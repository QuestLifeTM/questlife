const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(path, mocks = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require','module','exports',js)(id => { if (id in mocks) return mocks[id]; throw Error(id); },module,module.exports);
  return module.exports;
}
const model = load('App/services/journal/album-model.ts');
const photo = (id, extras={}) => ({ id, kind:'photo', bucket:'journal-media', path:`owner/${id}.jpg`, capturedAt:'2026-11-03T12:00:00Z', ...extras });
function service({ files=[], failPaths=[], tables={}, queryError, signError, owner='owner' }={}) {
  const calls=[];
  let currentOwner=owner;
  const supabase = {
    from(table) {
      let from=0,to=Infinity;
      const query = { select(){return this},eq(){return this},in(){return this},order(){return this},range(a,b){from=a;to=b;return this},
        then(resolve) { return Promise.resolve({data:(tables[table]??[]).slice(from,to+1),error:queryError??null}).then(resolve); } };
      return query;
    },
    storage: { from(bucket) { return { async createSignedUrl(path,expiry) {
      calls.push({bucket,path,expiry});
      if (signError) throw signError;
      return failPaths.includes(path) ? {error:{message:'Object not found'},data:null} : {data:{signedUrl:`https://signed/${bucket}/${path}?version=${calls.length}`},error:null};
    } }; } },
  };
  const api=load('App/services/journal/album-media.ios.ts', {
    '@/lib/device-files':{getInfoAsync:async uri=>({exists:files.includes(uri)})},
    '@/lib/supabase':{supabase}, '@/services/local-data/owner':{getLocalDataOwner:()=>currentOwner},
    '@/services/active-quest/local-store.ios':{getCompletedLocalJourney:async id=>tables.local?.[id]??null}, './album-model':model,
  });
  return {api,calls,setOwner:value=>{currentOwner=value}};
}

