# negocIAtrader — QG web v0.2 (integração experimental)
Site publicado pelo repositório GitHub (nome legado: doce-e-poesia).

## O que funciona
- Gráfico, EMA 9/21, RSI/ATR e análise M1–H1 por CSV/demonstração.
- Novo endpoint Cloudflare Pages Functions `/api/candles?asset=EURJPY-OTC` para consultar M1.
- Endpoint protegido de ingestão POST /api/candles, que armazena até 750 velas M1 por ativo em KV.
- Atualização do painel a cada 10 segundos após habilitar "Acompanhar feed".
- OTC separado do mercado normal. Não executa ordens.

## Configuração Cloudflare (não realizada automaticamente)
No projeto Pages existente, crie o namespace **Workers KV** e configure binding de **MARKET_KV** para produção (e preview, caso usado). Configure o segredo **FEED_INGEST_TOKEN** (valor aleatório forte) em Settings > Variables and Secrets. Faça novo deploy após adicionar o binding.
GET responde 503 `not_configured` até que essas configurações existam, sem inventar preços.
Se a sua conta não mostrar Pages Functions, valide suporte atual e as configurações de deploy.

## Conector IQ Option (experimental, não oficial)
`connector/iq_readonly_bridge.py` usa biblioteca comunitária em Python. A fonte exige autenticação: utilize **somente uma conta de treinamento separada**, em um ambiente privado, nunca a conta real. Defina variáveis IQ_EMAIL, IQ_PASSWORD, FEED_API_URL=https://<seu-site>.pages.dev, FEED_INGEST_TOKEN e IQ_ASSET. Não cole credenciais no GitHub, Cloudflare público ou chat. Deve ser executado continuamente em servidor próprio. Se não houver execução externa, o feed não será atualizado. Conexão e preços **não foram testados** na IQ Option.

## Dados de entrada
O endpoint espera JSON `{"asset":"EURJPY-OTC","candles":[{"t":1700000000,"o":1,"h":1.1,"l":0.9,"cl":1.05}]}`, com o header `X-Feed-Token` enviado pelo conector privado. A vela deve estar fechada.

## Segurança e limites
Dados de fonte não oficial podem ter atraso, interrupção e divergências em relação à IQ Option. GET público expõe as velas armazenadas, sem informações de contas. Não existe endpoint para operar; nenhum modelo garante resultados. Não hospede automação autenticada usando Workers públicos.


## Cloudflare Pages — atualização do ambiente
Após criar o binding KV `MARKET_KV` e o segredo `FEED_INGEST_TOKEN` no ambiente Production, faça novo deploy da branch master. GET /api/candles?asset=EURJPY-OTC deve retornar status `no_data` quando o KV existe mas ainda não recebeu velas; `not_configured` indica binding ausente na implantação ativa.


## Atualização: D1 (recomendado para M1)
O Cloudflare KV gratuito possui limite de gravações e não é adequado para atualizar muitos ativos M1 continuamente. O backend agora prioriza D1 quando há binding `MARKET_DB` no ambiente Production. Basta criar um banco D1 e adicionar esse binding ao projeto Pages: as tabelas são inicializadas automaticamente na primeira consulta à API. `migrations/0001_market_data.sql` documenta o esquema caso prefira criá-lo manualmente.
Acompanhe a configuração em `/api/status`, que **não** revela o valor do segredo. Sem `MARKET_DB`, o código mantém compatibilidade com `MARKET_KV`, mas pode atingir o limite diário no plano gratuito. Nenhuma cotação da IQ Option será recebida até que um coletor privado autentique uma conta de treinamento, faça a coleta e envie velas M1 fechadas.


## Deploy do binding D1
O projeto Cloudflare Pages usa o binding Production `MARKET_DB` para o banco `negociatrader-market` e mantém `MARKET_KV` de fallback. Quando um binding é criado, é necessário republicar a branch `master` para atualizar o ambiente de execução. Verifique `/api/status`: `d1_binding: true`. A primeira consulta a `/api/candles?asset=EURJPY-OTC` inicializa as tabelas se o banco estiver vazio.


## Conexão Pages → Cloudflare Worker
O Pages usa a variável de Production `COLLECTOR_PUBLIC_URL=https://negociatrader.gestarlink.workers.dev` para consultar o serviço via `/api/collector-status`. Após configurar a variável no painel Cloudflare, o novo deploy da branch `master` aplica a alteração. O Worker neste estágio apenas fornece diagnóstico, sem conexão com a IQ Option ou velas reais.
