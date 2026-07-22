create table public.quest_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.quest_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.quest_post_comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index quest_post_comments_post_created_idx on public.quest_post_comments(post_id, created_at);
alter table public.quest_post_comments enable row level security;
create policy "Authenticated users read post comments" on public.quest_post_comments for select to authenticated using (true);
create policy "Users add their own comments" on public.quest_post_comments for insert to authenticated with check ((select auth.uid()) = user_id);

create or replace function public.get_quest_post_comments(p_post_id uuid)
returns jsonb language sql security definer set search_path = '' stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'parentId', c.parent_id, 'body', c.body, 'createdAt', c.created_at,
    'userId', p.id, 'displayName', coalesce(p.display_name, 'Adventurer'), 'username', p.username,
    'emoji', p.emoji, 'avatarColor', p.avatar_color
  ) order by c.created_at), '[]'::jsonb)
  from public.quest_post_comments c join public.profiles p on p.id = c.user_id where c.post_id = p_post_id;
$$;

create or replace function public.add_quest_post_comment(p_post_id uuid, p_body text, p_parent_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare row public.quest_post_comments;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.quest_post_comments(post_id, user_id, parent_id, body)
  values (p_post_id, auth.uid(), p_parent_id, trim(p_body)) returning * into row;
  return jsonb_build_object('id', row.id);
end;
$$;

revoke all on function public.get_quest_post_comments(uuid) from public, anon;
revoke all on function public.add_quest_post_comment(uuid, text, uuid) from public, anon;
grant execute on function public.get_quest_post_comments(uuid), public.add_quest_post_comment(uuid, text, uuid) to authenticated;
