/*
  Warnings:

  - You are about to drop the column `category` on the `tournament` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `tournament` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tournament" DROP COLUMN "category",
DROP COLUMN "gender",
ADD COLUMN     "gamesPerSet" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "isGenderSeparated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isGroupPhase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "setsToWin" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'registration_open',
ADD COLUMN     "tieBreakType" VARCHAR(10) NOT NULL DEFAULT 'super';

-- AlterTable
ALTER TABLE "tournamentregistration" ADD COLUMN     "blindnessCategory" VARCHAR(10),
ADD COLUMN     "gender" VARCHAR(10);

-- CreateTable
CREATE TABLE "TournamentCategory" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "categoryName" VARCHAR(10) NOT NULL,
    "gender" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "tournamentCategoryId" INTEGER NOT NULL,
    "round" VARCHAR(50) NOT NULL,
    "player1Id" INTEGER NOT NULL,
    "player2Id" INTEGER NOT NULL,
    "refereeId" INTEGER,
    "winnerId" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "courtNumber" VARCHAR(10),
    "matchTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSet" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "player1Score" INTEGER NOT NULL,
    "player2Score" INTEGER NOT NULL,

    CONSTRAINT "MatchSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentCategory_tournamentId_idx" ON "TournamentCategory"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentCategory_tournamentId_categoryName_gender_key" ON "TournamentCategory"("tournamentId", "categoryName", "gender");

-- CreateIndex
CREATE INDEX "Match_tournamentId_idx" ON "Match"("tournamentId");

-- CreateIndex
CREATE INDEX "Match_tournamentCategoryId_idx" ON "Match"("tournamentCategoryId");

-- CreateIndex
CREATE INDEX "Match_player1Id_idx" ON "Match"("player1Id");

-- CreateIndex
CREATE INDEX "Match_player2Id_idx" ON "Match"("player2Id");

-- CreateIndex
CREATE INDEX "Match_refereeId_idx" ON "Match"("refereeId");

-- CreateIndex
CREATE INDEX "MatchSet_matchId_idx" ON "MatchSet"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSet_matchId_setNumber_key" ON "MatchSet"("matchId", "setNumber");

-- AddForeignKey
ALTER TABLE "TournamentCategory" ADD CONSTRAINT "TournamentCategory_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentCategoryId_fkey" FOREIGN KEY ("tournamentCategoryId") REFERENCES "TournamentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSet" ADD CONSTRAINT "MatchSet_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "TournamentRegistration_tournamentId_index" RENAME TO "tournamentregistration_tournamentId_idx";

-- RenameIndex
ALTER INDEX "TournamentRegistration_userId_index" RENAME TO "tournamentregistration_userId_idx";
