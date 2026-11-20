import test from "node:test";
import assert from "node:assert/strict";
import worker,{MarketAgent} from "../src/worker.js";
function mock(flag="false"){
 const store=new Map();
 const state={storage:{get:async k=>store.get(k),put:async(k,v)=>store.set(k,v)},waitUntil:()=>{}};
 const object=new MarketAgent(state,{DEMO_CONFIRMED:flag});
 return {env:{MARKET_AGENT:{idFromName:()=>"id",get:()=>({fetch:(url,init)=>object.fetch(new Request(url,init))})}}};
}
test("status never claims connection or market data",async()=>{
 const response=await worker.fetch(new Request("https://example.test/health"),mock().env);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.iq_connected,false);assert.equal(data.live_prices,false);assert.equal(data.mode,"read_only");
});
test("anonymous probe is denied",async()=>{
 const response=await worker.fetch(new Request("https://example.test/probe",{method:"POST"}),mock().env);
 assert.equal(response.status,401);
});
test("demo confirmation gate prevents outbound transport",async()=>{
 const x=mock();x.env.PROBE_CONTROL_TOKEN="example-long-private-secret";
 const response=await worker.fetch(new Request("https://example.test/probe",{method:"POST",headers:{"X-Control-Token":"example-long-private-secret"}}),x.env);
 assert.equal(response.status,409);
 assert.equal((await response.json()).status,"disabled");
});
test("no purchase or credential handling exists",async()=>{
 const {readFile}=await import("node:fs/promises");
 const source=await readFile(new URL("../src/worker.js",import.meta.url),"utf8");
 assert.doesNotMatch(source,/\.buy\(|\.sell\(|IQ_PASSWORD|IQ_EMAIL/);
});
