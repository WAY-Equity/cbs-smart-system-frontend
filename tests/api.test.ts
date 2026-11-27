import {test} from 'node:test';
import assert from 'node:assert/strict';
import {query, apiEnabled, basicAuth} from '../src/api.ts';
test('API stays off unless VITE_API_URL is set at build time',()=>{assert.equal(apiEnabled,false)});
test('query drops empty filters and encodes Japanese',()=>{assert.equal(query({q:'物件 A',status:'',branch:undefined,limit:50}),'?q=%E7%89%A9%E4%BB%B6+A&limit=50');assert.equal(query({q:''}),'')});
test('basicAuth encodes user:password as UTF-8 base64',()=>{assert.equal(basicAuth('cbs','cbs'),'Basic Y2JzOmNicw==');assert.equal(basicAuth('cbs','パス'),'Basic '+Buffer.from('cbs:パス').toString('base64'))});
