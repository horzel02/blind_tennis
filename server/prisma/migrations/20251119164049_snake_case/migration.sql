-- 1) ZMIANA NAZW TABEL NA snake_case

ALTER TABLE "tournamentregistration"  RENAME TO "tournament_registration";
ALTER TABLE "tournamentuserrole"      RENAME TO "tournament_user_role";
ALTER TABLE "TournamentCategory"      RENAME TO "tournament_category";
ALTER TABLE "Match"                   RENAME TO "match";
ALTER TABLE "MatchSet"                RENAME TO "match_set";
ALTER TABLE "CategoryConfig"          RENAME TO "category_config";
ALTER TABLE "CategoryGroup"           RENAME TO "category_group";
ALTER TABLE "GroupSlot"               RENAME TO "group_slot";
ALTER TABLE "Notification"            RENAME TO "notification";
ALTER TABLE "TournamentGuardian"      RENAME TO "tournament_guardian";

-- 2) ZMIANY NAZW KOLUMN NA snake_case

-- tournament
ALTER TABLE "tournament"
  RENAME COLUMN "postalCode"          TO "postal_code";
ALTER TABLE "tournament"
  RENAME COLUMN "applicationsOpen"    TO "applications_open";
ALTER TABLE "tournament"
  RENAME COLUMN "groupSize"           TO "group_size";
ALTER TABLE "tournament"
  RENAME COLUMN "qualifiersPerGroup"  TO "qualifiers_per_group";
ALTER TABLE "tournament"
  RENAME COLUMN "allowByes"           TO "allow_byes";
ALTER TABLE "tournament"
  RENAME COLUMN "koSeedingPolicy"     TO "ko_seeding_policy";
ALTER TABLE "tournament"
  RENAME COLUMN "avoidSameGroupInR1"  TO "avoid_same_group_in_r1";
ALTER TABLE "tournament"
  RENAME COLUMN "isGroupPhase"        TO "is_group_phase";
ALTER TABLE "tournament"
  RENAME COLUMN "isGenderSeparated"   TO "is_gender_separated";
ALTER TABLE "tournament"
  RENAME COLUMN "setsToWin"           TO "sets_to_win";
ALTER TABLE "tournament"
  RENAME COLUMN "gamesPerSet"         TO "games_per_set";
ALTER TABLE "tournament"
  RENAME COLUMN "tieBreakType"        TO "tie_break_type";

-- users
ALTER TABLE "users"
  RENAME COLUMN "preferredCategory"   TO "preferred_category";

-- tournament_registration (dawne tournamentregistration)
ALTER TABLE "tournament_registration"
  RENAME COLUMN "tournamentId"        TO "tournament_id";
ALTER TABLE "tournament_registration"
  RENAME COLUMN "userId"              TO "user_id";
ALTER TABLE "tournament_registration"
  RENAME COLUMN "blindnessCategory"   TO "blindness_category";
ALTER TABLE "tournament_registration"
  RENAME COLUMN "createdAt"           TO "created_at";
ALTER TABLE "tournament_registration"
  RENAME COLUMN "updatedAt"           TO "updated_at";
ALTER TABLE "tournament_registration"
  RENAME COLUMN "invitedBy"           TO "invited_by";

-- tournament_user_role (dawne tournamentuserrole)
ALTER TABLE "tournament_user_role"
  RENAME COLUMN "tournamentId"        TO "tournament_id";
ALTER TABLE "tournament_user_role"
  RENAME COLUMN "userId"              TO "user_id";
ALTER TABLE "tournament_user_role"
  RENAME COLUMN "createdAt"           TO "created_at";

-- tournament_category (dawne TournamentCategory)
ALTER TABLE "tournament_category"
  RENAME COLUMN "tournamentId"        TO "tournament_id";
ALTER TABLE "tournament_category"
  RENAME COLUMN "categoryName"        TO "category_name";
ALTER TABLE "tournament_category"
  RENAME COLUMN "createdAt"           TO "created_at";

-- match (dawne Match)
ALTER TABLE "match"
  RENAME COLUMN "tournamentId"        TO "tournament_id";
ALTER TABLE "match"
  RENAME COLUMN "tournamentCategoryId" TO "tournament_category_id";
ALTER TABLE "match"
  RENAME COLUMN "player1Id"           TO "player1_id";
ALTER TABLE "match"
  RENAME COLUMN "player2Id"           TO "player2_id";
ALTER TABLE "match"
  RENAME COLUMN "refereeId"           TO "referee_id";
ALTER TABLE "match"
  RENAME COLUMN "winnerId"            TO "winner_id";
ALTER TABLE "match"
  RENAME COLUMN "courtNumber"         TO "court_number";
