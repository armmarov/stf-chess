# System Overview

## Product

**STF Supreme Chess** is a mobile-first web application for managing student attendance and payments for chess coaching sessions. See `REQUIREMENTS.md §1–2` for full product description and goals.

## User Roles

| Role        | Phase 1 Access |
|-------------|----------------|
| **Admin**   | Full system access: manage users, sessions, payments, fee config |
| **Teacher** | Manage sessions, mark attendance, review payments |
| **Coach**   | Account provisioned; no Phase 1 UI (deferred to Phase 2) |
| **Student** | Pre-confirm attendance, upload payment receipts, view own history |

See `REQUIREMENTS.md §3` for full role descriptions.

## Feature Summary

### Authentication (all roles)
- Email/password login with JWT httpOnly cookie session
- Logout

### Admin
- Register and manage users (students, teachers, coaches)
- View all sessions, attendance, and payments
- Configure global session fee
- Approve or reject payment receipts

### Teacher
- Create, edit, cancel sessions
- Mark actual attendance and cash payment per student per session
- Review and approve/reject payment receipts

### Student
- View upcoming sessions
- Toggle pre-attendance (up to 10 min before session start)
- Upload payment receipt (JPG/PNG/PDF, max 5 MB)
- View own attendance and payment history

### Coach
- Phase 2 only — no features in Phase 1

## Out of Scope (Phase 1)

See `REQUIREMENTS.md §10` for the full exclusion list (password reset, payment gateway, notifications, analytics, multi-language, etc.).
