/**
 * Plugin-owned SQL: table naming, dialect detection, and the migration runner.
 *
 * ## Why plugins get real tables
 *
 * The JSON key-value store in `store.ts` covers most plugins, but a plugin
 * that needs to *query* — "every answer scoring below 0.5 in this course" —
 * cannot do it over a JSON blob without loading the world into memory. So a
 * plugin may ship SQL migrations and own real tables.
 *
 * ## Why the SQL is per-dialect
 *
 * LAILA runs PostgreSQL in production and SQLite in local dev (see the dual
 * schema under `prisma/`). Prisma's own schema is generated for both by a
 * provider swap, but a plugin's raw DDL cannot be: `SERIAL`, `JSONB`,
 * `TIMESTAMP(3)` and `AUTOINCREMENT` have no common spelling. A plugin
 * therefore ships `001_init.postgres.sql` and `001_init.sqlite.sql`, or a
 * single `001_init.sql` when the DDL happens to be portable.
 *
 * ## The table-prefix rule
 *
 * Every object a plugin creates must start with its prefix. This is a
 * **guardrail, not a wall**: a plugin's server half is trusted in-process code
 * and could reach Prisma directly if it wanted to. What the rule buys is that
 * an *honest mistake* — a migration that says `DROP TABLE users` because it
 * was copied from somewhere — is refused at install rather than discovered
 * from a backup. See `docs/PLUGINS.md` on the security model.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import prisma from '../utils/prisma.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('plugins:db');

export type SqlDialect = 'postgres' | 'sqlite';

/**
 * Which database is behind Prisma right now.
 *
 * Read from `DATABASE_URL` rather than cached at module load: `index.ts` calls
 * `dotenv.config()` *after* its hoisted imports, so anything this module
 * computed at import time would see an undefined URL in local dev and quietly
 * pick the wrong dialect. (That ordering trap is documented in CLAUDE.md.)
 */
export function dialect(): SqlDialect {
  const url = process.env.DATABASE_URL ?? '';
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'postgres';
  if (url.startsWith('file:') || url.startsWith('sqlite:')) return 'sqlite';
  // An unset URL in a test run is SQLite in practice; anything else is a
  // configuration we do not know how to write DDL for, and guessing would
  // produce migrations that half-apply.
  if (!url) return 'sqlite';
  throw new Error(`Cannot determine SQL dialect from DATABASE_URL: ${url.split(':')[0]}:…`);
}

/**
 * PostgreSQL truncates identifiers at 63 bytes, and a truncated name silently
 * collides with another truncated name. The prefix is therefore **bounded at
 * 33 characters** however long the plugin id is (a short id simply yields a
 * shorter prefix): a readable slice of the id, for a human reading `\dt`, plus
 * a hash of the *full* id so two plugins sharing their first 20 characters
 * still get distinct tables.
 *
 * 33 + {@link MAX_PLUGIN_TABLE_NAME} = 63, exactly the limit.
 */
const PREFIX_ID_CHARS = 20;
const PREFIX_HASH_CHARS = 6;
export const MAX_PLUGIN_TABLE_NAME = 30;

export function tablePrefix(pluginId: string): string {
  const slug = pluginId.replace(/[^a-z0-9]+/gi, '_').toLowerCase().slice(0, PREFIX_ID_CHARS);
  const hash = crypto.createHash('sha256').update(pluginId).digest('hex').slice(0, PREFIX_HASH_CHARS);
  return `plug_${slug}_${hash}_`;
}

/**
 * The real table name for a plugin's logical table.
 *
 * @throws {Error} when the logical name is empty, not an identifier, or long
 *   enough to push the full name past PostgreSQL's limit.
 */
export function tableName(pluginId: string, logical: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(logical)) {
    throw new Error(`Plugin table name must be lowercase snake_case: "${logical}"`);
  }
  if (logical.length > MAX_PLUGIN_TABLE_NAME) {
    throw new Error(
      `Plugin table name "${logical}" exceeds ${MAX_PLUGIN_TABLE_NAME} characters`,
    );
  }
  return `${tablePrefix(pluginId)}${logical}`;
}

/**
 * Strip comments and string literals so the guard below reads the statement's
 * structure rather than its contents. Without this, a plugin inserting the
 * literal `'DROP TABLE users'` as seed data would trip its own migration.
 */
function stripNoise(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, (m) => m) // keep quoted identifiers: they ARE names
    .replace(/\s+/g, ' ');
}

