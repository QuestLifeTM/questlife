const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const alice = '00000000-0000-0000-0000-000000000001';
const bob = '00000000-0000-0000-0000-000000000002';
const quest = '00000000-0000-0000-0000-000000000010';
const session = '00000000-0000-0000-0000-000000000020';
let db;
before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth, storage to authenticated;
    create table public.profiles(id uuid primary key, total_xp integer not null default 0);
    create table public.quests(id uuid primary key, quest_mode text default 'focused', experience_points integer default 100);
    create table public.quest_completions(id uuid primary key default gen_random_uuid(), user_id uuid, quest_id uuid, completed_on date, reflection text, xp_awarded integer, logged boolean, rating smallint, review_text text, review_public boolean, photo_urls text[], created_at timestamptz default now());
    create table public.quest_sessions(id uuid primary key, user_id uuid, quest_id uuid, started_at timestamptz default now(), ended_at timestamptz, status text default 'doing_now');
    create table public.quest_session_snapshots(session_id uuid primary key, user_id uuid, active_duration_ms bigint, recording_state text, updated_at timestamptz default now());
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text, metadata jsonb);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
    create function public.daily_quest_limit_is_enabled() returns boolean language sql as $$ select false $$;
    create function public.fixture_completion_xp() returns trigger language plpgsql as $$ begin update public.profiles set total_xp = total_xp + new.xp_awarded where id = new.user_id; return new; end $$;
    create trigger completion_xp after insert on public.quest_completions for each row execute function public.fixture_completion_xp();
  `);
  await db.exec(fs.readFileSync('supabase/migrations/20261103173147_ios_quest_journey_rewards.sql', 'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261103224411_personalized_quest_activities.sql', 'utf8'));
});
after(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`reset role; truncate auth.users, public.profiles, public.quests, public.quest_sessions, public.quest_completions, public.quest_session_snapshots, storage.objects cascade;
    insert into auth.users values ('${alice}'),('${bob}'); insert into public.profiles(id) values ('${alice}'),('${bob}');
    insert into public.quests(id) values ('${quest}');
    insert into public.quest_sessions(id,user_id,quest_id,started_at) values ('${session}','${alice}','${quest}',now()-interval '30 minutes');
    insert into public.quest_session_snapshots values ('${session}','${alice}',1800000,'paused',now());
    select set_config('request.jwt.claim.sub','${alice}',false);`);
});
function event(overrides = {}) { return { id: 'mood:1', kind: 'mood', mood: 'happy', capturedAt: new Date().toISOString(), activeElapsedMs: 600000, promptId: 'mood:1', ...overrides }; }
async function save(value) { return (await db.query('select public.save_quest_journey_event($1::uuid,$2::jsonb) as result', [session, JSON.stringify(value)])).rows[0].result; }
async function xp() { return (await db.query('select total_xp from public.profiles where id=$1', [alice])).rows[0].total_xp; }

test('migration executes; duplicate/lost responses and concurrent claims credit a fixed reward only once', async () => {
  const value = event({ xp: 999999 });
  const results = await Promise.all([save(value), save(value), save({ ...value, id: 'different-id' })]);
  assert.deepEqual(results.map(r => r.xp), [5, 5, 5]);
  assert.equal(await xp(), 5);
  assert.equal((await db.query('select count(*)::integer as n from public.quest_prompt_rewards')).rows[0].n, 1);
});
test('owner checks, RLS and grants prevent another user from reading or awarding rewards', async () => {
  await save(event());
  await db.exec(`select set_config('request.jwt.claim.sub','${bob}',false); set role authenticated;`);
  assert.equal((await db.query('select * from public.quest_journey_events')).rows.length, 0);
  await assert.rejects(save(event()), /Quest session not found/);
  await assert.rejects(db.query('delete from public.quest_prompt_rewards'), /permission denied/);
  await assert.rejects(db.query('update public.quest_journey_events set event = $1', ['{}']), /permission denied/);
  await db.exec('reset role');
});
test('unsynced active time, premature prompts, wrong kinds and invalid moods cannot earn XP', async () => {
  await db.exec(`update public.quest_session_snapshots set active_duration_ms=0, recording_state='paused'`);
  await assert.rejects(save(event()), /Active time has not synced/);
  await db.exec('update public.quest_session_snapshots set active_duration_ms=1800000');
  await assert.rejects(save(event({ activeElapsedMs: 500000 })), /Prompt not due/);
  await assert.rejects(save(event({ kind: 'note', body: 'a note', promptId: 'capture:0', activeElapsedMs: 300000 })), /Wrong prompt response/);
  await assert.rejects(save(event({ mood: 'invented' })), /Invalid mood/);
  assert.equal(await xp(), 0);
});
test('media must exist in the owner/session path; videos over 30 seconds are rejected', async () => {
  const path = `${alice}/${session}/clip.mp4`;
  const clip = event({ id: 'clip', kind: 'video', promptId: 'capture:0', activeElapsedMs: 300000, durationSeconds: 30, mimeType: 'video/mp4', storagePath: path });
  await assert.rejects(save(clip), /Save media/);
  await db.query("insert into storage.objects(bucket_id,name,metadata) values ('quest-moments',$1,$2)", [path, JSON.stringify({ mimetype: 'video/mp4' })]);
  await assert.rejects(save({ ...clip, durationSeconds: 31 }), /Video too long/);
  assert.equal((await save(clip)).xp, 10);
  assert.equal(await xp(), 10);
});
test('saved rewards survive abandonment and delayed offline submissions cannot claim moments after the run', async () => {
  await save(event());
  await db.exec(`update public.quest_sessions set status='abandoned', ended_at=now()`);
  await save(event());
  assert.equal(await xp(), 5);
  await assert.rejects(save(event({ id: 'mood:2', promptId: 'mood:2', activeElapsedMs: 1200000, capturedAt: new Date(Date.now()+120000).toISOString() })), /Invalid quest time/);
});
test('completion links its exact session and adds only base XP, preserving bonus XP', async () => {
  await save(event());
  const result = (await db.query('select public.complete_quest_v2(p_quest_id => $1::uuid,p_session_id => $2::uuid) as result', [quest, session])).rows[0].result;
  assert.equal(result.xpAwarded, 100);
  assert.equal(await xp(), 105);
  const linked = (await db.query('select completion_id from public.quest_sessions where id=$1', [session])).rows[0];
  assert.equal(linked.completion_id, result.completionId);
  await save(event());
  assert.equal(await xp(), 105);
});

test('personalized rewards use server prices, preserve snapshots and reject wrong media', async () => {
 const tasks = [{id:'one',title:'Observe',description:'Write something',kind:'note',xp:23,waitMinutes:0,expiryMinutes:60}];
 await db.query('update quests set personalization=$1::jsonb', [JSON.stringify(tasks)]);
 await db.exec(`update quest_sessions set started_at=now()-interval '5 minutes';`);
 await db.query('select initialize_quest_personalization($1)',[session]);
 await db.exec(`update quests set personalization='[]';`);
 const result = await save(event({id:'task-answer',kind:'note',body:'A bird',promptId:'task:one',activeElapsedMs:300000}));
 assert.equal(result.xp,23);
 assert.equal((await save(event({id:'task-answer',kind:'note',body:'A bird',promptId:'task:one',activeElapsedMs:300000}))).xp,23);
 assert.equal(await xp(),23);
 const mood = await save(event({id:'new-mood',promptId:'mood:1',activeElapsedMs:300000}));
 assert.equal(mood.xp,10);
 assert.equal(await xp(),33);
});
test('personalized dismissal starts next wait and cannot dismiss future tasks', async () => {
 const tasks = ['one','two'].map(id=>({id,title:id,description:id,kind:'note',xp:23,waitMinutes:1,expiryMinutes:3}));
 await db.query('update quests set personalization=$1::jsonb',[JSON.stringify(tasks)]);
 await db.exec(`update quest_sessions set started_at=now()-interval '5 minutes';`);
 await db.query('select initialize_quest_personalization($1)',[session]);
 await assert.rejects(db.query('select dismiss_quest_side_task($1,$2,$3)',[session,'task:two',60000]));
 await db.query('select dismiss_quest_side_task($1,$2,$3)',[session,'task:one',70000]);
 assert.equal((await db.query('select resolve_quest_side_task($1,$2) as p',[session,130000])).rows[0].p.id,'task:two');
});
