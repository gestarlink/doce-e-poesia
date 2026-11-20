const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export async function onRequestGet({env}){
  // Workers on the same Cloudflare account must communicate through Service Bindings,
  // not via subrequests to their public workers.dev URLs.
  const service=env.COLLECTOR_SERVICE;
  if(!service || typeof service.fetch!=="function"){
    return json({status:"binding_required",message:"Configure o Service Binding COLLECTOR_SERVICE para o Worker negociatrader",public_url_configured:!!env.COLLECTOR_PUBLIC_URL},503);
  }
  try {
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),8000);
    let response;
    try{
      response=await service.fetch("https://collector.internal/health",{signal:ctl.signal,headers:{"Accept":"application/json"}});
    }finally{clearTimeout(timer)}
    if(!response.ok)return json({status:"worker_error",message:"O Worker vinculado não respondeu corretamente"},502);
    const p=await response.json();
    if(p.environment!=="cloudflare-durable-object"||p.mode!=="read_only"){
      return json({status:"unexpected_response",message:"Resposta inesperada do coletor"},502)
    }
    return json({status:"connected",source:"cloudflare_native_prototype",
      stage:String(p.adapter||"pending").slice(0,64),
      iq_connected:p.iq_connected===true,live_prices:p.live_prices===true});
  }catch{
    return json({status:"worker_unreachable",message:"Service Binding configurado, mas chamada falhou"},502)
  }
}