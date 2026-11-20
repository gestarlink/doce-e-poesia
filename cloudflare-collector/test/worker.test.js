import test from "node:test";
import assert from "node:assert/strict";
import worker,{MarketAgent,normalizeCandles} from "../src/worker.js";
const token="secure-32-character-demo-control-token-for-tests";
function fakeEnv(overrides={}){
 const values=new Map();
 const state={storage:{get:async k=>values.get(k),put:async(k,v)=>values.set(k,v)}};
 const env={
   IQ_CONTROL_TOKEN:token, IQ_ACCOUNT_KIND:"NOT_CONFIRMED",
   MARKET_AGENT:{idFromName:()=>123,get:()=>({fetch:(url,init)=>new MarketAgent(state,env).fetch(new Request(url,init))})}
 };
 return Object.assign(env,overrides);
}
test("read-only status never claims live prices",async()=>{
 const r=await worker.fetch(new Request("https://example.test/health"),fakeEnv());
 const x=await r.json();assert.equal(r.status,200);
 assert.equal(x.iq_connected,false);assert.equal(x.live_prices,false);
 assert.equal(x.account_gate,false);
});
test("unauthorized demo test is denied even with secret configuration",async()=>{
 const env=fakeEnv({IQ_ACCOUNT_KIND:"SEPARATE_DEMO_CONFIRMED",IQ_DEMO_EMAIL:"demo@example.com",IQ_DEMO_PASSWORD:"example-password"});
 const r=await worker.fetch(new Request("https://example.test/demo-history",{method:"POST",body:JSON.stringify({asset:"EURJPY-OTC"})}),env);
 assert.equal(r.status,401);
});
test("separate demo account gate prevents any login",async()=>{
 const env=fakeEnv({IQ_DEMO_EMAIL:"demo@example.com",IQ_DEMO_PASSWORD:"example-password"});
 const r=await worker.fetch(new Request("https://example.test/demo-history",{method:"POST",headers:{"X-Control-Token":token},body:JSON.stringify({asset:"EURJPY-OTC"})}),env);
 assert.equal(r.status,409);
 assert.equal((await r.json()).status,"demo_account_not_confirmed");
});
test("missing credentials prevents any login even after separate demo gate",async()=>{
 const env=fakeEnv({IQ_ACCOUNT_KIND:"SEPARATE_DEMO_CONFIRMED"});
 const r=await worker.fetch(new Request("https://example.test/demo-history",{method:"POST",headers:{"X-Control-Token":token},body:JSON.stringify({asset:"EURJPY-OTC"})}),env);
 assert.equal(r.status,409);assert.equal((await r.json()).status,"demo_credentials_missing");
});
test("OHLC conversion only includes closed minute candles",()=>{
 const now=1800000120;
 const rows=normalizeCandles([
   {from:1800000000,open:1.0,close:1.1,max:1.2,min:.9},
   {from:1800000060,open:1.1,close:1.2,max:1.3,min:1.0},
   {from:1800000120,open:1.2,close:1.3,max:1.4,min:1.1},
   {from:1800000001,open:1.0,close:1.1,max:1.2,min:.9},
 ],now);
 assert.deepEqual(rows.map(x=>x.t),[1800000000,1800000060]);
});
test("no trading order calls are present",async()=>{
 const fs=await import("node:fs/promises");
 const s=await fs.readFile(new URL("../src/worker.js",import.meta.url),"utf8");
 assert.doesNotMatch(s,/\.buy\(|\.sell\(|buyv2|place_order|sendMessage.*buy/);
});
