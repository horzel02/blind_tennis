-- AlterTable
ALTER TABLE "category_config" RENAME CONSTRAINT "CategoryConfig_pkey" TO "category_config_pkey";

-- AlterTable
ALTER TABLE "category_group" RENAME CONSTRAINT "CategoryGroup_pkey" TO "category_group_pkey";

-- AlterTable
ALTER TABLE "group_slot" RENAME CONSTRAINT "GroupSlot_pkey" TO "group_slot_pkey";

-- AlterTable
ALTER TABLE "match" RENAME CONSTRAINT "Match_pkey" TO "match_pkey";

-- AlterTable
ALTER TABLE "match_set" RENAME CONSTRAINT "MatchSet_pkey" TO "match_set_pkey";

-- AlterTable
ALTER TABLE "notification" RENAME CONSTRAINT "Notification_pkey" TO "notification_pkey";

-- AlterTable
ALTER TABLE "tournament_category" RENAME CONSTRAINT "TournamentCategory_pkey" TO "tournament_category_pkey";

-- AlterTable
ALTER TABLE "tournament_guardian" RENAME CONSTRAINT "TournamentGuardian_pkey" TO "tournament_guardian_pkey";

-- AlterTable
ALTER TABLE "tournament_registration" RENAME CONSTRAINT "tournamentregistration_pkey" TO "tournament_registration_pkey";

-- AlterTable
ALTER TABLE "tournament_user_role" RENAME CONSTRAINT "tournamentuserrole_pkey" TO "tournament_user_role_pkey";

-- RenameForeignKey
ALTER TABLE "category_config" RENAME CONSTRAINT "CategoryConfig_tournamentCategoryId_fkey" TO "category_config_tournament_category_id_fkey";

-- RenameForeignKey
ALTER TABLE "category_group" RENAME CONSTRAINT "CategoryGroup_tournamentCategoryId_fkey" TO "category_group_tournament_category_id_fkey";

-- RenameForeignKey
ALTER TABLE "group_slot" RENAME CONSTRAINT "GroupSlot_groupId_fkey" TO "group_slot_group_id_fkey";

-- RenameForeignKey
ALTER TABLE "group_slot" RENAME CONSTRAINT "GroupSlot_userId_fkey" TO "group_slot_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "match" RENAME CONSTRAINT "Match_categoryGroupId_fkey" TO "match_category_group_id_fkey";

-- RenameForeignKey
ALTER TABLE "match" RENAME CONSTRAINT "Match_player1Id_fkey" TO "match_player1_id_fkey";

-- RenameForeignKey
ALTER TABLE "match" RENAME CONSTRAINT "Match_player2Id_fkey" TO "match_player2_id_fkey";

-- RenameForeignKey
ALTER TABLE "match" RENAME CONSTRAINT "Match_refereeId_fkey" TO "match_referee_id_fkey";

-- RenameForeignKey
ALTER TABLE "match" RENAME CONSTRAINT "Match_tournamentCategoryId_fkey" TO "match_tournament_category_id_fkey";

-- RenameForeignKey
ALTER TABLE "match" RENAME CONSTRAINT "Match_tournamentId_fkey" TO "match_tournament_id_fkey";

-- RenameForeignKey
ALTER TABLE "match" RENAME CONSTRAINT "Match_winnerId_fkey" TO "match_winner_id_fkey";

-- RenameForeignKey
ALTER TABLE "match_set" RENAME CONSTRAINT "MatchSet_matchId_fkey" TO "match_set_match_id_fkey";

-- RenameForeignKey
ALTER TABLE "notification" RENAME CONSTRAINT "Notification_userId_fkey" TO "notification_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "tournament_category" RENAME CONSTRAINT "TournamentCategory_tournamentId_fkey" TO "tournament_category_tournament_id_fkey";

-- RenameForeignKey
ALTER TABLE "tournament_guardian" RENAME CONSTRAINT "TournamentGuardian_guardianUserId_fkey" TO "tournament_guardian_guardian_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "tournament_guardian" RENAME CONSTRAINT "TournamentGuardian_invitedByUserId_fkey" TO "tournament_guardian_invited_by_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "tournament_guardian" RENAME CONSTRAINT "TournamentGuardian_playerId_fkey" TO "tournament_guardian_player_id_fkey";

-- RenameForeignKey
ALTER TABLE "tournament_guardian" RENAME CONSTRAINT "TournamentGuardian_tournamentId_fkey" TO "tournament_guardian_tournament_id_fkey";

-- RenameForeignKey
ALTER TABLE "tournament_registration" RENAME CONSTRAINT "tournamentregistration_tournamentId_fkey" TO "tournament_registration_tournament_id_fkey";

