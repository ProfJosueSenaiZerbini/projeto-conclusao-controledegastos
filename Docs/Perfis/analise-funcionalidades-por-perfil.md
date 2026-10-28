# Funcionalidades por perfil — análise do contexto brasileiro

Este documento explica **por que** cada perfil do Verdanz tem as ferramentas que tem, e **de onde vem cada número** usado nelas. A tela fica em `/meu-perfil`; o código, em:

| Arquivo | O que tem |
|---|---|
| `public/js/perfil-calculos.js` | As contas (INSS, 13º, seguro-desemprego, etc.) e os valores oficiais de 2026 |
| `public/js/perfil-conteudo.js` | Contexto, dicas e meta sugerida de cada perfil |
| `public/js/meu-perfil.js` | A tela: abas, ferramentas e o botão "Criar esta meta" |
| `public/js/dica-perfil.js` | A dica do perfil no cartão "Dicas para você" do dashboard |
| `Docs/Testes/teste-calculos-perfil.js` | 32 testes dos cálculos (`node Docs/Testes/teste-calculos-perfil.js`) |

---

## 1. O ponto de partida: o brasileiro e o dinheiro em 2026

Três dados guiaram todas as escolhas:

- **Endividamento recorde.** Cerca de **82% das famílias** têm alguma dívida (81,7% em setembro de 2026, segundo a Peic/CNC), e perto de **3 em cada 10** têm contas em atraso. O **cartão de crédito** é a principal dívida de **83,6%** das famílias endividadas.
- **Trabalho informal.** O desemprego está baixo (**5,3%** no trimestre até agosto de 2026, IBGE), mas **37,5% de quem trabalha é informal** — sem carteira, sem 13º, sem FGTS e, muitas vezes, sem INSS.
- **Salário mínimo de R$ 1.621,00**, base de vários benefícios (seguro-desemprego, Tarifa Social, Pé-de-Meia).

Conclusão: o que mais ajuda não é "mais um gráfico de gastos", e sim **responder a pergunta que cada perfil faz quando o dinheiro aperta**. Cada perfil ganhou uma ferramenta principal que responde a essa pergunta.

| Perfil | A pergunta | A ferramenta |
|---|---|---|
| CLT | "Quanto do 13º vai cair de verdade?" | Planejador do 13º |
| Autônomo | "Quanto posso gastar se a renda muda todo mês?" | Salário seguro + MEI em dia |
| Estudante | "Vou chegar ao fim do mês?" | Limite da semana |
| Doméstico | "Quanto sobra depois das contas da casa?" | Contas fixas e vencimentos |
| Desempregado | "Por quanto tempo eu aguento?" | Seguro-desemprego + duração do dinheiro |
| Aposentado | "Esse empréstimo vale a pena?" | Custo real do empréstimo + gastos com saúde |

Além da ferramenta, todo perfil tem **"Bom saber"** (direitos e alertas do contexto brasileiro) e uma **meta sugerida**, que vira uma meta de verdade com um clique.

---

## 2. Os perfis, um por um

### CLT — trabalhador de carteira assinada

**Realidade.** Salário previsível, mas o dinheiro "some" antes do fim do mês (persona Diego). O 13º é o maior dinheiro extra do ano e muita gente se assusta com a 2ª parcela, que vem com descontos.

**Ferramenta: Planejador do 13º.** A pessoa informa o salário bruto e os meses trabalhados e vê:
- 13º bruto (1/12 do salário por mês trabalhado);
- **1ª parcela** (até 30/11): metade, **sem desconto**;
- **INSS do 13º inteiro**, que sai todo da 2ª parcela, pela tabela progressiva de 2026;
- **2ª parcela** (até 20/12) antes do Imposto de Renda.

**Por que o IR não é calculado.** O IR do 13º depende de dependentes e pensão, e as regras mudaram em 2026 (isenção até R$ 5.000 com redutor até R$ 7.350, Lei 15.270/2025). As fontes consultadas divergem nos detalhes da tabela-base. Um número errado de imposto é pior que nenhum, então a tela avisa e manda conferir no holerite.

**Bom saber:** as duas parcelas do 13º; a nova isenção do IR; o perigo do pagamento mínimo do cartão; o custo do saque-aniversário do FGTS na demissão.

