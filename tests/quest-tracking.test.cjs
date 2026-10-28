const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const readFileSync = require('node:fs').readFileSync;
const root = path.resolve(__dirname, '../App');
function loader(mocks = {}, platform = "native") {
  const cache = new Map();
  function load(id) {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (!id.startsWith('@/')) return require(id);
    if (cache.has(id)) return cache.get(id).exports;
    const native = path.join(root, id.slice(2) + '.' + platform + '.ts');
    const filename = require('node:fs').existsSync(native) ? native : path.join(root, id.slice(2) + '.ts');
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} }; cache.set(id, module);
    new Function('require', 'module', 'exports', code)(load, module, module.exports);
    return module.exports;
  }
  return load;
}
const load = loader();
const { measureLocation, emptyMeasurementState } = load('@/services/active-quest/measurement');
const { simplifyRouteForRendering } = load('@/services/active-quest/route-filter');
const epoch = Date.parse('2026-10-27T12:00:00Z');
function sample(x, y, seconds, extra = {}) {
  return { latitude: y / 111194.9266, longitude: x / 111194.9266, capturedAt: new Date(epoch + seconds * 1000).toISOString(), accuracy: 4, speed: 2, heading: null, altitude: null, ...extra };
}
function replay(samples, windowId = 'a') {
  let state = emptyMeasurementState(), meters = 0; const points = []; const decisions = [];
  for (const p of samples) { const result = measureLocation(state, p, windowId, epoch, epoch + 3600_000); state = result.state; meters += result.distance; if (result.point) points.push(result.point); decisions.push(result); }
  return { state, meters, points, decisions };
}
test('straight measured course is preserved without smoothing lag', () => {
  const result = replay(Array.from({ length: 101 }, (_, i) => sample(i * 2, 0, i)));
  assert.ok(Math.abs(result.meters - 198) < 0.1);
  assert.equal(result.points.at(-1).longitude, sample(200, 0, 100).longitude);
});
test('repeated square laps and backtracking count every traversal', () => {
  const points = [sample(0, 0, 0), sample(0, 0, 1)]; let t = 2;
  for (let lap = 0; lap < 2; lap++) for (let side = 0; side < 4; side++) for (let i = 1; i <= 10; i++) {
    const coords = [[i * 2, 0], [20, i * 2], [20 - i * 2, 20], [0, 20 - i * 2]][side]; points.push(sample(...coords, t++));
  }
  const result = replay(points); assert.ok(Math.abs(result.meters - 160) < 0.2);
  const back = replay([sample(0,0,0),sample(0,0,1),sample(10,0,6),sample(0,0,11)]);
  assert.ok(Math.abs(back.meters - 20) < 0.1);
});
test('five minute stationary jitter does not become mileage, slow walking still counts', () => {
  const jitter = replay(Array.from({ length: 300 }, (_, i) => sample(Math.sin(i) * 1.5, Math.cos(i) * 1.5, i, { speed: 0 })));
  assert.ok(jitter.meters <= 10);
  const slow = replay(Array.from({ length: 121 }, (_, i) => sample(i * 0.5, 0, i, { speed: null })));
  assert.ok(slow.meters > 55 && slow.meters < 61);
});
test('duplicate, out-of-order, invalid and weak fixes cannot add distance', () => {
  const initial = replay([sample(0,0,0),sample(0,0,1),sample(2,0,2)]);
  for (const p of [sample(2,0,2),sample(500,0,1),sample(4,0,3,{accuracy:-1}),sample(4,0,3,{accuracy:null}),sample(4,0,3,{accuracy:100}),sample(4,0,3,{latitude:NaN})]) {
    const result = measureLocation(initial.state,p,'a',epoch,epoch+10000); assert.equal(result.distance,0); assert.equal(result.point,null);
  }
});
test('GPS teleport is rejected; reacquisition breaks the route without inventing distance', () => {
  const result = replay([sample(0,0,0),sample(0,0,1),sample(2,0,2),sample(1000,0,3),sample(4,0,4),sample(1000,0,40),sample(1002,0,41),sample(1004,0,42)]);
  assert.equal(result.decisions[3].decision,'jump');
  assert.equal(result.decisions[6].breakSegment,true);
  assert.ok(result.meters < 7);
});
test('delayed valid batches use captured time and resume never bridges recording windows', () => {
  const first = replay([sample(0,0,0),sample(0,0,1),sample(2,0,2)]);
  const lateDelivery = measureLocation(first.state,sample(4,0,3),'a',epoch,epoch+600_000);
  assert.equal(lateDelivery.decision,'accepted');
  const resumed = measureLocation(first.state,sample(100,0,3),'b',epoch+3000,epoch+10000);
  const confirmed = measureLocation(resumed.state,sample(102,0,4),'b',epoch+3000,epoch+10000);
  assert.equal(confirmed.distance,0); assert.equal(confirmed.breakSegment,true);
});
test('render simplification and replay do not change measurement totals', () => {
  const input = Array.from({length:200},(_,i)=>sample(i*2, Math.sin(i/10)*5,i));
  const a = replay(input); simplifyRouteForRendering(a.points,20);
  assert.equal(replay(input).meters,a.meters);
});
async function harness() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(),'quest-tracking-'));
  let marker = { ownerId:'owner',sessionId:'session',windowId:'a',startedAt:epoch };
  let fail = false;
  const mockFiles = {
    documentDirectory:temp+'/', makeDirectoryAsync:(p)=>fs.mkdir(p,{recursive:true}),
    readAsStringAsync:(p)=>fs.readFile(p,'utf8'),
    deleteAsync:(p)=>fs.rm(p,{recursive:true,force:true}),
  };
  const sqlite = { openDatabaseAsync: async (name,_options,directory) => {
    const db = new DatabaseSync(path.join(directory,name));
    const adapter = {
      execAsync:async sql=>db.exec(sql),
      getFirstAsync:async (sql,...args)=>db.prepare(sql).get(...args),
      getAllAsync:async (sql,...args)=>db.prepare(sql).all(...args),
      runAsync:async (sql,...args)=>{ if(fail) throw new Error('disk full'); return db.prepare(sql).run(...args); },
      closeAsync:async()=>db.close(),
      withExclusiveTransactionAsync:async cb=>{db.exec('BEGIN');try {await cb(adapter);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}},
    }; return adapter;
  }};
  const l = loader({'@/lib/device-files':mockFiles,'expo-sqlite':sqlite,'@/services/active-quest/tracking-session':{getTrackingSession:async()=>marker}});
  const owner=l('@/services/local-data/owner');owner.setLocalDataOwner('owner');
  const store=l('@/services/active-quest/local-store');
  await store.ensureActiveQuestSession({sessionId:'session',questId:'quest',startedAt:new Date(epoch).toISOString(),entryTitle:''});
  await store.updateActiveQuestSession('session',{trackingStatus:'tracking'});
  return {store,owner,setMarker:m=>marker=m,setFailure:v=>fail=v,close:async()=>{await store.clearActiveQuestDataForOwner('owner');await fs.rm(temp,{recursive:true,force:true});}};
}
test('transactional storage retains originals; duplicates do not double count; failed commit rolls back', async () => {
  const h=await harness();try {
    for(const p of [sample(0,0,0),sample(0,0,1),sample(2,0,2)]) await h.store.addAcceptedRoutePoint('session',p,{windowId:'a',startedAt:epoch});
    let before=await h.store.getActiveQuestSnapshot('session');
    await h.store.addAcceptedRoutePoint('session',sample(2,0,2),{windowId:'a',startedAt:epoch});
    assert.equal((await h.store.getActiveQuestSnapshot('session')).session.distanceMeters,before.session.distanceMeters);
    assert.equal((await h.store.getQuestRecordingDiagnostics('session')).length,3);
    h.setFailure(true);
    await assert.rejects(h.store.addAcceptedRoutePoint('session',sample(4,0,3),{windowId:'a',startedAt:epoch}),/disk full/);
    assert.equal((await h.store.getActiveQuestSnapshot('session')).session.distanceMeters,before.session.distanceMeters);
    h.setFailure(false);
    await h.store.addAcceptedRoutePoint('session',sample(4,0,3),{windowId:'a',startedAt:epoch});
    assert.ok((await h.store.getActiveQuestSnapshot('session')).session.distanceMeters>before.session.distanceMeters);
  }finally{await h.close();}
});
test('stopped, blocked and other-owner callbacks do not retain location', async () => {
  const h=await harness();try {
    h.setMarker(null);
    await h.store.addAcceptedRoutePoint('session',sample(2,0,2),{windowId:'a',startedAt:epoch});
    assert.equal((await h.store.getQuestRecordingDiagnostics('session')).length,0);
    h.setMarker({ownerId:'other',sessionId:'session',windowId:'a',startedAt:epoch});
    await h.store.addAcceptedRoutePoint('session',sample(2,0,2),{windowId:'a',startedAt:epoch});
    assert.equal((await h.store.getQuestRecordingDiagnostics('session')).length,0);
  }finally{await h.close();}
});

