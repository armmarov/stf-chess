# Notifications

## Summary

Notifications are in-app alerts stored in the database and polled by the frontend. There is no push delivery (WebSocket, SSE, or mobile push) in v1 — clients poll `GET /notifications/unread-count` to drive the bell indicator and fetch the list on demand.

Emissions are **fire-and-forget**: a failure to write a notification record never propagates to or rolls back the parent operation.

## Trigger Events

| Type | Trigger | Audience |
|------|---------|----------|
| `session_created` | `POST /sessions` — new session created | All active students |
| `pre_attendance_set` | Student confirms pre-attendance | All active admin + teacher staff (excluding the student) |
| `attendance_marked_present` | Bulk attendance mark — student transitions to `present=true` | Affected students only |
| `paid_cash` | Bulk attendance mark — student transitions to `paidCash=true` | Affected students only |
| `receipt_uploaded` | `POST /payments` — student uploads receipt | All active admin + teacher staff (excluding the uploader) |
| `payment_reviewed` | `PATCH /payments/:id/review` — receipt approved or rejected | The student who uploaded the receipt |

**Transition-only emissions:** `attendance_marked_present` and `paid_cash` fire only when the value flips from false → true. Re-marking an already-present or already-cash-paid student does not emit a duplicate notification.

## Data Model

```
Notification {
  id        uuid (PK)
  userId    uuid (FK → User, CASCADE DELETE)
  type      NotificationType enum
  title     string
  message   string
  linkPath  string?     -- optional in-app navigation path
  payload   Json?       -- reserved; always null in current emissions
  readAt    DateTime?   -- null = unread
  createdAt DateTime
}

Indexes:
  (userId, readAt)    -- unread-count query
  (userId, createdAt) -- list query (sorted desc)
```

No retention policy exists in v1 — notifications accumulate indefinitely.

## Delivery Model

```
Parent operation (e.g. createSession)
        │
        ├── DB write (session row) ──── awaited
        │
        └── emit notifications ──────── fire-and-forget (Promise not awaited)
                │
                ├── success → notifications created in DB
                └── failure → silently dropped; parent already committed
```

Notifications are **not exactly-once**. If the parent commits but the notification write fails (e.g. transient DB error), no notification is created and no retry occurs. This is acceptable for non-critical in-app alerts.

## Polling Design

The frontend uses two calls:
1. `GET /notifications/unread-count` — lightweight integer poll (drives the bell badge).
2. `GET /notifications` — full list fetch on bell click or page load.

There is no server-push mechanism. Poll interval is a frontend concern; no server-side SSE or WebSocket support exists in v1.

## Role Access

All notification endpoints are available to every authenticated role (admin, teacher, coach, student). Each caller only ever sees their own notifications — there is no cross-user read or admin overview endpoint.

## Known Limitations

| Limitation | Impact |
|-----------|--------|
| `session_created` fan-out scales linearly with active student count — one `createMany` call inserts N rows synchronously (inside the fire-and-forget) | Large clubs may see latency on session creation once student count grows |
| No delivery guarantee — emission failures are silently dropped | Students may miss notifications in DB error scenarios |
| No deduplication — if the same state-change is submitted twice before the first emission completes, duplicate notifications may be written | Low-probability; no mitigation in v1 |
| No retention policy — notifications accumulate indefinitely | Table will grow unbounded; archiving/pruning is future work |
| `payload` field is reserved but always null | Structured deep-link data not available in v1 |
| Cash entry `amount` in payment history uses current fee, not fee at payment time | See `08-payment-flow.md` for context |

## API Reference

See `docs/api/openapi.yaml` paths:
- `GET /notifications`
- `GET /notifications/unread-count`
- `POST /notifications/read-all`
- `POST /notifications/{id}/read`
