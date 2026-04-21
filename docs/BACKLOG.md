# Product Backlog

Tracks features not yet started. Use this as the running list for what to build next. Items are grouped by source (user-requested vs. team suggestion) and tagged with rough effort and risk.

---

## User-requested

### 1. Payment gateway integration

Replace the receipt-upload flow with an actual online payment provider so students pay and get auto-credited without the admin/teacher review cycle.

- **Provider candidates for Malaysia:** Billplz, Stripe (FPX available), Razer (iPay88), ToyyibPay, Chip.
- Recommend **Billplz** or **Stripe FPX** — both support DuitNow/FPX, well-documented, sandbox-friendly.
- Flow: student clicks "Pay RM 50" → redirect to hosted page → returns to app with success/cancelled → webhook updates `Payment.status`.
- Webhook signature verification is mandatory.
- Keep the existing receipt-upload flow as a fallback ("mark as manual transfer") for admins/teachers.
- New columns on `Payment`: `gateway`, `gatewayRef`, `gatewayFeeCents`, `paidAt`.
- Mild schema change; big BE work (webhook, idempotency, reconciliation); FE mostly redirects.
- **Effort:** L · **Risk:** M (money paths → test thoroughly + reconcile).

### 2. Gamification

Point system that rewards engagement and lets students see their own progress + a leaderboard.

