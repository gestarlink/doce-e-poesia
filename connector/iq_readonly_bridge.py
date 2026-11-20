"""Experimental IQ Option candle reader. No trading actions. Use a separate DEMO account only.
Requires: pip install iqoptionapi requests websocket-client
Env: IQ_EMAIL, IQ_PASSWORD, FEED_API_URL, FEED_INGEST_TOKEN, IQ_ASSET (EURJPY-OTC etc)
Never publish credentials, use public GitHub actions, or use your real account.
"""
import os,time,sys
import requests

ALLOWED={"EURJPY","EURJPY-OTC","EURUSD","EURUSD-OTC"}
def main():
    asset=os.environ.get("IQ_ASSET","EURJPY-OTC")
    url=os.environ.get("FEED_API_URL","").rstrip("/")
    token=os.environ.get("FEED_INGEST_TOKEN","")
    email=os.environ.get("IQ_EMAIL","")
    password=os.environ.get("IQ_PASSWORD","")
    if asset not in ALLOWED or not url.startswith("https://") or not all([token,email,password]):
        raise RuntimeError("Configure IQ_ASSET, FEED_API_URL (HTTPS), FEED_INGEST_TOKEN, IQ_EMAIL e IQ_PASSWORD em ambiente privado")
    from iqoptionapi.stable_api import IQ_Option
    api=IQ_Option(email,password)
    ok,reason=api.connect()
    if not ok:raise RuntimeError("Falha na autenticação: verifique a conta de teste e a biblioteca. Não exponha detalhes: "+str(type(reason).__name__))
    print("Conectado à biblioteca comunitária para coleta experimental.",flush=True)
    last_sent=0
    while True:
        try:
            now=int(time.time())
            # Historical M1 candles; avoids forwarding the still-forming candle.
            historical=api.get_candles(asset,60,750,now)
            rows=[]
            for c in historical or []:
                t=int(c.get("from",0))
                if not t or t+60>now:continue
                row={"t":t,"o":float(c["open"]),"h":float(c["max"]),"l":float(c["min"]),"cl":float(c["close"])}
                if row["h"]>=max(row["o"],row["cl"]) and row["l"]<=min(row["o"],row["cl"]):rows.append(row)
            if rows and max(r["t"] for r in rows)>last_sent:
                response=requests.post(url+"/api/candles",json={"asset":asset,"candles":rows},headers={"X-Feed-Token":token},timeout=15)
                response.raise_for_status()
                last_sent=max(r["t"] for r in rows)
                print("Última vela M1 fechada recebida:",time.strftime("%H:%M:%S",time.gmtime(last_sent)),flush=True)
        except KeyboardInterrupt:
            return
        except Exception as err:
            # Avoid leaking credentials or response payloads into logs.
            print("Falha de coleta/transmissão:",type(err).__name__,flush=True)
        time.sleep(10)
if __name__=="__main__":main()
