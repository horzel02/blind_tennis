-- CreateEnum
CREATE TYPE "TournamentFormula" AS ENUM ('open', 'towarzyski', 'mistrzowski');

-- AlterTable
ALTER TABLE "tournament" ADD COLUMN     "formula" "TournamentFormula" NOT NULL DEFAULT 'open';
