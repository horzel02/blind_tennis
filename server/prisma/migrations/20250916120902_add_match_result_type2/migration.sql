/*
  Warnings:

  - Made the column `resultType` on table `Match` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Match" ALTER COLUMN "resultType" SET NOT NULL;
