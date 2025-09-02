# Jobs do Worker (Coletor de Histórico & Limpador de Retenção)
Este worker pode opcionalmente coletar cotações de BTC em intervalos de 10 minutos e limpar snapshots mais antigos que 90 dias.
## Ativar Jobs
Defina `HISTORY_JOBS=1` ao iniciar o worker para executar os jobs:

```cs
# Certifique-se de que Redis e Postgres estão rodando (veja .env/.env.test)
# QUOTE_PROVIDER pode ser 'stub' para testes/dev ou 'mercadobitcoin'
HISTORY_JOBS=1 QUOTE_PROVIDER=stub REDIS_URL=redis://localhost:6379 pnpm --filter worker start:dev
```

*   **Coletor de Histórico**: executa a cada minuto, faz _upsert_ de um snapshot no limite do slot atual de 10 minutos (America/Sao\_Paulo) usando `GetCurrentQuoteUseCase` (cache + provider).
*   **Limpador de Retenção**: executa de hora em hora, exclui snapshots com `ts < now()-90d`.
## Notas
*   O endpoint da API `/quotes/history` lê da tabela `quote_snapshots` e retorna 24h (144 slots) alinhados com `floor10min(now)` em `America/Sao_Paulo`.
*   Lacunas (sem snapshots para um slot) são retornadas como `buy/sell = null`.
*   Para verificar localmente sem rodar o worker, é possível fazer _upsert_ manual de snapshots usando o repositório Prisma ou SQL, e depois chamar o endpoint.