# Simulador de Consignado

Simula um empréstimo consignado em vários bancos ao mesmo tempo e mostra a oferta de cada um, mesmo quando algum banco demora ou falha.

## Como executar

Pré-requisitos: Node.js 22 (com `nvm`, rode `nvm use`) e npm 10 ou superior.

```bash
npm ci
npm run dev
```

O `npm run dev` sobe o front (http://localhost:5173), a API (porta 3000) e os dois bancos simulados (portas 4001 e 4002). Não é preciso criar `.env`: cada pacote tem um `.env.example` com valores que já funcionam.

Para testar na tela, use os dados fictícios de referência: nome `Maria Fictícia da Silva`, e-mail `maria.ficticia@example.com`, CPF `381.927.465-00`, CNPJ `47.182.936/0001-44`, salário `5.000,00`, descontos `500,00`, valor `10.000,00` e prazo `24`. Os dois bancos aprovam, com parcelas de R$ 517,33 (Alpha) e R$ 507,17 (Beta).

### Recusas dos bancos

Cada banco recusa por uma regra própria, e cada um avisa de um jeito diferente:

| Banco | Recusa quando | Como avisa | Para ver na tela |
| --- | --- | --- | --- |
| Alpha | O valor passa de R$ 100.000,00. | HTTP 200 com `decision: "declined"` e `reasonCode`. | Valor `150.000,00`. |
| Beta | O empregador não tem convênio com o banco. | HTTP 422 com `erro: "empregador_sem_convenio"`. | CNPJ `38.501.462/0001-65`. |

O cartão do banco mostra "Reprovado" e o motivo. Um código de recusa desconhecido continua sendo recusa, com o motivo genérico.

### Cenários do Banco Beta

O Beta simula falhas conforme a variável `BETA_SCENARIO`, para mostrar o resultado parcial:

```bash
BETA_SCENARIO=slow npm run dev
```

| Cenário | Comportamento | O que a tela mostra para o Beta |
| --- | --- | --- |
| `ok` (padrão) | Responde em cerca de 150 ms. | Oferta aprovada. |
| `slow` | Responde depois de 10 s, acima do tempo limite de 3 s. | "Sem resposta": não respondeu a tempo. |
| `unavailable` | Responde HTTP 503. | "Sem resposta": indisponível. |
| `invalid` | Responde sem a taxa. | "Sem resposta": resposta ilegível. |

### Variáveis de ambiente

Para mudar alguma, copie o `.env.example` do pacote para `.env` e edite, ou passe na linha de comando.

| Variável | Pacote | Padrão | Uso |
| --- | --- | --- | --- |
| `BANK_TIMEOUT_MS` | api | `3000` | Tempo limite de cada banco, em ms. |
| `WEB_ORIGIN` | api | `http://localhost:5173` no exemplo | Única origem liberada no CORS. |
| `ALPHA_BASE_URL`, `BETA_BASE_URL` | api | `http://localhost:4001` e `:4002` no exemplo | URLs dos bancos. |
| `PORT`, `LOG_LEVEL` | api | `3000`, `info` | Porta e nível de log da API. |
| `BETA_SCENARIO` | bank-mocks | `ok` | Cenário do Beta. |
| `VITE_API_URL` | web | `http://localhost:3000` | URL da API usada pelo front. |

A API e os bancos simulados validam as variáveis na subida e, se uma faltar ou for inválida, encerram com uma mensagem que a nomeia.

### API

A API tem uma rota, `POST /api/simulations`, com valores em centavos:

```bash
curl -s -X POST localhost:3000/api/simulations \
  -H 'content-type: application/json' \
  -d '{"name":"Maria Fictícia da Silva","email":"maria.ficticia@example.com","cpf":"38192746500","employerCnpj":"47182936000144","salaryCents":500000,"existingDeductionsCents":50000,"requestedAmountCents":1000000,"termMonths":24}'
```

A resposta é sempre HTTP 200 quando a entrada é válida, mesmo com bancos falhando: cada banco vem em `results` com `status` (`success`, `rejected`, `timeout`, `unavailable` ou `invalid-response`), e `partial: true` indica que algum banco não respondeu. Uma recusa do banco é uma resposta e não deixa o resultado parcial. Entrada inválida recebe 400 com uma mensagem em português por campo; erro inesperado, 500 sem detalhes internos. Toda resposta traz um `requestId` para suporte.

### Testes e verificação

```bash
npm test          # testes de todos os pacotes (Vitest, sem rede)
npm run check     # lint, tipos, testes e build; rode antes de cada pull request
```

Para produção: `npm run build`, depois `npm start -w @consignado/api`, `npm start -w @consignado/bank-mocks` e `npm run preview -w @consignado/web -- --port 5173`, cada um num terminal, com um `api/.env` criado a partir do exemplo.

## Decisões técnicas

- **Monorepo com npm workspaces**: `web` (React + Vite), `api` (Express), `bank-mocks` (os dois bancos) e `shared` (esquemas Zod e tipos). Front e API validam com o mesmo esquema, então as regras e as mensagens nunca divergem.
- **Dinheiro em centavos inteiros e cálculo com `decimal.js`.** Nenhum valor passa por ponto flutuante, em que `0.1 + 0.2` não dá `0.3`. A parcela é arredondada para o centavo mais próximo; a margem e o valor financiável, sempre para baixo, para nunca oferecer mais crédito do que a regra permite.
- **Taxa mensal composta**, `(1 + a)^(1/12) − 1`, e não a anual dividida por 12, que superestima a taxa (24% a.a. é 1,8088% a.m., e não 2%).
- **Consulta paralela com tempo limite por banco.** Cada banco tem o próprio `AbortSignal`, que aborta a requisição de verdade. Uma falha de um banco nunca derruba a simulação: vira um status daquele banco, e a espera máxima é o tempo limite.
- **Sem nova tentativa automática.** Ela estouraria o tempo de resposta e multiplicaria as chamadas ao banco parceiro.
- **Adaptadores atrás de uma porta (`BankAdapter`).** Cada banco tem um contrato HTTP diferente, traduzido por um adaptador. Um banco novo é um adaptador e uma linha no `container.ts`, sem mexer no serviço nem nas regras.
- **Camadas com dependências apontando para o domínio.** O domínio (margem, Price, Price inversa) é puro e não importa Express, `fetch` nem infraestrutura; o ESLint barra esses imports no `npm run lint`.
- **Contrato da resposta com regras de consistência.** Além dos tipos, o esquema recusa números incoerentes (total diferente de parcela × prazo, margem disponível acima da consignável, banco repetido). O front recusa uma resposta assim, e os testes da API quebram se o cálculo produzir uma.
- **Recusa do banco separada de falha técnica.** Cada adaptador traduz a recusa do seu banco para o status `rejected` com um motivo canônico (`amount-above-limit`, `employer-not-covered` ou `other`). Um 4xx ou 5xx que o adaptador não reconhece continua `unavailable`, então uma queda nunca aparece para o cliente como "Reprovado".
- **Bancos simulados por HTTP real**, com cenários determinísticos, para que a demonstração e os testes mostrem as falhas sempre do mesmo jeito.
- **Nome e e-mail validados, mas fora da consulta aos bancos.** A API exige nome completo e um e-mail válido, mas envia a cada banco só CPF, valor e prazo, o mínimo para a cotação. Os dois campos também passam pelo mascaramento de logs.
- **Sem banco de dados.** O fluxo não precisa de persistência, e não guardar CPF nem salário reduz o risco de vazamento (LGPD).
- **Front sem bibliotecas de estilo, componentes, formulário ou máscara.** São seis campos; máscaras e formatação são funções puras em aritmética inteira, testadas sem React.

## Limitações

- **Bancos simulados.** Alpha e Beta são mocks com taxa fixa por faixa de prazo; não há integração com bancos reais nem consulta de margem em órgão pagador.
- **Só juros.** A simulação não inclui CET, IOF nem seguro prestamista, então o custo real do empréstimo é maior que o mostrado.
- **Limites iniciais.** Prazo de 6 a 96 meses, valor de R$ 500,00 a R$ 500.000,00 e salário até R$ 1.000.000,00, definidos em `shared/src/simulation-request.ts`.
- **E-mail sem verificação.** O formato é validado, mas nenhuma mensagem é enviada para confirmar o endereço.
- **Margem sobre o salário bruto** informado pelo cliente, sem validação externa.
- **CNPJ só numérico.** O CNPJ alfanumérico da Receita ainda é recusado. O CNPJ vai só para o Beta, que é o banco que o usa para conferir o convênio.
- **Resposta única.** A tela mostra um carregamento global até o último banco responder ou estourar o tempo limite; não mostra cada banco chegando.
- **Regras de recusa fixas.** Cada banco simulado recusa por uma regra só (teto de valor no Alpha, convênio no Beta). "Reprovado" também aparece quando o banco aprova a taxa mas a parcela não cabe na margem.
- **Trocar o cenário do Beta exige reiniciar** os bancos simulados.
- **Sem CI, Docker, autenticação nem limite de requisições.** A única barreira antes do merge é o `npm run check` local.

## Melhorias e proposições

Cada proposta diz o problema, o que muda e o ganho para o cliente ou para o serviço. As marcadas como **feita** já estão no código; as **planejadas** ficaram fora desta entrega.

### Para o cliente

- **Tela sempre recuperável** (planejada).
  - *Problema:* uma falha inesperada no cliente da API pode deixar a tela presa em "Consultando bancos…", e erros de validação antigos continuam visíveis numa nova tentativa.
  - *Proposta:* tratar toda falha como erro com nova tentativa, limpar os erros antigos ao reenviar e descartar respostas de simulações já substituídas.
  - *Ganho:* o cliente nunca fica sem saída nem vê dados de uma simulação anterior.
- **Status por banco em tempo real** (planejada).
  - *Problema:* o carregamento é global, mesmo quando um banco já respondeu.
  - *Proposta:* uma rota de eventos (SSE) que envia o resultado de cada banco assim que ele chega, com carregamento por cartão.
  - *Ganho:* o cliente vê a primeira oferta em centenas de milissegundos, sem esperar o banco mais lento.
- **Recusa pelo próprio banco** (feita).
  - *Problema:* "Reprovado" vinha só da margem, e o banco não tinha como recusar por política própria.
  - *Proposta:* cada adaptador traduz a recusa do seu banco para o status `rejected` com um motivo, e o cartão mostra o motivo em português. A recusa não se confunde com falha técnica e não deixa o resultado parcial.
  - *Ganho:* o cliente entende por que um banco recusou e sabe que tentar de novo não muda a resposta.
- **Custo real** (planejada).
  - *Problema:* a simulação mostra só juros.
  - *Proposta:* calcular IOF, tarifas e CET no domínio.
  - *Ganho:* o cliente compara pelo custo total.
- **CNPJ alfanumérico** (planejada).
  - *Problema:* o novo formato da Receita é recusado.
  - *Proposta:* adaptar a validação e a máscara.
  - *Ganho:* clientes de empresas novas conseguem simular.

### Segurança e privacidade

- **Dados pessoais fora dos logs e sem persistência** (feita).
  - *Problema:* logs costumam vazar CPF e salário.
  - *Proposta:* nada é gravado, e toda linha de log passa por um mascaramento recursivo que troca nome, e-mail, CPF, CNPJ, valores, corpo e credenciais por `[REDACTED]`. O nome, o e-mail, o salário e os descontos nunca saem da API.
  - *Ganho:* menor exposição a vazamentos e aderência à LGPD.
- **Superfície da API reduzida** (feita).
  - *Problema:* uma API aberta aceita qualquer origem e qualquer corpo.
  - *Proposta:* CORS só para a origem configurada, corpo limitado a 10 KB, campos fora do contrato recusados, URLs dos bancos só da configuração e erro 500 sem detalhes internos.
  - *Ganho:* menos vetores de abuso e de vazamento de informação interna.
- **Autenticação e limite de requisições** (planejada).
  - *Problema:* qualquer cliente pode chamar a API quantas vezes quiser.
  - *Proposta:* um middleware de autenticação e limite por cliente antes da rota, com respostas 401 e 429 no formato dos demais erros.
  - *Ganho:* protege a API e os bancos parceiros de uso abusivo.

### Qualidade

- **Validação compartilhada e contrato consistente** (feitas).
  - *Problema:* regras duplicadas entre front e API divergem com o tempo, e um esquema que só confere tipos aceita respostas impossíveis.
  - *Proposta:* um único esquema Zod no `shared`, com regras de consistência da resposta, usado pelo front e pelos testes da API.
  - *Ganho:* um erro de cálculo quebra o teste antes de chegar à tela.
- **Arquitetura verificada pelo lint** (feita no domínio; planejada para as demais camadas).
  - *Problema:* a regra de camadas depende de revisão manual.
  - *Proposta:* o ESLint já barra infraestrutura no domínio; a proposta estende a verificação a todas as camadas, detecta ciclos de importação e move as interfaces de log e de simulação para portas neutras.
  - *Ganho:* a arquitetura não se degrada a cada mudança.
- **Testes mais fortes** (planejados).
  - *Problema:* exemplos fixos não provam que as fórmulas valem para qualquer entrada, e os testes dos adaptadores se repetem.
  - *Proposta:* testes de propriedade nas fórmulas (parcela cresce com valor e taxa, juros nunca negativos, valor financiável sempre cabe na margem), uma suíte de contrato que todo adaptador de banco precisa passar e mutation testing (Stryker) nos módulos financeiros, com meta de 80%.
  - *Ganho:* mais confiança nos cálculos e um banco novo testado da mesma forma que os existentes.
- **Testes de ponta a ponta no navegador** (planejado).
  - *Problema:* o fluxo completo na tela foi verificado à mão.
  - *Proposta:* Playwright com os quatro cenários do Beta.
  - *Ganho:* regressões visuais e de fluxo aparecem antes do merge.

### Infraestrutura e operação

- **Rastreabilidade por requisição** (feita).
  - *Problema:* sem identificador, um erro relatado pelo cliente não é encontrado nos logs.
  - *Proposta:* todo pedido recebe um `x-request-id`, devolvido ao cliente e presente em cada linha de log, com status e duração por banco.
  - *Ganho:* o suporte localiza qualquer simulação pelo código mostrado na tela.
- **Cancelamento quando o cliente desiste** (planejado).
  - *Problema:* se o cliente fecha a página, a API continua esperando os bancos.
  - *Proposta:* propagar o fechamento da conexão até os adaptadores, abortando as consultas, e isolar a falha de cálculo de um banco para não derrubar os outros.
  - *Ganho:* menos carga desperdiçada nos bancos parceiros e simulações mais resilientes.
- **Nova tentativa, cache e circuit breaker** (planejados).
  - *Problema:* uma falha passageira vira `unavailable`, cada simulação consulta todos os bancos e um banco fora do ar faz toda simulação esperar o tempo limite.
  - *Proposta:* decoradores da porta `BankAdapter`, sem mudar os adaptadores: nova tentativa com recuo dentro do tempo limite, cache curto de taxas por banco e prazo (sem CPF na chave) e circuit breaker que responde `unavailable` na hora depois de falhas seguidas.
  - *Ganho:* respostas mais rápidas e estáveis, com menos carga nos parceiros.
- **CI, Docker e observabilidade** (planejados).
  - *Problema:* a verificação antes do merge é manual, rodar o projeto exige Node 22 e os logs não mostram tendências.
  - *Proposta:* GitHub Actions com `npm run check` em todo pull request e a `main` protegida pelo check; `docker compose up` subindo os três serviços; OpenTelemetry com um trace por simulação e métricas por banco.
  - *Ganho:* nenhum código quebrado chega à `main`, qualquer pessoa sobe o projeto com um comando e a operação enxerga a taxa de falha de cada banco.