**Meta sugerida:** reserva de emergência de **6 meses dos gastos**, em 12 meses.

### Autônomo — trabalha por conta própria

**Realidade.** Renda que oscila (persona Bruno: entre R$ 1.500 e R$ 6.000). O risco é gastar como se todo mês fosse mês bom.

**Ferramenta 1: Salário seguro.** Lê as entradas dos últimos meses e sugere um "salário" igual à **média da metade mais fraca dos meses**. Vivendo com ele e guardando o que vier a mais, os meses bons pagam os ruins. Se os gastos passam desse salário, a tela avisa.

> Por que a metade mais fraca, e não "os 3 piores meses": com só 3 meses de histórico, "os 3 piores" seriam todos, e o salário seguro viraria a média comum — sem proteção nenhuma. Esse problema apareceu testando a tela e foi corrigido.

**Ferramenta 2: MEI em dia.** Valor do DAS de 2026 conforme a atividade, quantos dias faltam para o dia 20 e quanto já entrou no ano em relação ao **limite de R$ 81 mil** — com aviso se o ritmo atual passar do limite.

**Bom saber:** valores do DAS; limite do MEI; separar a conta do negócio; reserva maior (6 a 12 meses).

**Meta sugerida:** reserva de 6 meses dos gastos, em 18 meses.

### Estudante

**Realidade.** Mesada, bolsa ou estágio que chega uma vez por mês e acaba em pequenos gastos (persona Ana, que pediu aviso ao chegar em 80% do limite).

**Ferramenta: Limite da semana.** Divide o valor do mês pelos dias reais do mês (fevereiro tem 4 semanas, outubro 4,4) e compara com o que foi gasto **desde segunda-feira**. Fica amarelo em 80% e vermelho ao estourar. Mostra também quanto ainda pode gastar até o fim do mês, por dia.

**Bom saber:** pequenos gastos somam; **Pé-de-Meia** (R$ 200 de matrícula, R$ 1.800/ano de frequência, R$ 1.000 por ano concluído); direitos do estágio (bolsa, auxílio-transporte e recesso); limite do cartão não é renda.

**Meta sugerida:** guardar **15% do que recebe** por 6 meses (a persona quer guardar de 15% a 20%).

### Doméstico — cuida das contas da casa

**Realidade.** Muitos vencimentos ao mesmo tempo (persona Carla, que pediu alerta 3 dias antes). Atraso gera multa, juros e, na luz e na água, risco de corte.

**Ferramenta: Contas fixas da casa.** A pessoa cadastra cada conta (nome, valor, dia do vencimento) e vê:
- a lista **ordenada pelo vencimento mais próximo**, em vermelho até 3 dias e em amarelo até 7;
- o total das contas fixas e **quanto sobra** do que entra na casa;
- quanto custaria atrasar todas em 10 dias (multa de 2% + juros de 1% ao mês).

**Bom saber:** **Tarifa Social de energia** (gratuidade até 80 kWh para CadÚnico com renda de até meio salário mínimo por pessoa, R$ 810,50) e o novo desconto para renda até 1 salário mínimo; trocar a data de vencimento; custo do atraso; combinar o repasse com a família.

**Meta sugerida:** fundo de imprevistos de 3 meses das contas fixas, em 6 meses.

### Desempregado — buscando trabalho

**Realidade.** Ansiedade e incerteza (persona Felipe): a pergunta é "quanto tempo eu aguento?".

**Ferramenta 1: Seguro-desemprego.** Pela média dos 3 últimos salários, calcula a parcela pelas faixas de 2026. Pelos meses trabalhados e pelo número do pedido, calcula **quantas parcelas** (regra da Lei 13.134/2015: o 1º pedido exige 12 meses de trabalho, o 2º exige 9, o 3º em diante exige 6; 3 a 5 parcelas). Se a pessoa não tem direito, a tela explica o porquê.

**Ferramenta 2: Quanto tempo o dinheiro dura.** Simula mês a mês o saldo das contas, as parcelas do seguro, bicos e o gasto médio, e responde em linguagem simples ("5 meses e 2 dias, até março de 2027"). Mostra também quanto tempo a pessoa ganha **cortando metade de Lazer e Compras**, calculado a partir das transações dela.

