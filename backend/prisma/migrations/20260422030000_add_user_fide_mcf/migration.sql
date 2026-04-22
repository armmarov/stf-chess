-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "fide_id"                 TEXT,
  ADD COLUMN "mcf_id"                  TEXT,
  ADD COLUMN "fide_standard_rating"    INTEGER,
  ADD COLUMN "fide_rapid_rating"       INTEGER,
  ADD COLUMN "fide_blitz_rating"       INTEGER,
  ADD COLUMN "fide_rating_fetched_at"  TIMESTAMP(3);
