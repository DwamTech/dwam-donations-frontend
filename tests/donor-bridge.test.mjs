import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypescript } from './load-typescript.mjs';
const { donorBridge } = await loadTypescript('../src/lib/api/donor-bridge.ts');
const env = { NODE_ENV: 'test', SITE_ORIGIN: 'https://site.test', DONATIONS_BACKEND_ORIGIN: 'https://backend.test', DONATIONS_API_BRIDGE_ENABLED: 'true', DONOR_PORTAL_ENABLED: 'true', DONATIONS_MUTATIONS_ENABLED: 'true' };
function req(path, method='GET', headers={}) { return new Request('https://site.test'+path, { method, headers: { Origin: env.SITE_ORIGIN, 'Content-Type':'application/json', ...headers }, ...(method==='POST'?{body:'{}'}:{}) }); }
test('donor login hides Sanctum credential in an independent HttpOnly Secure cookie', async()=>{
 const r=await donorBridge(req('/api/donor/session','POST',{Cookie:'admin_session=foreign; donation_intent_scope=guest'}),{env,fetch:async(url,o)=>{
   assert.equal(url,'https://backend.test/api/donor/session');assert.equal(o.headers.get('Cookie'),null);assert.equal(o.headers.get('Authorization'),null);
   return Response.json({data:{id:1,name:'Synthetic',email:'donor@example.test'},token:'1|synthetic_token'});
 }});
 assert.equal(r.status,200);assert.equal((await r.json()).token,undefined);assert.match(r.headers.get('Set-Cookie'),/donor_session=1%7Csynthetic_token; Path=\/api\/donor; HttpOnly; SameSite=Strict; Max-Age=7200; Secure/);
});
test('donor registration creates the same private session without forwarding caller authority', async()=>{
 const r=await donorBridge(req('/api/donor/registration','POST',{Cookie:'admin_session=foreign',Authorization:'Bearer foreign'}),{env,fetch:async(url,o)=>{
   assert.equal(url,'https://backend.test/api/donor/registration');assert.equal(o.headers.get('Cookie'),null);assert.equal(o.headers.get('Authorization'),null);assert.equal(o.headers.get('Origin'),null);
   return Response.json({data:{id:2,name:'New donor',email:'new@example.test'},token:'2|synthetic_token'},{status:201});
 }});
 assert.equal(r.status,201);assert.equal((await r.json()).token,undefined);assert.match(r.headers.get('Set-Cookie'),/HttpOnly; SameSite=Strict; Max-Age=7200; Secure/);
});
test('donor bridge forwards only its own credential to exact owned routes and revokes cookie on logout',async()=>{
 const r=await donorBridge(req('/api/donor/logout','POST',{Cookie:'donor_session=1%7Csynthetic_token; admin_session=foreign',Authorization:'Bearer foreign'}),{env,fetch:async(url,o)=>{
   assert.equal(url,'https://backend.test/api/donor/logout');assert.equal(o.headers.get('Authorization'),'Bearer 1|synthetic_token');assert.equal(o.headers.get('Cookie'),null);return Response.json({message:'Logged out.'});
 }});
 assert.match(r.headers.get('Set-Cookie'),/Max-Age=0/);
 for(const [path,method,headers,status] of [['/api/admin/donations','GET',{},404],['/api/donor/profile?url=https://evil.test','GET',{},404],['/api/donor/profile','GET',{},401],['/api/donor/session','POST',{Origin:'https://evil.test'},403]]){
   assert.equal((await donorBridge(req(path,method,headers),{env,fetch:()=>{throw Error('No network permitted');}})).status,status);
 }
});
test('donor PDF keeps privacy headers, validates bytes and ignores browser-supplied upstream targets',async()=>{
 const r=await donorBridge(req('/api/donor/receipts/11111111-1111-4111-8111-111111111111','GET',{Cookie:'donor_session=1%7Csynthetic_token'}),{env,fetch:async(url)=>{
   assert.equal(url,'https://backend.test/api/donation-receipts/11111111-1111-4111-8111-111111111111/download');
   return new Response('%PDF-synthetic',{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="receipt-DR-1.pdf"'}});
 }});
 assert.equal(r.status,200);assert.equal(r.headers.get('Pragma'),'no-cache');assert.match(r.headers.get('Cache-Control'),/private, no-store/);
});
