# Moodle `.mbz` import — research notes (2026-09-04, not yet implemented)

Plan: read an `.mbz`, emit a `CoursePackage` (`server/src/services/coursePackage.schema.ts`)
and hand it to `courseImportService.importPackage`, so id mapping, file
rewriting and validation live in one place. Facts below were verified against
the Moodle source at tag `MOODLE_405_STABLE` (4.5) and diffed against `main`
(5.x, where everything moved under `public/`); no element-name differences for
the modules listed.

## Container
- **Gzipped tar since Moodle 2.9**; plain zip before (and some sites still).
  Sniff magic bytes: `1F 8B` gzip vs `50 4B 03 04` zip. Tar entries can exceed
  100 chars (PAX long names) — use a tar library that handles them.
- Nothing on npm or PyPI parses MBZ (checked: `mbz`, `moodle-backup`,
  `common-cartridge`, `imscc`, `moodlexport` — none do). Server has
  `tar-stream` and `unzipper` hoisted; an XML parser would be a new dep.
- Reference implementations on GitHub: `cloudpedagogy/cloudpedagogy-moodle-course-auditor`
  (Python, most complete), `wheelerda/extract-mbz`, `IET-OU/moodle-backup-parser` (PHP).
  Sample corpus: `saylordotorg/course_backups`.

## Layout
```
moodle_backup.xml            information (moodle_version, backup_version, original_course_*),
                             contents/activities (moduleid, sectionid, modulename, title, directory),
                             contents/sections (sectionid, title, directory), settings
course/course.xml            shortname, fullname, summary(+format), startdate, enddate, ...
sections/section_<id>/section.xml   number, name, summary, sequence (comma-separated cmids = ORDER), visible
activities/<modname>_<cmid>/module.xml   modulename, sectionid, visible, indent, availability
activities/<modname>_<cmid>/<modname>.xml   the activity
files.xml                    <file> contenthash, contextid, component, filearea, itemid, filepath, filename, mimetype, filesize
files/<hash[0:2]>/<sha1>     blobs, no extension; filename="." rows are directories
questions.xml                question bank (see below)
users.xml                    only when users=1 — ignore
```
Section 0 ("General") always exists. Moodle ≥4.5 has subsections: `activity.insubsection`,
`section.parentcmid`, `modname=subsection` → treat `mod_subsection` as a container (→ child module).

## Text
- All text is entity-escaped (never CDATA): decode once after XML parsing.
- `*format` columns: 0 MOODLE, 1 HTML, 2 PLAIN, 4 MARKDOWN.
- Embedded files: `@@PLUGINFILE@@/<filepath><filename>` → match the `files.xml`
  row with the same component/filearea(/itemid) → blob → `/uploads/` URL.
- Link tokens `$@COURSEVIEWBYID*1*@$`, `$@H5PEMBED@$` etc. — strip or drop.

## Activity → LAILA mapping
| Moodle | key fields | LAILA |
|---|---|---|
| section | name, summary, sequence, visible | `CourseModule` (order from `sequence`) |
| page | name, intro, content(+format) | `Lecture` + text `LectureSection` |
| label | intro (is the content) | text section (or lecture description) |
| book | chapters: pagenum, subchapter, title, content | `Lecture` with one section per chapter |
| resource | files.xml `mod_resource/content`, sortorder=1 = main | file section (`fileUrl`, `fileName`, `fileType`, `fileSize`) |
| folder | files `mod_folder/content`, `filepath` for subfolders | `<lecture-folder data-files=…>` |
| url | externalurl, name, intro | `<lecture-url data-url data-title>` |
| quiz | name, intro, timelimit, attempts_number, grade, shuffleanswers; `question_instances` | `Quiz` + `QuizQuestion` |
| assign | name, intro, duedate, cutoffdate, allowsubmissionsfromdate, grade, `plugin_configs` (onlinetext/file enabled) | `Assignment` (dueDate, gracePeriodDeadline, availableFrom, points, submissionType) |
| forum | type, name, intro; `discussions/posts` (first post by teacher) | `ForumThread` (settings + opening post) |
| lesson, wiki, glossary, h5pactivity, scorm, choice, feedback, lti | — | skip, list in report (h5p/scorm package could become a file section) |

Timestamps are Unix seconds; `0` means unset.

## Question bank (`questions.xml`)
- **≥4.0**: `question_categories → question_bank_entries → question_versions → questions`;
  quiz slot has `question_reference { questionbankentryid, version }` (version NULL = latest
  `status=ready`); random slots are `question_set_reference` with JSON `filtercondition` (skip).
- **<4.0**: `question_category → questions → question` directly; `question_instance.questionid`.
- Question: `name, questiontext(+format), generalfeedback, defaultmark, qtype` and a
  `plugin_qtype_<qtype>_question` block; multichoice: `answers/answer {answertext, fraction, feedback}`
  + `multichoice {single, shuffleanswers}`.
- LAILA `QuizQuestion.questionType` ∈ `multiple_choice | true_false | short_answer | fill_in_blank`
  (`quiz.routes.ts` Zod); `options` is a JSON-string array, `correctAnswer` a string.
  Map multichoice(single)→multiple_choice, truefalse→true_false, shortanswer→short_answer;
  essay/matching/numeric/cloze → skip with report line.

## Alternatives
- Moodle also exports **IMS Common Cartridge 1.1** (`.imscc`; not 1.2/1.3): `imsmanifest.xml`,
  webcontent, QTI 1.2 assessments (`cc.multiple_choice.v0p1`, `cc.true_false.v0p1`,
  `cc.fib.v0p1`, `cc.essay.v0p1`), discussion topics, weblinks. Covers fewer activities than MBZ.
