# Simulador de Consignado

Simula um empréstimo consignado em vários bancos ao mesmo tempo e mostra a oferta de cada um, mesmo quando algum banco demora ou falha.

## Funcionalidades

- **Formulário único** com CPF, CNPJ do empregador, salário, descontos consignados existentes, valor desejado e prazo.
- **Validação no front e na API** com o mesmo esquema Zod: CPF e CNPJ por dígito verificador, limites de valor e de prazo, mensagens em português junto a cada campo.
- **Margem consignável**: 35% do salário menos os descontos existentes. Quando a parcela não cabe, o simulador mostra a parcela máxima e quanto o cliente consegue financiar.
- **Cálculo pela tabela Price**, com a taxa anual do banco convertida em mensal composta, valores em centavos e aritmética decimal.
- **Consulta paralela aos bancos**, com tempo limite por banco. Um banco lento, fora do ar ou com resposta inválida não derruba a simulação: as demais ofertas aparecem, junto com o motivo da falha daquele banco.
- **Privacidade**: nada é gravado, e CPF, CNPJ e valores não aparecem nos logs.

## Termos

| Termo | Significado |
| --- | --- |
| Consignado | Empréstimo cujas parcelas são descontadas direto da folha de pagamento do cliente. |
| Margem consignável | Parte do salário que pode ir para parcelas de consignado: 35% do salário bruto. |
| Margem disponível | A margem consignável menos os descontos consignados que o cliente já paga. É o teto da nova parcela. |
| Tabela Price | Sistema de amortização com parcelas fixas: `parcela = valor × i / (1 − (1 + i)^−n)`, com a taxa mensal `i` e o prazo `n`. |
| Valor financiável | O caminho inverso da Price: quanto o cliente consegue pegar com uma parcela igual à margem disponível. |
| Resultado parcial | Simulação em que algum banco não devolveu oferta. A resposta continua válida (HTTP 200) e diz qual banco falhou e por quê. |
| Centavos | Unidade de todos os valores na API e nas regras: R$ 10.000,00 é `1000000`. |

## Arquitetura

Monorepo com npm workspaces:

| Pacote | Porta | Conteúdo |
| --- | --- | --- |
| `web` | 5173 | Front-end React + Vite. |
| `api` | 3000 | API Express de simulação. |
| `bank-mocks` | 4001 e 4002 | Bancos Alpha e Beta simulados via HTTP, num único processo. |
| `shared` | — | Esquemas Zod, validadores de CPF e CNPJ e tipos do contrato, usados pelo front e pela API. |

A API é organizada em camadas, com as dependências apontando para o domínio:

```
api/src/
├── http/          rotas, controllers e middlewares
├── services/      SimulationService
├── domain/        regras puras e a porta BankAdapter
├── infra/         adaptadores dos bancos, cliente HTTP e logger
├── config/        variáveis de ambiente validadas
├── container.ts   monta adaptadores e serviço
├── app.ts         cria o Express (sem listen, usado nos testes)
└── server.ts      sobe a API
```

## Como executar

Pré-requisitos: Node.js 22 (com `nvm`, rode `nvm use`) e npm 10 ou superior.

```bash
npm ci
npm run dev
```

O `npm run dev` sobe a API, os bancos simulados e o front com recarga automática. Abra http://localhost:5173.

Não é preciso criar nenhum `.env` para rodar localmente. Cada pacote (`api`, `bank-mocks` e `web`) tem um `.env.example` com valores que já funcionam:

- o `npm run dev` da API carrega o `api/.env.example` e, por cima dele, o `api/.env`, quando existir;
- o `npm start` da API carrega só o `api/.env`;
- os bancos simulados leem o `bank-mocks/.env`, quando existir, e usam os padrões do código no resto;
- o front lê o `web/.env` pelo Vite, e sem ele usa `http://localhost:3000`.

Para mudar alguma variável, copie o exemplo para `.env` no mesmo pacote e edite:

```bash
cp bank-mocks/.env.example bank-mocks/.env
```

Uma variável passada na linha de comando tem precedência sobre o `.env`.

### Variáveis de ambiente

