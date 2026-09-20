# Course packages: export, import, duplicate

LAILA can save a course's **design** as a single file, load that file as a new
course on any LAILA instance, and copy a course inside one instance. The file
is a `.laila.zip` package. Students, submissions, grades, chat history, logs and
secrets are never part of it.

| Action | Where | What you get |
|---|---|---|
| Export | Teaching → course card menu → **Export course** | `<course-slug>.laila.zip` downloads |
| Import | Teaching → **Import course** (top right) | a new **draft** course owned by you |
| Duplicate | Teaching → course card menu → **Duplicate course** | a new draft course titled "… (copy)" |

Export needs edit rights on the course (owner, co-instructor, course admin, or
global admin). Import and duplicate need the instructor role.

## Choosing what travels

An export carries the **sections you select**. Omitting the selection keeps the
historical behaviour exactly — design only, no student data — so every existing
link, script and bookmark is unaffected.

```
GET /api/courses/:id/export                      design only (the default)
GET /api/courses/:id/export?include=all          everything
GET /api/courses/:id/export?include=design,grades
GET /api/courses/export/sections                 what this instance offers
```

| Section | Carries |
|---|---|
| `design` | Course settings, modules, lectures, sections. **Always included.** |
| `assessments` | Assignments, quizzes, surveys, rubrics |
| `labs` | Code labs, custom labs and their cells |
| `tutors` | Course tutors and the chatbots behind them |
| `forums` | Forum settings and staff-opened threads |
| `files` | Every upload the above refers to |
| `plugins` | Installed plugins' per-course config and block data |
| **`enrollments`** | Who is enrolled, with role and date |
| **`submissions`** | Assignment submissions and their attachments |
| **`grades`** | Grades, quiz attempts, survey responses |
| **`progress`** | Per-student lecture and module completion |
| **`discussions`** | Student-opened threads and every reply |
| **`conversations`** | Tutor and chatbot transcripts |
| **`activity`** | The learning activity log for this course |

The **bold** sections disclose data belonging to someone other than the
exporter. They are opt-in, and they require **course-owner or platform-admin**
rights — deliberately *not* merely edit rights, so a co-instructor or TA can
take the course design elsewhere without being able to walk off with every
student's submissions and transcripts.

Two conveniences the selection applies for you: `design` is always added (a
package of submissions with no idea what they were submitted to is unusable),
and selecting `submissions` or `discussions` pulls in `files`, because
otherwise their attachments would import as a wall of broken links.

The manifest records the selection, so an importer can state what it is about to
add, and an admin can tell whether an old archive holds personal data without
unpacking it. Packages written before selections existed validate unchanged;
an absent `selection` means design-only, which is exactly what they hold.

## What travels

With the default (design-only) selection, everything an instructor authored:

- course settings (title, description, thumbnail, difficulty, visibility,
  tutor routing, labs enabled, view mode, start time), categories
- modules and sub-modules, lectures, sections (text/TipTap HTML, files,
  folders, videos, embeds, URLs, inline MCQs, inline chatbots, assignment
  blocks), lecture attachments
