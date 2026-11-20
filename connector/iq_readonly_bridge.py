"""Coletor experimental IQ Option -> negocIAtrader, somente leitura.
NÃO executa ordens. Use conta separada de treinamento.
Nunca registre senhas, cookies, tokens ou mensagens brutas da IQ Option.
Requer: iqoptionapi (projeto comunitário) e requests.
Variáveis: IQ_EMAIL, IQ_PASSWORD, IQ_ASSET, FEED_API_URL, FEED_INGEST_TOKEN.
"""
import os
import sys
import time

ASSETS={"EURJPY","EURJPY-OTC","EURUSD","EURUSD-OTC"}
def convert(candles,now):
    rows={}
    for c in candles or []:
        try:
            t=int(c["from"])
            if t%60 or t+60>now:continue
            row={"t":t,"o":float(c["open"]),"h":float(c["max"]),"l":float(c["min"]),"cl":float(c["close"])}
            if row["h"]>=max(row["o"],row["cl"]) and row["l"]<=min(row["o"],row["cl"]):
                rows[t]=row
        except (KeyError,TypeError,ValueError,OverflowError):
            continue
    return sorted(rows.values(),key=lambda x:x["t"])

def main():
    asset=os.environ.get("IQ_ASSET","EURJPY-OTC")
    url=os.environ.get("FEED_API_URL","").rstrip("/")
    token=os.environ.get("FEED_INGEST_TOKEN","")
    email=os.environ.get("IQ_EMAIL","")
    password=os.environ.get("IQ_PASSWORD","")
    if asset not in ASSETS or not url.startswith("https://") or not all([token,email,password]):
        raise SystemExit("Configure IQ_EMAIL, IQ_PASSWORD, IQ_ASSET, FEED_API_URL (HTTPS) e FEED_INGEST_TOKEN em ambiente privado.")
    import requests
    from iqoptionapi.stable_api import IQ_Option
    api=IQ_Option(email,password)
    ok,reason=api.connect()
    if not ok:
        raise SystemExit("Falha na autenticação da conta de TREINAMENTO. Tipo: "+type(reason).__name__)
    print("Conexão experimental iniciada. Sem chamadas de compra e venda.",flush=True)
    last_sent=0
    failures=0
    while True:
        try:
            if hasattr(api,"check_connect") and not api.check_connect():
                ok,_=api.connect()
                if not ok:raise ConnectionError("reconnect failed")
            now=int(time.time())
            candles=api.get_candles(asset,60,750 if not last_sent else 8,now)
            rows=convert(candles,now)
            rows=[c for c in rows if c["t"]>last_sent]
            if rows:
                resp=requests.post(url+"/api/candles",json={"asset":asset,"candles":rows},headers={"X-Feed-Token":token},timeout=20)
                resp.raise_for_status()
                latest=max(c["t"] for c in rows)
                last_sent=latest
                print("Velas M1 fechadas transmitidas:",len(rows),"última:",time.strftime("%H:%M:%S UTC",time.gmtime(latest)),flush=True)
            failures=0
            time.sleep(12)
        except KeyboardInterrupt:
            print("Coletor encerrado.",flush=True)
            return
        except Exception as err:
            failures+=1
            # Sem stacktrace de terceiros (pode revelar dados sensíveis).
            wait=min(120,12*2**min(failures,3))
            print("Falha de coleta/transmissão:",type(err).__name__,"Aguardando",wait,"segundos.",flush=True)
            time.sleep(wait)

if __name__=="__main__":
    main()
