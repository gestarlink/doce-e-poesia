const response=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
export async function onRequestGet({env}){
 const result={service:"negocIAtrader",mode:"read_only",d1_binding:!!env.MARKET_DB,kv_binding:!!env.MARKET_KV,ingest_secret_configured:!!env.FEED_INGEST_TOKEN,market_data:"unverified"};
 if(env.MARKET_DB){
   try{await env.MARKET_DB.prepare("SELECT COUNT(*) AS n FROM market_candles LIMIT 1").first();result.d1_schema="ready"}
   catch{result.d1_schema="migration_required"}
 }
 return response(result);
}
