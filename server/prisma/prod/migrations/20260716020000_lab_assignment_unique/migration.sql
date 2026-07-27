-- One assignment row per (lab, course): dedupe keeping the newest, then enforce.
DELETE FROM "lab_assignments" a
USING "lab_assignments" b
WHERE a."lab_id" = b."lab_id"
  AND a."course_id" = b."course_id"
  AND a."id" < b."id";

CREATE UNIQUE INDEX "lab_assignments_lab_id_course_id_key"
  ON "lab_assignments"("lab_id", "course_id");
