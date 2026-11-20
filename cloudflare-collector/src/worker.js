/** negocIAtrader experimental demo-only market history reader.
 * Unofficial IQ Option protocol (community documented); NO order/trading calls.
 * The Worker receives separate DEMO credentials from Cloudflare Secrets only.
 * No credentials, session IDs, raw login errors or account details are returned/logged.
 */
const IQ_SOCKET = "wss://iqoption.com/echo/websocket";
const LOGIN = "https://auth.iqoption.com/api/v2/login";
const ASSETS = Object.freeze({"EURUSD":1,"EURJPY":4,"EURUSD-OTC":76,"EURJPY-OTC":79});
const sendJson=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const delay = ms => new Promise(ok=>setTimeout(ok,ms));
const isProtected = (request,env)=>typeof env.IQ_CONTROL_TOKEN==="string"&&env.IQ_CONTROL_TOKEN.length>=32&&request.headers.get("X-Control-Token")===env.IQ_CONTROL_TOKEN;
const isSeparateDemo = env=>env.IQ_ACCOUNT_KIND==="SEPARATE_DEMO_CONFIRMED";
const isCredConfigured=env=>typeof env.IQ_DEMO_EMAIL==="string"&&env.IQ_DEMO_EMAIL.length>3&&typeof env.IQ_DEMO_PASSWORD==="string"&&env.IQ_DEMO_PASSWORD.length>5;
function extractSession(headers){
  const lines=typeof headers.getSetCookie==="function"?headers.getSetCookie():[headers.get("set-cookie")||""];
  for(const line of lines){
    const match=line.match(/(?:^|[,;]\s*)ssid=([^;,\s]+)/i);
    if(match)return match[1];
  }
  return null;
}
export function normalizeCandles(data,nowSeconds=Math.floor(Date.now()/1000)){
  if(!Array.isArray(data))return [];
  const rows=new Map();
  for(const c of data){
    if(!c||typeof c!=="object")continue;
    const t=Number(c.from),o=Number(c.open),cl=Number(c.close),h=Number(c.max),l=Number(c.min);
    if(![t,o,cl,h,l].every(Number.isFinite)||!Number.isInteger(t)||t%60!==0||t+60>nowSeconds)continue;
    if(h<Math.max(o,cl)||l>Math.min(o,cl)||h<l)continue;
    rows.set(t,{t,o,h,l,cl});
  }
  return [...rows.values()].sort((a,b)=>a.t-b.t).slice(-250);
}
/** Does not make any outgoing requests until called inside the protected DEMO gate. */
async function requestDemoHistory(asset,env){
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),12000);
  let resp;
  try{
    resp=await fetch(LOGIN,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body:new URLSearchParams({identifier:env.IQ_DEMO_EMAIL,password:env.IQ_DEMO_PASSWORD}),redirect:"manual",signal:ctl.signal});
  }catch{
    return {status:"login_network_error",message:"Não foi possível contactar o login IQ; confira conectividade."};
  }finally{clearTimeout(timer)}
  const ssid=extractSession(resp.headers);
  if(!resp.ok||!ssid){
    // Deliberately don't propagate IQ response or Set-Cookie.
    return {status:resp.status===429?"rate_limited":resp.status===403?"login_challenge":"login_not_accepted",message:"Não houve sessão de leitura. Se houver 2FA/captcha, use somente o site oficial; não tentamos contornar."};
  }
  let ws;
  try{ws=new WebSocket(IQ_SOCKET)}
  catch{return {status:"socket_creation_failed",message:"WebSocket não disponível neste ambiente"}}
  const assetId=ASSETS[asset];
  const outcome=await new Promise(resolve=>{
    let done=false,requested=false;
    const finish=result=>{
      if(done)return;done=true;
      clearTimeout(timeout);
      try{ws.close(1000,"read-only done")}catch{}
      resolve(result);
    };
    const timeout=setTimeout(()=>finish({status:"timeout",message:"Nenhuma resposta útil de velas dentro de 22 segundos"}),22000);
    ws.addEventListener("open",()=>{
      try{ws.send(JSON.stringify({name:"ssid",msg:ssid,request_id:""}))}
      catch{finish({status:"socket_send_failed"})}
    });
    ws.addEventListener("message",event=>{
      let data;try{data=JSON.parse(typeof event.data==="string"?event.data:"")}catch{return}
      if(data.name==="profile"){
        if(data.msg===false){finish({status:"session_rejected"});return}
        if(!requested){
          requested=true;
          const now=Math.floor(Date.now()/1000);
          const msg={name:"get-candles",version:"2.0",body:{active_id:assetId,split_normalization:true,size:60,to:now,count:250}};
          try{ws.send(JSON.stringify({name:"sendMessage",msg,request_id:"negociatrader-history"}))}
          catch{finish({status:"request_failed"})}
        }
        return;
      }
      if(data.name==="candles"){
        const candles=normalizeCandles(data.msg?.candles);
        if(candles.length<30){finish({status:"invalid_candles",count:candles.length});return}
        finish({status:"history_received",asset,candles});
      }
    });
    ws.addEventListener("error",()=>finish({status:"socket_error"}));
    ws.addEventListener("close",()=>finish({status:"socket_closed"}));
  });
  return outcome;
}
export class MarketAgent {
  constructor(state,env){this.state=state;this.env=env}
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(request.method==="GET"&&path==="/status"){
      const previous=await this.state.storage.get("latest_demo_test")||null;
      return sendJson({service:"negocia-trader-cloudflare-market-agent",environment:"cloudflare-durable-object",mode:"read_only",adapter:"demo_history_testing",iq_connected:false,live_prices:false,latest_demo_test:previous,account_gate:isSeparateDemo(this.env),credentials_ready:isCredConfigured(this.env)});
    }
    if(request.method==="POST"&&path==="/demo-history"){
      if(!isSeparateDemo(this.env))return sendJson({status:"demo_account_not_confirmed"},409);
      if(!isCredConfigured(this.env))return sendJson({status:"demo_credentials_missing"},409);
      let requestBody;try{requestBody=await request.json()}catch{return sendJson({status:"bad_request"},400)}
      const asset=requestBody?.asset;
      if(typeof asset!=="string"||!Object.prototype.hasOwnProperty.call(ASSETS,asset))return sendJson({status:"unknown_asset"},400);
      const now=Date.now();
      const cooldown=await this.state.storage.get("auth_cooldown_until_ms")||0;
      if(now<cooldown)return sendJson({status:"rate_limited_local",retry_after_seconds:Math.ceil((cooldown-now)/1000)},429);
      const started=await this.state.storage.get("last_demo_attempt_ms")||0;
      if(now-started<60000)return sendJson({status:"rate_limited_local",retry_after_seconds:Math.ceil((60000-(now-started))/1000)},429);
      await this.state.storage.put("last_demo_attempt_ms",now);
      await this.state.storage.put("latest_demo_test",{status:"running",asset,started_at_ms:now});
      let result;
      try{result=await requestDemoHistory(asset,this.env)}
      catch{result={status:"unexpected_error"}}
      if(result.status==="rate_limited")await this.state.storage.put("auth_cooldown_until_ms",Date.now()+15*60*1000);
      const summary={status:result.status,asset,count:Array.isArray(result.candles)?result.candles.length:0,finished_at_ms:Date.now()};
      await this.state.storage.put("latest_demo_test",summary);
      return sendJson(result,result.status==="history_received"?200:422);
    }
    return sendJson({error:"not_found"},404);
  }
}
const agent=env=>env.MARKET_AGENT.get(env.MARKET_AGENT.idFromName("read-only-iq-transport"));
export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(request.method==="GET"&&(path==="/health"||path==="/"))return agent(env).fetch("https://internal/status");
    if(request.method==="POST"&&path==="/demo-history"){
      if(!isProtected(request,env))return sendJson({error:"not_authorized"},401);
      const size=Number(request.headers.get("Content-Length")||0);
      if(size>1024)return sendJson({error:"request_too_large"},413);
      let body;try{body=await request.text()}catch{return sendJson({error:"invalid_request"},400)}
      if(body.length>1024)return sendJson({error:"request_too_large"},413);
      return agent(env).fetch("https://internal/demo-history",{method:"POST",headers:{"Content-Type":"application/json"},body});
    }
    return sendJson({error:"not_found"},404);
  }
};
