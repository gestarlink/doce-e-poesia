# negocIAtrader — teste de histórico da IQ Option com conta DEMO separada

**Status:** implementação experimental para testar login + WebSocket + 250 velas históricas M1. Não foi testada com login real. Não há feed contínuo, sinais comprovados nem execução de ordens.

O sistema funciona em duas partes dentro da mesma conta Cloudflare:
- **Worker** `negociatrader` + Durable Object: realiza uma tentativa de autenticação via HTTPS no servidor da IQ Option, recebe uma sessão e solicita velas por WebSocket usando protocolo documentado por biblioteca comunitária.
- **Pages** `doceepoesia` + D1: recebe somente velas OHLC já normalizadas e as apresenta no QG. Não recebe nem armazena a senha da IQ Option.

## Antes de tudo — condição obrigatória
Utilize **somente uma conta de treinamento SEPARADA**, com login diferente daquele que tenha acesso a dinheiro real. Se for apenas o saldo demonstrativo da MESMA conta usada para dinheiro real, NÃO coloque suas credenciais no Worker. O código de teste não realiza operações nem solicita saldo, mas uma sessão da conta real poderia ter acesso a recursos além do necessário.

## Configuração privada (não postar nada no chat)
Abra **Cloudflare → Workers & Pages → Worker `negociatrader` → Settings → Variables and Secrets**.
Configure:
- `IQ_ACCOUNT_KIND` — Text, valor exatamente `SEPARATE_DEMO_CONFIRMED`, somente após verificar que é uma conta independente.
- `IQ_DEMO_EMAIL` — **Secret**, e-mail da conta separada de treinamento.
- `IQ_DEMO_PASSWORD` — **Secret**, senha da conta separada de treinamento.
- `IQ_CONTROL_TOKEN` — **Secret**, senha aleatória inédita com pelo menos 32 caracteres, distinta da senha IQ e de FEED_INGEST_TOKEN. Guarde-a em gerenciador de senhas. Não a inclua no GitHub, em commits, prints ou mensagens.

Salve e conclua qualquer publicação exigida pelo Cloudflare.
Não configure esses segredos no projeto Pages; apenas no Worker `negociatrader`.

## Testar no QG
1. Abra `https://doceepoesia.pages.dev`.
2. Selecione EUR/JPY, EUR/USD, EUR/JPY OTC ou EUR/USD OTC.
3. No campo **Token de controle do Worker**, cole `IQ_CONTROL_TOKEN` (NUNCA a senha da IQ Option).
4. Clique **Testar histórico M1 (somente leitura)**.
5. Espere até 30 segundos. Se o teste conseguir obter 30+ velas fechadas, elas serão gravadas no D1 e exibidas com a marca **IQ DEMO · HISTÓRICO NÃO VALIDADO**.
6. Compare horários e OHLC diretamente com o gráfico da IQ Option antes de confiar nos dados.

O token só existe no campo temporário durante o teste. O navegador não o grava localmente. A API limita as tentativas a uma por minuto. Não repita em sequência se houver bloqueio.

## Erros possíveis
- `demo_account_not_confirmed`: a trava ainda não foi configurada;
- `demo_credentials_missing`: secrets ausentes;
- `login_not_accepted` / `login_challenge`: login não aceito ou etapa adicional exigida pela IQ Option. Resolva somente pelo site oficial; sem contornar captcha ou 2FA;
- `socket_error` / `timeout`: a sessão WebSocket ou o protocolo podem estar indisponíveis/alterados;
- `invalid_candles`: resposta insuficiente ou incompatível;
- `history_imported`: 30+ velas recebidas; **não** significa que o feed em tempo real foi validado.

## Segurança e limites
A origem é uma API de comunidade, **não oficial**. O Cloudflare pode ter acesso a segredos em ambiente de execução; não há garantia que a IQ Option aceite login feito a partir de uma rede de servidor. O código não registra senhas, ssid nem mensagens brutas, não tem funções de compra/venda, e interrompe se não conseguir autenticação normal.
O Worker usa o ID de ativo do projeto comunitário (EURUSD=1; EURJPY=4; EURUSD-OTC=76; EURJPY-OTC=79), que pode ficar desatualizado.
Este módulo é **histórico sob demanda**, não transmite cotações em tempo real a cada segundo. A próxima fase dependerá dos resultados.
