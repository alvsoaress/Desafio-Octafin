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

## API de simulação

A API tem uma rota, `POST /api/simulations`, que recebe os dados do cliente, calcula a margem, consulta os bancos e devolve a oferta de cada um numa resposta única.

### Requisição

O corpo é um JSON com seis campos, todos obrigatórios. Valores em reais vão em centavos inteiros. Um campo fora desta lista é recusado.

| Campo | Tipo | Regra | Mensagem de erro |
| --- | --- | --- | --- |
| `cpf` | string | CPF com dígitos verificadores válidos, com ou sem máscara. Sequências repetidas (`111.111.111-11`) são inválidas. | Informe um CPF válido. |
| `employerCnpj` | string | CNPJ do empregador, com as mesmas regras do CPF. | Informe um CNPJ válido. |
| `salaryCents` | inteiro | Salário bruto mensal, maior que zero e até R$ 1.000.000,00. | Informe o salário. |
| `existingDeductionsCents` | inteiro | Descontos consignados existentes, de zero até o salário. | Os descontos não podem ser maiores que o salário. |
| `requestedAmountCents` | inteiro | Valor desejado, de R$ 500,00 a R$ 500.000,00. | Informe um valor entre R$ 500,00 e R$ 500.000,00. |
| `termMonths` | inteiro | Prazo em meses, de 6 a 96. | Informe um prazo entre 6 e 96 meses. |

Campo ausente recebe "Campo obrigatório.", e tipo errado (texto no lugar de número, `null`, número negativo nos descontos) recebe "Valor inválido.". O front valida com o mesmo esquema, então as mensagens são as mesmas na tela e na API.

### Resposta

Com os serviços no ar (`npm run dev`, com o Beta no cenário padrão `slow`):

```bash
curl -s -X POST localhost:3000/api/simulations \
  -H 'content-type: application/json' \
  -d '{"cpf":"38192746500","employerCnpj":"47182936000144","salaryCents":500000,"existingDeductionsCents":50000,"requestedAmountCents":1000000,"termMonths":24}' | jq
```

Depois de cerca de 3 s, o tempo limite do Beta, a resposta é HTTP 200:

```json
{
  "requestId": "dc32847a-…",
  "partial": true,
  "margin": {
    "consignableCents": 175000,
    "availableCents": 125000
  },
  "request": {
    "requestedAmountCents": 1000000,
    "termMonths": 24
  },
  "results": [
    {
      "bankId": "alpha",
      "bankName": "Banco Alpha",
      "status": "success",
      "offer": {
        "annualRate": "0.240000",
        "monthlyRate": "0.018088",
        "installmentCents": 51733,
        "totalCents": 1241592,
        "totalInterestCents": 241592,
        "withinMargin": true,
        "maxInstallmentCents": 125000,
        "maxFinanceableCents": null
      }
    },
    {
      "bankId": "beta",
      "bankName": "Banco Beta",
      "status": "timeout",
      "error": {
        "code": "timeout",
        "message": "O Banco Beta não respondeu a tempo."
      }
    }
  ]
}
```

- `margin`: a margem consignável (35% de R$ 5.000,00 = R$ 1.750,00) e a disponível (menos os R$ 500,00 de descontos = R$ 1.250,00).
- `request`: o valor e o prazo simulados.
- `results`: um item por banco, sempre na mesma ordem, mesmo quando o banco falha. Um banco com `status: "success"` traz `offer`; os demais trazem `error`, com uma mensagem pronta para a tela.
- `offer`: as taxas anual e mensal como string decimal de 6 casas, para não perder precisão, e a parcela, o total pago e o total de juros em centavos. A taxa mensal é a equivalente composta de 24% a.a. (1,8088% a.m., e não 2%), e a parcela de R$ 517,33 sai da tabela Price com ela.
- `withinMargin`: se a parcela cabe na margem disponível. `maxInstallmentCents` é a margem disponível, e `maxFinanceableCents`, quando a parcela não cabe, é o valor que caberia com a mesma taxa e prazo.
- `partial`: `true` quando algum banco não devolveu oferta. A simulação continua válida.

Quando a parcela passa da margem, por exemplo com salário de R$ 3.000,00 e descontos de R$ 600,00 (`"salaryCents":300000,"existingDeductionsCents":60000`), a margem disponível é R$ 450,00, e a oferta do Alpha indica quanto o cliente conseguiria pegar:

```json
"margin": { "consignableCents": 105000, "availableCents": 45000 },
"offer": { "installmentCents": 51733, "withinMargin": false, "maxInstallmentCents": 45000, "maxFinanceableCents": 869852, "…": "…" }
```

