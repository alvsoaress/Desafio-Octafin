# Simulador de Consignado

Simula um empréstimo consignado em vários bancos ao mesmo tempo e mostra a oferta de cada um, mesmo quando algum banco demora ou falha.

## Funcionalidades

- **Formulário único** com CPF, CNPJ do empregador, salário, descontos consignados existentes, valor desejado e prazo.
- **Validação no front e na API** com o mesmo esquema Zod: CPF e CNPJ por dígito verificador, limites de valor e de prazo, mensagens em português junto a cada campo.
- **Margem consignável**: 35% do salário menos os descontos existentes. Quando a parcela não cabe, o simulador mostra a parcela máxima e quanto o cliente consegue financiar.
- **Cálculo pela tabela Price**, com a taxa anual do banco convertida em mensal composta, valores em centavos e aritmética decimal.
- **Consulta paralela aos bancos**, com tempo limite por banco. Um banco lento, fora do ar ou com resposta inválida não derruba a simulação: as demais ofertas aparecem, junto com o motivo da falha daquele banco.
- **Situação de cada banco**: cada cartão diz "Aprovado" (a parcela cabe na margem disponível), "Reprovado" (não cabe) ou "Sem resposta" (o banco falhou). O banco informa só a taxa, e quem decide se a parcela cabe é a margem calculada pela API. Uma falha técnica não é reprovação, porque o banco não chegou a avaliar o pedido. O selo "Menor parcela" aparece só quando há duas ou mais ofertas aprovadas para comparar.
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
| `BETA_SCENARIO` | bank-mocks | `ok` | Cenário do Banco Beta (veja [Bancos simulados](#bancos-simulados)). |
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

Com os serviços no ar e o Beta no cenário `slow` (`BETA_SCENARIO=slow npm run dev`), para mostrar também um banco com falha:

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
| `ok` (padrão) | Responde em cerca de 150 ms com taxa de 21,50% a.a. | `success` |
| `slow` | Responde a mesma oferta depois de 10 s, acima do tempo limite da API. | `timeout` |
| `unavailable` | Responde HTTP 503 a qualquer requisição. | `unavailable` |
| `invalid` | Responde HTTP 200 sem o campo da taxa. | `invalid-response` |

Para trocar o cenário, reinicie com a variável. Na raiz, ela vale para o `npm run dev` inteiro:

```bash
BETA_SCENARIO=slow npm run dev
```

Para reiniciar só os bancos simulados, deixando a API e o front no ar:

```bash
BETA_SCENARIO=slow npm run dev -w @consignado/bank-mocks
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

## Testes

Os testes usam Vitest e não dependem de rede: os bancos são simulados com `nock` nos adaptadores e com adaptadores falsos no serviço, e a API é testada com `supertest` sem subir servidor.

| Pacote | Testes | O que cobrem |
| --- | --- | --- |
| `shared` | 131 | CPF e CNPJ por dígito verificador, conversão de reais digitados em centavos (`"1.234,56"` → `123456`, e `"0,10"` + `"0,20"` = `30`), esquemas da requisição e da resposta com as mensagens de erro. |
| `api` | 154 | Domínio com exemplos de referência fixos: margem de R$ 1.250,00 para salário de R$ 5.000,00 e descontos de R$ 500,00; 24% a.a. vira `0.018088` a.m., e não `0.02`; R$ 10.000,00 em 24 meses dá parcela `51733` e total `1241592`; com margem de R$ 450,00, o valor financiável é `869852`. Adaptadores com `nock` em cada status (sucesso, tempo limite, conexão recusada, 503, corpo que não é JSON e fora do contrato). Serviço com adaptadores falsos (banco lento, exceção inesperada, todos fora do ar, logs sem dados pessoais). Rotas, middlewares, erros, CORS, `x-request-id`, mascaramento do logger e variáveis de ambiente. |
| `bank-mocks` | 68 | Contrato de cada banco, taxa por faixa de prazo, os quatro cenários do Beta, latência cancelada quando o cliente desiste e logs sem CPF. |
| `web` | 147 | Máscaras, formatação de reais e percentuais, situação de cada banco e regra do selo, cliente da API com `fetch` falso, e componentes e tela com Testing Library: validação junto ao campo, carregamento, textos e rótulos de cada resultado e de cada erro, e navegação só com teclado. |

Os testes ficam ao lado do código (`*.test.ts` e `*.test.tsx`). Para rodar:

```bash
npm test                                                  # todos os pacotes
npm test -w @consignado/api                               # um pacote
npm test -w @consignado/api -- src/domain/loan.test.ts    # um arquivo
```

Para o modo de observação, que roda de novo a cada mudança, use `npx vitest` dentro da pasta do pacote.

### Verificação antes do merge

O `npm run check` roda lint, tipos, testes e build de todos os pacotes, nessa ordem, e para no primeiro erro. Não há CI: rode-o antes de cada pull request.

O lint também protege a arquitetura. O código de `api/src/domain/` não pode importar `express`, `pino`, `nock`, `undici` nem `supertest`, nem as camadas `infra`, `http` e `services`, nem o `container`, o `app` e o `server`, e também não pode usar `fetch`. Um import desses quebra o `npm run lint`:

```text
api/src/domain/loan.ts
  1:1  error  'express' import is restricted from being used. O domínio não depende de infraestrutura  no-restricted-imports
```

### Roteiro pela tela

Com `npm run dev`, abra http://localhost:5173 e preencha o exemplo de referência: CPF `381.927.465-00`, CNPJ `47.182.936/0001-44`, salário `5.000,00`, descontos `500,00`, valor `10.000,00` e prazo `24`.

| Situação | O que aparece |
| --- | --- |
| `ok` (padrão) | Os dois bancos "Aprovado", com o Alpha em R$ 517,33 e o selo "Menor parcela" no Beta (R$ 507,17). |
| `BETA_SCENARIO=slow` | "Consultando bancos…" por cerca de 3 s, depois o Alpha "Aprovado" com R$ 517,33 e sem selo, o Beta "Sem resposta" com "O Banco Beta não respondeu a tempo." e o aviso de resultado parcial. |
| `BETA_SCENARIO=unavailable` | O Beta "Sem resposta" com "O Banco Beta está indisponível no momento." |
| `BETA_SCENARIO=invalid` | O Beta "Sem resposta" com "O Banco Beta devolveu uma resposta que não conseguimos ler." |
| Salário `3.000,00` e descontos `600,00` | Os dois bancos "Reprovado", sem selo. No Alpha, "A parcela de R$ 517,33 passa da sua margem disponível de R$ 450,00." e "Com essa margem, você consegue até R$ 8.698,52 em 24 meses." |
| Descontos `1.050,00`, com o mesmo salário | Os dois bancos "Reprovado" e "Você não tem margem disponível para uma nova parcela." |
| Bancos simulados parados | "Nenhum banco respondeu agora. Tente novamente em alguns instantes." e o botão "Simular de novo". |
| API parada | "Não foi possível simular agora. Tente novamente." |

## Decisões

### Dinheiro e cálculo

- **Valores em centavos inteiros nas regras e na API; reais só na tela.** Assim nenhum valor passa por ponto flutuante, em que `0.1 + 0.2` não dá `0.3`. Os cálculos usam `decimal.js`.
- **Taxa mensal composta, `(1 + a)^(1/12) − 1`, arredondada para 6 casas e usada assim no cálculo.** Dividir a taxa anual por 12 superestima a taxa (24% a.a. daria 2% a.m., e não 1,8088%). Usar a taxa arredondada, a mesma que aparece na tela, permite que o cliente refaça a conta e chegue à mesma parcela.
- **A parcela é arredondada para o centavo mais próximo, e a margem e o valor financiável, sempre para baixo.** O simulador nunca oferece mais margem nem mais crédito do que a regra permite.

### Bancos e falhas

- **Os bancos são consultados em paralelo, cada um isolado e com tempo limite próprio.** Cada consulta roda dentro de um `try/catch` e nunca rejeita, e todas vão juntas num `Promise.all`. O tempo limite é um `AbortSignal.timeout` por banco: o adaptador o repassa ao `fetch`, que é abortado, e o serviço também corre a resposta contra o sinal, para que um adaptador que o ignore não segure a simulação. A espera máxima é o tempo limite, e um banco lento vira resultado parcial.
- **Sem nova tentativa automática.** Tentar de novo estouraria o tempo de resposta e multiplicaria as chamadas ao banco parceiro.
- **Falha do banco vira status no adaptador; erro inesperado vira `unavailable` no serviço.** O adaptador traduz cada falha do banco no status correspondente, sem lançar erro. Um defeito no próprio adaptador não é escondido: sobe ao serviço, que o registra no log e responde `unavailable` para aquele banco, sem derrubar a simulação.
- **Bancos simulados por HTTP real, com contratos diferentes e validação do próprio contrato.** Os adaptadores mostram a tradução de dois formatos distintos (taxa em decimal no Alpha e em percentual no Beta), e um adaptador que traduza errado recebe HTTP 400, como receberia de um banco real.
- **O cenário do Beta é fixado por variável de ambiente.** O mesmo cenário sempre produz o mesmo resultado, na demonstração e nos testes. Trocar exige reiniciar os bancos simulados.

### API, segurança e logs

- **Sem banco de dados.** O fluxo não precisa de persistência, e não guardar CPF nem salário reduz o risco de vazamento (LGPD).
- **Mascaramento recursivo nos logs.** Uma função pura percorre cada linha de log em qualquer profundidade e troca os campos sensíveis por `[REDACTED]`. O `redact` nativo do `pino` cobre só os caminhos listados.

### Front

- **Sem bibliotecas de estilo, de componentes, de formulário nem de máscara.** São seis campos: CSS puro com variáveis e estado com `useState` bastam. As máscaras e a formatação de reais e percentuais são funções puras em aritmética inteira, testadas sem React, e o valor digitado nunca passa por `number` com casas decimais.
- **A situação de cada banco é derivada da resposta, sem status novo no contrato.** "Aprovado" e "Reprovado" saem de `status` e `withinMargin`, que a API já devolve, e uma falha técnica fica como "Sem resposta", porque o banco não avaliou o pedido.
- **O selo "Menor parcela" só aparece com duas ou mais ofertas aprovadas.** Com uma oferta só, "menor" não compara nada e vira destaque sem motivo.
- **O cliente da API é injetável e valida a resposta pelo contrato.** A tela é testada com um cliente falso, sem rede, e uma resposta fora do contrato vira a mensagem de erro, em vez de quebrar a renderização.

### Projeto

- **npm workspaces com um pacote `shared` sem build.** Os esquemas Zod da requisição e da resposta ficam no `shared` e são usados pelo front e pela API, com os tipos inferidos deles, então validação e contrato não divergem. O pacote exporta TypeScript direto, porque todo consumidor já o entende.
- **A regra de camadas é verificada pelo ESLint.** O domínio não pode importar infraestrutura, e a arquitetura não depende de revisão manual (veja [Verificação antes do merge](#verificação-antes-do-merge)).
- **Docker e CI/CD ficaram fora desta entrega.** A prioridade foram as funcionalidades e a documentação. O `npm run dev` já sobe tudo num checkout limpo, e o `npm run check` local faz o papel do CI. As propostas estão em [Melhorias planejadas](#melhorias-planejadas).

## Premissas

Pontos que o desafio deixa em aberto e o que o simulador assume em cada um:

- **CNPJ do empregador.** É obrigatório e validado por dígito verificador, mas não é enviado aos bancos, que cotam só com CPF, valor e prazo. Só o CNPJ numérico é aceito; o alfanumérico da Receita fica como melhoria.
- **Limites.** O prazo vai de 6 a 96 meses, o valor desejado de R$ 500,00 a R$ 500.000,00 e o salário até R$ 1.000.000,00. São limites iniciais, definidos como constantes em `shared/src/simulation-request.ts` (as mensagens de erro, em `shared/src/messages.ts`, citam os mesmos valores e mudam junto).
- **Custo.** A simulação mostra só juros. Não entram CET (custo efetivo total), IOF nem seguro prestamista.
- **Base da margem.** A margem é de 35% do salário bruto informado. Se a regra fosse sobre o salário líquido, mudaria o rótulo do campo, não a fórmula.
- **Dados.** Todos os CPFs e CNPJs do projeto são fictícios, gerados com dígitos verificadores válidos.

## Melhorias planejadas

Ficaram fora desta entrega. Cada proposta diz o problema, como seria feita neste código e o que muda no contrato da API.

### Resiliência e experiência

- **Status por banco em tempo real.**
  - *Problema:* a resposta é única, então a tela mostra um carregamento global e não sabe que o Alpha já respondeu enquanto o Beta ainda está sendo consultado.
  - *Como:* uma rota de eventos (SSE) em que o `SimulationService` emite o resultado de cada banco assim que ele chega; o front troca o carregamento global por um estado por cartão.
  - *Contrato:* nova rota de eventos, com um evento por banco no formato atual de `results` e um evento final com `partial`. O `POST /api/simulations` continua igual.
- **Nova tentativa com recuo.**
  - *Problema:* uma falha passageira do banco vira `unavailable` na hora.
  - *Como:* no serviço, repetir só as falhas `unavailable`, com recuo exponencial e um orçamento de tempo que nunca passa do tempo limite total, para não aumentar a espera máxima.
  - *Contrato:* nada.
- **Cache de taxas.**
  - *Problema:* cada simulação consulta todos os bancos, mesmo que a taxa seja a mesma de segundos antes.
  - *Como:* um cache em memória por banco e prazo, com validade curta, num decorador da porta `BankAdapter`, sem mudar os adaptadores. O CPF não entraria na chave.
  - *Contrato:* nada.
- **Circuit breaker por banco.**
  - *Problema:* um banco fora do ar continua recebendo chamadas e fazendo cada simulação esperar o tempo limite.
  - *Como:* outro decorador da porta, que depois de várias falhas seguidas responde `unavailable` na hora por um intervalo e depois testa o banco de novo.
  - *Contrato:* nada.

### Bancos e regras

- **Terceiro banco.**
  - *Problema:* a entrega tem só dois bancos simulados.
  - *Como:* o serviço e o domínio não mudam. Basta:
    1. criar `api/src/infra/banks/<banco>.adapter.ts` com uma classe que implementa a porta `BankAdapter` (`api/src/domain/bank-adapter.ts`): `bankId`, `bankName` e `quote(request, signal)`;
    2. no `quote`, traduzir a requisição para o formato do banco, chamar o `postJson` (`api/src/infra/http-client.ts`) com o `signal` e converter a resposta com o `toQuoteResult` (`api/src/infra/banks/to-quote-result.ts`), passando uma função que valida o corpo com o esquema Zod do banco e devolve a taxa anual em forma decimal (`0.24` para 24% a.a.), ou `null` quando o corpo está fora do contrato;
    3. testar com `nock` cada status, como em `alpha.adapter.test.ts`;
    4. acrescentar a URL do banco em `api/src/config/env.ts` e no `api/.env.example`, e uma linha na lista `adapters` do `api/src/container.ts`.
  - *Contrato:* nada. O novo banco aparece como mais um item de `results`, e o front já mostra qualquer quantidade de cartões.
- **Recusa decidida pelo banco.**
  - *Problema:* hoje o banco informa só a taxa, e "Reprovado" quer dizer apenas que a parcela não cabe na margem. Um banco real também recusa por política própria, como idade, convênio ou restrição de crédito.
  - *Como:* um status `rejected` no resultado do adaptador, produzido pelo `toQuoteResult` quando o banco devolve uma recusa no próprio contrato, e um cenário `rejected` no mock do Beta. O front mostra "Reprovado" com o motivo informado pelo banco.
  - *Contrato:* `status` ganha o valor `rejected`, com `error.code` igual a `rejected` e uma mensagem própria.
- **Trocar o cenário do Beta sem reiniciar.**
  - *Problema:* para demonstrar cada falha, é preciso reiniciar os bancos simulados.
  - *Como:* uma rota `POST /__scenario` só no mock do Beta, nunca exposta pela API.
  - *Contrato:* nada na API.
- **CNPJ alfanumérico.**
  - *Problema:* a Receita passou a emitir CNPJs com letras, que o validador atual recusa.
  - *Como:* adaptar a normalização e o dígito verificador em `shared/src/documents.ts` e a máscara do front.
  - *Contrato:* `employerCnpj` passa a aceitar letras.
- **CET, IOF e seguro.**
  - *Problema:* a simulação mostra só juros, e o custo real do empréstimo é maior.
  - *Como:* calcular IOF e tarifas no domínio e o CET a partir do fluxo de pagamentos.
  - *Contrato:* novos campos em `offer`, como `iofCents` e `cetAnnualRate`.

### Operação e entrega

- **Testes de ponta a ponta no navegador.**
  - *Problema:* o fluxo completo na tela foi verificado à mão.
  - *Como:* Playwright com os bancos simulados nos quatro cenários do Beta, cobrindo o roteiro de [Roteiro pela tela](#roteiro-pela-tela).
  - *Contrato:* nada.
- **Métricas e traces.**
  - *Problema:* os logs dizem o que aconteceu numa simulação, mas não mostram tendências, como a taxa de falha de cada banco.
  - *Como:* OpenTelemetry, com um trace por simulação, um span por banco e métricas de duração e status por banco, que hoje já vão para o log.
  - *Contrato:* nada.
- **Autenticação e limite de requisições.**
  - *Problema:* qualquer cliente pode chamar a API, quantas vezes quiser.
  - *Como:* autenticação do cliente e limite de requisições por cliente, num middleware antes da rota.
  - *Contrato:* novo cabeçalho de credencial, e respostas 401 e 429 no formato dos demais erros.
- **Docker.**
  - *Problema:* rodar o projeto exige Node 22 instalado.
  - *Como:* um `Dockerfile` na raiz, em etapas, com um alvo por serviço (API, bancos simulados e front, servido por `nginx`), e um `docker-compose.yml` que sobe tudo nas mesmas portas, com o cenário do Beta escolhido por `BETA_SCENARIO=ok docker compose up`.
  - *Contrato:* nada.
- **CI/CD.**
  - *Problema:* a única barreira antes do merge é rodar o `npm run check` localmente.
  - *Como:* um workflow do GitHub Actions que roda `npm ci` e `npm run check` em todo pull request e push na `main`. A publicação (CD) depende de escolher onde hospedar a API, os bancos simulados e o front.
  - *Contrato:* nada.
