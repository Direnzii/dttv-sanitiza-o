# DTTV — Agenda & Serviços (PWA)

Web App em **HTML5 + Tailwind (CDN) + JavaScript Vanilla (ES Modules)** com persistência em **localStorage**, padrão **SPA** (abas via hash) e recursos **PWA** (manifest + service worker).

## Como rodar

Você precisa servir os arquivos por HTTP (service worker não funciona via `file://`).

Exemplo com Python:

```bash
python3 -m http.server 5173
```

Abra `http://127.0.0.1:5173`.

## Funcionalidades

- **Clientes**: CRUD completo (Nome obrigatório).
- **Serviços**: CRUD completo (Nome, Detalhe, Custo Total).
- **Agenda**: registros de serviços prestados (alimenta o dashboard).
- **Dashboard**: resumo por período (padrão: últimos 7 dias, com seletor).
- **Orçamentos & PDF**: 1 cliente + N serviços, geração de PDF via `jsPDF`.
- **Backup JSON**: exporta/importa estado do localStorage com deduplicação.
- **Periodicidade recomendada (Clientes)**: valor + unidade (dias/meses) para alertas de “período de limpeza vencido”.

## Observações

- O app cacheia o “App Shell” no service worker; dependências CDN são cacheadas em runtime após o primeiro acesso.
- Dados ficam em `localStorage` sob a chave exibida na tela **Backup (JSON)**.
- Notificações dependem de **permissão do navegador** e funcionam em **HTTPS** (ex.: Vercel). Sem backend, o aviso é “best effort” (quando o app estiver aberto/ativado).