/**
 * Every place a statement can NAME an object whose prefix we must check.
 *
 * Originally this covered only `CREATE|ALTER|DROP` of a table-like object, and
 * `assertPrefixed` passes anything it does not match. That left the guard wide
 * open to the cases that matter most for isolation: `SELECT … FROM users`,
 * `DELETE FROM users`, `TRUNCATE TABLE users` and `CREATE TEMPORARY TABLE x AS
 * SELECT * FROM users` all sailed through, even though `hostApi` applies this
 * function to `api.db.query()`/`execute()` precisely to stop a plugin reaching
 * into host tables. Only `DROP TABLE users` was ever caught.
 *
 * Two regexes now, both anchored on a keyword that is always followed by an
 * object name. The second covers DML and is the reason a plugin can no longer
 * read or empty a table it does not own.
 */
const DDL_RE =
  /\b(?:CREATE|ALTER|DROP)\s+(?:OR\s+REPLACE\s+)?(?:GLOBAL\s+|LOCAL\s+)?(?:TEMP|TEMPORARY|UNLOGGED|MATERIALIZED|UNIQUE)?\s*(?:TABLE|INDEX|VIEW|TRIGGER|SEQUENCE)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?("?[A-Za-z0-9_.]+"?)/gi;

/** Table references in data statements: the read/write surface. */
const DML_RE =
  /\b(?:FROM|JOIN|INTO|UPDATE|TRUNCATE(?:\s+TABLE)?)\s+(?:ONLY\s+)?("?[A-Za-z0-9_.]+"?)/gi;

/** Names bound by a CTE are not tables; `FROM cte` must not be refused. */
const CTE_RE = /\b(?:WITH|,)\s+(?:RECURSIVE\s+)?("?[A-Za-z0-9_]+"?)\s+AS\s*\(/gi;

export class PluginSqlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginSqlError';
  }
}

/**
 * Verify every object a migration touches lives under the plugin's prefix.
 *
 * @returns the object names found, for logging
 * @throws {PluginSqlError} naming the first offending object
 */
