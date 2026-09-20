-- Every object must carry the plugin's table prefix; the migration runner
-- refuses anything else. api.db.table('reflections') returns this name.
CREATE TABLE plug_org_laila_reflection_cd8e4a_reflections (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  course_id    INTEGER,
  instance_key TEXT NOT NULL,
  word_count   INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX plug_org_laila_reflection_cd8e4a_reflections_course
  ON plug_org_laila_reflection_cd8e4a_reflections (course_id);
