-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('GROUPS_KO', 'KO_ONLY');

-- CreateEnum
CREATE TYPE "KOSeedingPolicy" AS ENUM ('RANDOM_CROSS', 'STRUCTURED');

-- AlterTable
ALTER TABLE "tournament" ADD COLUMN     "allowByes" BOOLEAN DEFAULT true,
ADD COLUMN     "avoidSameGroupInR1" BOOLEAN DEFAULT true,
ADD COLUMN     "format" "TournamentFormat" NOT NULL DEFAULT 'KO_ONLY',
ADD COLUMN     "groupSize" INTEGER DEFAULT 4,
ADD COLUMN     "koSeedingPolicy" "KOSeedingPolicy" DEFAULT 'RANDOM_CROSS',
ADD COLUMN     "qualifiersPerGroup" INTEGER DEFAULT 2;
