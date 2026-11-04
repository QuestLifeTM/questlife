const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('storage signing policy dependency is executable; journal and journey media remain owner-only', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as $$ select current_setting('request.jwt.claim.sub')::uuid $$;
      create table public.party_members(party_id uuid, user_id uuid);
      create function public.is_party_participant(p_party_id uuid, p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
        select exists(select 1 from public.party_members where party_id=p_party_id and user_id=p_user);
      $$;
      revoke all on function public.is_party_participant(uuid,uuid) from public;
      create table storage.objects(bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant usage on schema auth,storage to authenticated;
      grant select on storage.objects to authenticated;
      create policy party_read on storage.objects for select to authenticated using (bucket_id='party-media' and public.is_party_participant(split_part(name,'/',1)::uuid,auth.uid()));
      create policy private_read on storage.objects for select to authenticated using (bucket_id in ('journal-media','quest-moments') and split_part(name,'/',1)=auth.uid()::text);
      insert into storage.objects values
        ('journal-media','00000000-0000-0000-0000-000000000001/photo.jpg'),
        ('quest-moments','00000000-0000-0000-0000-000000000001/session/video.mp4'),
        ('journal-media','00000000-0000-0000-0000-000000000002/private.jpg');
      select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
      set role authenticated;
    `);
    await assert.rejects(db.query('select name from storage.objects'), /permission denied for function is_party_participant/);
    await db.exec('reset role');
    await db.exec(fs.readFileSync('supabase/migrations/20261104014215_restore_storage_participant_predicate.sql','utf8'));
    await db.exec('set role authenticated');
    assert.equal((await db.query('select name from storage.objects')).rows.length, 2);
    await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false)");
    assert.equal((await db.query('select name from storage.objects')).rows.length, 1);
    await db.exec('reset role');
    assert.equal((await db.query("select has_function_privilege('anon','public.is_party_participant(uuid,uuid)','execute') as allowed")).rows[0].allowed, false);
  } finally { await db.close(); }
});