test('0–5 and large albums center their group, show at most four and count only extras',()=>{
  for (const width of [280,327,350,390,700]) for (const count of [0,1,2,3,4,5,16]) {
    const g=model.albumGeometry(width,count);
    assert.equal(g.visible,Math.min(4,count)); assert.equal(g.extra,Math.max(0,count-4));
    assert.ok(g.width<=420); assert.equal(g.cardWidth,model.albumGeometry(width,4).cardWidth);
    if(count) assert.ok(Math.abs(g.left*2+g.cardWidth+(g.visible-1)*g.step-g.width)<0.001);
    // The maximum rotated rectangle must fit, not just its unrotated frame.
    for(let i=0;i<g.visible;i++) {
      const rad=Math.abs([1,-5,3,-4][i])*Math.PI/180;
      const rotatedWidth=g.cardWidth*Math.cos(rad)+g.cardHeight*Math.sin(rad);
      const x=g.left+i*g.step+g.cardWidth/2;
      assert.ok(x-rotatedWidth/2>=0); assert.ok(x+rotatedWidth/2<=g.width);
    }
  }
});
test('repeat completions stay separate and later-added photos create a populated album',()=>{
  const memory={completionId:'c1',title:'Same quest',completedAt:'2026-11-03T12:00:00Z',photoPaths:[]};
  assert.equal(model.memoryAlbum(memory).items.length,0);
  const a=model.memoryAlbum({...memory,photoPaths:['owner/a.jpg']});
  const b=model.memoryAlbum({...memory,completionId:'c2',photoPaths:['owner/b.jpg']});
  assert.notEqual(a.id,b.id); assert.equal(a.items.length,1);
});
test('journey media excludes notes/moods, mixes videos and photos, deduplicates local/remote identities',()=>{
  const remote=model.journeyMedia([{id:'v',kind:'video',remotePath:'owner/s/v.mp4',capturedAt:'2026-11-03T11:00:00Z'}, {id:'m',kind:'mood'}, {id:'n',kind:'note'}]);
  const merged=model.mergeAlbumMedia(remote,[{...remote[0],localUri:'file://video'}],[photo('p')]);
  assert.equal(merged.length,2); assert.equal(merged[0].kind,'video'); assert.equal(merged[0].localUri,'file://video');
  assert.equal(model.mergeAlbumMedia([photo('a')],[photo('another-id',{path:'owner/a.jpg'})]).length,1);
});
test('resolver uses each bucket, preserves failed positions and video placeholders',async()=>{
  const {api,calls}=service({failPaths:['owner/missing.jpg']});
  const resolved=await api.resolveAlbumMedia([photo('first'),photo('missing'),photo('v',{kind:'video',bucket:'quest-moments',path:'owner/s/v.mp4',thumbnailPath:'owner/s/v.thumb.jpg'}),photo('no-poster',{kind:'video'})]);
  assert.deepEqual(resolved.map(i=>i.id),['first','missing','v','no-poster']);
  assert.ok(resolved[1].error); assert.ok(resolved[0].previewUri); assert.equal(resolved[3].previewUri,undefined);
  assert.deepEqual(calls.map(c=>c.bucket),['journal-media','journal-media','quest-moments']);
  assert.ok(calls.every(c=>!c.path.endsWith('.mp4')));
});
test('missing local file falls back remotely; present local file survives offline; retry can bypass it',async()=>{
  const {api,calls}=service({files:['file://present']});
  assert.ok((await api.resolveAlbumMedia([photo('a',{localUri:'file://gone'})]))[0].previewUri.startsWith('https:'));
  assert.equal((await api.resolveAlbumMedia([photo('a',{localUri:'file://present'})]))[0].previewUri,'file://present');
  assert.ok((await api.resolveAlbumMedia([photo('a',{localUri:'file://present'})],true))[0].previewUri.startsWith('https:'));
  assert.equal(calls.length,2);
});
test('legacy signed URL is renewed and repeated resolution obtains a fresh URL',async()=>{
  const {api,calls}=service();
  const item=photo('old',{path:'https://example.supabase.co/storage/v1/object/sign/journal-media/owner/old.jpg?token=expired'});
  const first=(await api.resolveAlbumMedia([item]))[0];
  const second=(await api.resolveAlbumMedia([item],true))[0];
  assert.equal(calls[0].path,'owner/old.jpg'); assert.notEqual(first.previewUri,second.previewUri);
});
test('network failure preserves media and account switching rejects stale results',async()=>{
  const {api}=service({signError:Error('offline')});
  const result=await api.resolveAlbumMedia([photo('a'),photo('b')]);
  assert.equal(result.length,2); assert.ok(result.every(item=>item.error));
  const changing=service(); const pending=changing.api.resolveAlbumMedia([photo('a')]); changing.setOwner('other');
  await assert.rejects(pending,/account changed/);
});
test('completed album uses explicit session link and merges pending local captures',async()=>{
  const {api}=service({tables:{quest_sessions:[{id:'s',completion_id:'c',quest_id:'q',ended_at:'2026-11-03T12:00:00Z'}],quest_journey_events:[{session_id:'s',event:{id:'v',kind:'video',remotePath:'owner/s/v.mp4',capturedAt:'2026-11-03T11:00:00Z'}}],local:{c:{events:[{id:'p',kind:'photo',uri:'file://pending',capturedAt:'2026-11-03T10:00:00Z'}]}}}});
  const result=await api.loadCompletedAlbums({memoriesByDate:{today:[{completionId:'c',questId:'q',title:'Quest',completedAt:'2026-11-03T12:00:00Z',photoPaths:['owner/legacy.jpg']}]}});
  assert.equal(result.albums[0].sessionId,'s'); assert.equal(result.albums[0].items.length,3); assert.equal(result.warning,undefined);
});
test('missing backend capability retains legacy media and explains the failure',async()=>{
  const {api}=service({queryError:{code:'42703'}});
  const result=await api.loadCompletedAlbums({memoriesByDate:{today:[{completionId:'c',title:'Quest',completedAt:'2026-11-03T12:00:00Z',photoPaths:['owner/legacy.jpg']}]}});
  assert.equal(result.albums[0].items.length,1); assert.match(result.warning,/backend needs/);
});
test('iOS upload reads native bytes, rejects empty files, and can retry after a failed read',async()=>{
  let fail=true;
  const api=load('App/services/media/upload-bytes.ios.ts',{'@/lib/device-files':{EncodingType:{Base64:'base64'},readAsStringAsync:async uri=>{ if(fail) throw Error('read failed');return uri==='empty'?'':'aGVsbG8='; }}});
  await assert.rejects(api.readUploadBytes('file://photo'),/read failed/); fail=false;
  assert.equal(new TextDecoder().decode(await api.readUploadBytes('file://photo')),'hello');
  await assert.rejects(api.readUploadBytes('empty'),/empty/);
});

test('scroll lookahead shares in-flight signing with rows and reuses valid URLs',async()=>{
  const {api,calls}=service();
  const [a,b]=await Promise.all([api.resolveAlbumMedia([photo('a')]),api.resolveAlbumMedia([photo('a')])]);
  assert.equal(calls.length,1); assert.equal(a[0].previewUri,b[0].previewUri);
  await api.resolveAlbumMedia([photo('a')]); assert.equal(calls.length,1);
  assert.equal(api.getCachedAlbumMedia([photo('a')])[0].previewUri,a[0].previewUri);
});
