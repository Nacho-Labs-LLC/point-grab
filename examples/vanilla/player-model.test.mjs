import test from 'node:test';
import assert from 'node:assert/strict';
test('duration parsing uses seconds and rejects malformed input', async () => {
 const {parseDuration}=await import('./player-model.js');
 assert.equal(parseDuration('3:47'),227);
 assert.equal(parseDuration('0:00'),0);
 assert.throws(()=>parseDuration('3:99'));
 assert.throws(()=>parseDuration('oops'));
});
test('queue next wraps and shuffle cannot repeat the same track',async()=>{
 const {nextTrackIndex}=await import('./player-model.js');
 assert.equal(nextTrackIndex(4,5,false),0);
 assert.equal(nextTrackIndex(0,5,true,()=>0),1);
 assert.equal(nextTrackIndex(0,5,true,()=>0.999),4);
 assert.equal(nextTrackIndex(0,1,true),0);
});
