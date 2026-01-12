-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "role_name" VARCHAR(50) NOT NULL,
    "creation_date" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modification_date" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(10) NOT NULL,
    "gender" VARCHAR(10) NOT NULL,
    "street" VARCHAR(255) NOT NULL,
    "postalCode" VARCHAR(10) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "registration_deadline" TIMESTAMP(3),
    "participant_limit" INTEGER,
    "applicationsOpen" BOOLEAN NOT NULL DEFAULT true,
    "type" VARCHAR(10) NOT NULL DEFAULT 'open',
    "organizer_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "assignment_date" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "surname" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "creation_date" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modification_date" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournamentregistration" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" INTEGER,

    CONSTRAINT "tournamentregistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournamentuserrole" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournamentuserrole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_name" ON "roles"("role_name");

-- CreateIndex
CREATE INDEX "role_id" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "user_id" ON "user_roles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email" ON "users"("email");

-- CreateIndex
CREATE INDEX "TournamentRegistration_tournamentId_index" ON "tournamentregistration"("tournamentId");

-- CreateIndex
CREATE INDEX "TournamentRegistration_userId_index" ON "tournamentregistration"("userId");

-- CreateIndex
CREATE INDEX "tournamentregistration_invitedBy_idx" ON "tournamentregistration"("invitedBy");

-- CreateIndex
CREATE INDEX "tournamentuserrole_tournamentId_idx" ON "tournamentuserrole"("tournamentId");

-- CreateIndex
CREATE INDEX "tournamentuserrole_userId_idx" ON "tournamentuserrole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tournamentuserrole_tournamentId_userId_role_key" ON "tournamentuserrole"("tournamentId", "userId", "role");

-- AddForeignKey
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_ibfk_1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_ibfk_2" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "tournamentregistration" ADD CONSTRAINT "tournamentregistration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournamentregistration" ADD CONSTRAINT "tournamentregistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournamentuserrole" ADD CONSTRAINT "tournamentuserrole_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournamentuserrole" ADD CONSTRAINT "tournamentuserrole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
