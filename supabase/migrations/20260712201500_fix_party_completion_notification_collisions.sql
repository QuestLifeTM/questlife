-- A Party completion creates one Feed and one Leaderboard notification for every
-- active member. `created_at` is populated with `now()`, which is the transaction
-- timestamp in Postgres. The former unique key included that timestamp, so two
-- completion transactions that began in the same timestamp bucket could collide
-- and roll back an otherwise valid quest completion.
--
-- Notifications are append-only/read-state records and do not need timestamp
-- uniqueness. Keep the unread lookup index, but allow each completion to create
-- its own notification rows.
alter table public.party_member_notifications
  drop constraint if exists party_member_notifications_party_id_user_id_kind_created_at_key;