- assignments with attachments and their post-surveys; rubrics
- quizzes with questions
- surveys attached to modules
- code labs with cells; custom labs with cells and their course link
- course tutors, including the chatbot definition each is built on
- forums: settings plus the opening post, **only for threads opened by course
  staff** (a student's thread is their data and stays behind)
- every uploaded file any of the above refers to

Not exported, by design: enrollments, submissions, grades, progress, chat and
tutor conversations, activity logs, announcements, course prerequisites
(they point at another course), the activation code (a signup sponsorship in a
global namespace), API keys and LLM provider rows. Slide images rendered from a
.pptx are a cache and are regenerated on first view after import.

## What happens on import with personal data

People are matched **by email**. A matched person's rows are written; an
unmatched person's rows are skipped and their address listed in the report, so
the importer can invite them and re-import. Nothing else about a matched user
changes — importing enrollments enrolls them, and that is the only side effect.

Two details worth knowing:

- **Anonymity survives.** A thread or survey response exported anonymously
  carries no person at all, so it cannot be de-anonymised by importing it. An
  anonymous thread is attributed to the course owner in the author column, with
  its anonymous flag intact — exactly how LAILA already stores one.
- **Threading survives.** Discussion posts are written parents-first and their
  `parentId` rewired to the new ids. A reply whose parent was skipped becomes
  top-level rather than being dropped: losing the nesting beats losing the post.

## What happens on import

- The importer becomes the course owner. The course is a **draft** with a new
  slug and no activation code, whatever the source was.
- **Files** are stored under fresh upload names (same folder, same extension,
  new UUID) and every reference is rewritten: file columns, lecture HTML
  attributes, folder JSON, lab configs.
- **Chatbots** behind course tutors are matched by their unique name. A match
  is reused as-is; a missing one is created from the definition in the package.
  A code lab or custom lab that names an AI helper which does not exist here is
  imported without one, and the report says so.
- **Surveys and custom labs** get a private copy owned by the importer, so
  editing them never changes another instructor's course.
- **Categories** are matched by title and created if missing.
- All rows are written in one transaction; a failure leaves no partial course
  and removes the staged files.

The response is a report: row counts per entity, chatbots matched/created,
files copied/missing, and warnings. The UI shows a toast and points at the
warnings; read them before publishing.

## The format

```
<slug>.laila.zip
├── manifest.json     format id, version, when/where exported
├── course.json       the design tree (see server/src/services/coursePackage.schema.ts)
└── files/<sha256>    one blob per referenced upload, named by content hash
```

`course.json` is validated with a Zod schema before any row is written, then
checked for dangling cross-references. Entities that other entities point at
carry a `key` (unique inside the package, meaningless outside it) and
references are `moduleKey`, `lectureKey`, `assignmentKey`, `surveyKey`,
`labKey`, `defaultTutorKey`. Dates are ISO-8601 strings. File URLs are left as
they were on the exporting instance; the `files` list maps each to its blob.

`manifest.json`:

```json
{
  "format": "laila-course",
  "formatVersion": 1,
  "exportedAt": "2026-09-04T18:28:08.169Z",
  "exporter": { "application": "LAILA", "version": "3.13.0" },
  "source": { "courseId": 4, "slug": "pedagogy-science-art-teaching", "title": "Pedagogy…" },
  "selection": ["design", "assessments", "labs", "tutors", "forums", "files", "plugins"]
}
```

A server refuses a package whose `formatVersion` is newer than it knows.
Additive changes keep the version; a breaking change bumps it and the importer
gains a migration step.

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/api/courses/export/sections` | – | the section catalogue this instance offers |
| `GET` | `/api/courses/:id/export?include=…` | – | `application/zip`; headers `X-Laila-Missing-Files` (referenced uploads no longer on disk), `X-Laila-Sections` (what was actually included) and `X-Laila-Warnings` (e.g. a capped activity log) |
| `POST` | `/api/courses/import` | multipart, field `package` (the zip), optional `title` | `201` import report |
| `POST` | `/api/courses/:id/duplicate` | optional JSON `{ "title" }` | `201` import report |

Uploads are capped at 512 MB and read into memory by the zip parser.

## Code map

| Concern | File |
|---|---|
| Schema, types, reference check | `server/src/services/coursePackage.schema.ts` |
| Export sections and the personal-data line | `server/src/services/coursePackage.selection.ts` |
| Personal-data serialisers (the roster, all 7 sections) | `server/src/services/coursePackage.personal.ts` |
| Export (graph → package → zip) | `server/src/services/courseExport.service.ts` |
| Import, duplicate | `server/src/services/courseImport.service.ts` |
| Upload URL helpers | `server/src/utils/uploadFiles.ts` |
| Routes | `server/src/routes/courseTransfer.routes.ts` (mounted before `course.routes.ts`) |
| Client API | `client/src/api/courseTransfer.ts` |
| UI | `client/src/pages/teach/TeachDashboard.tsx` |
| Test fixture | `server/src/services/coursePackage.fixtures.ts` |

## Known limits

- **An import never creates a user.** People travel as a roster keyed by email;
  the importer matches against existing accounts and skips rows belonging to
  anyone this instance does not know, reporting their addresses. Invite them,
  then re-import. (If a package could mint accounts, a crafted roster would be
  an account-creation primitive for anyone allowed to import.)
- An imported activity log drops `eventUuid`, because that column is unique per
  user and these rows are a copy, not the originals. The log is also capped at
  200,000 rows per package — the newest are kept and the shortfall is reported
  in `X-Laila-Warnings`.
- A full archive is still not a substitute for a database restore
  (`deploy/backup/laila-restore.sh`): it moves one course, not an instance.
- A plugin contributes to the `plugins` section through the
  `course.export.data` filter; a plugin that does not register one exports
  nothing of its own. See `docs/PLUGINS.md`.
- A tutor's chatbot is matched by name only. If the target instance has a
  different chatbot under the same name, the tutor is built on that one.
- Model names in chatbot definitions (`modelPreference`) travel verbatim; the
  target instance's LLM providers may not offer them.
- The exporter drops references it cannot honour (an assignment whose module
  was deleted, a default tutor that is not one of the course's tutors) rather
  than failing; such rows import unattached.
- Moodle `.mbz` import is not implemented. The plan is a converter from MBZ to
  this package so there is one import path.
