# API Documentation

The single source of truth for the STF Supreme Chess REST API is `openapi.yaml` in this directory (OpenAPI 3.1).

## Viewing the spec

**Option 1 — Swagger UI (online, no install):**
1. Open [https://editor.swagger.io](https://editor.swagger.io)
2. Paste the contents of `openapi.yaml` into the editor.

**Option 2 — Redocly (online, cleaner read view):**
1. Open [https://redocly.github.io/redoc/](https://redocly.github.io/redoc/)
2. Use "Try it" with a local file URL, or copy-paste via the Redoc CLI.

**Option 3 — Redocly CLI (local):**
```bash
npx @redocly/cli preview-docs docs/api/openapi.yaml
```

**Option 4 — VS Code extension:**
Install [OpenAPI (Swagger) Editor](https://marketplace.visualstudio.com/items?itemName=42Crunch.vscode-openapi) and open `openapi.yaml`.

## Keeping the spec in sync

- **When backend-developer ships or changes an endpoint**, the documentation-expert updates `openapi.yaml` in the same change set.
- Schemas live under `components/schemas` — reuse them via `$ref`; do not inline duplicates.
- If the backend implementation diverges from the spec, flag it to `backend-developer` and `system-architect` immediately.
- Each endpoint must document: method, path, summary, auth requirement, allowed roles (in description), request body, all response schemas, and error codes.
