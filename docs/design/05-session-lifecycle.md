# Session Lifecycle

## States

```
          ┌──────────┐
  create  │          │  edit fields
─────────►│  ACTIVE  │◄────────────
          │          │
          └────┬─────┘
               │ isCancelled = true
               │ (admin or teacher)
               ▼
          ┌──────────────┐
          │  CANCELLED   │  admin only: isCancelled = false
          │              │◄──────────────────────────────────
          └──────────────┘
```

A session is never deleted. Cancellation is a soft operation that sets `isCancelled = true`, `cancelledAt`, and `cancelledById` on the row.

## Who Can Do What

| Action                    | Admin | Teacher | Coach | Student |
|---------------------------|:-----:|:-------:|:-----:|:-------:|
| View sessions (list + detail) | ✓ | ✓     | ✓     | ✓       |
| Create session            | ✓     | ✓       |       |         |
| Edit active session       | ✓     | ✓       |       |         |
| Cancel session            | ✓     | ✓       |       |         |
| Un-cancel session         | ✓     |         |       |         |

## Create Rules

- `date` must be ≥ today (UTC date comparison, server-side).
- `startTime` must be strictly before `endTime` (both `HH:MM`, 24-hour).
- `notes` is optional.
- `cancelledAt`, `cancelledById` are never accepted from the client.

## Edit Rules (Active Session)

- Any subset of `{ date, startTime, endTime, place, notes }` may be updated.
- If either `startTime` or `endTime` is provided, both are validated together against each other.
- The same date and time rules as creation apply to changed fields.

## Cancellation

1. Client sends `PATCH /api/sessions/:id` with `{ isCancelled: true }`.
2. Server sets:
   - `isCancelled = true`
   - `cancelledAt = now()`
   - `cancelledById = req.user.id`
3. Client must **not** send `cancelledAt` or `cancelledById` — they are stripped from input.
4. Once cancelled, any further edit (other than un-cancel) returns **409** `"Cannot edit a cancelled session; un-cancel it first"`.

## Un-cancellation (Admin Only)

1. Admin sends `PATCH /api/sessions/:id` with `{ isCancelled: false }`.
2. Server sets:
   - `isCancelled = false`
   - `cancelledAt = null`
   - `cancelledById = null`
3. Teachers cannot un-cancel — they receive **403** `"Only admin can un-cancel a session"`.

## Listing Behaviour

- `GET /api/sessions` includes cancelled sessions by default (`isCancelled` is visible in each item).
- Pass `?includeCancelled=false` to suppress cancelled sessions from the list.
- Results are ordered by `date` asc, then `startTime` asc.
- Each item includes `_count.preAttendances` — Prisma count projection of confirmed pre-attendance records.

## Pre-Attendance Cutoff

Students may toggle pre-attendance until **10 minutes before** the session's `startTime` on the session `date`. This is enforced in the pre-attendance service, not the sessions module. See `REQUIREMENTS.md §4.6 FR-21`.

## Date / Time Serialization

`date`, `startTime`, and `endTime` are stored as Prisma `DateTime` fields and serialized as ISO 8601 strings in API responses:

- `date` (`@db.Date`) → `"2026-04-20T00:00:00.000Z"` (UTC midnight)
- `startTime` / `endTime` → `"2026-04-20T09:00:00.000Z"` (full timestamp)

Input format: `date` accepts `YYYY-MM-DD`; `startTime`/`endTime` accept `HH:MM` or `HH:MM:SS`. The server combines them internally via `toDateTime(date, time)`.

> **Note:** Timezone handling in `toDateTime` depends on server locale. Verify UTC behaviour in production.

## Invariants

- `isCancelled = true` → `cancelledAt IS NOT NULL` and `cancelledById IS NOT NULL`
- `isCancelled = false` → `cancelledAt IS NULL` and `cancelledById IS NULL`
- `startTime < endTime` always holds after any write
- `date ≥ today` enforced only at create/update time; past sessions are valid historical records

## API Reference

See `docs/api/openapi.yaml` paths `/sessions` and `/sessions/{id}`.
