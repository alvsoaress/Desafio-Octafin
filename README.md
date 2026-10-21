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
- **Cada banco recebe só o que precisa.** O Alpha recebe CPF, valor e prazo; o Beta recebe também o CNPJ, que usa para conferir o convênio. Nome, e-mail, salário e descontos nunca saem da API.
- **Nome e e-mail com finalidade declarada.** Identificam quem pediu a simulação e são o contato para a etapa de contratação, que fica fora deste MVP. Por isso são validados, mas não são guardados, não vão para os bancos e passam pelo mascaramento de logs.
- **Sem banco de dados.** O fluxo não precisa de persistência, e não guardar CPF nem salário reduz o risco de vazamento (LGPD).
- **Front sem bibliotecas de estilo, componentes, formulário ou máscara.** São oito campos; máscaras e formatação são funções puras em aritmética inteira, testadas sem React.

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

Cada proposta segue o formato **Problema**, **Proposta** e **Por quê**. As implementadas já estão no código; as planejadas ficaram fora desta entrega e estão em ordem de prioridade.

### Implementadas

1. **Resultado de cada banco, mesmo quando algum falha**
   - *Problema:* a empresa depende de bancos que não controla. Se um demora ou cai, a simulação inteira não pode travar nem falhar junto.
   - *Proposta:* consulta paralela com tempo limite de 3 s por banco, que aborta a requisição de verdade. Cada falha vira um status daquele banco (`timeout`, `unavailable` ou `invalid-response`), a resposta indica `partial: true` e a tela avisa que alguns bancos não responderam.
   - *Por quê:* o cliente espera no máximo o tempo limite e vê as ofertas que chegaram, em vez de uma tela de erro por causa de um parceiro.
2. **Recusa do banco separada de falha técnica**
   - *Problema:* "o banco recusou" e "o banco não respondeu" pedem ações opostas do cliente, e cada banco avisa a recusa de um jeito.
   - *Proposta:* cada adaptador traduz a recusa do seu banco (HTTP 200 com `decision` no Alpha, HTTP 422 com código no Beta) para o status `rejected` com um motivo, mostrado em português no cartão. Um código desconhecido continua sendo recusa, e um erro HTTP desconhecido continua `unavailable`.
   - *Por quê:* o cliente sabe que tentar de novo não muda uma recusa, mas pode mudar uma falha. Uma queda do parceiro nunca aparece como "Reprovado".
3. **Resultado que ajuda a decidir**
   - *Problema:* uma parcela que não cabe na margem só diz "não", e com várias ofertas o cliente precisa comparar sozinho.
   - *Proposta:* quando a parcela passa da margem, o cartão mostra o valor máximo que cabe no mesmo prazo. Com duas ou mais ofertas aprovadas, a de menor parcela ganha um selo.
   - *Por quê:* o cliente sai da simulação com um próximo passo, em vez de recomeçar no escuro.
4. **Dados pessoais mínimos e fora dos logs**
   - *Problema:* um simulador de crédito recebe CPF, salário e contato, e logs costumam vazar esses dados.
   - *Proposta:* nada é gravado. Cada banco recebe só o que usa, e toda linha de log passa por um mascaramento recursivo que troca nome, e-mail, CPF, CNPJ, valores, corpo e credenciais por `[REDACTED]`.
   - *Por quê:* menos exposição em caso de vazamento e aderência aos princípios de finalidade e necessidade da LGPD.
5. **Superfície da API reduzida**
   - *Problema:* uma API aberta aceita qualquer origem e qualquer corpo, e mensagens de erro detalhadas expõem a parte interna.
   - *Proposta:* CORS só para a origem configurada, corpo limitado a 10 KB, campos fora do contrato recusados, URLs dos bancos só da configuração e erro 500 sem detalhes internos.
   - *Por quê:* menos vetores de abuso e de vazamento de informação interna.
6. **Validação compartilhada e contrato com regras de consistência**
   - *Problema:* regras duplicadas entre front e API divergem com o tempo, e um esquema que só confere tipos aceita respostas impossíveis.
   - *Proposta:* um único esquema Zod no `shared`, usado pelo front e pela API, que também recusa números incoerentes, como um total diferente de parcela × prazo.
   - *Por quê:* o cliente vê a mesma mensagem nos dois lados, e um erro de cálculo quebra o teste antes de chegar à tela.
7. **Rastreabilidade por requisição**
   - *Problema:* sem identificador, um erro relatado pelo cliente não é encontrado nos logs.
   - *Proposta:* todo pedido recebe um `x-request-id`, devolvido ao cliente, mostrado na tela quando a simulação falha e presente em cada linha de log, com status e duração por banco.
   - *Por quê:* o suporte localiza a simulação pelo código que o cliente informa.
8. **Arquitetura verificada pelo lint**
   - *Problema:* a regra de que o domínio não depende de infraestrutura só valeria enquanto alguém lembrasse dela na revisão.
   - *Proposta:* o ESLint barra imports de Express, `fetch` e infraestrutura no domínio, e o `npm run check` reúne lint, tipos, testes e build num comando só.
   - *Por quê:* uma violação de camada no domínio quebra a verificação local antes de chegar à `main`.

