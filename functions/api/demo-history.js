import {onRequestPost as ingestCandles} from "./candles.js";
const j=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const ASSETS=new Set(["EURJPY","EURJPY-OTC","EURUSD","EURUSD-OTC"]);
/** User-initiated read-only history test. Token stays in request header;
 * it is never stored in HTML, GitHub or the public DB.
 */
export async function onRequestPost({request,env}){
  if(!env.COLLECTOR_SERVICE||!env.MARKET_DB)return j({status:"service_unavailable",message:"Worker/D1 indisponível"},503);
  const key=request.headers.get("X-Control-Token")||"";
  if(key.length<32||key.length>256)return j({status:"token_required"},401);
  const len=Number(request.headers.get("Content-Length")||0);
  if(len>1024)return j({status:"payload_too_large"},413);
  let data;try{data=await request.json()}catch{return j({status:"invalid_json"},400)}
  if(!ASSETS.has(data?.asset))return j({status:"invalid_asset"},400);
  let result;
  try{
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),29000);
    let r;
    try{
      r=await env.COLLECTOR_SERVICE.fetch("https://collector.internal/demo-history",{
        method:"POST",headers:{"Content-Type":"application/json","X-Control-Token":key},
        body:JSON.stringify({asset:data.asset}),signal:ctl.signal
      });
    }finally{clearTimeout(timer)}
    result=await r.json();
    if(!r.ok)return j({status:typeof result.status==="string"?result.status:"collector_error",retry_after_seconds:result.retry_after_seconds??null},r.status);
  }catch{return j({status:"collector_timeout_or_unavailable"},503)}
  if(result?.status!=="history_received"||!Array.isArray(result.candles)||result.candles.length<30)return j({status:"insufficient_source_data"},422);
  if(!env.FEED_INGEST_TOKEN)return j({status:"ingest_token_missing"},503);
  // Reuse the already-validated D1 ingest path without exposing its secret.
  const internal=new Request("https://internal/api/candles",{method:"POST",headers:{"Content-Type":"application/json","X-Feed-Token":env.FEED_INGEST_TOKEN},body:JSON.stringify({asset:data.asset,candles:result.candles})});
  const stored=await ingestCandles({request:internal,env});
  const summary=await stored.json();
  if(!stored.ok)return j({status:"import_failed",reason:summary.error||"Falha de persistência"},503);
  return j({status:"history_imported",asset:data.asset,candles_received:result.candles.length,candles_stored:summary.stored,storage:summary.storage,source:"unofficial_demo_history_unverified",last_timestamp:summary.last_timestamp});
}
