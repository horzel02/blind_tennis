-- CreateEnum
CREATE TYPE "MatchResultType" AS ENUM ('NORMAL', 'WALKOVER', 'DISQUALIFICATION', 'RETIREMENT');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "resultNote" TEXT,
ADD COLUMN     "resultType" "MatchResultType" DEFAULT 'NORMAL';
