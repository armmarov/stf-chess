# User Management

## Who Can Create / Modify Whom

| Action | Admin | Teacher | Self (any role) |
|--------|:-----:|:-------:|:---------------:|
| Create user (any role) | ✓ | | |
| Create student | ✓ | ✓ | |
| View any user | ✓ | | |
| View student | ✓ | ✓ | |
| View own profile | ✓ | ✓ | ✓ |
| Update name / phone | ✓ | | ✓ |
| Deactivate student (`isActive: false`) | ✓ | ✓ | |
| Deactivate any role | ✓ | | |
| Re-activate user (`isActive: true`) | ✓ | | |
| Reset any user's password | ✓ | | |

**Username is immutable** — it cannot be changed after creation. Including `username` in a `PATCH` body returns 400.

## Active vs Inactive Users

- `isActive: false` is a **soft deactivation** — the row is retained for historical FK references (attendance records, payment records, session creation logs).
- A deactivated user **cannot log in**: `POST /auth/login` returns 403 `"Account is deactivated"`.
- A user deactivated **after login** is rejected on the next authenticated request: `GET /auth/me` returns 401 `"User not found or inactive"` (authMiddleware re-fetches the user from DB on every request).
- There is no hard delete. Deactivated users are excluded from the attendance roster and session-related active-student lookups (`isActive=true` filter applied in service layer).

## Password Lifecycle

```
Admin creates user
      │
      ▼
Admin sets initial password (POST /users with password field)
      │
      ▼
User logs in with that password
      │
      ├── Lost / needs reset?
      │         │
      │         ▼
      │   Admin resets via POST /users/:id/password { newPassword }
      │         │
      │         ▼
      │   Admin shares new password out-of-band
      │
      └── Phase 1: no self-service password change, no reset flow
          (REQUIREMENTS §11 decision #1; §10 out-of-scope)
```

- Password is hashed with **bcrypt** (cost factor 10) before storage. Plain-text is never stored or returned.
- Minimum length: **8 characters** (enforced by Zod at both creation and reset).
- Only admin can call `POST /users/:id/password` — no role (including self) may change their own password via the API in Phase 1.

## Username Rules

- 3–32 characters.
- Lowercase letters, digits, and underscores only (`^[a-z0-9_]{3,32}$`).
- Must be unique — duplicate returns 409 `"Username already taken"`.
- **Immutable** after creation.

## Field Update Rules by Role

| Field | Admin | Teacher (on student) | Self |
|-------|:-----:|:--------------------:|:----:|
| `name` | ✓ | | ✓ |
| `phone` | ✓ | | ✓ |
| `isActive` | ✓ (any value) | ✓ (`false` only on student) | ✗ (403) |
| `role` | ✓ | ✗ (403) | ✗ (403) |
| `username` | ✗ (400 `"Username cannot be changed"`) | ✗ | ✗ |
| `password` | via `POST /users/:id/password` | | |

## API Reference

See `docs/api/openapi.yaml` paths:
- `GET /users`
- `GET /users/{id}`
- `POST /users`
- `PATCH /users/{id}`
- `POST /users/{id}/password`
