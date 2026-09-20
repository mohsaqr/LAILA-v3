import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  dialect,
  tablePrefix,
  tableName,
  assertPrefixed,
  splitStatements,
  readMigrations,
  PluginSqlError,
  MAX_PLUGIN_TABLE_NAME,
} from './db.js';

vi.mock('../utils/logger.js', () => {
  const noop = () => {};
  return { createLogger: () => ({ error: noop, warn: noop, info: noop, debug: noop }) };
});
vi.mock('../utils/prisma.js', () => ({ default: {} }));

const PID = 'org.example.drag-match';

describe('dialect', () => {
  const original = process.env.DATABASE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });

  it('reads postgres and sqlite URLs', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@h/db';
    expect(dialect()).toBe('postgres');
    process.env.DATABASE_URL = 'postgres://u:p@h/db';
    expect(dialect()).toBe('postgres');
    process.env.DATABASE_URL = 'file:./dev.db';
    expect(dialect()).toBe('sqlite');
  });

  it('defaults to sqlite when unset', () => {
    delete process.env.DATABASE_URL;
    expect(dialect()).toBe('sqlite');
  });

  it('throws on a database it cannot write DDL for', () => {
    process.env.DATABASE_URL = 'mysql://u:p@h/db';
    expect(() => dialect()).toThrow(/Cannot determine SQL dialect/);
  });

  // The env is read per call, not at import: index.ts runs dotenv.config()
  // after its hoisted imports, so a cached value would be wrong in dev.
  it('is read fresh on every call', () => {
    process.env.DATABASE_URL = 'file:./dev.db';
    expect(dialect()).toBe('sqlite');
    process.env.DATABASE_URL = 'postgresql://u:p@h/db';
    expect(dialect()).toBe('postgres');
  });
});

describe('tablePrefix', () => {
  it('is deterministic and bounded at 33 characters however long the id', () => {
    const short = tablePrefix('a.b');
    const long = tablePrefix('org.example.a-very-long-plugin-identifier-indeed.module');
    expect(short).toBe(tablePrefix('a.b')); // deterministic
    expect(long.length).toBe(33); // the bound, hit by any id >= 20 chars
    expect(short.length).toBeLessThanOrEqual(33);
    expect(short).toMatch(/^plug_a_b_[0-9a-f]{6}_$/);
  });

  it('separates ids that share their first 20 characters', () => {
    const a = tablePrefix('org.example.plugin-aaaa.one');
    const b = tablePrefix('org.example.plugin-aaaa.two');
    expect(a.slice(0, 26)).toBe(b.slice(0, 26)); // same readable slice
    expect(a).not.toBe(b); // different hash
  });

  it('keeps a full table name inside PostgreSQL 63-byte identifier limit', () => {
    const longest = tableName('org.example.a-very-long-plugin-identifier', 'x'.repeat(MAX_PLUGIN_TABLE_NAME));
    expect(longest.length).toBeLessThanOrEqual(63);
  });
});

describe('tableName', () => {
  it('prefixes a valid logical name', () => {
    expect(tableName(PID, 'answers')).toBe(`${tablePrefix(PID)}answers`);
  });

  it('rejects names that are not lowercase snake_case', () => {
    expect(() => tableName(PID, 'Answers')).toThrow(/snake_case/);
    expect(() => tableName(PID, 'my-answers')).toThrow(/snake_case/);
    expect(() => tableName(PID, '1answers')).toThrow(/snake_case/);
    expect(() => tableName(PID, '')).toThrow(/snake_case/);
  });

  it('rejects a name that would overflow the identifier limit', () => {
    expect(() => tableName(PID, 'a'.repeat(MAX_PLUGIN_TABLE_NAME + 1))).toThrow(/exceeds/);
  });
});

describe('assertPrefixed', () => {
  const p = tablePrefix(PID);

  it('allows objects under the plugin prefix', () => {
    const found = assertPrefixed(
      PID,
      `CREATE TABLE ${p}answers (id SERIAL PRIMARY KEY, body TEXT);
       CREATE INDEX ${p}answers_idx ON ${p}answers (id);
       ALTER TABLE ${p}answers ADD COLUMN score REAL;`,
    );
    expect(found).toHaveLength(3);
  });

  it('handles IF NOT EXISTS, UNIQUE and quoted identifiers', () => {
    expect(() =>
      assertPrefixed(
        PID,
        `CREATE TABLE IF NOT EXISTS "${p}answers" (id INT);
         CREATE UNIQUE INDEX IF NOT EXISTS ${p}answers_u ON ${p}answers (id);
         DROP TABLE IF EXISTS ${p}old;`,
      ),
    ).not.toThrow();
  });

  // The whole point of the guard.
  it('refuses to touch a host table', () => {
    expect(() => assertPrefixed(PID, 'DROP TABLE users;')).toThrow(PluginSqlError);
    expect(() => assertPrefixed(PID, 'ALTER TABLE courses ADD COLUMN x INT;')).toThrow(
      /may only create objects prefixed/,
    );
    expect(() => assertPrefixed(PID, 'CREATE TABLE plugins_shadow (id INT);')).toThrow(
      PluginSqlError,
    );
  });

  it('refuses a schema-qualified name that would sidestep the prefix', () => {
    expect(() => assertPrefixed(PID, `CREATE TABLE public.${p}answers (id INT);`)).toThrow(
      /schema-qualified/,
    );
  });

  it('refuses another plugin\'s prefix', () => {
    const other = tablePrefix('org.other.plugin');
    expect(() => assertPrefixed(PID, `DROP TABLE ${other}secrets;`)).toThrow(PluginSqlError);
  });

  // A migration seeding the literal text 'DROP TABLE users' is data, not DDL.
  it('ignores DDL-looking text inside string literals and comments', () => {
    expect(() =>
      assertPrefixed(
        PID,
        `-- DROP TABLE users
         /* ALTER TABLE courses */
         INSERT INTO ${p}notes (body) VALUES ('DROP TABLE users');`,
      ),
    ).not.toThrow();
  });

  it('allows plain DML with no object names to check', () => {
    expect(assertPrefixed(PID, `UPDATE ${p}answers SET score = 1;`)).toEqual([]);
  });
});

