const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export async function onRequestGet({env}){
  const raw=(env.COLLECTOR_PUBLIC_URL||"").trim().replace(/\/$/,"");
  if(!raw)return json({status:"not_configured",message:"Serviço coletor ainda não publicado"});
  let url;
  try{
    url=new URL(raw);
    if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.port||!url.hostname.endsWith(".onrender.com"))throw Error("invalid");
  }catch{return json({status:"invalid_configuration",message:"URL de coletor deve ser HTTPS onrender.com"},503)}
  try{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
    let response;
    try{response=await fetch(url.toString()+"/health",{signal:controller.signal,headers:{"Accept":"application/json"}})}finally{clearTimeout(timeout)}
    if(!response.ok)return json({status:"offline",message:"Serviço de coleta indisponível"},503);
    const payload=await response.json();
    // Do not relay any remote JSON fields not explicitly allowlisted.
    return json({status:"connected",phase:String(payload.phase||"unknown").slice(0,80),
       demo_account_confirmed:payload.demo_account_confirmed===true,
       configured:payload.configured===true,
       last_candle_utc:typeof payload.last_candle_utc==="number"?payload.last_candle_utc:null,
       last_sent_at_utc:typeof payload.last_sent_at_utc==="number"?payload.last_sent_at_utc:null,
       source:"community_iq_option_unverified"});
  }catch{return json({status:"offline",message:"Serviço desligado, acordando ou sem conexão"},503)}
}