Score sources:
- Session attended (present=true): **+10 pts**
- Pre-attendance marked before cutoff: **+2 pts**
- Payment on time: **+5 pts**
- Daily puzzle solved (see #3): **+5 pts on first attempt, +2 on retry**
- Tournament participation (see #4): **+20 pts**
- Tournament placement: **+50/30/10 pts** for 1st/2nd/3rd

Data: new `PointEntry` table with `(userId, source, sourceId, points, createdAt)` for full audit + replay. Current score = `sum(points)`; cached `User.totalPoints` updated via triggers or service hooks.

FE:
- Points pill on student dashboard ("You have 245 points")
- Leaderboard page (top N overall, top N this month)
- Per-student breakdown page ("How did I earn these?")
- Admin can view anyone; students see own + leaderboard only

**Effort:** M · **Risk:** L (just math, easy to bolt on).

### 3. Daily puzzle

One puzzle per day for all users, visible on dashboard. Affects gamification score.

- Data source: **Lichess Puzzle Database** (CC0, https://database.lichess.org/#puzzles).
- Pre-import a filtered pool (500–2000 puzzles in the 1200–1800 Elo range) into a `Puzzle` table.
- Deterministic rotation by date: `puzzleId = orderIndex % totalCount` using day-of-year hash so every user sees the same puzzle.
- FE renders via existing `ChessBoard` (chessground) + `chess.js` to validate moves. On each user move, compare UCI against solution array; auto-play opponent reply on match.
- `PuzzleAttempt` table tracks per-user: status (solved/failed), moves, timeMs.
- Streak indicator ("7-day streak") + weekly "most puzzles solved" leaderboard.
- Hooks into gamification score (task #2).

**Effort:** M · **Risk:** L.

### 4. Tournament result tracking

Beyond "who expressed interest" (current), record what actually happened.

- New `TournamentResult` per `(tournamentId, studentId)`: `{ placement: number, wins: int, losses: int, draws: int, notes: string }`.
- Admin enters results after the tournament.
- Student profile page shows their tournament history: for each, "4th place · 3W 1L 1D" etc.
- Aggregated stats: total tournaments played, best placement, win rate.
- Feeds gamification points (placement bonuses).

**Effort:** M · **Risk:** L.

---

## Team suggestions (prioritized)

### High-value / low-effort

**5. Calendar export (ICS).** One endpoint `GET /api/sessions/calendar.ics?token=...` that emits an iCalendar feed of upcoming sessions. Students subscribe once in Google Calendar / Apple Calendar and always see chess sessions there. Token auth so feed URLs don't require cookies.

**6. Push notifications (Web Push).** The PWA is already installable — add Web Push so students get phone notifications for: session reminders (1 day before + 1 hour before), payment approved/rejected, new tournament, poll started. Saves reliance on the in-app bell. Requires `web-push` npm on BE + a small FE subscribe flow.

**7. Password reset via email/username challenge.** Currently only admins can reset passwords. A self-serve "I forgot my password" flow (email + one-time link OR username + manual admin approval queue) reduces admin load.

**8. Session attendance report / parent summary.** CSV or printable page per student: month / term view showing every session attended + payments settled. Useful to share with parents who ask "did my kid attend?". Admin export by student ID + date range.

**9. Fee-history / invoicing.** Admin-facing monthly invoice per student: "April 2026 · 8 sessions attended · RM 400 · paid RM 350 · outstanding RM 50". PDF download (pdfkit is already a dep for receipts).

### Medium-value

**10. Chess ratings / progression.** Track a self-managed rating per student (chess.com, lichess, FIDE) updated by admin. History chart on student detail. Optional: auto-sync from public APIs.

**11. Homework / lesson assignments.** Admin creates an assignment referencing a Resource (book/problem set) and assigns to a class or to specific students. Students mark as done; teacher sees progress. Tight tie-in with Resources module.

**12. Session capacity + waitlist.** Decision originally: no capacity limit. Revisit if some sessions fill up — optional capacity field on Session, waitlist for students who pre-attend after capacity reached.

**13. Audit log.** New `AuditLog` table records who changed what on user/payment/session/tournament records. View-only admin page. Cheap insurance for any "why did this change?" questions. Low code cost, high accountability gain.

**14. Dark mode.** Tailwind makes this trivial (`dark:` variants); persist via localStorage; respects OS preference. Quality-of-life, no data model impact.

**15. Coach role activation.** Phase 1 deferred coach-facing UI. Decide what coaches actually see/do (maybe: read-only across sessions + attendance + payments of their assigned students) and bring the role to life.

### Longer-horizon / ops

**16. Analytics dashboard.** Admin-only overview: attendance trend (last 12 weeks), revenue by month, session utilization, top tournaments by interest. Charts via lightweight libs or the existing DonutChart pattern.

**17. Engine analysis caching.** On public games, stash Stockfish results in a `GameAnalysis` table keyed by `(gameId, ply)` so repeat visitors don't re-crunch. Also lets us offer deeper analysis (depth 25+) computed lazily server-side once.

**18. Backup / restore automation.** Daily `pg_dump` cron + rsync of `UPLOADS_DIR` to off-box storage. Document retention policy. Currently zero backup automation beyond manual Git pushes.

**19. Multi-tenant / multi-club.** If the tool gets used beyond STF, add a `Club` table and scope every row to it. Medium effort; needs careful authz rethink.

**20. Broadcast / live game relay.** Admin streams a live tournament's PGN via a broadcast endpoint; students watch moves appear on the board in real time (poll every 5s or use SSE).

---

## Keep an eye on (light follow-ups from shipped work)

- Resource file downloads currently accept any MIME — consider adding a scan step or size cap by file type (PDFs allow 20 MB, images stay at 5 MB).
- Payment fee snapshot rule (FR-28): adding a `feeAmount` to `Attendance` when paidCash is marked would make the cash payment history accurate when fees change over time. Today cash entries use the current fee.
- Games module stores full PGN as TEXT; fine for club scale. Revisit storage strategy if archive crosses ~10k games.
- Stockfish analysis requires COOP/COEP headers — any CDN we front the app with must preserve these or analysis breaks silently.
- Notification fan-out on `session_created` creates one row per active student. Fine below ~500 students; queue-worker becomes worth the complexity above that.

---

## How to use this doc

- When scoping the next feature, pull items from here into a tasks chain (DB → BE → tests → docs → FE) using the same pattern we've used for shipped features.
- When a user asks "can we add X", check here first — might already be captured.
- Delete items that ship; keep a short "completed" section at the bottom if historical record is useful.

## Completed (reference)

All Phase 1 + polish features through 2026-04-21 (see REQUIREMENTS.md and the design docs under `docs/design/`). Recent additions: tournaments, polls, resources, game analysis with Stockfish, user class names, self password change, mobile hamburger, PWA support.
