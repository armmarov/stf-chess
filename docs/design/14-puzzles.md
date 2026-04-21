# Puzzles

## Feature Summary

The puzzle system presents 5 chess puzzles per day to every authenticated user. Puzzles are sourced from the Lichess CC0 database and selected deterministically by date — all users see the same 5 puzzles on the same day. Users solve puzzles move-by-move via a check-move API; the solution is never shipped to the client. Attempts are recorded for each user; retries are unlimited but only the first attempt of the day is tagged `isFirstTry` for future gamification.

| Role | Capabilities |
|------|-------------|
| Admin | Same as all roles (no admin-only endpoints in this module) |
| Teacher | View today's puzzles, solve, record attempts, view personal stats |
| Coach | View today's puzzles, solve, record attempts, view personal stats |
| Student | View today's puzzles, solve, record attempts, view personal stats |

## Data Source

Puzzles are sourced from the **Lichess puzzle database** (CC0 licence — free for any use). The database is not committed to the repository; the admin downloads the CSV from Lichess and seeds it manually.

**Seed command:** `npm run seed:puzzles`
**Input file:** `backend/prisma/puzzles.csv` (not tracked by git)

CSV columns used:

| CSV header | Mapped field |
|-----------|-------------|
| `PuzzleId` | `externalId` |
| `FEN` | `fen` |
| `Moves` | `solutionUci` (space-separated UCI move list) |
| `Rating` | `rating` |
| `RatingDeviation` | `ratingDeviation` |
| `Popularity` | `popularity` |
| `Themes` | `themes` |
| `GameUrl` | `gameUrl` |
| `OpeningTags` | `openingTags` |

The seed script upserts by `externalId` so re-running with an updated CSV is safe.

## Data Model

```
Puzzle {
  id              uuid (PK)
  externalId      varchar — Lichess PuzzleId; unique
  fen             varchar(120) — starting position
  solutionUci     text — space-separated UCI moves (NEVER exposed in API)
  rating          Int
  ratingDeviation Int?
  popularity      Int?
  themes          text? — space-separated theme tags
  openingTags     text?
  gameUrl         string?
  createdAt       DateTime

  Indexes: [rating]
}

PuzzleAttempt {
  id          uuid (PK)
  puzzleId    uuid (FK → Puzzle, CASCADE DELETE)
  userId      uuid (FK → User, CASCADE DELETE)
  status      PuzzleAttemptStatus enum  -- solved | failed | gave_up
  movesTaken  Int
  timeMs      Int
  isFirstTry  Boolean  -- true if priorAttempts today = 0 at insert time
  attemptedOn Date (stored as midnight UTC)

  Indexes: [userId, attemptedOn], [puzzleId]
}
```

## Today-Picking Algorithm

Five puzzles are selected for each UTC date using a deterministic hash:

```
hash = [...dateString].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0)
startIndex = hash % totalPuzzles
```

Puzzles are fetched ordered by `createdAt asc` starting at `startIndex`, with wrap-around if fewer than 5 remain before the end. The result is cached in-process per date (cache cleared on date change). All users get the same 5 puzzles for a given UTC date.

The final response orders puzzles by **rating ascending** (easiest first).

## Solution-Hiding Pattern

`solutionUci` is stored in the database but **never serialised into any API response**. The `PUZZLE_PUBLIC_SELECT` Prisma projection fetches `solutionUci` internally only to:

1. Compute `solutionLength` (move count) for the list response.
2. Validate moves in `POST /puzzles/{id}/check-move`.

Clients receive only `solutionLength` — the number of moves to play — not the moves themselves.

### Check-Move Protocol

The client drives puzzle solving move-by-move:

```
Client                          Server
  │── POST /puzzles/{id}/check-move ──▶│
  │   { ply: 0, uci: "e2e4" }         │  validates against moves[0]
  │◀── { correct: true, replyUci: "e7e5" } ──│  opponent replies
  │── POST /puzzles/{id}/check-move ──▶│
  │   { ply: 2, uci: "d2d4" }         │  validates against moves[2]
  │◀── { correct: true, solved: true } ──│  last move played
```

- `ply` is zero-indexed into the solution move array.
- Odd plies are opponent moves; the server returns `replyUci` automatically.
- A wrong move returns `{ correct: false, expected: "<correct uci>" }`.
- `POST /puzzles/{id}/check-move` does **not** record an attempt.

## Retry Semantics

A user may attempt each puzzle an unlimited number of times per day:

- Every attempt (solved, failed, or gave_up) is recorded as a `PuzzleAttempt` row.
- `isFirstTry: true` is set only on the first attempt of the day for a given `(userId, puzzleId, attemptedOn)` combination.
- Subsequent retries have `isFirstTry: false`.
- Only first-try data is intended to feed future gamification (leaderboards, difficulty calibration). Retries are stored for completeness.

## Streak Definition

A calendar day counts toward the streak if the user has **at least 1 solved attempt** on that day — there is no requirement to solve all 5 puzzles. The bar is intentionally low to encourage daily engagement.

Streak calculation uses UTC dates (`attemptedOn` stored as `@db.Date` midnight UTC).

## Gamification Hook (Future — Phase 2)

The data model is designed to support future gamification:

- `isFirstTry` enables "first-try solve rate" leaderboards.
- `timeMs` enables speed-based ranking.
- `currentStreak` / `longestStreak` in `GET /puzzles/me/stats` are already computed and returned.
- No gamification UI or leaderboard endpoints exist in v1.

## API Reference

See `docs/api/openapi.yaml` paths:
- `GET /puzzles/today`
- `GET /puzzles/me/stats`
- `POST /puzzles/{id}/check-move`
- `POST /puzzles/{id}/attempt`
