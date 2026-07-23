-- Post authors may change or remove only their own shared posts. The existing
-- post/comment foreign keys preserve the quest record and cascade comments.
alter table public.quest_posts enable row level security;

drop policy if exists "Post authors update their quest posts" on public.quest_posts;
create policy "Post authors update their quest posts"
  on public.quest_posts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Post authors delete their quest posts" on public.quest_posts;
create policy "Post authors delete their quest posts"
  on public.quest_posts for delete to authenticated
  using ((select auth.uid()) = user_id);
