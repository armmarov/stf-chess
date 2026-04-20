# Resources

## Feature Summary

Resources are curated learning materials (books, homework sheets, apps) managed by admins. Students and teachers consume them — browsing the list, viewing detail, downloading files or images. Admins control visibility through an `isEnabled` flag; disabled resources are invisible to non-admins.

| Role | Capabilities |
|------|-------------|
| Admin | Create, update, delete resources; view all (enabled and disabled) |
| Teacher | View and download enabled resources |
| Coach | View and download enabled resources |
| Student | View and download enabled resources |

## Data Model

```
Resource {
  id          uuid (PK)
  title       varchar(200)
  type        ResourceType enum  -- book | homework | app
  description text?
  url         string?            -- external link (valid URL)
  imagePath   string?            -- internal path under UPLOADS_DIR; never exposed
  filePath    string?            -- internal path under UPLOADS_DIR; never exposed
  fileName    string?            -- original uploaded filename (varchar 255); exposed in API
  fileMime    string?            -- stored MIME type (varchar 100); never exposed
  isEnabled   Boolean default true
  createdById uuid (FK → User, RESTRICT)
  createdAt   DateTime
  updatedAt   DateTime

  Indexes: [type], [isEnabled]
}
```

`Resource` rows are hard-deleted (no soft delete). Deleting a resource removes both image and file from disk.

## Enable / Disable Semantics

`isEnabled` is an admin-controlled flag. It does **not** represent a lifecycle state — it is simply a visibility toggle.

| Caller role | `isEnabled=true` | `isEnabled=false` |
|-------------|-----------------|------------------|
| Admin | Visible | Visible |
| Teacher / Coach / Student | Visible | **404** (indistinguishable from not found) |

This applies uniformly to: `GET /resources` (excluded from list), `GET /resources/{id}` (404), `GET /resources/{id}/image` (404), `GET /resources/{id}/file` (404).

## File Storage

Two independent files can be attached to a resource:

| Asset | Field name in multipart | Subdirectory | Allowed types | Max size |
|-------|------------------------|--------------|---------------|----------|
| Image (thumbnail) | `image` | `UPLOADS_DIR/resources/` | JPEG, PNG, WebP | 5 MB |
| Downloadable file | `file` | `UPLOADS_DIR/resources/` | Any | 20 MB |

Both assets are stored under the same `UPLOADS_DIR/resources/` subdirectory with UUID-based filenames. Internal paths (`imagePath`, `filePath`, `fileMime`) are **never exposed** in API responses. The API surface exposes:

- `hasImage: boolean` — true if an image is attached
- `hasFile: boolean` — true if a file is attached
- `fileName: string | null` — the original uploaded filename (e.g. `chapter3.pdf`)

Download endpoints serve the content directly:
- Image: `Content-Disposition: inline`; `Content-Type` from file extension
- File: `Content-Disposition: attachment; filename="<fileName>"` (falls back to a title-slug if `fileName` is null); `Content-Type` from stored MIME (`application/octet-stream` if unknown)

## PATCH Semantics

`PATCH /resources/{id}` accepts `multipart/form-data` — all fields optional.

| Action | How to trigger |
|--------|---------------|
| Update metadata | Send any of `title`, `type`, `description`, `url`, `isEnabled` |
| Clear description | Send `description=""` |
| Clear URL | Send `url=""` |
| Replace image | Upload a new `image` file (old file deleted from disk) |
| Remove image | Send `removeImage=true` (string) |
| Replace file | Upload a new `file` (old file deleted from disk) |
| Remove file | Send `removeFile=true` (string) |

`removeImage` and `removeFile` must be the string `"true"` (multipart form values are strings).

## API Reference

See `docs/api/openapi.yaml` paths:
- `GET /resources`
- `POST /resources`
- `GET /resources/{id}`
- `PATCH /resources/{id}`
- `DELETE /resources/{id}`
- `GET /resources/{id}/image`
- `GET /resources/{id}/file`
