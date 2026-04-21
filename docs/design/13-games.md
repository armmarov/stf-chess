# Games

## Feature Summary

Games is a curated library of chess games managed by admins. Every authenticated user can browse the list and replay individual games. Admins create, edit, and delete records; non-admins have read-only access.

| Role | Capabilities |
|------|-------------|
| Admin | Create, update, delete game records |
| Teacher | View game list and replay games |
| Coach | View game list and replay games |
| Student | View game list and replay games |

## Data Model

```
Game {
  id             uuid (PK)
  tournamentName varchar(200)
  whitePlayer    varchar(120)
  blackPlayer    varchar(120)
  result         GameResult enum   -- white_win | black_win | draw
  pgn            text              -- full PGN; validated on write
  eventDate      Date?             -- date only (no time); stored as midnight UTC
  whiteElo       Int?              -- 0–4000
  blackElo       Int?              -- 0–4000
  opening        varchar(120)?     -- ECO code or opening name
  notes          text?             -- max 10 000 characters
  createdById    uuid (FK → User, RESTRICT)
  createdAt      DateTime
  updatedAt      DateTime

  Indexes: [createdAt], [tournamentName]
}

enum GameResult {
  white_win  @map("1-0")
  black_win  @map("0-1")
  draw       @map("1/2-1/2")
}
```

`Game` rows are hard-deleted (no soft delete). No associated files are stored on disk.

## PGN Validation Rule

Every write that includes a `pgn` field (POST always; PATCH only when `pgn` is present) validates the PGN using **chess.js v1.x**:

```
const c = new Chess();
c.loadPgn(pgn, { strict: false });   // accepts standard algebraic notation
if (c.history().length === 0) → reject  // header-only PGNs not allowed
```

| Condition | HTTP status | Error format |
|-----------|-------------|--------------|
| Parse failure | 400 | `Invalid PGN: <chess.js error message>` |
| Zero moves | 400 | `Invalid PGN: PGN contains no moves` |
| ≥1 move | — | Accepted |

`strict: false` means the parser accepts most real-world PGN files, including those with non-standard tags, comments, and variations.

## List vs Detail Split

The list endpoint (`GET /games`) omits `pgn` and `notes` for performance — returning only metadata needed to browse and filter. The detail endpoint (`GET /games/{id}`) returns the full record including `pgn` and `notes`.

## Frontend Replay

The frontend uses **chess.js** and **chessground** to replay games from the stored PGN:

- **Main-line only** — variations and annotations embedded in the PGN are silently ignored during replay.
- Move-by-move navigation is provided; the board position is derived from `chess.js` move history.
- No server-side move computation occurs; the PGN is served as-is and parsed client-side.

## Phase 2 — Engine Analysis (Deferred)

Stockfish WASM-based engine analysis is **not included in v1**. It is planned for a future phase and will run entirely in the browser (no server-side engine). This design does not need to change to support it — the full PGN is already available on the detail endpoint.

## Filtering

`GET /games` supports two independent query filters applied with AND semantics:

| Parameter | Behaviour |
|-----------|-----------|
| `tournamentName` | Case-insensitive substring match on `tournamentName` |
| `player` | Case-insensitive substring match on `whitePlayer` OR `blackPlayer` |

Both may be omitted to return all games.

## API Reference

See `docs/api/openapi.yaml` paths:
- `GET /games`
- `POST /games`
- `GET /games/{id}`
- `PATCH /games/{id}`
- `DELETE /games/{id}`
