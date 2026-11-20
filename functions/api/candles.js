const ASSETS=new Set(["EURJPY","EURJPY-OTC","EURUSD","EURUSD-OTC"]);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const validCandle=c=>{if(!c||typeof c!=="object")return false;const {t,o,h,l,cl}=c;return [t,o,h,l,cl].every(Number.isFinite)&&t>1000000000&&t<4102444800&&h>=Math.max(o,cl)&&l<=Math.min(o,cl)&&h>=l};
export async function onRequestGet({request,env}){
  const a=new URL(request.url).searchParams.get("asset");
  if(!ASSETS.has(a))return json({error:"Ativo inválido"},400);
  if(!env.MARKET_KV)return json({status:"not_configured",asset:a,candles:[],message:"Binding MARKET_KV não configurado"},503);
  const payload=await env.MARKET_KV.get("candles:"+a,"json");
  if(!payload)return json({status:"no_data",asset:a,candles:[],message:"Nenhum feed conectado"});
  return json({status:"available",asset:a,source:"community_connector_unverified",...payload});
}
export async function onRequestPost({request,env}){
  if(!env.MARKET_KV||!env.FEED_INGEST_TOKEN)return json({error:"Integração não configurada"},503);
  const token=request.headers.get("X-Feed-Token")||"";
  // Constant-time equality is not guaranteed in this runtime; token is high entropy and not query-string based.
  if(token!==env.FEED_INGEST_TOKEN)return json({error:"Não autorizado"},401);
  const length=Number(request.headers.get("Content-Length")||0);
  if(length>140000)return json({error:"Payload excede o limite"},413);
  let data;try{data=await request.json()}catch{return json({error:"JSON inválido"},400)}
  if(!ASSETS.has(data?.asset)||!Array.isArray(data?.candles)||data.candles.length<1||data.candles.length>750||!data.candles.every(validCandle))return json({error:"Velas inválidas"},400);
  const now=Math.floor(Date.now()/1000);
  const rows=data.candles.filter(c=>c.t+60<=now).sort((a,b)=>a.t-b.t);
  if(!rows.length)return json({error:"Nenhuma vela M1 fechada"},422);
  const latest=rows.at(-1).t;
  if(latest>now-60)return json({error:"Dados futuros"},422);
  const previous=await env.MARKET_KV.get("candles:"+data.asset,"json");
  if(previous?.last_timestamp && latest<previous.last_timestamp)return json({error:"Lote mais antigo que o armazenado"},409);
  const merged=[...(previous?.candles||[]),...rows];
  const unique=new Map(merged.map(x=>[x.t,x]));
  const candles=[...unique.values()].sort((a,b)=>a.t-b.t).slice(-750);
  const obj={candles,last_timestamp:candles.at(-1).t,received_at:now};
  await env.MARKET_KV.put("candles:"+data.asset,JSON.stringify(obj));
  return json({ok:true,asset:data.asset,stored:candles.length,last_timestamp:obj.last_timestamp});
}
