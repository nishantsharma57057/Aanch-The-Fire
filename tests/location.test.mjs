import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestLocation} from '../src/location.js';
const position={coords:{latitude:27.21,longitude:77.96,accuracy:25}};
test('device location keeps latitude, longitude and accuracy',async()=>{assert.deepEqual(await requestLocation({getCurrentPosition:ok=>ok(position)}),{lat:27.21,lng:77.96,accuracy:25})});
test('GPS timeout retries with lower accuracy and bounded cache',async()=>{let calls=0;const geo={getCurrentPosition(ok,fail,options){calls++;if(calls===1){assert.equal(options.enableHighAccuracy,true);fail({code:3})}else{assert.equal(options.enableHighAccuracy,false);assert.equal(options.maximumAge,30000);ok(position)}}};await requestLocation(geo);assert.equal(calls,2)});
test('denied permission does not retry and gives actionable instructions',async()=>{let calls=0;await assert.rejects(requestLocation({getCurrentPosition(ok,fail){calls++;fail({code:1})}}),/Allow Location/);assert.equal(calls,1)});
test('cancelled location cannot overwrite a manually selected pin',async()=>{const controller=new AbortController();let complete;const pending=requestLocation({getCurrentPosition(ok){complete=ok}},{signal:controller.signal});controller.abort();complete(position);await assert.rejects(pending,/cancelled/)});
test('unsupported and insecure browsers show a manual fallback',async()=>{await assert.rejects(requestLocation(null),/pin/);await assert.rejects(requestLocation({}, {secure:false}),/HTTPS/)});
