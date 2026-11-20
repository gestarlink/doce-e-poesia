const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export async function onRequestGet({env}){
  const raw=(env.COLLECTOR_PUBLIC_URL||"").trim().replace(/\/$/,"");
  if(!raw)return json({status:"not_configured",message:"Coletor Cloudflare ainda não vinculado"});
  let url;
  try{
    url=new URL(raw);
    const host=url.hostname;
    if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.port||
       !(host.endsWith(".workers.dev")||host.endsWith(".onrender.com")))throw Error("invalid");
  }catch{return json({status:"invalid_configuration",message:"Esperada URL HTTPS *.workers.dev"},503)}
  try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8500);
    let response;
    try{response=await fetch(url.toString()+"/health",{signal:controller.signal,headers:{"Accept":"application/json"}})}
    finally{clearTimeout(timeout)}
    if(!response.ok)return json({status:"offline",message:"Serviço externo indisponível"},503);
    const p=await response.json();
    if(p.environment==="cloudflare-durable-object" && p.mode==="read_only"){
      return json({status:"connected",source:"cloudflare_native_prototype",
       stage:String(p.adapter||"pending").slice(0,64),iq_connected:p.iq_connected===true,live_prices:p.live_prices===true});
    }
    // Legacy host; only relay explicit safe fields.
    return json({status:"connected",source:"community_iq_option_unverified",phase:String(p.phase||"unknown").slice(0,80),
       demo_account_confirmed:p.demo_account_confirmed===true,configured:p.configured===true,
       last_candle_utc:Number.isFinite(p.last_candle_utc)?p.last_candle_utc:null,
       last_sent_at_utc:Number.isFinite(p.last_sent_at_utc)?p.last_sent_at_utc:null});
  }catch{return json({status:"offline",message:"Coletor indisponível ou sem resposta"},503)}
}