test('native lifecycle publishes ownership before first batch and serializes stop after start', async () => {
  let marker = null, status = 'idle', running = false;
  const location = {
    Accuracy:{Highest:6}, hasServicesEnabledAsync:async()=>true,
    requestForegroundPermissionsAsync:async()=>({granted:true}),
    getBackgroundPermissionsAsync:async()=>({granted:true}),
    startLocationUpdatesAsync:async()=>{ assert.ok(marker?.windowId); assert.equal(status,'tracking'); running=true; },
    hasStartedLocationUpdatesAsync:async()=>running, stopLocationUpdatesAsync:async()=>{running=false;},
  };
  const l=loader({ 'react-native':{Platform:{OS:'ios'}}, 'expo-location':location,
    '@/services/active-quest/local-store':{updateActiveQuestSession:async(_id,update)=>{status=update.trackingStatus;}},
    '@/services/active-quest/tracking-session':{getTrackingSession:async()=>marker,setTrackingSession:async value=>{marker=value;}},
  });
  const tracking=l('@/services/active-quest/tracking');
  const [start]=await Promise.all([tracking.beginQuestLocationTracking('owner','session'),tracking.stopQuestLocationTracking()]);
  assert.equal(start.started,true); assert.equal(marker,null); assert.equal(running,false);
});
test('denied background permission provides a truthful foreground-only fallback', async () => {
  let marker=null, starts=0;
  const l=loader({ 'react-native':{Platform:{OS:'android'}}, 'expo-location':{
    Accuracy:{Highest:6},hasServicesEnabledAsync:async()=>true,requestForegroundPermissionsAsync:async()=>({granted:true}),
    getBackgroundPermissionsAsync:async()=>({granted:false}),requestBackgroundPermissionsAsync:async()=>({granted:false}),
    startLocationUpdatesAsync:async()=>{starts++;},
  }, '@/services/active-quest/local-store':{updateActiveQuestSession:async()=>{}},
  '@/services/active-quest/tracking-session':{getTrackingSession:async()=>marker,setTrackingSession:async value=>{marker=value;}},
  });
  const result=await l('@/services/active-quest/tracking').beginQuestLocationTracking('owner','session');
  assert.equal(result.started,true); assert.equal(result.backgroundGranted,false); assert.equal(starts,0); assert.equal(marker.backgroundGranted,false);
});
test('native registration failures clear the marker and do not report success', async () => {
  let marker=null;
  const l=loader({ 'react-native':{Platform:{OS:'ios'}}, 'expo-location':{
    Accuracy:{Highest:6},hasServicesEnabledAsync:async()=>true,requestForegroundPermissionsAsync:async()=>({granted:true}),
    getBackgroundPermissionsAsync:async()=>({granted:true}),startLocationUpdatesAsync:async()=>{throw new Error('OS denied');},
  }, '@/services/active-quest/local-store':{updateActiveQuestSession:async()=>{}},
  '@/services/active-quest/tracking-session':{getTrackingSession:async()=>marker,setTrackingSession:async value=>{marker=value;}},
  });
  const result=await l('@/services/active-quest/tracking').beginQuestLocationTracking('owner','session');
  assert.equal(result.started,false); assert.equal(marker,null);
});
test('pause keeps journey distance but a recording window restart creates a new segment', async () => {
  const h=await harness(); try {
    for(const p of [sample(0,0,0),sample(0,0,1),sample(2,0,2)]) await h.store.addAcceptedRoutePoint('session',p,{windowId:'a',startedAt:epoch});
    await h.store.setActiveQuestRecordingState('session','paused',{pausedAt:new Date(epoch+3000).toISOString(),activeSince:null,activeDurationMs:3000});
    await h.store.addAcceptedRoutePoint('session',sample(4,0,3),{windowId:'a',startedAt:epoch});
    const before=await h.store.getActiveQuestSnapshot('session');
    assert.ok(before.session.distanceMeters>3.9);
    assert.equal(before.session.routeSegments.at(-1).state,'paused');
    h.setMarker({ownerId:'owner',sessionId:'session',windowId:'b',startedAt:epoch+4000});
    for(const p of [sample(100,0,4),sample(102,0,5)]) await h.store.addAcceptedRoutePoint('session',p,{windowId:'b',startedAt:epoch+4000});
    const after=await h.store.getActiveQuestSnapshot('session');
    assert.equal(after.session.distanceMeters,before.session.distanceMeters);
    assert.equal(after.session.routeSegments.at(-1).pointIds.length,1);
  } finally {await h.close();}
});
test('raw samples survive the encrypted outbox snapshot handoff', async()=>{
  const h=await harness();try{
    for(const p of [sample(0,0,0),sample(0,0,1),sample(2,0,2)]) await h.store.addAcceptedRoutePoint('session',p,{windowId:'a',startedAt:epoch});
    const [snapshot]=await h.store.getAllActiveQuestSnapshots();
    assert.equal(snapshot.observations.length,3);
    await h.store.clearActiveQuestDataForOwner('owner');
    await h.store.hydrateActiveQuestRecord(snapshot);
    assert.equal((await h.store.getQuestRecordingDiagnostics('session')).length,3);
    assert.equal((await h.store.getActiveQuestSnapshot('session')).session.distanceMeters,snapshot.session.distanceMeters);
  }finally{await h.close();}
});