describe('splitStatements', () => {
  it('splits on top-level semicolons', () => {
    expect(splitStatements('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('ignores a trailing semicolon and blank statements', () => {
    expect(splitStatements('SELECT 1;;  ;')).toEqual(['SELECT 1']);
  });

  it('keeps semicolons inside string literals', () => {
    const out = splitStatements(`INSERT INTO t (a) VALUES ('x;y'); SELECT 2;`);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("'x;y'");
  });

  it('handles doubled quotes inside a literal', () => {
    const out = splitStatements(`INSERT INTO t (a) VALUES ('it''s; fine'); SELECT 2;`);
    expect(out).toHaveLength(2);
  });

  it('keeps semicolons inside a dollar-quoted body', () => {
    const out = splitStatements(
      `CREATE FUNCTION f() RETURNS void AS $$ BEGIN RAISE NOTICE 'a;b'; END; $$ LANGUAGE plpgsql; SELECT 1;`,
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('plpgsql');
  });

  it('keeps semicolons inside comments', () => {
    const out = splitStatements(`-- a; b\nSELECT 1; /* c; d */ SELECT 2;`);
    expect(out).toHaveLength(2);
  });

  it('keeps semicolons inside quoted identifiers', () => {
    const out = splitStatements(`CREATE TABLE "weird;name" (id INT); SELECT 1;`);
    expect(out).toHaveLength(2);
  });
});

describe('readMigrations', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'laila-plug-mig-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const write = (name: string, sql: string) => fs.writeFile(path.join(dir, name), sql);

  it('returns an empty list for a missing directory', async () => {
    expect(await readMigrations(path.join(dir, 'nope'))).toEqual([]);
  });

  it('picks the dialect variant when present', async () => {
    await write('001_init.postgres.sql', 'CREATE TABLE a (id SERIAL);');
    await write('001_init.sqlite.sql', 'CREATE TABLE a (id INTEGER);');
    const pg = await readMigrations(dir, 'postgres');
    expect(pg).toHaveLength(1);
    expect(pg[0].name).toBe('001_init');
    expect(pg[0].sql).toContain('SERIAL');
    const lite = await readMigrations(dir, 'sqlite');
    expect(lite[0].sql).toContain('INTEGER');
  });

  it('falls back to a dialect-free file', async () => {
    await write('001_init.sql', 'CREATE TABLE a (id INT);');
    expect((await readMigrations(dir, 'postgres'))[0].sql).toContain('INT');
    expect((await readMigrations(dir, 'sqlite'))[0].sql).toContain('INT');
  });

  // Skipping would mean "works on my machine, missing table in production".
  it('throws when one dialect is provided and the other is not', async () => {
    await write('001_init.postgres.sql', 'CREATE TABLE a (id SERIAL);');
    await expect(readMigrations(dir, 'sqlite')).rejects.toThrow(/no sqlite variant/);
  });

  it('sorts by name so the author controls ordering', async () => {
    await write('002_second.sql', 'SELECT 2;');
    await write('010_tenth.sql', 'SELECT 10;');
    await write('001_first.sql', 'SELECT 1;');
    expect((await readMigrations(dir, 'sqlite')).map((m) => m.name)).toEqual([
      '001_first',
      '002_second',
      '010_tenth',
    ]);
  });

  it('ignores non-SQL files', async () => {
    await write('README.md', '# notes');
    await write('001_init.sql', 'SELECT 1;');
    expect(await readMigrations(dir, 'sqlite')).toHaveLength(1);
  });

  it('checksums the exact bytes that will run', async () => {
    await write('001_init.sql', 'SELECT 1;');
    const first = (await readMigrations(dir, 'sqlite'))[0];
    await write('001_init.sql', 'SELECT 2;');
    const second = (await readMigrations(dir, 'sqlite'))[0];
    expect(first.checksum).not.toBe(second.checksum);
    expect(first.checksum).toMatch(/^[0-9a-f]{64}$/);
  });
});
