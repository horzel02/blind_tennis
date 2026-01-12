/*
  Warnings:

  - The values [open] on the enum `TournamentFormula` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TournamentFormula_new" AS ENUM ('towarzyski', 'mistrzowski');
ALTER TABLE "tournament" ALTER COLUMN "formula" DROP DEFAULT;
ALTER TABLE "tournament" ALTER COLUMN "formula" TYPE "TournamentFormula_new" USING ("formula"::text::"TournamentFormula_new");
ALTER TYPE "TournamentFormula" RENAME TO "TournamentFormula_old";
ALTER TYPE "TournamentFormula_new" RENAME TO "TournamentFormula";
DROP TYPE "TournamentFormula_old";
ALTER TABLE "tournament" ALTER COLUMN "formula" SET DEFAULT 'towarzyski';
COMMIT;

-- AlterTable
ALTER TABLE "tournament" ALTER COLUMN "formula" SET DEFAULT 'towarzyski';
