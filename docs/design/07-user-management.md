# User Management

## Who Can Create / Modify Whom

| Action | Admin | Teacher | Self (any role) |
|--------|:-----:|:-------:|:---------------:|
| Create user (any role) | ✓ | | |
| Create student | ✓ | ✓ | |
| View any user | ✓ | | |
| View student | ✓ | ✓ | |
| View own profile | ✓ | ✓ | ✓ |
| Update name / phone | ✓ | ✓ (student only) | ✓ |
| Deactivate student (`isActive: false`) | ✓ | ✓ | |
| Deactivate any role | ✓ | | |
| Re-activate user (`isActive: true`) | ✓ | | |
| Reset any user's password | ✓ | | |

**Username is admin-only** — only admin may change a username via `PATCH /users/:id`. Non-admin callers including `username` receive 403 `"Only admin can change username"`. Changing a username does **not** invalidate the affected user's JWT (token uses `sub` = user ID).

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
      ├── Want to change own password?
      │         │
      │         ▼
      │   POST /auth/change-password { currentPassword, newPassword }
      │   (any role; must supply current password to verify)
      │
      ├── Lost / needs reset?
      │         │
      │         ▼
      │   Admin resets via POST /users/:id/password { newPassword }
      │         │
      │         ▼
      │   Admin shares new password out-of-band
      │
      └── Forgotten-password / email reset: out of scope (REQUIREMENTS §10)
```

- Password is hashed with **bcrypt** (cost factor 10) before storage. Plain-text is never stored or returned.
- Minimum length: **8 characters** (enforced by Zod at creation, reset, and self-change).
- Any authenticated user may change their own password via `POST /auth/change-password` — must supply the correct current password; new password must differ from current.
- Admin may reset any user's password via `POST /users/:id/password` without supplying the current password.
- JWT cookie is **not revoked** after a self-change — existing sessions remain active.

## Username Rules

- 3–32 characters.
- Lowercase letters, digits, and underscores only (`^[a-z0-9_]{3,32}$`).
- Must be unique — duplicate returns 409 `"Username already taken"`.
- Changeable by admin only (`PATCH /users/:id`). Non-admin callers receive 403.

## Field Update Rules by Role

| Field | Admin | Teacher (on student or self) | Self (student/coach) |
|-------|:-----:|:----------------------------:|:--------------------:|
| `name` | ✓ | ✓ | ✓ |
| `phone` | ✓ | ✓ | ✓ |
| `className` | ✓ | ✓ | ✓ |
| `isActive` | ✓ (any value) | ✓ (student only) | ✗ (403) |
| `role` | ✓ | ✗ (403) | ✗ (403) |
| `username` | ✓ (409 if taken) | ✗ (403 `"Only admin can change username"`) | ✗ (403) |
| `password` | via `POST /users/:id/password` | | |

## API Reference

See `docs/api/openapi.yaml` paths:
- `GET /users`
- `GET /users/{id}`
- `POST /users`
- `PATCH /users/{id}`
- `POST /users/{id}/password`
