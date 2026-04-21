-- CreateEnum
CREATE TYPE "GameResult" AS ENUM ('1-0', '0-1', '1/2-1/2');

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "tournament_name" VARCHAR(200) NOT NULL,
    "white_player" VARCHAR(120) NOT NULL,
    "black_player" VARCHAR(120) NOT NULL,
    "result" "GameResult" NOT NULL,
    "pgn" TEXT NOT NULL,
    "event_date" DATE,
    "white_elo" INTEGER,
    "black_elo" INTEGER,
    "opening" VARCHAR(120),
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "games_created_at_idx" ON "games"("created_at");

-- CreateIndex
CREATE INDEX "games_tournament_name_idx" ON "games"("tournament_name");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
