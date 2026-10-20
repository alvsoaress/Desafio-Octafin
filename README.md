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

Cada pacote tem um `.env.example` com as variáveis e seus valores padrão, que já funcionam localmente. Para mudar algum, copie o arquivo para `.env` no mesmo pacote:

```bash
cp api/.env.example api/.env
cp bank-mocks/.env.example bank-mocks/.env
cp web/.env.example web/.env
```

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
