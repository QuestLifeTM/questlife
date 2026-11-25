begin;

-- Serialize the data conversion with concurrent quest edits. Keep every quest
-- ID and its saved items, completions, collections, and posts intact.
lock table public.quests in access exclusive mode;
alter table public.quests drop constraint if exists quests_category_check;

-- The admin transition guard requires an authenticated app user. Suspend only
-- that guard for this deployment conversion, restoring it in the transaction.
alter table public.quests disable trigger quests_enforce_admin_transition;

update public.quests
set category = case
  when upper(trim(category)) = 'FOOD & DRINKS' then 'FOOD AND DRINKS'
  when upper(trim(category)) in ('ADVENTURE', 'FITNESS', 'FOOD AND DRINKS', 'CREATIVITY', 'SOCIAL')
    then upper(trim(category))
  else 'SOCIAL'
end
where category is distinct from case
  when upper(trim(category)) = 'FOOD & DRINKS' then 'FOOD AND DRINKS'
  when upper(trim(category)) in ('ADVENTURE', 'FITNESS', 'FOOD AND DRINKS', 'CREATIVITY', 'SOCIAL')
    then upper(trim(category))
  else 'SOCIAL'
end;

update public.quests
set accent_color = case category
  when 'ADVENTURE' then '#4AA3FF'
  when 'FITNESS' then '#FF5C5C'
  when 'FOOD AND DRINKS' then '#FF9A4A'
  when 'CREATIVITY' then '#A474FF'
  when 'SOCIAL' then '#4ACF78'
end
where accent_color is distinct from case category
  when 'ADVENTURE' then '#4AA3FF'
  when 'FITNESS' then '#FF5C5C'
  when 'FOOD AND DRINKS' then '#FF9A4A'
  when 'CREATIVITY' then '#A474FF'
  when 'SOCIAL' then '#4ACF78'
end;

alter table public.quests enable trigger quests_enforce_admin_transition;
alter table public.quests add constraint quests_category_check check (category in (
  'ADVENTURE', 'FITNESS', 'FOOD AND DRINKS', 'CREATIVITY', 'SOCIAL'
));

commit;