Com descontos de R$ 1.050,00 (`"existingDeductionsCents":105000`), a margem disponível é zero. A resposta continua 200 e os bancos continuam sendo consultados, para o cliente ver as taxas, mas toda oferta vem com `withinMargin: false`, `maxInstallmentCents: 0` e `maxFinanceableCents: 0`.

### Status de cada banco

Os bancos são consultados em paralelo, cada um com o tempo limite `BANK_TIMEOUT_MS` (3 s por padrão). Quando o tempo estoura, a requisição ao banco é abortada, e não só ignorada. Não há nova tentativa automática: ela estouraria o tempo de resposta e multiplicaria as chamadas ao banco.

| `status` | Quando acontece | Cenário do Beta que o produz |
| --- | --- | --- |
| `success` | Resposta 2xx com corpo válido no contrato do banco. | `ok` |
| `timeout` | O banco não respondeu dentro do tempo limite. | `slow` |
| `unavailable` | Conexão recusada ou resposta que não é 2xx. Também é o status de um erro inesperado no adaptador. | `unavailable` |
| `invalid-response` | Resposta 2xx que não é JSON, fora do contrato ou com taxa implausível (negativa ou acima de 1000% a.a.). | `invalid` |

### Erros

Todo erro tem o mesmo formato, com o `requestId` para suporte:

| HTTP | `error` | Quando |
| --- | --- | --- |
| 400 | `validation_error` | Algum campo é inválido. O objeto `fields` traz uma mensagem por campo. |
| 400 | `invalid_json` | O corpo não é JSON. |
| 413 | `payload_too_large` | O corpo passa de 10 KB. |
| 500 | `internal_error` | Erro inesperado. A resposta não traz pilha, mensagem interna nem dados da requisição. |

Por exemplo, um CPF inválido e um campo a mais:

```bash
curl -s -X POST localhost:3000/api/simulations \
  -H 'content-type: application/json' \
  -d '{"cpf":"11111111111","employerCnpj":"47182936000144","salaryCents":500000,"existingDeductionsCents":50000,"requestedAmountCents":1000000,"termMonths":24,"extra":true}'
```

```json
{"error":"validation_error","fields":{"cpf":"Informe um CPF válido.","extra":"Campo não permitido."},"requestId":"b89eb7e9-…"}
```

E um corpo que não é JSON (`-d '{'`):

```json
{"error":"invalid_json","requestId":"0a9cf84b-…"}
```

Toda resposta traz o cabeçalho `x-request-id`, com o mesmo valor do `requestId` do corpo. Se a requisição enviar um `x-request-id` que seja um UUID válido, ele é reaproveitado; qualquer outro valor é trocado por um novo. O CORS libera só a origem do `WEB_ORIGIN`: uma requisição de outra origem não recebe os cabeçalhos `Access-Control-*`.

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

Para trocar o cenário, reinicie com a variável. Na raiz, ela vale para o `npm run dev` inteiro:

```bash
BETA_SCENARIO=ok npm run dev
```

Para reiniciar só os bancos simulados, deixando a API e o front no ar:

```bash
BETA_SCENARIO=ok npm run dev -w @consignado/bank-mocks
```

Também dá para definir `BETA_SCENARIO` no `bank-mocks/.env`. Um valor desconhecido impede a subida, com uma mensagem que lista os cenários aceitos.

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

## Logs e privacidade

A API escreve logs em JSON com o `pino`. Cada requisição gera uma linha com só `requestId`, método, caminho, status e duração, e cada simulação registra, por banco, o `bankId`, o `status` e a duração da consulta. A simulação do exemplo acima gera estas linhas (sem os campos `level`, `time`, `pid` e `hostname`):

```json
{"requestId":"dc32847a-…","bankId":"alpha","status":"success","durationMs":171,"msg":"Consulta ao banco concluída"}
{"requestId":"dc32847a-…","bankId":"beta","status":"timeout","durationMs":3009,"msg":"Consulta ao banco concluída"}
{"requestId":"dc32847a-…","method":"POST","path":"/api/simulations","status":200,"durationMs":3054,"msg":"Requisição concluída"}
```

Como proteção extra, toda linha passa por um mascaramento que troca por `[REDACTED]` o valor das chaves `cpf`, `employerCnpj`, `salaryCents`, `existingDeductionsCents`, `requestedAmountCents`, `body`, `authorization` e `cookie`, em qualquer nível do objeto. Assim, um objeto com esses campos passado ao logger por engano não vaza os dados. Um erro inesperado é registrado só com o `requestId` e o nome do erro, sem a mensagem, que poderia conter dados da requisição.

Nada é gravado: não há banco de dados, arquivo nem cache, e o front não usa `localStorage`. O CPF, o valor e o prazo vão para os bancos, que precisam deles para cotar; o salário e os descontos não saem da API. Todos os CPFs e CNPJs do projeto, nos exemplos, nos mocks e nos testes, são fictícios.
