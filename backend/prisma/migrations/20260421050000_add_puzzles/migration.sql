-- CreateEnum
CREATE TYPE "PuzzleAttemptStatus" AS ENUM ('solved', 'failed', 'gave_up');

-- CreateTable
CREATE TABLE "puzzles" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "fen" VARCHAR(120) NOT NULL,
    "solution_uci" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "rating_deviation" INTEGER,
    "popularity" INTEGER,
    "themes" TEXT,
    "opening_tags" TEXT,
    "game_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_attempts" (
    "id" TEXT NOT NULL,
    "puzzle_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "PuzzleAttemptStatus" NOT NULL,
    "moves_taken" INTEGER NOT NULL,
    "time_ms" INTEGER NOT NULL,
    "is_first_try" BOOLEAN NOT NULL,
    "attempted_on" DATE NOT NULL,

    CONSTRAINT "puzzle_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "puzzles_external_id_key" ON "puzzles"("external_id");

-- CreateIndex
CREATE INDEX "puzzles_rating_idx" ON "puzzles"("rating");

-- CreateIndex
CREATE INDEX "puzzle_attempts_user_id_attempted_on_idx" ON "puzzle_attempts"("user_id", "attempted_on");

-- CreateIndex
CREATE INDEX "puzzle_attempts_puzzle_id_idx" ON "puzzle_attempts"("puzzle_id");

-- AddForeignKey
ALTER TABLE "puzzle_attempts" ADD CONSTRAINT "puzzle_attempts_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_attempts" ADD CONSTRAINT "puzzle_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
