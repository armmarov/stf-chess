-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "image_path" TEXT,
    "registration_link" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_interests" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournaments_start_date_idx" ON "tournaments"("start_date");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_interests_tournament_id_student_id_key" ON "tournament_interests"("tournament_id", "student_id");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_interests" ADD CONSTRAINT "tournament_interests_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_interests" ADD CONSTRAINT "tournament_interests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