| Variável | Pacote | Padrão | Uso |
| --- | --- | --- | --- |
| `WEB_ORIGIN` | api | obrigatória | Única origem liberada no CORS (`http://localhost:5173` no exemplo). |
| `ALPHA_BASE_URL` | api | obrigatória | URL do Banco Alpha (`http://localhost:4001` no exemplo). |
| `BETA_BASE_URL` | api | obrigatória | URL do Banco Beta (`http://localhost:4002` no exemplo). |
| `PORT` | api | `3000` | Porta da API. |
| `BANK_TIMEOUT_MS` | api | `3000` | Tempo limite de cada banco, em milissegundos. |
| `LOG_LEVEL` | api | `info` | Nível do log: `fatal`, `error`, `warn`, `info`, `debug`, `trace` ou `silent`. |
| `ALPHA_PORT` | bank-mocks | `4001` | Porta do Banco Alpha. |
| `BETA_PORT` | bank-mocks | `4002` | Porta do Banco Beta. |
| `BETA_SCENARIO` | bank-mocks | `slow` | Cenário do Banco Beta (veja [Bancos simulados](#bancos-simulados)). |
| `VITE_API_URL` | web | `http://localhost:3000` | URL da API usada pelo front. |

As URLs da API não têm padrão no código, para que uma configuração esquecida não aponte em silêncio para outro lugar. A API e os bancos simulados validam as variáveis na subida e, se alguma faltar ou for inválida, encerram com uma mensagem que a nomeia:

```text
Configuração inválida da API. ALPHA_BASE_URL: variável obrigatória
Configuração inválida dos mocks bancários. BETA_SCENARIO: use um destes valores: ok, slow, unavailable, invalid
```

### Build de produção

```bash
npm run build
cp api/.env.example api/.env
npm start -w @consignado/api
npm start -w @consignado/bank-mocks
npm run preview -w @consignado/web -- --port 5173
```

Rode cada `start` e o `preview` num terminal próprio. O `--port 5173` é necessário porque o `vite preview` usa a porta 4173 por padrão, e a API só aceita a origem do `WEB_ORIGIN`. O `VITE_API_URL` entra no código do front durante o build: para apontar para outra API, defina-o antes do `npm run build`.

### Scripts

Rode na raiz do projeto.

| Script | O que faz |
| --- | --- |
| `npm run dev` | Sobe a API, os bancos simulados e o front. |
| `npm run lint` | ESLint e verificação de formatação do Prettier. |
| `npm run format` | Formata o código com o Prettier. |
| `npm run typecheck` | Checagem de tipos em todos os pacotes. |
| `npm test` | Testes (Vitest) de todos os pacotes. |
| `npm run build` | Build de produção de todos os pacotes. |
| `npm run check` | Lint, tipos, testes e build, nessa ordem, parando no primeiro erro. |

Para rodar um script em um pacote só, use `-w`, por exemplo `npm test -w @consignado/api`.

## Bancos simulados

O pacote `bank-mocks` simula dois bancos parceiros num único processo, cada um na sua porta e com um contrato diferente, como acontece com APIs de bancos reais. Os bancos validam o corpo recebido e respondem HTTP 400 quando ele vem fora do contrato. Nenhum deles guarda nem registra o CPF: o log de cada requisição traz só banco, método, caminho, status e duração.

| | Banco Alpha | Banco Beta |
| --- | --- | --- |
| Porta | `4001` | `4002` |
| Rota | `POST /v1/loan-quotes` | `POST /api/simulacao` |
| Corpo | `{ "document": "<cpf>", "amountCents": 1000000, "termMonths": 24 }` | `{ "cpf": "<cpf>", "valor": "10000.00", "prazoMeses": 24 }` |
| Resposta | `{ "quoteId": "…", "annualInterestRate": "0.24" }` (taxa anual em decimal) | `{ "codigo": "…", "taxaAnualPercentual": "21.50" }` (taxa anual em percentual) |

O Alpha responde em cerca de 100 ms, com taxa fixa por faixa de prazo:

| Prazo | Taxa anual |
| --- | --- |
| 6 a 24 meses | 24% (`"0.24"`) |
| 25 a 60 meses | 26% (`"0.26"`) |
| 61 a 96 meses | 28% (`"0.28"`) |

O Beta se comporta conforme a variável `BETA_SCENARIO`, sempre do mesmo jeito enquanto o processo estiver no ar:

| Cenário | Comportamento | Status esperado na API |
| --- | --- | --- |
| `ok` | Responde em cerca de 150 ms com taxa de 21,50% a.a. | `success` |
| `slow` (padrão) | Responde a mesma oferta depois de 10 s, acima do tempo limite da API. | `timeout` |
| `unavailable` | Responde HTTP 503 a qualquer requisição. | `unavailable` |
| `invalid` | Responde HTTP 200 sem o campo da taxa. | `invalid-response` |

Para trocar o cenário, reinicie os bancos simulados com a variável, por exemplo:

```bash
BETA_SCENARIO=ok npm run dev -w @consignado/bank-mocks
```

ou defina `BETA_SCENARIO` no `bank-mocks/.env`. Um valor desconhecido impede a subida, com uma mensagem que lista os cenários aceitos.

### Testando com `curl`

Com os bancos simulados no ar, use o CPF fictício `38192746500`:

```bash
# Banco Alpha
curl -s -X POST localhost:4001/v1/loan-quotes \
  -H 'content-type: application/json' \
  -d '{"document":"38192746500","amountCents":1000000,"termMonths":24}'

# Banco Beta, com o código HTTP e o tempo de resposta
curl -s -w '\n%{http_code} %{time_total}s\n' -X POST localhost:4002/api/simulacao \
  -H 'content-type: application/json' \
  -d '{"cpf":"38192746500","valor":"10000.00","prazoMeses":24}'
```

Resultado esperado do Beta em cada cenário:

| Cenário | Resposta |
| --- | --- |
| `ok` | `{"codigo":"…","taxaAnualPercentual":"21.50"}` e `200`, em menos de 0,3 s |
| `slow` | A mesma oferta e `200`, depois de cerca de 10 s |
| `unavailable` | `{"erro":"servico_indisponivel"}` e `503` |
| `invalid` | `{"codigo":"…"}` e `200`, sem `taxaAnualPercentual` |
