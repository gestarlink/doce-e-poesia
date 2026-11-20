# negocIAtrader — Coletor nativo Cloudflare (PROTÓTIPO)

Este módulo foi inspirado no padrão Workers + Durable Objects usado no projeto VozLab. É um **projeto separado**, dentro do mesmo repositório GitHub. O site segue em Cloudflare Pages, já ligado a D1.

## O que funciona neste estágio
- Worker público GET /health, com estado guardado em Durable Object SQLite (gratuito, com limites).
- Endpoint POST /probe protegido pelo segredo `PROBE_CONTROL_TOKEN`, desabilitado até confirmar conta DEMO separada via `DEMO_CONFIRMED=true`. Quando liberado, verifica somente um handshake WebSocket sem login.
- **Não existe login na IQ Option, leitura de velas, execução de ordens nem sinais ao vivo.** O protocolo Python não pode ser executado diretamente aqui. Precisamos portar a parte de leitura para JS e validar uma conta de treinamento separada.
- Saída status sempre `iq_connected:false` e `live_prices:false` até que a implementação real seja validada.

## Implantar no Cloudflare sem Render
No painel **Workers & Pages > Create application > Worker > Connect to Git**, selecione repositório `gestarlink/doce-e-poesia`, configure o projeto **Worker** com root `cloudflare-collector`, arquivo `wrangler.jsonc`, e execute deployment de Workers (não Pages). O workflow exato depende da interface Workers Builds disponível na sua conta. O Worker terá nome `negociatrader-iq-collector`.

Pode alternativamente fazer deploy via `npx wrangler deploy --config cloudflare-collector/wrangler.jsonc`, usando credenciais de CI privadas; **não colocar token API no GitHub**.

Verifique GET `https://negociatrader-iq-collector.<subdomínio>.workers.dev/health`.
No Pages atual, configure a variável **não secreta** `COLLECTOR_PUBLIC_URL` com a URL base desse Worker. Após novo deploy, o QG consultará `/api/collector-status`.

Não configure `DEMO_CONFIRMED=true` nem `PROBE_CONTROL_TOKEN` antes de decidirmos testar uma conta separada. O endpoint protegido não é necessário para publicar a versão de status.

## Limitações
Cloudflare Durable Objects gratuitos suportam WebSockets, mas conexões externas não permanecem indefinidamente ativas; reconexão e tratamento de autenticação precisam ser desenvolvidos e testados. Cloudflare Containers executariam Python tradicional, mas exigem Workers Paid. Este primeiro módulo não é um coletor funcional da IQ Option.