function iosPermissionHarness({foreground=true,canAskAgain=true,background=true,failBackground=false}={}) {
  let marker=null, status='idle', foregroundRequests=0;
  const l=loader({'expo-location':{
    Accuracy:{Highest:6},hasServicesEnabledAsync:async()=>true,
    getForegroundPermissionsAsync:async()=>({granted:foreground,canAskAgain}),
    requestForegroundPermissionsAsync:async()=>{foregroundRequests++;return {granted:foreground,canAskAgain};},
    getBackgroundPermissionsAsync:async()=>({granted:background}),
    requestBackgroundPermissionsAsync:async()=>({granted:background}),
    startLocationUpdatesAsync:async()=>{if(failBackground)throw new Error('background unavailable');},
  },'@/services/active-quest/local-store':{updateActiveQuestSession:async(_id,update)=>{status=update.trackingStatus;}},
  '@/services/active-quest/tracking-session':{getTrackingSession:async()=>marker,setTrackingSession:async value=>{marker=value;}},
  },'ios');
  return {tracking:l('@/services/active-quest/tracking'),state:()=>({marker,status,foregroundRequests})};
}
test('iOS existing permission is reused without re-requesting it',async()=>{
  const h=iosPermissionHarness();const result=await h.tracking.beginQuestLocationTracking('owner','session');
  assert.equal(result.started,true);assert.equal(h.state().foregroundRequests,0);
});
test('iOS background-start failure keeps foreground map and recording available',async()=>{
  const h=iosPermissionHarness({failBackground:true});const result=await h.tracking.beginQuestLocationTracking('owner','session');
  assert.equal(result.started,true);assert.equal(result.backgroundGranted,false);
  assert.equal(h.state().status,'tracking');assert.equal(h.state().marker.backgroundGranted,false);
});
test('iOS permanent denial offers Settings instead of an endless permission loop',async()=>{
  const h=iosPermissionHarness({foreground:false,canAskAgain:false});const result=await h.tracking.beginQuestLocationTracking('owner','session');
  assert.equal(result.started,false);assert.equal(result.openSettings,true);assert.equal(h.state().status,'permission-needed');
});
test('iOS preview accepts a fresh coarse fix without awarding miles and is not erased by empty storage',()=>{
  const {locationPreview,newerLiveFix}=loader({},'ios')('@/services/active-quest/live-fix');
  const coords={latitude:40,longitude:-74,accuracy:80,speed:0,altitude:null,heading:null};
  const fix=locationPreview({coords,timestamp:epoch},epoch+1000);
  assert.ok(fix);assert.equal(fix.accuracy,80);
  assert.equal(newerLiveFix(fix,null),fix);
  assert.equal(locationPreview({coords,timestamp:epoch},epoch+120000),null);
  const old={...fix,capturedAt:new Date(epoch-10000).toISOString()};assert.equal(newerLiveFix(fix,old),fix);
});
