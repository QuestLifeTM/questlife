-- Restore client permissions for user-owned saves and collections. RLS remains
-- enabled and the ownership policies on these tables continue to constrain rows.

grant select, insert, delete on table public.saved_quests to authenticated;

grant select, insert, update, delete on table public.user_adventure_packs to authenticated;
grant select, insert, update, delete on table public.user_adventure_pack_quests to authenticated;
