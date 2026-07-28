begin;

-- This deployment migration runs without an authenticated app user. The
-- transition trigger is unrelated to category data, so suspend it only while
-- converting the existing records, then restore normal protection below.
alter table public.quests disable trigger quests_enforce_admin_transition;

update public.quests
set
  category = case category
    when 'SKILLS' then 'CREATIVITY'
    when 'NATURE' then 'ADVENTURE'
    else category
  end,
  accent_color = case category
    when 'SKILLS' then '#9C4DFF'
    when 'NATURE' then '#4D9CFF'
    else accent_color
  end
where category in ('SKILLS', 'NATURE');

alter table public.quests enable trigger quests_enforce_admin_transition;

alter table public.quests drop constraint if exists quests_category_check;
alter table public.quests add constraint quests_category_check check (category in (
  'ADVENTURE',
  'FOOD AND DRINKS',
  'FITNESS',
  'CREATIVITY',
  'EVENTS',
  'SOCIAL',
  'WILD CARD'
));

commit;