**Bom saber:** prazo de 7 a 120 dias para pedir o seguro; FGTS na demissão; o que cortar primeiro; evitar empréstimo para o dia a dia.

**Meta sugerida:** nenhuma, de propósito. Nesta fase o foco é fazer o dinheiro durar, não guardar.

### Aposentado

**Realidade.** Renda fixa, gastos com saúde crescentes (persona Elena) e muito assédio de golpes e de crédito consignado.

**Ferramenta 1: Quanto um empréstimo custa de verdade.** A pessoa digita a oferta que recebeu (valor, parcela, número de parcelas) e vê o **total pago, quanto é juro, a taxa ao mês e ao ano** e quanto do benefício fica preso. Acima de 30% do benefício, aparece um alerta. A taxa é encontrada pelo método da bissecção (o mesmo princípio da função TAXA do Excel).

**Ferramenta 2: Gastos com saúde.** Média mensal da categoria Saúde e quanto ela pesa nos gastos.

**Bom saber:** o INSS não manda links nem liga oferecendo empréstimo; o benefício nasce bloqueado para consignado; o dia do pagamento depende do final do número do benefício; Farmácia Popular.

**Meta sugerida:** reserva de 1 ano dos gastos com saúde (ou 2 meses de gastos, se ainda não houver registros de saúde), em 12 meses.

---

## 3. Decisões de projeto

**Nada muda no banco de dados.** O escopo atual tem 5 entidades e o `CLAUDE.md` pede para não trazer de volta `Perfil` e `Funcionalidade` sem pedido explícito. Por isso:
- os perfis continuam guardados no navegador (`PerfisSalvos`, como na tela de escolha);
- o que a pessoa digita nas ferramentas (mesada, contas fixas, salário) também fica no navegador (`Preferencias`, uma chave por usuário);
- as ferramentas só **leem** contas, transações e metas pela API que já existe, e a única escrita é criar a meta sugerida pela rota `POST /api/meta`.

A limitação é a mesma da escolha de perfil: em outro navegador, os dados digitados nas ferramentas não aparecem. Resolver isso exige tabelas novas, o que é uma decisão do grupo.

**Só números confirmados em mais de uma fonte.** Ficaram de fora, de propósito:
- **IR do 13º** — regras novas e tabela-base com divergência entre as fontes;
- **calendário de pagamento do INSS** — muda todo mês e as fontes não concordavam entre si; a tela orienta a consultar o Meu INSS ou o 135;
- **teto de juros do consignado** — é revisado com frequência pelo Conselho Nacional de Previdência Social.

**Os valores de 2026 ficam num lugar só.** Tudo que muda todo janeiro está na constante `VALORES_2026` em `perfil-calculos.js`. Quem atualizar deve mudar também os testes e as fontes deste documento.

**Cálculo separado da tela.** As contas ficam em funções puras, sem tela e sem API, para poderem ser testadas no Node. Os 32 testes foram conferidos com contas feitas à mão — por exemplo, o desconto máximo de INSS de R$ 988,09 bate com as tabelas publicadas.

---

## 4. Ideias para depois

- Guardar perfis e preferências no banco, para valerem em qualquer navegador.
- Opção de **letra maior** para o perfil Aposentado (a persona Elena pediu fontes de 14 a 16 px).
- Aviso no dashboard quando uma conta fixa do perfil Doméstico estiver a 3 dias do vencimento.
- Calendário de pagamento do INSS pelo final do benefício, quando houver uma fonte oficial estável.

---

## 5. Fontes (consultadas em outubro de 2026)

