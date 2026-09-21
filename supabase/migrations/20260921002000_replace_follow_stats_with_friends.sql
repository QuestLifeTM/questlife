-- The profile carousel now presents one mutual-friends count instead of two
-- directional follow counts. Preserve all other user visibility choices.
update public.profiles
set stat_visibility = jsonb_set(
  coalesce(stat_visibility, '{}'::jsonb) - 'followers' - 'following',
  '{friends}',
  'true'::jsonb,
  true
);
