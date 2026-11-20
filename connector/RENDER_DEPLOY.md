# Coletor experimental IQ Option — deploy sem instalação local

**Status:** preparado, não publicado no Render e ainda não autenticado na IQ Option.

## Bloqueio intencional
O serviço roda uma rota pública `/health` sem dados sensíveis, mas **não** inicia login enquanto `IQ_ACCOUNT_KIND` não for exatamente `SEPARATE_DEMO_CONFIRMED`.
Não use conta real. O repositório comunitário informa explicitamente que é somente para estudos.

## Implantar
No Render, crie um Blueprint do repositório público `gestarlink/doce-e-poesia` (ainda com nome antigo), usando `render.yaml`.
O plano Free oferece teste sem mensalidade, mas suspende o serviço após 15 minutos de inatividade; **não** garante coleta contínua de 24h. O serviço pode reiniciar ou ficar indisponível.
Depois de confirmar pessoalmente que usa credenciais de uma **conta totalmente separada, exclusivamente de treinamento**, configure **somente no painel privado do Render**:
- `IQ_EMAIL` e `IQ_PASSWORD` da conta separada;
- `FEED_INGEST_TOKEN` igual ao segredo já guardado no Cloudflare (não enviar em chat);
- `IQ_ACCOUNT_KIND=SEPARATE_DEMO_CONFIRMED` para liberar a coleta.
O feed é somente leitura. A biblioteca não é oficial, pode parar de funcionar e não foi validada com credenciais reais nem demonstrativas.
Se o GitHub estiver inacessível por 2FA, Render permite conectar um repositório **público** por URL, com implantação manual.

## Teste seguro
Abra a URL `https://<seu-servico>.onrender.com/health`. Espere `phase=connected` e depois `phase=sent`.
Abra o QG e clique em "Conectar feed (beta)". Não execute operações por causa de um sinal experimental.
O endpoint de status não mostra segredos nem credenciais.

## Arquitetura e limitações
Render Free não é um servidor persistente. Quando o serviço dormir, a atualização para. Cloudflare continua com os últimos dados e sinaliza quando ficaram antigos.
O plano Free também tem limites mensais que podem variar; confirme limites na conta.