### Planejadas, em ordem de prioridade

O critério é atacar primeiro o que o cliente sente hoje, depois o que dá visibilidade e proteção contra os bancos, e por fim o que amplia o produto.

1. **Tela sempre recuperável**
   - *Problema:* erros de validação antigos continuam na tela numa nova tentativa, uma falha inesperada no cliente da API pode deixar a tela presa em "Consultando bancos…", e uma oferta incoerente de um banco faz a tela recusar a resposta inteira.
   - *Proposta:* limpar os erros ao reenviar, tratar toda falha como erro com nova tentativa, descartar respostas de simulações já substituídas e validar a resposta banco a banco, rebaixando só o banco incoerente para "Sem resposta".
   - *Por quê:* vem primeiro porque é um defeito que o cliente já encontra, e a correção é pequena.
2. **Visibilidade por banco**
   - *Problema:* o log registra o status de cada banco, mas não o código HTTP que ele devolveu nem o motivo da recusa. Um 400 (erro nosso) e um 503 (queda do parceiro) parecem iguais.
   - *Proposta:* registrar o código HTTP e o motivo da recusa em cada consulta, e expor métricas e traces por banco com OpenTelemetry: taxa de falha, de recusa e latência.
   - *Por quê:* a operação descobre um parceiro instável antes do cliente reclamar, e os números calibram a proposta seguinte.
3. **Proteção contra banco instável**
   - *Problema:* um banco fora do ar faz toda simulação esperar o tempo limite, uma falha passageira vira `unavailable`, e a API continua esperando os bancos mesmo quando o cliente fecha a página.
   - *Proposta:* decoradores da porta `BankAdapter`, sem mudar os adaptadores: circuit breaker que responde `unavailable` na hora depois de falhas seguidas, nova tentativa com recuo dentro do tempo limite e cache curto de taxas por banco e prazo, sem CPF na chave. O fechamento da conexão também aborta as consultas em andamento.
   - *Por quê:* respostas mais rápidas quando um parceiro cai e menos carga desperdiçada nos bancos. Depende da visibilidade do item 2 para calibrar os limites.
4. **CNPJ alfanumérico**
   - *Problema:* desde julho de 2026, a Receita emite CNPJs com letras para inscrições novas, e a validação atual só aceita números.
   - *Proposta:* adaptar a validação, a normalização e a máscara ao novo formato.
   - *Por quê:* hoje quem trabalha numa empresa aberta recentemente não consegue simular.
5. **Resultado de cada banco em tempo real**
   - *Problema:* o carregamento é global e dura até o banco mais lento responder.
   - *Proposta:* uma rota de eventos (SSE) que envia o resultado de cada banco assim que ele chega, com carregamento por cartão.
   - *Por quê:* o cliente vê a primeira oferta em centenas de milissegundos, sem esperar o banco mais lento.
6. **Custo real do empréstimo**
   - *Problema:* a simulação mostra só juros, então o custo real é maior que o exibido.
   - *Proposta:* calcular IOF, tarifas e CET no domínio e informar o valor máximo aceito quando o banco recusa por teto.
   - *Por quê:* o cliente compara as ofertas pelo custo total, que é o que ele de fato paga.
7. **Autenticação e limite de requisições**
   - *Problema:* qualquer cliente pode chamar a API quantas vezes quiser, e cada chamada consulta todos os bancos.
   - *Proposta:* um middleware de autenticação e de limite por cliente antes da rota, com respostas 401 e 429 no formato dos demais erros.
   - *Por quê:* protege a API e os bancos parceiros de uso abusivo. Fica atrás das anteriores porque o MVP ainda não está publicado.
8. **Resultado por e-mail, com consentimento**
   - *Problema:* o cliente perde a simulação ao fechar a página, e o e-mail coletado ainda não é usado.
   - *Proposta:* com o consentimento explícito do cliente, enviar um resumo das ofertas para o e-mail informado, sem CPF nem salário no corpo.
   - *Por quê:* o cliente retoma a decisão depois, e o e-mail passa a ter um uso concreto e autorizado.
9. **Testes mais fortes**
   - *Problema:* exemplos fixos não provam que as fórmulas valem para qualquer entrada, os testes dos adaptadores se repetem e o fluxo completo na tela foi verificado à mão.
   - *Proposta:* testes de propriedade nas fórmulas, uma suíte de contrato que todo adaptador de banco precisa passar, mutation testing (Stryker) nos módulos financeiros e Playwright com os cenários do Beta.
   - *Por quê:* mais confiança nos cálculos, e um banco novo testado da mesma forma que os existentes.
10. **CI, Docker e publicação**
    - *Problema:* a verificação antes do merge depende de rodar o `npm run check` à mão, rodar o projeto exige Node 22 e nada é publicado.
    - *Proposta:* GitHub Actions com `npm run check` em todo pull request e a `main` protegida pelo check, `docker compose up` subindo os três serviços, CD a partir da `main` e verificação de camadas no lint estendida a todo o código.
    - *Por quê:* nenhum código quebrado chega à `main`, qualquer pessoa sobe o projeto com um comando e cada merge chega a um ambiente de demonstração.
