-- CreateEnum
CREATE TYPE "GuardianStatus" AS ENUM ('invited', 'accepted', 'declined', 'revoked');

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "title" VARCHAR(120),
    "body" TEXT,
    "link" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentGuardian" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "guardianUserId" INTEGER,
    "status" "GuardianStatus" NOT NULL DEFAULT 'invited',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "invitedByUserId" INTEGER,
    "note" VARCHAR(255),

    CONSTRAINT "TournamentGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TournamentGuardian_tournamentId_idx" ON "TournamentGuardian"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentGuardian_playerId_idx" ON "TournamentGuardian"("playerId");

-- CreateIndex
CREATE INDEX "TournamentGuardian_guardianUserId_idx" ON "TournamentGuardian"("guardianUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentGuardian_tournamentId_playerId_guardianUserId_key" ON "TournamentGuardian"("tournamentId", "playerId", "guardianUserId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentGuardian" ADD CONSTRAINT "TournamentGuardian_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentGuardian" ADD CONSTRAINT "TournamentGuardian_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentGuardian" ADD CONSTRAINT "TournamentGuardian_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentGuardian" ADD CONSTRAINT "TournamentGuardian_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
