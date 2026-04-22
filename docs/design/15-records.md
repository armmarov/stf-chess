# Competition Records

## Purpose

The records module lets students and their teachers/admins log competition outcomes against a student's profile. It acts as a persistent showcase of competitive history — every authenticated user can read every record, regardless of role.

See `REQUIREMENTS.md` for the originating feature requirements.

## Data Model

```
CompetitionRecord {
  id              cuid (PK)
  studentId       String (FK → User "studentRecords", RESTRICT)
  createdById     String (FK → User "recordCreator", RESTRICT)
  competitionName varchar(200)
  competitionDate Date              -- stored as @db.Date; returned as YYYY-MM-DD string
  level           CompetitionLevel
  category        CompetitionCategory
  pajsk           Boolean           -- default false; counts toward PAJSK co-curricular marks
  fideRated       Boolean           -- default false
  mcfRated        Boolean           -- default false
  placement       Int?              -- 1–30; null = participation only
  imagePath       String?           -- relative path under UPLOADS_DIR (internal; not exposed)
  createdAt       DateTime
  updatedAt       DateTime

  Indexes: [studentId], [competitionDate]
}

enum CompetitionLevel {
  sekolah        -- school
  daerah         -- district
  negeri         -- state
  kebangsaan     -- national
  antarabangsa   -- international
}

enum CompetitionCategory {
  u13 | u14 | u15 | u16 | u17 | u18 | u21 | open
}
```

Both `student` and `createdBy` relations use `onDelete: Restrict` — deleting either referenced user is blocked while records exist.

The service always includes `student { id, name, username, className }` and `createdBy { id, name }` in every response; these are never lazy-loaded on demand.

## Authorization Matrix

| Operation | student | teacher | admin | coach |
|-----------|---------|---------|-------|-------|
| List (`GET /records`) | All records | All records | All records | All records |
| Get one (`GET /records/{id}`) | Any record | Any record | Any record | Any record |
| Create (`POST /records`) | Own `studentId` only | Any `studentId` | Any `studentId` | 403 |
| Update (`PATCH /records/{id}`) | Own records only | Any record | Any record | Own records only |
| Delete (`DELETE /records/{id}`) | Own records only | Any record | Any record | Own records only |

"Own records only" means `createdById === requestor.id` — the check is on the creator, not the student.

A student who attempts to create a record with a `studentId` that differs from their own ID receives `403 "Students may only create records for themselves"`.

## Placement Convention

| `placement` value | Display label |
|-------------------|---------------|
| `1` | Champion |
| `2` | 1st Runner-up |
| `3` | 2nd Runner-up |
| `4` – `30` | Ordinal string, e.g. "4th place" |
| `null` | Participation |

The server stores and returns the raw integer (or null). Display mapping is the responsibility of the frontend/consumer.

## Image Attachment

Each competition record may have one optional image (certificate, award photo, etc.).

| Property | Value |
|----------|-------|
| Subdirectory | `UPLOADS_DIR/records/` |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/webp` |
| Maximum size | 5 MB |
| Served via | `GET /api/records/{id}/image` (any authenticated role) |
| `Content-Disposition` | Not set (browser default) |
| On update | Old file deleted from disk before new one is saved |
| On delete | File deleted from disk |

`imagePath` is never exposed in API responses. Use the boolean `hasImage` flag to check for presence, then fetch via the dedicated endpoint.

**Multipart form data:** `POST /records` and `PATCH /records/{id}` both use `multipart/form-data`. Boolean fields (`pajsk`, `fideRated`, `mcfRated`) are coerced from string — accepted truthy values: `"true"`, `"1"`.

To clear an image without replacement: send `removeImage=true` (string `"true"` or `"1"`) in the PATCH body.

## Visibility

All records are visible to every authenticated user — there is no per-role filtering on the list or detail endpoints. This is intentional: records function as a public showcase within the club.

## API Reference

See `docs/api/openapi.yaml` paths:

- `GET /records` — list all records; optional `studentId` query param filters to one student
- `POST /records` — create a record (multipart/form-data)
- `GET /records/{id}` — get a single record
- `PATCH /records/{id}` — partial update (multipart/form-data; at least one field required; `studentId` is immutable)
- `DELETE /records/{id}` — hard delete, returns 204
- `GET /records/{id}/image` — download the attached image

Component schemas: `CompetitionRecord`, `CompetitionLevel`, `CompetitionCategory`, `CreateCompetitionRecordRequest`, `UpdateCompetitionRecordRequest`, `CompetitionRecordListResponse`, `CompetitionRecordResponse`.

## Phase 2 Ideas

- **Gamification tie-in** — award points per placement tier (e.g. Champion at kebangsaan = 100 pts), feeding a student leaderboard.
- **Leaderboard by level** — rank students by placement count within a selected `CompetitionLevel`.
- **PDF export** — generate a printable certificate or achievement summary per student.
- **Bulk import** — CSV upload for post-tournament entry of multiple students at once.
- **Notification on creation** — notify the student when a teacher/admin logs a record on their behalf.
