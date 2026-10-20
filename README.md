# Simulador de Consignado

Simula um empréstimo consignado em vários bancos ao mesmo tempo e mostra a oferta de cada um, mesmo quando algum banco demora ou falha.

## Funcionalidades

- **Formulário único** com CPF, CNPJ do empregador, salário, descontos consignados existentes, valor desejado e prazo.
- **Validação no front e na API** com o mesmo esquema Zod: CPF e CNPJ por dígito verificador, limites de valor e de prazo, mensagens em português junto a cada campo.
- **Margem consignável**: 35% do salário menos os descontos existentes. Quando a parcela não cabe, o simulador mostra a parcela máxima e quanto o cliente consegue financiar.
- **Cálculo pela tabela Price**, com a taxa anual do banco convertida em mensal composta, valores em centavos e aritmética decimal.
- **Consulta paralela aos bancos**, com tempo limite por banco. Um banco lento, fora do ar ou com resposta inválida não derruba a simulação: as demais ofertas aparecem, junto com o motivo da falha daquele banco.
- **Privacidade**: nada é gravado, e CPF, CNPJ e valores não aparecem nos logs.

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

Cada pacote tem um `.env.example` com as variáveis e seus valores padrão, que já funcionam localmente. Por enquanto, só os bancos simulados leem o `.env`; a API e o front passam a lê-lo quando ganharem configuração própria. Para mudar alguma variável dos bancos simulados, copie o arquivo para `.env` no mesmo pacote:

```bash
cp bank-mocks/.env.example bank-mocks/.env
```

Uma variável passada na linha de comando tem precedência sobre o `.env`.

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
