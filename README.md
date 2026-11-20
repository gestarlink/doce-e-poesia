# negocIAtrader — QG web de análise (v0.1)

Projeto de painel web estático, em modo somente leitura, sem ordens e sem conexão autenticada com a IQ Option.

## Recursos
- EUR/JPY e EUR/USD, normal e OTC separados;
- importação local de CSV M1 (timestamp,open,high,low,close), sem upload;
- análise EMA 9/21, RSI 14, ATR 14, pavios e timeframes M1, M5, M10, M15, H1;
- demonstração com dados fictícios claramente identificados;
- sinalização sempre experimental, sem recomendações de entradas.

## Deploy Cloudflare Pages
Framework: None; build command: vazio; output: raiz (/). O arquivo index.html é o ponto de entrada. Não há dependências de build.

## Próximo passo
Validar um feed autorizado de velas reais da IQ Option. A biblioteca não oficial exige autenticação, que não deve ser exposta ao código cliente, ao repositório nem a Workers públicos. Este painel não incorpora uma conta IQ Option, não lê preços em tempo real e não executa trades.