Endividamento e inadimplência:
- [Agência Brasil — CNC: endividamento das famílias sobe para 82%, mas inadimplência cai (ago/2026)](https://agenciabrasil.ebc.com.br/economia/noticia/2026-08/cnc-endividamento-das-familias-sobe-para-82-mas-inadimplencia-cai)
- [Rede Onda Digital — Endividamento das famílias cai pela 1ª vez no ano (set/2026)](https://redeondadigital.com.br/brasil/endividamento-das-familias-cai-pela-1a-vez-no-ano-inadimplencia-recua-entre-os-mais-pobres)
- [Senado Notícias — Dívidas em recorde assombram as famílias brasileiras (mai/2026)](https://www12.senado.leg.br/noticias/infomaterias/2026/05/dividas-em-recorde-assombram-as-familias-brasileiras)
- [DIEESE — O aumento do endividamento das famílias no Brasil e o novo Desenrola (mai/2026)](https://www.dieese.org.br/sinteseespecial/2026/sinteseEspecial23.html)

Trabalho:
- [IBGE — PNAD Contínua, 2º trimestre de 2026](https://static.poder360.com.br/uploads/2026/08/pnad-continua-2tri2026.pdf)
- [ADVFN — Desocupação de 5,3% e informalidade em alta (ago/2026)](https://br.advfn.com/jornal/2026/08/pnad-continua-desocupacao-fica-em-5-3-no-trimestre-encerrado-em-julho-informalidade-sobe-diz-ibge)

Salário mínimo e INSS:
- [Valor Final — Tabela INSS 2026](https://valorfinal.com.br/tabela-inss-2026)
- [Deel — Tabela INSS 2026](https://www.deel.com/pt/blog/nova-tabela-inss-como-aplicar/)
- [Cora — Tabela INSS 2026](https://www.cora.com.br/blog/tabela-inss-2025/)

13º salário e Imposto de Renda:
- [Valor Final — 13º salário 2026: datas das parcelas](https://valorfinal.com.br/decimo-terceiro-2026-datas)
- [Valor Final — 13º: como calcular, INSS e IRRF](https://valorfinal.com.br/guia/decimo-terceiro-clt)
- [Secom/gov.br — Nova tabela do IR e isenção até R$ 5 mil (jan/2026)](https://www.gov.br/secom/pt-br/acompanhe-a-secom/noticias/2026/01/nova-tabela-do-ir-veja-faixas-e-aliquotas-e-saiba-mais-sobre-medida-que-isenta-o-pagamento-para-quem-ganha-ate-r-5-mil)
- [Blog BB — Imposto de Renda 2026: novas regras](https://blog.bb.com.br/imposto-de-renda-2026-regras-isencao/)

Seguro-desemprego:
- [Cálculo Jurídico — Seguro-desemprego 2026: valor, teto e tabela](https://calculojuridico.com.br/tabela-seguro-desemprego/)
- [Serasa Experian — Seguro-desemprego 2026](https://www.serasaexperian.com.br/carreiras/blog-carreiras/seguro-desemprego-2026/)
- [Arena do Dinheiro — Seguro-desemprego 2026: valor, parcelas e quem tem direito](https://arenadodinheiro.com.br/noticias/seguro-desemprego-2026-valor-parcelas-e-quem-tem-direito/)

MEI:
- [Contábeis — MEI em 2026: o que muda no DAS](https://www.contabeis.com.br/noticias/74842/mei-em-2026-veja-o-que-muda-no-das-nota-fiscal-e-regras/)
- [Nubank — DAS MEI 2026](https://blog.nubank.com.br/valor-das-mei/)
- [Contmatic — Limite MEI 2026: R$ 81 mil](https://simplifique.contmatic.com.br/blogs/mei-2026-limite-faturamento-o-que-muda)

Estudante:
- [Sou Brasília — Pé-de-Meia: valores e calendário 2026](https://soubrasilia.com/pe-de-meia-poupanca-estudante-ensino-medio/)
- [Vestibulando Web — Calendário Pé-de-Meia 2026](https://www.vestibulandoweb.com.br/pe-de-meia/calendario-pe-de-meia-2026/)

Doméstico:
- [Jovem Pan — Nova Tarifa Social de energia elétrica](https://jovempan.com.br/noticias/brasil/nova-tarifa-social-de-energia-eletrica-passa-a-valer-a-partir-deste-sabado.html)
- [O Hoje — Tarifa Social ou Desconto Social: entenda (abr/2026)](https://ohoje.com/2026/04/10/tarifa-social-ou-desconto-social-entenda-qual-reduz-a-sua-conta-de-energia/)

Aposentado:
- [Serasa — Pagamento do INSS 2026: calendário e como consultar](https://www.serasa.com.br/blog/pagamento-inss/)
- [Banco BMG — 13º dos aposentados 2026](https://www.bancobmg.com.br/blog/educacao-financeira/13-dos-aposentados-quando-sera-pago-o-beneficio-do-inss/)

Personas: `Docs/Personas e Mapa da Empatia` e o Diário de Bordo do grupo.
