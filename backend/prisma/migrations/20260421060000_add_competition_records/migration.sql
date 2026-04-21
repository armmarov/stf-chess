-- CreateEnum
CREATE TYPE "CompetitionLevel" AS ENUM ('sekolah', 'daerah', 'negeri', 'kebangsaan', 'antarabangsa');

-- CreateEnum
CREATE TYPE "CompetitionCategory" AS ENUM ('u13', 'u14', 'u15', 'u16', 'u17', 'u18', 'u21', 'open');

-- CreateTable
CREATE TABLE "competition_records" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "competition_name" TEXT NOT NULL,
    "competition_date" DATE NOT NULL,
    "level" "CompetitionLevel" NOT NULL,
    "pajsk" BOOLEAN NOT NULL DEFAULT false,
    "fide_rated" BOOLEAN NOT NULL DEFAULT false,
    "mcf_rated" BOOLEAN NOT NULL DEFAULT false,
    "category" "CompetitionCategory" NOT NULL,
    "placement" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competition_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competition_records_student_id_idx" ON "competition_records"("student_id");

-- CreateIndex
CREATE INDEX "competition_records_competition_date_idx" ON "competition_records"("competition_date");

-- AddForeignKey
ALTER TABLE "competition_records" ADD CONSTRAINT "competition_records_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_records" ADD CONSTRAINT "competition_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