export function assertPrefixed(pluginId: string, sql: string): string[] {
  const prefix = tablePrefix(pluginId);
  const cleaned = stripNoise(sql);
  const found: string[] = [];

  // Bound by the statement itself, so not host tables.
  const cteNames = new Set<string>();
  for (const m of cleaned.matchAll(CTE_RE)) {
    cteNames.add(m[1].replace(/"/g, '').toLowerCase());
  }

  const check = (raw: string, verb: 'name' | 'touch') => {
    // A schema-qualified name is a way around the prefix, so it is refused
    // outright rather than checked on its last segment.
    if (raw.includes('.')) {
      throw new PluginSqlError(
        `Plugin "${pluginId}" may not use a schema-qualified name: "${raw}"`,
      );
    }
    const lower = raw.toLowerCase();
    if (cteNames.has(lower)) return;
    if (!lower.startsWith(prefix)) {
      throw new PluginSqlError(
        verb === 'name'
          ? `Plugin "${pluginId}" may only create objects prefixed "${prefix}" — found "${raw}"`
          : `Plugin "${pluginId}" may only read or write tables prefixed "${prefix}" — found "${raw}"`,
      );
    }
    found.push(raw);
  };

  for (const m of cleaned.matchAll(DDL_RE)) check(m[1].replace(/"/g, ''), 'name');

  for (const m of cleaned.matchAll(DML_RE)) {
    const raw = m[1].replace(/"/g, '');
    // `FROM (SELECT …)` and `FROM SELECT` name no table. The paren case never
    // reaches here (the regex needs a word), but a bare keyword can.
    if (SQL_NON_TABLE_WORDS.has(raw.toLowerCase())) continue;
    check(raw, 'touch');
  }

  return found;
}

/**
 * Words that can follow FROM/JOIN/INTO and are not table names.
 *
 * Kept deliberately small. Anything not listed here is treated as a table and
 * must carry the prefix — an unknown construct is refused rather than allowed,
 * because the cost of a false refusal is a plugin author rewriting a query, and
 * the cost of a false pass is a plugin reading the users table.
 */
const SQL_NON_TABLE_WORDS = new Set(['select', 'lateral', 'unnest', 'values', 'generate_series']);

export interface PluginMigrationFile {
  /** Filename without dialect suffix or extension, e.g. "001_init". */
  name: string;
  /** Absolute path of the file chosen for this dialect. */
  file: string;
  sql: string;
  checksum: string;
}

/**
 * Read a plugin's migration directory and return the files for `dia`, sorted
 * by name so ordering is the author's to control (`001_`, `002_`, …).
 *
 * A name that has a file for another dialect but not this one is an error, not
 * a skip: silently not creating a table in dev is how a plugin "works locally"
 * and explodes in production.
 */
export async function readMigrations(
  dir: string,
  dia: SqlDialect = dialect(),
): Promise<PluginMigrationFile[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }

  const byName = new Map<string, { generic?: string; dialects: Set<string> }>();
  for (const entry of entries) {
    const m = /^(.+?)(?:\.(postgres|sqlite))?\.sql$/i.exec(entry);
    if (!m) continue;
    const [, name, d] = m;
    const rec = byName.get(name) ?? { dialects: new Set<string>() };
    if (d) rec.dialects.add(d.toLowerCase());
    else rec.generic = entry;
    byName.set(name, rec);
  }

  const names = [...byName.keys()].sort();
  const out: PluginMigrationFile[] = [];
  for (const name of names) {
    const rec = byName.get(name)!;
    const chosen = rec.dialects.has(dia) ? `${name}.${dia}.sql` : rec.generic;
    if (!chosen) {
      throw new PluginSqlError(
        `Migration "${name}" has no ${dia} variant (found: ${[...rec.dialects].join(', ') || 'none'})`,
      );
    }
    const file = path.join(dir, chosen);
    const sql = await fs.readFile(file, 'utf8');
    out.push({
      name,
      file,
      sql,
      checksum: crypto.createHash('sha256').update(sql).digest('hex'),
    });
  }
  return out;
}

/**
 * Split a migration into statements on semicolons that are not inside a string
 * literal or a dollar-quoted block. Prisma's raw execute takes one statement at
 * a time, and a naive `sql.split(';')` breaks any migration containing a
 * semicolon in a default value or a PL/pgSQL body.
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let lineComment = false;
  let blockComment = false;
  let dollarTag: string | null = null;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      buf += ch;
      i++;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        buf += '*/';
        i += 2;
        continue;
      }
      buf += ch;
      i++;
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += ch;
      i++;
      continue;
    }
    if (inSingle) {
      buf += ch;
      i++;
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      buf += ch;
      i++;
      if (ch === '"') inDouble = false;
      continue;
    }

    if (ch === '-' && next === '-') {
      lineComment = true;
      buf += '--';
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      buf += '/*';
      i += 2;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      buf += ch;
      i++;
      continue;
    }
    if (ch === '$') {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (tag) {
        dollarTag = tag[0];
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (ch === ';') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Apply a plugin's pending migrations.
 *
 * Each migration runs inside a transaction together with the row recording it,
 * so a migration that fails halfway is not remembered as applied. An already
 * applied migration whose checksum changed is an error: editing shipped history
 * leaves every instance on a different schema with no way to tell.
 *
 * @param pluginId the plugin whose migrations to run
 * @param dir absolute path to its migrations directory
 * @returns which migrations ran and which were already recorded
 * @throws {PluginSqlError} on an unprefixed object, a missing dialect variant,
 *   or a changed checksum
 */
export async function runMigrations(pluginId: string, dir: string): Promise<MigrationResult> {
  const files = await readMigrations(dir);
  if (!files.length) return { applied: [], skipped: [] };

  const done = await prisma.pluginMigration.findMany({ where: { pluginId } });
  const byName = new Map(done.map((d) => [d.name, d]));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const mig of files) {
    const existing = byName.get(mig.name);
    if (existing) {
      if (existing.checksum !== mig.checksum) {
        throw new PluginSqlError(
          `Migration "${mig.name}" of plugin "${pluginId}" changed after it was applied. ` +
            `Ship a new migration instead of editing a released one.`,
        );
      }
      skipped.push(mig.name);
      continue;
    }

    const objects = assertPrefixed(pluginId, mig.sql);
    const statements = splitStatements(mig.sql);

    await prisma.$transaction(async (tx) => {
      for (const stmt of statements) {
        await tx.$executeRawUnsafe(stmt);
      }
      await tx.pluginMigration.create({
        data: { pluginId, name: mig.name, checksum: mig.checksum },
      });
    });

    log.info({ plugin: pluginId, migration: mig.name, objects }, 'plugin migration applied');
    applied.push(mig.name);
  }

  return { applied, skipped };
}

/**
 * Drop every table a plugin owns. Called on uninstall **only** when the admin
 * asked for its data to go too — the default keeps the tables, because
 * uninstalling to upgrade is far more common than uninstalling to forget, and
 * dropping by default makes that mistake unrecoverable.
 */
export async function dropPluginTables(pluginId: string): Promise<string[]> {
  const prefix = tablePrefix(pluginId);
  const dia = dialect();
  const rows =
    dia === 'postgres'
      ? await prisma.$queryRawUnsafe<{ name: string }[]>(
          `SELECT tablename AS name FROM pg_tables WHERE schemaname = current_schema() AND tablename LIKE $1`,
          `${prefix}%`,
        )
      : await prisma.$queryRawUnsafe<{ name: string }[]>(
          `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ?`,
          `${prefix}%`,
        );

  const dropped: string[] = [];
  for (const { name } of rows) {
    // Re-check rather than trusting the LIKE: this builds a DROP statement.
    if (!name.startsWith(prefix)) continue;
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${name}"`);
    dropped.push(name);
  }
  await prisma.pluginMigration.deleteMany({ where: { pluginId } });
  log.warn({ plugin: pluginId, dropped }, 'plugin tables dropped');
  return dropped;
}
