-- CreateEnum
CREATE TYPE "PajskTarget" AS ENUM ('tiada', 'sekolah', 'daerah', 'negeri', 'kebangsaan', 'antarabangsa');

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN "target_pajsk" "PajskTarget" NOT NULL DEFAULT 'tiada';
