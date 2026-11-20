/** negocIAtrader: Cloudflare-native experimental WebSocket transport.
 * Read-only, no IQ login, no candle feed, no trading operations.
 * /probe is disabled unless separate DEMO is explicitly confirmed and
 * a private high-entropy PROBE_CONTROL_TOKEN is configured.
 */
const IQ_SOCKET = "wss://iqoption.com/echo/websocket";
const j=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export class MarketAgent {
  constructor(state,env){this.state=state;this.env=env}
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(path==="/status" && request.method==="GET"){
      const last=await this.state.storage.get("last_transport_test")||null;
      return j({service:"negocia-trader-cloudflare-market-agent",environment:"cloudflare-durable-object",mode:"read_only",adapter:"protocol_port_pending",iq_connected:false,live_prices:false,transport_probe:last});
    }
    if(path==="/probe" && request.method==="POST"){
      if(this.env.DEMO_CONFIRMED!=="true")return j({status:"disabled",message:"Conta demonstrativa separada ainda não confirmada"},409);
      const started=new Date().toISOString();
      await this.state.storage.put("last_transport_test",{phase:"connecting",started});
      try{
        const ws=new WebSocket(IQ_SOCKET);
        ws.addEventListener("open",()=>{
          this.state.waitUntil(this.state.storage.put("last_transport_test",{phase:"handshake_opened",started,finished:new Date().toISOString()}));
          ws.close(1000,"probe complete");
        });
        ws.addEventListener("error",()=>{
          this.state.waitUntil(this.state.storage.put("last_transport_test",{phase:"handshake_error",started,finished:new Date().toISOString()}));
        });
        ws.addEventListener("close",e=>{
          if(e.code!==1000)this.state.waitUntil(this.state.storage.put("last_transport_test",{phase:"handshake_closed",started,finished:new Date().toISOString()}));
        });
        this.state.waitUntil(new Promise(resolve=>setTimeout(()=>{
          try{if(ws.readyState<2)ws.close(1000,"probe timeout")}catch(_){}
          resolve();
        },8000)));
        return j({status:"probe_started",description:"Somente handshake WebSocket, sem login e sem preços"},202);
      }catch(_){
        await this.state.storage.put("last_transport_test",{phase:"handshake_error",started});
        return j({status:"probe_failed",message:"Não foi possível iniciar WebSocket"},503);
      }
    }
    return j({error:"Não encontrado"},404);
  }
}
const agent=env=>env.MARKET_AGENT.get(env.MARKET_AGENT.idFromName("read-only-iq-transport"));
export default {
  async fetch(request,env){
    const path=new URL(request.url).pathname;
    if(request.method==="GET"&&(path==="/health"||path==="/"))return agent(env).fetch("https://internal/status");
    if(request.method==="POST"&&path==="/probe"){
      if(!env.PROBE_CONTROL_TOKEN||request.headers.get("X-Control-Token")!==env.PROBE_CONTROL_TOKEN)return j({error:"Não autorizado"},401);
      return agent(env).fetch("https://internal/probe",{method:"POST"});
    }
    return j({error:"Não encontrado"},404);
  }
};
