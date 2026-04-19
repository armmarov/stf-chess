# Data Model

## Entity Relationship Diagram

```mermaid
erDiagram
    User {
        uuid   id          PK
        string name
        string email       UK
        string password_hash
        enum   role        "admin|teacher|coach|student"
        string phone
        bool   is_active   "default true"
        timestamp created_at
    }

    Session {
        uuid   id            PK
        date   date
        time   start_time
        time   end_time
        string place
        string notes         "nullable"
        uuid   created_by    FK
        timestamp created_at
        bool   is_cancelled  "default false"
        timestamp cancelled_at  "nullable"
        uuid   cancelled_by  FK "nullable"
    }

    PreAttendance {
        uuid   id          PK
        uuid   session_id  FK
        uuid   student_id  FK
        timestamp confirmed_at
    }

    Attendance {
        uuid   id          PK
        uuid   session_id  FK
        uuid   student_id  FK
        bool   present     "default false"
        bool   paid_cash   "default false"
        uuid   marked_by   FK
        timestamp marked_at
    }

    Payment {
        uuid    id              PK
        uuid    student_id      FK
        uuid    session_id      FK "nullable"
        decimal amount          "snapshot of fee at upload time"
        string  receipt_file_path
        enum    status          "pending|approved|rejected"
        timestamp uploaded_at
        uuid    reviewed_by     FK "nullable"
        timestamp reviewed_at   "nullable"
    }

    AppConfig {
        uuid   id          PK
        string key         UK "e.g. session_fee"
        string value
        uuid   updated_by  FK
        timestamp updated_at
    }

    User ||--o{ Session          : "created_by"
    User ||--o{ PreAttendance    : "student"
    Session ||--o{ PreAttendance : "session"
    User ||--o{ Attendance       : "student"
    Session ||--o{ Attendance    : "session"
    User ||--o{ Attendance       : "marked_by"
    User ||--o{ Payment          : "student"
    Session ||--o{ Payment       : "session"
    User ||--o{ Payment          : "reviewed_by"
    User ||--o{ AppConfig        : "updated_by"
```

## Table Notes

### User
- `email` is unique and used as login identifier.
- `is_active = false` is a soft delete — record is retained for historical FK references.
- `role` is an enum: `admin`, `teacher`, `coach`, `student`.

### Session
- `created_by` references `User.id` (teacher or admin who created the session).
- `notes` is optional free text.
- Cancellation is a **soft delete**: `is_cancelled` is set to `true` via `PATCH /api/sessions/:id`; the row is never deleted. `cancelled_at` and `cancelled_by` are set at the same time. This preserves historical attendance and payment records that reference the session.

### PreAttendance
- Unique constraint on `(session_id, student_id)` — one record per student per session.
- A student may toggle pre-attendance; the record is upserted (delete or update `confirmed_at`).
- Cutoff: students cannot change pre-attendance within 10 minutes of `session.start_time` (enforced in service layer).

### Attendance
- Unique constraint on `(session_id, student_id)`.
- `present` and `paid_cash` are independent boolean flags set by teacher.
- `marked_by` references the teacher who last updated the record.

### Payment
- `amount` captures the session fee **at the time of upload** — it is not recalculated if `AppConfig.session_fee` changes later.
- `session_id` is nullable: a payment may be submitted without being tied to a specific session.
- `status` flow: `pending` → `approved` or `rejected` (no revert).
- `reviewed_by` / `reviewed_at` set when admin or teacher acts on the payment.
- Receipt file stored on disk with UUID filename; `receipt_file_path` is the relative path under `/uploads`.

### AppConfig
- Keyed by string (e.g., `session_fee`).
- `value` stored as string; application parses to the appropriate type.
- `updated_by` references the admin who last changed the value.

## Indexes

| Table          | Index / Constraint                          |
|----------------|---------------------------------------------|
| `users`        | `UNIQUE (email)`                            |
| `sessions`     | `INDEX (date)`                              |
| `pre_attendance` | `UNIQUE (session_id, student_id)`         |
| `attendance`   | `UNIQUE (session_id, student_id)`           |
| `payments`     | `INDEX (student_id)`, `INDEX (status)`      |
| `app_config`   | `UNIQUE (key)`                              |
