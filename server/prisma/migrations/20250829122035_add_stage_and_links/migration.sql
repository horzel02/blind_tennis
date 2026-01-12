-- CreateEnum
CREATE TYPE "MatchStage" AS ENUM ('group', 'knockout');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "categoryGroupId" INTEGER,
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "roundOrder" INTEGER,
ADD COLUMN     "sourceA" VARCHAR(50),
ADD COLUMN     "sourceB" VARCHAR(50),
ADD COLUMN     "stage" "MatchStage" NOT NULL DEFAULT 'group';

-- CreateTable
CREATE TABLE "CategoryConfig" (
    "id" SERIAL NOT NULL,
    "tournamentCategoryId" INTEGER NOT NULL,
    "groupsCount" INTEGER NOT NULL DEFAULT 0,
    "groupSizeMin" INTEGER NOT NULL DEFAULT 3,
    "groupSizeMax" INTEGER NOT NULL DEFAULT 6,
    "advancePerGroup" INTEGER NOT NULL DEFAULT 2,
    "allowBestThirds" BOOLEAN NOT NULL DEFAULT false,
    "bracketSeeding" VARCHAR(20) NOT NULL DEFAULT 'draw',
    "groupAllocation" VARCHAR(20) NOT NULL DEFAULT 'draw',
    "rulesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryGroup" (
    "id" SERIAL NOT NULL,
    "tournamentCategoryId" INTEGER NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSlot" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "position" INTEGER,
    "seed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryConfig_tournamentCategoryId_key" ON "CategoryConfig"("tournamentCategoryId");

-- CreateIndex
CREATE INDEX "CategoryGroup_tournamentCategoryId_idx" ON "CategoryGroup"("tournamentCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryGroup_tournamentCategoryId_name_key" ON "CategoryGroup"("tournamentCategoryId", "name");

-- CreateIndex
CREATE INDEX "GroupSlot_userId_idx" ON "GroupSlot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSlot_groupId_userId_key" ON "GroupSlot"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSlot_groupId_position_key" ON "GroupSlot"("groupId", "position");

-- CreateIndex
CREATE INDEX "Match_stage_idx" ON "Match"("stage");

-- CreateIndex
CREATE INDEX "Match_categoryGroupId_idx" ON "Match"("categoryGroupId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_categoryGroupId_fkey" FOREIGN KEY ("categoryGroupId") REFERENCES "CategoryGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryConfig" ADD CONSTRAINT "CategoryConfig_tournamentCategoryId_fkey" FOREIGN KEY ("tournamentCategoryId") REFERENCES "TournamentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryGroup" ADD CONSTRAINT "CategoryGroup_tournamentCategoryId_fkey" FOREIGN KEY ("tournamentCategoryId") REFERENCES "TournamentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSlot" ADD CONSTRAINT "GroupSlot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CategoryGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSlot" ADD CONSTRAINT "GroupSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
