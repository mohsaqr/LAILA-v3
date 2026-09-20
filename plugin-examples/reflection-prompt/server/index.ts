/**
 * Reflection Prompt — server half.
 *
 * Exercises every part of the host API a real plugin is likely to touch: its
 * own SQL table, an HTTP route, a lifecycle hook, an LLM call and an activity
 * log entry. Written as the reference an author copies from.
 *
 * Built to `server/index.cjs` by the SDK, because the LAILA server compiles to
 * CommonJS.
 */

/**
 * `PluginHostApi` is the type the host passes in. It is imported for types
 * only — nothing from LAILA is bundled into the plugin.
 */
import type { PluginHostApi } from '../../../server/src/plugins/hostApi.js';

interface ReflectionRow {
  id: number;
  user_id: number;
  course_id: number | null;
  instance_key: string;
  word_count: number;
}

/** Called once when the plugin loads. */
export function register(api: PluginHostApi): void {
  const reflections = api.db.table('reflections');

  // --- HTTP: mounted at /api/plugins/org.laila.reflection-prompt/api -------
  const router = api.router();

  /**
   * A teacher's overview of one block: how many have answered and how long
   * their answers were. Reads the plugin's own table, so it stays fast as the
   * cohort grows — the thing the JSON store could not do.
   */
  router.get('/summary', async (req, res) => {
    const instanceKey = String(req.query.instanceKey ?? '');
    if (!/^section:\d+$/.test(instanceKey)) {
      res.status(400).json({ error: 'instanceKey must look like "section:123"' });
      return;
    }
    const placeholder = api.db.dialect === 'postgres' ? '$1' : '?';
    const rows = await api.db.query<ReflectionRow>(
      `SELECT user_id, word_count FROM ${reflections} WHERE instance_key = ${placeholder}`,
      instanceKey,
    );
    const counts = rows.map((r) => r.word_count);
    res.json({
      responses: rows.length,
      averageWords: counts.length
        ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
        : 0,
    });
  });

  /**
   * Record a submission, and optionally ask for an AI follow-up question.
   *
   * The student's identity comes from the host's own auth middleware, which
   * has already run by the time a plugin route is reached — a plugin never
   * has to (and never should) trust a userId from the body.
   */
  router.post('/submit', async (req, res) => {
    const { instanceKey, text, courseId, aiFollowUp } = req.body ?? {};
    const userId = (req as { user?: { id: number } }).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const wordCount = text.trim().split(/\s+/).length;
    const p = api.db.dialect === 'postgres';
    await api.db.execute(
      `INSERT INTO ${reflections} (user_id, course_id, instance_key, word_count)
       VALUES (${p ? '$1, $2, $3, $4' : '?, ?, ?, ?'})`,
      userId,
      courseId ?? null,
      instanceKey,
      wordCount,
    );

    await api.logActivity({
      userId,
      verb: 'submitted',
      objectType: 'section',
      courseId: courseId ?? undefined,
      metadata: { wordCount },
    });

    let followUp: string | null = null;
    if (aiFollowUp) {
      try {
        const answer = await api.llm({
          messages: [
            {
              role: 'system',
              content:
                'You are a tutor. Read the student reflection and reply with ONE short, open follow-up question. No preamble.',
            },
            { role: 'user', content: text },
          ],
          maxTokens: 80,
        });
        followUp = answer.content.trim() || null;
      } catch (err) {
        // A provider outage must not lose the student's reflection — it is
        // already saved above. Degrade to no follow-up and say so in the log.
        api.log.warn({ err: String(err) }, 'AI follow-up unavailable');
      }
    }

    res.json({ ok: true, wordCount, followUp });
  });

  // --- Hooks ---------------------------------------------------------------

  /**
   * Clean up when a course goes. The `plugin_data` rows cascade with the
   * course, but this plugin's own table has no foreign key — LAILA cannot know
   * about a table it did not create, so the plugin owns its own cleanup.
   */
  api.on('course.deleted', async ({ courseId }) => {
    const p = api.db.dialect === 'postgres';
    const removed = await api.db.execute(
      `DELETE FROM ${reflections} WHERE course_id = ${p ? '$1' : '?'}`,
      courseId,
    );
    api.log.info({ courseId, removed }, 'reflections removed with course');
  });

  /**
   * Contribute to a course export when the `plugins` section is selected.
   * Returning the value unchanged when not selected is what makes the
   * selection meaningful rather than advisory.
   */
  api.filter('course.export.data', async (data, ctx) => {
    if (!ctx.sections.includes('plugins')) return data;
    const p = api.db.dialect === 'postgres';
    const rows = await api.db.query<ReflectionRow>(
      `SELECT user_id, instance_key, word_count FROM ${reflections} WHERE course_id = ${p ? '$1' : '?'}`,
      ctx.courseId,
    );
    return { ...data, 'org.laila.reflection-prompt': { reflections: rows } };
  });

  api.log.info({ table: reflections }, 'reflection-prompt registered');
}

/** Called when the plugin is disabled. */
export function deactivate(): void {
  // Nothing to release: the host clears hooks, jobs and the router itself.
  // A plugin holding a socket, a file handle or an external subscription would
  // close it here.
}
