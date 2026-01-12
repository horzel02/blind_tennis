/*
  Warnings:

  - Made the column `allowByes` on table `tournament` required. This step will fail if there are existing NULL values in that column.
  - Made the column `avoidSameGroupInR1` on table `tournament` required. This step will fail if there are existing NULL values in that column.
  - Made the column `groupSize` on table `tournament` required. This step will fail if there are existing NULL values in that column.
  - Made the column `koSeedingPolicy` on table `tournament` required. This step will fail if there are existing NULL values in that column.
  - Made the column `qualifiersPerGroup` on table `tournament` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "tournament" ALTER COLUMN "allowByes" SET NOT NULL,
ALTER COLUMN "avoidSameGroupInR1" SET NOT NULL,
ALTER COLUMN "groupSize" SET NOT NULL,
ALTER COLUMN "koSeedingPolicy" SET NOT NULL,
ALTER COLUMN "qualifiersPerGroup" SET NOT NULL;