ALTER TABLE "match"
  RENAME COLUMN "matchTime"           TO "match_time";
ALTER TABLE "match"
  RENAME COLUMN "durationMin"         TO "duration_min";
ALTER TABLE "match"
  RENAME COLUMN "categoryGroupId"     TO "category_group_id";
ALTER TABLE "match"
  RENAME COLUMN "roundOrder"          TO "round_order";
ALTER TABLE "match"
  RENAME COLUMN "sourceA"             TO "source_a";
ALTER TABLE "match"
  RENAME COLUMN "sourceB"             TO "source_b";
ALTER TABLE "match"
  RENAME COLUMN "createdAt"           TO "created_at";
ALTER TABLE "match"
  RENAME COLUMN "updatedAt"           TO "updated_at";
ALTER TABLE "match"
  RENAME COLUMN "resultType"          TO "result_type";
ALTER TABLE "match"
  RENAME COLUMN "resultNote"          TO "result_note";

-- match_set (dawne MatchSet)
ALTER TABLE "match_set"
  RENAME COLUMN "matchId"             TO "match_id";
ALTER TABLE "match_set"
  RENAME COLUMN "setNumber"           TO "set_number";
ALTER TABLE "match_set"
  RENAME COLUMN "player1Score"        TO "player1_score";
ALTER TABLE "match_set"
  RENAME COLUMN "player2Score"        TO "player2_score";

-- category_config (dawne CategoryConfig)
ALTER TABLE "category_config"
  RENAME COLUMN "tournamentCategoryId" TO "tournament_category_id";
ALTER TABLE "category_config"
  RENAME COLUMN "groupsCount"          TO "groups_count";
ALTER TABLE "category_config"
  RENAME COLUMN "groupSizeMin"         TO "group_size_min";
ALTER TABLE "category_config"
  RENAME COLUMN "groupSizeMax"         TO "group_size_max";
ALTER TABLE "category_config"
  RENAME COLUMN "advancePerGroup"      TO "advance_per_group";
ALTER TABLE "category_config"
  RENAME COLUMN "allowBestThirds"      TO "allow_best_thirds";
ALTER TABLE "category_config"
  RENAME COLUMN "bracketSeeding"       TO "bracket_seeding";
ALTER TABLE "category_config"
  RENAME COLUMN "groupAllocation"      TO "group_allocation";
ALTER TABLE "category_config"
  RENAME COLUMN "rulesJson"            TO "rules_json";
ALTER TABLE "category_config"
  RENAME COLUMN "createdAt"            TO "created_at";
ALTER TABLE "category_config"
  RENAME COLUMN "updatedAt"            TO "updated_at";

-- category_group (dawne CategoryGroup)
ALTER TABLE "category_group"
  RENAME COLUMN "tournamentCategoryId" TO "tournament_category_id";
ALTER TABLE "category_group"
  RENAME COLUMN "orderIndex"           TO "order_index";
ALTER TABLE "category_group"
  RENAME COLUMN "createdAt"            TO "created_at";
ALTER TABLE "category_group"
  RENAME COLUMN "updatedAt"            TO "updated_at";

-- group_slot (dawne GroupSlot)
ALTER TABLE "group_slot"
  RENAME COLUMN "groupId"              TO "group_id";
ALTER TABLE "group_slot"
  RENAME COLUMN "userId"               TO "user_id";
ALTER TABLE "group_slot"
  RENAME COLUMN "createdAt"            TO "created_at";
ALTER TABLE "group_slot"
  RENAME COLUMN "updatedAt"            TO "updated_at";

-- notification (dawne Notification)
ALTER TABLE "notification"
  RENAME COLUMN "userId"               TO "user_id";
ALTER TABLE "notification"
  RENAME COLUMN "createdAt"            TO "created_at";
ALTER TABLE "notification"
  RENAME COLUMN "readAt"               TO "read_at";
ALTER TABLE "notification"
  RENAME COLUMN "resolvedAt"           TO "resolved_at";

-- tournament_guardian (dawne TournamentGuardian)
ALTER TABLE "tournament_guardian"
  RENAME COLUMN "tournamentId"         TO "tournament_id";
ALTER TABLE "tournament_guardian"
  RENAME COLUMN "playerId"             TO "player_id";
ALTER TABLE "tournament_guardian"
  RENAME COLUMN "guardianUserId"       TO "guardian_user_id";
ALTER TABLE "tournament_guardian"
  RENAME COLUMN "invitedAt"            TO "invited_at";
ALTER TABLE "tournament_guardian"
  RENAME COLUMN "respondedAt"          TO "responded_at";
ALTER TABLE "tournament_guardian"
  RENAME COLUMN "invitedByUserId"      TO "invited_by_user_id";
