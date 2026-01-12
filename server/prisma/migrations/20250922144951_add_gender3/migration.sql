/*
  Warnings:

  - You are about to drop the column `prefferedCategory` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "prefferedCategory",
ADD COLUMN     "preferredCategory" VARCHAR(10);
