const ASSETS=new Set(["EURJPY","EURJPY-OTC","EURUSD","EURUSD-OTC"]);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const validCandle=c=>c&&typeof c==="object"&&[c.t,c.o,c.h,c.l,c.cl].every(Number.isFinite)&&Number.isInteger(c.t)&&c.t%60===0&&c.t>1000000000&&c.t<4102444800&&c.h>=Math.max(c.o,c.cl)&&c.l<=Math.min(c.o,c.cl)&&c.h>=c.l;
const ALLOWED_ORIGIN="https://doceepoesia.pages.dev";
export async function onRequestGet({request,env}){
  const asset=new URL(request.url).searchParams.get("asset");
  if(!ASSETS.has(asset))return json({status:"invalid_asset",error:"Ativo inválido"},400);
  if(env.MARKET_DB){
    try{
      const result=await env.MARKET_DB.prepare("SELECT t,o,h,l,cl FROM market_candles WHERE asset=? ORDER BY t DESC LIMIT 750").bind(asset).all();
      const rows=result.results||[];
      if(!rows.length)return json({status:"no_data",asset,candles:[],storage:"D1",message:"Nenhum feed conectado"});
      const metadata=await env.MARKET_DB.prepare("SELECT received_at FROM market_feed_state WHERE asset=?").bind(asset).first();
      const candles=rows.reverse();
      return json({status:"available",asset,source:"community_connector_unverified",storage:"D1",candles,last_timestamp:candles.at(-1).t,received_at:metadata?.received_at||0});
    }catch(e){return json({status:"schema_missing",asset,candles:[],storage:"D1",message:"Execute migrations/0001_market_data.sql no banco D1"},503)}
  }
  if(!env.MARKET_KV)return json({status:"not_configured",asset,candles:[],message:"Bindings de armazenamento não configurados"},503);
  const payload=await env.MARKET_KV.get("candles:"+asset,"json");
  if(!payload)return json({status:"no_data",asset,candles:[],storage:"KV",message:"Nenhum feed conectado"});
  return json({status:"available",asset,source:"community_connector_unverified",storage:"KV",...payload});
}
export async function onRequestPost({request,env}){
  if(!env.FEED_INGEST_TOKEN||(!env.MARKET_DB&&!env.MARKET_KV))return json({error:"Integração não configurada"},503);
  if(request.headers.get("X-Feed-Token")!==env.FEED_INGEST_TOKEN)return json({error:"Não autorizado"},401);
  if(Number(request.headers.get("Content-Length")||0)>150000)return json({error:"Payload excede 150KB"},413);
  let data;try{data=await request.json()}catch{return json({error:"JSON inválido"},400)}
  if(!ASSETS.has(data?.asset)||!Array.isArray(data.candles)||data.candles.length<1||data.candles.length>750||!data.candles.every(validCandle))return json({error:"Velas inválidas (timestamps UTC M1; OHLC numéricos)"},400);
  const now=Math.floor(Date.now()/1000);
  const rows=[...new Map(data.candles.filter(c=>c.t+60<=now).map(c=>[c.t,c])).values()].sort((a,b)=>a.t-b.t);
  if(!rows.length)return json({error:"Nenhuma vela M1 fechada"},422);
  const latest=rows.at(-1).t,asset=data.asset;
  if(env.MARKET_DB){
    try{
      const existing=await env.MARKET_DB.prepare("SELECT last_timestamp FROM market_feed_state WHERE asset=?").bind(asset).first();
      const added=rows.filter(c=>c.t>(existing?.last_timestamp||0));
      if(!added.length)return json({ok:true,asset,stored:0,last_timestamp:existing?.last_timestamp,storage:"D1",duplicate:true});
      const commands=[];
      for(let i=0;i<added.length;i+=35){
        const batch=added.slice(i,i+35);
        const marks=batch.map(()=>"(?,?,?,?,?,?,?)").join(",");
        const params=batch.flatMap(c=>[asset,c.t,c.o,c.h,c.l,c.cl,now]);
        commands.push(env.MARKET_DB.prepare("INSERT OR IGNORE INTO market_candles (asset,t,o,h,l,cl,received_at) VALUES "+marks).bind(...params));
      }
      commands.push(env.MARKET_DB.prepare("INSERT INTO market_feed_state (asset,last_timestamp,received_at) VALUES (?,?,?) ON CONFLICT(asset) DO UPDATE SET last_timestamp=excluded.last_timestamp,received_at=excluded.received_at").bind(asset,latest,now));
      await env.MARKET_DB.batch(commands);
      return json({ok:true,asset,stored:added.length,last_timestamp:latest,storage:"D1"});
    }catch(e){return json({error:"Falha no banco D1 — verifique migração e binding"},503)}
  }
  const previous=await env.MARKET_KV.get("candles:"+asset,"json");
  if(previous?.last_timestamp&&latest<=previous.last_timestamp)return json({ok:true,asset,stored:0,last_timestamp:previous.last_timestamp,storage:"KV",duplicate:true});
  // Legacy KV fallback is unsuitable for continuous M1 on the free plan: 1,000 writes/day.
  const merged=[...(previous?.candles||[]),...rows],unique=new Map(merged.map(c=>[c.t,c]));
  const candles=[...unique.values()].sort((a,b)=>a.t-b.t).slice(-750);
  await env.MARKET_KV.put("candles:"+asset,JSON.stringify({candles,last_timestamp:latest,received_at:now}));
  return json({ok:true,asset,stored:candles.length,last_timestamp:latest,storage:"KV",warning:"KV não recomendado para M1 contínuo em plano gratuito"});
}
