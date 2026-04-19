# ADR-0001: Technology Stack

**Status:** Accepted  
**Date:** 2026-04-19

## Context

STF Supreme Chess requires a mobile-first web application for attendance and payment management. The team needed a consistent, modern stack that:

- Supports rapid development by a small team.
- Enforces type safety across the full codebase.
- Is well-supported for a PostgreSQL-backed REST API.
- Produces a mobile-first SPA with minimal friction.
- Runs on affordable PaaS or VPS hosting (Phase 1 budget is minimal).

The resolved decisions recorded in `REQUIREMENTS.md §11` cover the specific choices. This ADR documents the rationale.

## Decision

| Layer       | Choice                                           |
|-------------|--------------------------------------------------|
| Language    | **TypeScript** — frontend and backend            |
| Frontend    | **Vue 3** (Composition API) + Vite + Vue Router + Pinia + Tailwind CSS |
| Backend     | **Node.js + Express** (TypeScript)               |
| Database    | **PostgreSQL** with **Prisma** ORM               |
| Auth        | **JWT** in httpOnly cookie; **bcrypt** for hashing |
| Validation  | **Zod** (shared schemas, FE + BE)                |
| File upload | **multer** (disk storage, Phase 1)               |
| Testing     | **Vitest** (FE), **Jest + Supertest** (BE)       |
| Deployment  | **PaaS** (Railway / Render) recommended; VPS alternative |

## Consequences

### Positive
- **Full-stack TypeScript** eliminates class of type errors at FE/BE boundary; shared Zod schemas can be published as a package later.
- **Vue 3 + Pinia** is lightweight, has excellent mobile performance, and Tailwind makes mobile-first layout straightforward.
- **Express** is minimal and well-understood; layered architecture (routes → controllers → services → Prisma) is easy to extend.
- **Prisma** provides type-safe DB access and migration management with minimal boilerplate.
- **PaaS deployment** (Railway/Render) requires zero server maintenance and includes managed PostgreSQL — appropriate for Phase 1.

### Negative / Trade-offs
- **Express** is un-opinionated; the team must enforce architecture conventions manually (no framework guardrails).
- **Local filesystem storage** for receipts (Phase 1) will need migration to object storage (S3/R2) before horizontal scaling.
- **No password reset** in Phase 1 — admin must manually reset via DB; acceptable for small user base initially.
- **Coach role** is provisioned but has no Phase 1 UI — accounts created now, features deferred to Phase 2.

## References
- `REQUIREMENTS.md §8` — Tech Stack
- `REQUIREMENTS.md §9` — Architecture
- `REQUIREMENTS.md §11` — Resolved Decisions
