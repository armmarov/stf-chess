# Auth and Roles

## Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client (Browser)
    participant API as Express API
    participant DB as PostgreSQL

    C->>API: POST /api/auth/login {username, password}
    API->>DB: SELECT user WHERE username = ?
    DB-->>API: user row (password_hash, role, is_active)
    API->>API: bcrypt.compare(password, password_hash)
    alt inactive account
        API-->>C: 403 Forbidden — Account is inactive
    else invalid credentials
        API-->>C: 401 Unauthorized — Invalid credentials
    else valid
        API->>API: jwt.sign({userId, role}, secret, {expiresIn})
        API-->>C: 200 OK + Set-Cookie: stf_token=<jwt>; HttpOnly; Secure; SameSite=Lax
        Note over C,API: Body: { user: { id, name, username, role } }
    end

    C->>API: GET /api/auth/me (stf_token cookie sent automatically)
    API->>API: authMiddleware: jwt.verify(cookie.stf_token)
    API-->>C: 200 { user: { id, name, username, role } }

    C->>API: POST /api/auth/logout
    API-->>C: 204 No Content + Set-Cookie: stf_token=; Max-Age=0
```

## Middleware Chain

Every protected route passes through:

1. **`authMiddleware`** — reads `stf_token` cookie, calls `jwt.verify`; returns `401` if missing or invalid.
2. **`roleGuard(roles[])`** — checks `req.user.role` against the allowed roles array; returns `403` if not permitted.
3. **Controller** — handles business logic.

Role enforcement is **server-side only**. Frontend hides UI elements for convenience, but the API rejects requests from any role not in the allowed list.

## Role Matrix

| Feature / Endpoint                                        | Admin | Teacher        | Coach | Student |
|-----------------------------------------------------------|:-----:|:--------------:|:-----:|:-------:|
| Login / Logout / Me                                       | ✓     | ✓              | ✓     | ✓       |
| **User Management**                                       |       |                |       |         |
| List users — any role (`GET /users?role=`)                | ✓     |                |       |         |
| List students only (`GET /users?role=student`)            | ✓     | ✓              |       |         |
| View any user (`GET /users/:id`)                          | ✓     |                |       |         |
| View student (`GET /users/:id`)                           | ✓     | ✓              |       |         |
| View own profile (`GET /users/:id` self)                  | ✓     | ✓              | ✓     | ✓       |
| Create any role (`POST /users`)                           | ✓     |                |       |         |
| Create student (`POST /users` role=student)               | ✓     | ✓              |       |         |
| Update user — name/phone/isActive/role (`PATCH /users/:id`) | ✓   |                |       |         |
| Update student — name/phone/isActive (`PATCH /users/:id`) | ✓     | ✓ (student only)|      |         |
| Update own name/phone (`PATCH /users/:id` self)           | ✓     | ✓              | ✓     | ✓       |
| Reset any user's password (`POST /users/:id/password`)    | ✓     |                |       |         |
| Change own password (`POST /auth/change-password`)        | ✓     | ✓              | ✓     | ✓       |
| **Sessions**                                              |       |                |       |         |
| List sessions (`GET /sessions`)                           | ✓     | ✓              | ✓     | ✓       |
| Create / edit / cancel session                            | ✓     | ✓              |       |         |
| **Attendance**                                            |       |                |       |         |
| Toggle pre-attendance                                     |       |                |       | ✓       |
| Get attendance roster                                     | ✓     | ✓              |       |         |
| Bulk mark attendance + cash                               | ✓     | ✓              |       |         |
| **Payments**                                              |       |                |       |         |
| Upload payment receipt                                    |       |                |       | ✓       |
| List own payments                                         |       |                |       | ✓       |
| List all payments                                         | ✓     | ✓              |       |         |
| Approve / reject payment                                  | ✓     | ✓              |       |         |
| **Config**                                                |       |                |       |         |
| Get session fee                                           | ✓     | ✓              | ✓     | ✓       |
| Update session fee                                        | ✓     |                |       |         |

## Token Details

| Property     | Value |
|--------------|-------|
| Algorithm    | HS256 |
| Secret       | `JWT_SECRET` env var (min 16 chars enforced by Zod schema) |
| Expiry       | 7 days (`604800` seconds) |
| Transport    | `httpOnly; SameSite=Lax; path=/` cookie named **`stf_token`**; `Secure` added when `NODE_ENV=production` |
| Max-Age      | 7 days (cookie and token expiry are kept in sync) |
| Payload      | `{ sub: userId, role, iat, exp }` — uses standard `sub` claim |

## Rate Limiting

`POST /api/auth/login` is rate-limited via `express-rate-limit`:

| Parameter    | Value |
|--------------|-------|
| Window       | 15 minutes |
| Max requests | 20 per IP |
| Headers      | Standard (`RateLimit-*`) |
| Response     | `429` with `{ error: "Too many requests, please try again later." }` |

## Error Codes (Auth Endpoints)

| Status | Meaning |
|--------|---------|
| 400    | Validation error — missing/invalid request body fields |
| 401    | Invalid credentials (wrong username or password) — `"Invalid credentials"` |
| 401    | Missing `stf_token` cookie (`/me` only) — `"Authentication required"` |
| 401    | Bad or expired JWT (`/me` only) — `"Invalid or expired token"` |
| 401    | User deactivated after login (`/me` only) — `"User not found or inactive"` |
| 403    | Account exists but `is_active = false` (login) — `"Account is deactivated"` |
| 429    | Rate limit exceeded — `"Too many requests, please try again later."` |

## Security Notes

- Passwords hashed with **bcrypt** (cost factor ≥ 12).
- Inactive users (`is_active = false`) are rejected with `403` — distinct from invalid credentials (`401`).
- JWT secret minimum length of 16 bytes enforced at startup via Zod env schema.
- Cookie flags: `HttpOnly`, `Secure`, `SameSite=Lax` — not accessible from JavaScript.