-- RenameForeignKey
ALTER TABLE "tournament_registration" RENAME CONSTRAINT "tournamentregistration_userId_fkey" TO "tournament_registration_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "tournament_user_role" RENAME CONSTRAINT "tournamentuserrole_tournamentId_fkey" TO "tournament_user_role_tournament_id_fkey";

-- RenameForeignKey
ALTER TABLE "tournament_user_role" RENAME CONSTRAINT "tournamentuserrole_userId_fkey" TO "tournament_user_role_user_id_fkey";

-- RenameIndex
ALTER INDEX "CategoryConfig_tournamentCategoryId_key" RENAME TO "category_config_tournament_category_id_key";

-- RenameIndex
ALTER INDEX "CategoryGroup_tournamentCategoryId_idx" RENAME TO "category_group_tournament_category_id_idx";

-- RenameIndex
ALTER INDEX "CategoryGroup_tournamentCategoryId_name_key" RENAME TO "category_group_tournament_category_id_name_key";

-- RenameIndex
ALTER INDEX "GroupSlot_groupId_position_key" RENAME TO "group_slot_group_id_position_key";

-- RenameIndex
ALTER INDEX "GroupSlot_groupId_userId_key" RENAME TO "group_slot_group_id_user_id_key";

-- RenameIndex
ALTER INDEX "GroupSlot_userId_idx" RENAME TO "group_slot_user_id_idx";

-- RenameIndex
ALTER INDEX "Match_categoryGroupId_idx" RENAME TO "match_category_group_id_idx";

-- RenameIndex
ALTER INDEX "Match_player1Id_idx" RENAME TO "match_player1_id_idx";

-- RenameIndex
ALTER INDEX "Match_player2Id_idx" RENAME TO "match_player2_id_idx";

-- RenameIndex
ALTER INDEX "Match_refereeId_idx" RENAME TO "match_referee_id_idx";

-- RenameIndex
ALTER INDEX "Match_stage_idx" RENAME TO "match_stage_idx";

-- RenameIndex
ALTER INDEX "Match_tournamentCategoryId_idx" RENAME TO "match_tournament_category_id_idx";

-- RenameIndex
ALTER INDEX "Match_tournamentId_idx" RENAME TO "match_tournament_id_idx";

-- RenameIndex
ALTER INDEX "MatchSet_matchId_idx" RENAME TO "match_set_match_id_idx";

-- RenameIndex
ALTER INDEX "MatchSet_matchId_setNumber_key" RENAME TO "match_set_match_id_set_number_key";

-- RenameIndex
ALTER INDEX "Notification_userId_createdAt_idx" RENAME TO "notification_user_id_created_at_idx";

-- RenameIndex
ALTER INDEX "Notification_userId_resolvedAt_idx" RENAME TO "notification_user_id_resolved_at_idx";

-- RenameIndex
ALTER INDEX "TournamentCategory_tournamentId_categoryName_gender_key" RENAME TO "tournament_category_tournament_id_category_name_gender_key";

-- RenameIndex
ALTER INDEX "TournamentCategory_tournamentId_idx" RENAME TO "tournament_category_tournament_id_idx";

-- RenameIndex
ALTER INDEX "TournamentGuardian_guardianUserId_idx" RENAME TO "tournament_guardian_guardian_user_id_idx";

-- RenameIndex
ALTER INDEX "TournamentGuardian_playerId_idx" RENAME TO "tournament_guardian_player_id_idx";

-- RenameIndex
ALTER INDEX "TournamentGuardian_tournamentId_idx" RENAME TO "tournament_guardian_tournament_id_idx";

-- RenameIndex
ALTER INDEX "TournamentGuardian_tournamentId_playerId_guardianUserId_key" RENAME TO "tournament_guardian_tournament_id_player_id_guardian_user_i_key";

-- RenameIndex
ALTER INDEX "tournamentregistration_invitedBy_idx" RENAME TO "tournament_registration_invited_by_idx";

-- RenameIndex
ALTER INDEX "tournamentregistration_tournamentId_idx" RENAME TO "tournament_registration_tournament_id_idx";

-- RenameIndex
ALTER INDEX "tournamentregistration_userId_idx" RENAME TO "tournament_registration_user_id_idx";

-- RenameIndex
ALTER INDEX "tournamentuserrole_tournamentId_idx" RENAME TO "tournament_user_role_tournament_id_idx";

-- RenameIndex
ALTER INDEX "tournamentuserrole_tournamentId_userId_role_key" RENAME TO "tournament_user_role_tournament_id_user_id_role_key";

-- RenameIndex
ALTER INDEX "tournamentuserrole_userId_idx" RENAME TO "tournament_user_role_user_id_idx";
