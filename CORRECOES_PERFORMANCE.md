# Correções aplicadas

## Backend
- API de ordens com paginação e filtros server-side (`page`, `limit`, `q`, `status`, `brand`, `startDate`, `endDate`, `all`).
- Resposta de `/api/orders` agora inclui `data`, `pagination` e `summary`.
- Redução de recálculos pesados de período em updates de status.
- Dashboard consolidado em uma única chamada `/api/dashboard`.
- Ajuste do `PORT` padrão para `3020`.
- Índices extras adicionados ao Prisma/SQLite para consultas mais comuns.

## Frontend
- Dashboard deixou de baixar a lista completa de ordens.
- Tela de ordens agora usa paginação real, busca com debounce e filtros no backend.
- Relatórios agora usam prévia paginada e exportação separada.
- Removido `React.StrictMode` para evitar fetch duplicado em desenvolvimento.
- `VITE_API_URL` fallback corrigido para `http://localhost:3020/api`.
- Datas locais corrigidas para evitar avançar um dia por causa de `toISOString()`.
- Mensagens de erro da API ficaram mais legíveis.

## Infra
- `nginx.conf` com gzip e cache para assets estáticos.
- `backend/Dockerfile` ajustado para copiar a pasta `prisma` corretamente.

## Observação
- Foi adicionada a migration `20260307140000_performance_indexes` com índices extras.
- No fluxo Docker atual, `prisma migrate deploy` já aplica isso ao subir o backend.
