// Meu perfil: as ferramentas de cada perfil escolhido na pesquisa.
//
// Cada perfil responde à pergunta que a pessoa faz quando o dinheiro aperta:
//   CLT          -> "Quanto do 13º vai cair de verdade?"
//   Autônomo     -> "Quanto posso gastar se a renda muda todo mês?"
//   Estudante    -> "Vou chegar ao fim do mês?"
//   Doméstico    -> "Quanto sobra depois das contas da casa?"
//   Desempregado -> "Por quanto tempo eu aguento?"
//   Aposentado   -> "Esse empréstimo vale a pena?"
// (a análise que justifica cada uma está em Docs/Perfis/)
//
// ONDE FICA CADA COISA
//   /js/perfil-calculos.js  as CONTAS (INSS, 13º, seguro...) e os valores
//                           oficiais de 2026. Tem teste próprio.
//   /js/perfil-conteudo.js  os TEXTOS: contexto, dicas e a meta sugerida.
//   este arquivo            só a TELA: campos, resultados e as abas.
//
// Nada daqui vai para o banco de dados. O que a pessoa digita fica no
// navegador (localStorage), com o id dela na chave. As ferramentas só LEEM
// contas, transações e metas pela API; a única escrita é "Criar esta meta".

const el = (id) => document.getElementById(id);
const hoje = new Date();

// ---- O QUE A PESSOA DIGITOU, GUARDADO NO NAVEGADOR ----
const Preferencias = {
  chave: () => 'perfil_ferramentas_' + ID_USUARIO,
  ler() {
    try {
      return JSON.parse(localStorage.getItem(this.chave())) || {};
    } catch (e) {
      return {};
    }
  },
  salvar(campo, valor) {
    const atual = this.ler();
    atual[campo] = valor;
    localStorage.setItem(this.chave(), JSON.stringify(atual));
  },
};

// ---- DATAS ----

const chaveDoMes = (data) => `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
const textoDoDia = (data) => `${chaveDoMes(data)}-${String(data.getDate()).padStart(2, '0')}`;

// Os N meses anteriores ao atual: ["2026-10", "2026-09", ...]
function mesesAnteriores(quantidade) {
  return Array.from({ length: quantidade }, (_, i) => chaveDoMes(new Date(hoje.getFullYear(), hoje.getMonth() - (i + 1), 1)));
}

// A semana de segunda a domingo que contém hoje.
function semanaAtual() {
  const diaDaSemana = (hoje.getDay() + 6) % 7; // segunda = 0 ... domingo = 6
  const segunda = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - diaDaSemana);
  const domingo = new Date(segunda.getFullYear(), segunda.getMonth(), segunda.getDate() + 6);
  return { inicio: textoDoDia(segunda), fim: textoDoDia(domingo) };
}

const media = (lista) => (lista.length ? lista.reduce((a, b) => a + b, 0) / lista.length : 0);

// 5.07 -> "5 meses e 2 dias"
function textoDosMeses(meses) {
  if (meses === Infinity) return 'não acaba';
  let inteiros = Math.floor(meses);
  let dias = Math.round((meses - inteiros) * 30);
  if (dias === 30) {
    inteiros += 1;
    dias = 0;
  }
  const partes = [];
  if (inteiros > 0) partes.push(plural(inteiros, 'mês', 'meses'));
  if (dias > 0) partes.push(plural(dias, 'dia', 'dias'));
  return partes.length ? partes.join(' e ') : 'menos de 1 dia';
}

function mesEAnoDaqui(meses) {
  const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + Math.floor(meses * 30.4));
  return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// ---- RESUMO DAS FINANÇAS ----
//
// Transforma contas e transações nos poucos números que as ferramentas
// usam. As médias usam os 3 últimos meses FECHADOS: o mês atual, pela
// metade, puxaria a média para baixo.
function resumir(contas, transacoes) {
  const porMes = {};
  const semana = semanaAtual();
  const mesAtual = chaveDoMes(hoje);
  const anoAtual = String(hoje.getFullYear());
  const textoDeHoje = hojeTexto();

  let gastoDaSemana = 0;
  let receitasDoAno = 0;          // do ano, até hoje (sem ganhos agendados)
  let receitasFechadasDoAno = 0;  // do ano, só dos meses que já terminaram

  for (const t of transacoes) {
    // Dinheiro guardado em meta não é gasto, e passar dinheiro de uma
    // conta para outra não é ganho nem gasto (ver auth.js).
    if (ehDinheiroGuardado(t) || ehTransferencia(t)) continue;

    const mes = String(t.data_transacao).slice(0, 7);
    const dia = String(t.data_transacao).slice(0, 10);
    const valor = Number(t.valor_transacao);
    porMes[mes] = porMes[mes] || { receitas: 0, despesas: 0, saude: 0, naoEssenciais: 0 };

    if (t.categoria.tipo === 'receita') {
      porMes[mes].receitas += valor;
      if (mes.startsWith(anoAtual) && dia <= textoDeHoje) receitasDoAno += valor;
      if (mes.startsWith(anoAtual) && mes < mesAtual) receitasFechadasDoAno += valor;
    } else {
      porMes[mes].despesas += valor;
      if (t.categoria.nome_categoria === 'Saúde') porMes[mes].saude += valor;
      if (['Lazer', 'Compras'].includes(t.categoria.nome_categoria)) porMes[mes].naoEssenciais += valor;
      if (dia >= semana.inicio && dia <= semana.fim) gastoDaSemana += valor;
    }
  }

  const fechados = mesesAnteriores(3).filter((m) => porMes[m]);
  // Sem nenhum mês fechado, usa o mês atual: é melhor que não mostrar nada.
  const base = fechados.length ? fechados : porMes[mesAtual] ? [mesAtual] : [];
  const daBase = (campo) => media(base.map((m) => porMes[m][campo]));

  return {
    saldoTotal: contas.reduce((soma, c) => soma + Number(c.saldo), 0),
    saldoPrevistoTotal: contas.reduce((soma, c) => soma + Number(c.saldo_previsto), 0),
    gastoMedioMensal: daBase('despesas'),
    receitaMediaMensal: daBase('receitas'),
    gastoSaudeMedio: daBase('saude'),
    naoEssenciaisMedio: daBase('naoEssenciais'),
    mesesNaMedia: base.length,
    receitasPorMes: mesesAnteriores(6).filter((m) => porMes[m] && porMes[m].receitas > 0).map((m) => porMes[m].receitas),
    receitasDoAno,
    receitasFechadasDoAno,
    receitasDoMes: porMes[mesAtual] ? porMes[mesAtual].receitas : 0,
    despesasDoMes: porMes[mesAtual] ? porMes[mesAtual].despesas : 0,
    gastoDaSemana,
  };
}

// ---- PEÇAS DE TELA ----

function ferramenta(icone, titulo, subtitulo, corpo) {
  return `
    <section class="cartao pilha">
      <div class="cartao__titulo">
        <span class="icone icone--folha" aria-hidden="true"><i class="fa-solid ${icone}"></i></span>
        <div><h3>${titulo}</h3><p class="suave pequeno">${subtitulo}</p></div>
      </div>
      ${corpo}
    </section>`;
}

// Campo de dinheiro. O valor salvo volta formatado ("1.500,00").
function campoDinheiro(id, rotulo, valor, { ajuda = '', exemplo = '0,00' } = {}) {
  return `
    <div class="campo">
      <label for="${id}">${rotulo}</label>
      <div class="dinheiro">
        <span aria-hidden="true">R$</span>
        <input class="entrada" id="${id}" inputmode="decimal" autocomplete="off" placeholder="${exemplo}" value="${valor ? valorNoCampo(valor) : ''}" aria-describedby="${id}Erro">
      </div>
      ${ajuda ? `<p class="ajuda">${ajuda}</p>` : ''}
      <p class="erro" id="${id}Erro" hidden></p>
    </div>`;
}

// Campo de número sem "R$" (meses, parcelas, dia do mês).
function campoNumero(id, rotulo, valor, { ajuda = '', exemplo = '' } = {}) {
  return `
    <div class="campo">
      <label for="${id}">${rotulo}</label>
      <input class="entrada" id="${id}" inputmode="numeric" autocomplete="off" placeholder="${exemplo}" value="${valor || ''}" aria-describedby="${id}Erro">
      ${ajuda ? `<p class="ajuda">${ajuda}</p>` : ''}
      <p class="erro" id="${id}Erro" hidden></p>
    </div>`;
}

function seletor(id, rotulo, opcoes, selecionado) {
  return `
    <div class="campo">
      <label for="${id}">${rotulo}</label>
      <select class="entrada" id="${id}">
        ${opcoes.map(([valor, texto]) => `<option value="${valor}" ${String(valor) === String(selecionado) ? 'selected' : ''}>${texto}</option>`).join('')}
      </select>
    </div>`;
}

// Uma linha "rótulo ..... valor" de resultado. Vai dentro de <dl>.
function par(rotulo, valor, { destaque = false, classe = '' } = {}) {
  return `<div class="par ${destaque ? 'par--destaque' : ''}"><dt>${rotulo}</dt><dd class="${classe}">${valor}</dd></div>`;
}

// Campos lado a lado, com as caixas sempre na mesma linha (.campos-lado,
// no verdanz.css). Em tela estreita, eles descem um embaixo do outro.
const duasColunas = (html) => `<div class="campos-lado">${html}</div>`;

// Avisa se o que foi digitado não é um número ("abc", "-50").
function conferirCampo(campo) {
  const texto = campo.value.trim();
  const ehZero = /^[0\s.,]+$/.test(texto);
  let mensagem = '';
  if (texto && !ehZero && lerValor(campo) === 0) {
    mensagem = texto.includes('-') ? 'Digite o valor sem o sinal de menos.' : 'Use só números, como 1.500,50.';
  }
  erroNoCampo(campo, mensagem);
}

// Recalcula a cada tecla: não existe botão "calcular".
function aoDigitar(ids, funcao) {
  ids.forEach((id) => {
    const campo = el(id);
    if (campo.tagName === 'INPUT' && campo.type !== 'checkbox') campo.addEventListener('input', () => conferirCampo(campo));
    campo.addEventListener('input', funcao);
    campo.addEventListener('change', funcao);
  });
}

// Valor que a pessoa já digitou; se nunca digitou, a sugestão.
const salvoOuSugerido = (salvo, sugestao) => (salvo === undefined ? sugestao : salvo);

function poucosDados(d) {
  if (d.mesesNaMedia >= 2) return '';
  return `<p class="fraco pequeno">Calculado com ${d.mesesNaMedia === 0 ? 'nenhum mês' : 'só 1 mês'} de registros. Quanto mais você registrar, mais preciso fica.</p>`;
}

// ---- AS FERRAMENTAS ----
// Cada função recebe a área onde desenhar e o resumo (d).

const FERRAMENTAS = {
  // CLT: quanto cai em cada parcela do 13º.
  clt(area) {
    const prefs = Preferencias.ler();

    area.innerHTML = ferramenta(
      'fa-calculator',
      'Planejador do 13º salário',
      'Veja quanto cai em cada parcela antes de o dinheiro chegar.',
      duasColunas(
        campoDinheiro('cltSalario', 'Salário bruto (do holerite)', prefs.salario || 0, { ajuda: 'O valor antes dos descontos.', exemplo: '3.000,00' }) +
          seletor('cltMeses', 'Meses trabalhados neste ano', Array.from({ length: 12 }, (_, i) => [12 - i, plural(12 - i, 'mês', 'meses')]), prefs.mesesTrabalhados || 12)
      ) + '<div id="cltResultado" class="pilha" aria-live="polite"></div>'
    );

    function calcular() {
      const salario = lerValor(el('cltSalario'));
      const meses = Number(el('cltMeses').value);
      Preferencias.salvar('salario', salario);
      Preferencias.salvar('mesesTrabalhados', meses);

      if (!salario) {
        el('cltResultado').innerHTML = recado('info', 'Digite seu salário bruto para ver as parcelas.');
        return;
      }

      const r = decimoTerceiro(salario, meses);
      el('cltResultado').innerHTML = `
        <dl>
          ${par('13º bruto', formatarMoeda(r.bruto))}
          ${par('1ª parcela, até 30 de novembro (sem descontos)', formatarMoeda(r.primeiraParcela), { classe: 'verde' })}
          ${par('INSS do 13º (sai da 2ª parcela)', formatarMoeda(-r.inss), { classe: 'alerta-texto' })}
          ${par('2ª parcela, até 20 de dezembro', formatarMoeda(r.segundaParcela), { destaque: true })}
        </dl>
        <p class="fraco pequeno">A 2ª parcela também pode ter desconto de Imposto de Renda, que depende de dependentes e de outras deduções. Ele não é calculado aqui: confira no seu holerite.</p>
        ${recado('info', `Seu INSS de todo mês é de ${formatarMoeda(descontoINSS(salario))}. Se você tem dívida no cartão ou no cheque especial, usar o 13º para quitá-la rende mais do que qualquer aplicação.`)}`;
    }

    aoDigitar(['cltSalario', 'cltMeses'], calcular);
    calcular();
  },

  // Autônomo: um "salário" fixo para quem tem renda que sobe e desce, e o MEI.
  autonomo(area, d) {
    const prefs = Preferencias.ler();
    const r = salarioSeguroAutonomo(d.receitasPorMes);

    let corpoSalario;
    if (!r || r.mesesAnalisados < 2) {
      corpoSalario = recado('info', 'Para calcular o seu salário, o Verdanz precisa das suas entradas de pelo menos 2 meses fechados. Registre o que você recebe (categoria Freelance, por exemplo) ou conecte seu banco em Contas.');
    } else {
      const falta = d.gastoMedioMensal - r.salarioSeguro;
      corpoSalario = `
        <dl>
          ${par(`Média de entradas (${plural(r.mesesAnalisados, 'mês', 'meses')})`, formatarMoeda(r.media))}
          ${par('Mês mais fraco', formatarMoeda(r.menorMes))}
          ${par('Mês mais forte', formatarMoeda(r.maiorMes))}
          ${par('Seu "salário" seguro', formatarMoeda(r.salarioSeguro), { destaque: true, classe: 'verde' })}
        </dl>
        <p class="fraco pequeno">É a média dos seus meses mais fracos. Viva com este valor todo mês e guarde o que entrar a mais nos meses bons: é essa sobra que paga os meses ruins.</p>
        ${
          falta > 0
            ? recado('atencao', `Seus gastos (${formatarMoeda(d.gastoMedioMensal)} por mês) passam do seu salário seguro em ${formatarMoeda(falta)}. Num mês fraco, essa diferença sai da reserva ou vira dívida.`)
            : recado('ok', 'Seus gastos cabem no seu salário seguro. Ótimo sinal para atravessar os meses fracos.')
        }`;
    }

    const diasAteDAS = diasAteVencimento(VALORES_2026.diaVencimentoDAS, hoje);
    const mesesFechados = hoje.getMonth();
    const projecaoDoAno = mesesFechados > 0 ? (d.receitasFechadasDoAno / mesesFechados) * 12 : 0;
    const limite = VALORES_2026.limiteAnualMEI;
    const jaPassou = d.receitasDoAno > limite;
    const vaiPassar = jaPassou || projecaoDoAno > limite;
    const usoDoLimite = Math.min(100, (d.receitasDoAno / limite) * 100);

    area.innerHTML =
      ferramenta('fa-wallet', 'Seu salário de autônomo', 'Um valor fixo para viver, mesmo com renda que sobe e desce.', corpoSalario) +
      ferramenta(
        'fa-receipt',
        'MEI em dia',
        'Guia mensal (DAS) e limite de faturamento de 2026.',
        `${seletor('meiAtividade', 'Sua atividade', [['comercio', 'Comércio ou indústria'], ['servicos', 'Prestação de serviços'], ['ambos', 'Comércio e serviços']], prefs.atividadeMEI || 'servicos')}
         <dl id="meiDAS"></dl>
         <div class="pilha--p">
           <div class="fila fila--entre"><span>Entradas deste ano</span><strong class="numero">${formatarMoeda(d.receitasDoAno)} <span class="suave" style="font-weight:400">de ${formatarMoeda(limite)}</span></strong></div>
           <div class="barra ${jaPassou ? 'barra--coral' : vaiPassar ? 'barra--sol' : ''}" role="img" aria-label="${Math.round(usoDoLimite)}% do limite do MEI"><span style="width:${usoDoLimite}%"></span></div>
           <p class="fraco pequeno">Considera as entradas registradas no Verdanz até hoje, então é uma aproximação do seu faturamento.</p>
         </div>
         ${
           jaPassou
             ? recado('perigo', 'Suas entradas deste ano já passam do limite do MEI. Converse com um contador sobre a mudança de categoria.')
             : vaiPassar
               ? recado('atencao', `No ritmo dos meses que já fecharam, você termina o ano com cerca de ${formatarMoeda(projecaoDoAno)}, acima do limite do MEI. Converse com um contador antes de passar dele.`)
               : ''
         }`
      );

    function atualizarDAS() {
      const atividade = el('meiAtividade').value;
      Preferencias.salvar('atividadeMEI', atividade);
      el('meiDAS').innerHTML =
        par('Valor do DAS em 2026', formatarMoeda(VALORES_2026.dasMEI[atividade])) +
        par('Próximo vencimento (dia 20)', diasAteDAS === 0 ? 'vence hoje' : `em ${plural(diasAteDAS, 'dia', 'dias')}`, { classe: diasAteDAS <= 3 ? 'alerta-texto' : '' });
    }

    aoDigitar(['meiAtividade'], atualizarDAS);
    atualizarDAS();
  },

  // Estudante: o que recebe no mês, dividido em semanas.
  estudante(area, d) {
    const prefs = Preferencias.ler();
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const diasRestantes = diasNoMes - hoje.getDate() + 1;

    area.innerHTML = ferramenta(
      'fa-coins',
      'Seu limite da semana',
      'Divida o que você recebe no mês em semanas e saiba quando segurar.',
      campoDinheiro('estMesada', 'Quanto você recebe por mês', salvoOuSugerido(prefs.mesada, Math.round(d.receitaMediaMensal)), { ajuda: 'Mesada, bolsa, estágio ou a soma deles.' }) +
        '<div id="estResultado" class="pilha" aria-live="polite"></div>'
    );

    function calcular() {
      const mesada = lerValor(el('estMesada'));
      Preferencias.salvar('mesada', mesada);
      desenharMeta(); // a meta sugerida usa a mesada

      if (!mesada) {
        el('estResultado').innerHTML = recado('info', 'Digite quanto você recebe por mês para ver o seu limite da semana.');
        return;
      }

      // Fevereiro tem 4 semanas, outubro 4,4: a divisão usa os dias reais.
      const limite = limiteSemanal(mesada, diasNoMes);
      const situacao = situacaoDoLimite(d.gastoDaSemana, limite);
      const uso = Math.min(100, (d.gastoDaSemana / limite) * 100);
      const restaNoMes = mesada - d.despesasDoMes;

      const mensagem = {
        ok: recado('ok', 'Você está dentro do limite desta semana.'),
        atencao: recado('atencao', 'Você já usou mais de 80% do limite da semana. Hora de segurar os gastos até segunda.'),
        estourou: recado('perigo', `Você passou do limite da semana em ${formatarMoeda(d.gastoDaSemana - limite)}. Isso sai das próximas semanas.`),
      }[situacao];
      const barra = { ok: '', atencao: 'barra--sol', estourou: 'barra--coral' }[situacao];

      el('estResultado').innerHTML = `
        ${mensagem}
        <div class="pilha--p">
          <div class="fila fila--entre"><span>Gasto nesta semana</span><strong class="numero">${formatarMoeda(d.gastoDaSemana)} <span class="suave" style="font-weight:400">de ${formatarMoeda(limite)}</span></strong></div>
          <div class="barra ${barra}" role="img" aria-label="${Math.round(uso)}% do limite da semana"><span style="width:${uso}%"></span></div>
        </div>
        <dl>
          ${par('Gasto neste mês', formatarMoeda(d.despesasDoMes))}
          ${par(`Ainda pode gastar até o fim do mês (${plural(diasRestantes, 'dia', 'dias')})`, formatarMoeda(Math.max(0, restaNoMes)), { destaque: true, classe: restaNoMes < 0 ? 'alerta-texto' : 'verde' })}
          ${restaNoMes > 0 ? par('Por dia', formatarMoeda(restaNoMes / diasRestantes)) : ''}
        </dl>`;
    }

    aoDigitar(['estMesada'], calcular);
    calcular();
  },

  // Doméstico: as contas fixas da casa, pelo vencimento.
  domestico(area, d) {
    area.innerHTML = ferramenta(
      'fa-file-invoice-dollar',
      'Contas fixas da casa',
      'Cadastre as contas de todo mês e veja os vencimentos e quanto sobra.',
      `<ul id="domLista"></ul>
       <form id="domForm" class="pilha" novalidate>
         <h4>Adicionar uma conta</h4>
         <div class="campo"><label for="domNome">Nome</label><input class="entrada" id="domNome" maxlength="60" placeholder="Luz, água, aluguel..."></div>
         ${duasColunas(campoDinheiro('domValor', 'Valor', 0) + campoNumero('domDia', 'Vence todo dia', 0, { exemplo: '10' }))}
         <p class="erro" id="domErro" hidden></p>
         <div><button type="submit" class="botao botao--linha"><i class="fa-solid fa-plus" aria-hidden="true"></i> Adicionar</button></div>
       </form>
       <div id="domResumo" class="pilha"></div>`
    );

    function contas() {
      const lista = Preferencias.ler().contasFixas || [];
      // Contas antigas, de antes de existir a data de criação, ganham a de hoje.
      if (lista.some((c) => !c.criadaEm)) {
        lista.forEach((c) => (c.criadaEm = c.criadaEm || hojeTexto()));
        Preferencias.salvar('contasFixas', lista);
      }
      return lista;
    }

    // Atrasadas primeiro, depois da mais próxima para a mais distante; pagas no fim.
    function ordem(c) {
      if (c.situacao === 'atrasada') return -1 - c.dias;
      if (c.situacao === 'paga') return 1000 + c.dias;
      return c.dias;
    }

    function selo(c) {
      if (c.situacao === 'paga') return '<span class="capsula capsula--folha"><i class="fa-solid fa-check" aria-hidden="true"></i> Paga</span>';
      if (c.situacao === 'atrasada') return `<span class="capsula capsula--coral">Atrasada há ${plural(c.dias, 'dia', 'dias')}</span>`;
      if (c.dias === 0) return '<span class="capsula capsula--coral">Vence hoje</span>';
      if (c.dias <= 3) return `<span class="capsula capsula--coral">Em ${plural(c.dias, 'dia', 'dias')}</span>`;
      if (c.dias <= 7) return `<span class="capsula capsula--sol">Em ${c.dias} dias</span>`;
      return `<span class="capsula">Em ${plural(c.dias, 'dia', 'dias')}</span>`;
    }

    function desenhar() {
      const lista = contas()
        .map((c, indice) => ({ ...c, indice, ...situacaoContaFixa(c, hoje) }))
        .sort((a, b) => ordem(a) - ordem(b));

      el('domLista').innerHTML = lista.length
        ? lista
            .map((c) => {
              const paga = c.situacao === 'paga';
              return `
                <li class="mov">
                  <div class="mov__linha mov__linha--acao">
                    <span class="icone ${paga ? 'icone--folha' : 'icone--ceu'}" aria-hidden="true"><i class="fa-solid ${paga ? 'fa-check' : 'fa-file-invoice'}"></i></span>
                    <span class="mov__texto"><strong>${esc(c.nome)}</strong><small>Todo dia ${c.dia} · ${selo(c)}</small></span>
                    <span class="mov__valor">${formatarMoeda(c.valor)}</span>
                    <span class="fila" style="gap:.125rem">
                      <button type="button" class="botao botao--linha botao--p" data-pagar="${c.indice}">${paga ? 'Desmarcar' : 'Paguei'}<span class="so-leitor">: ${esc(c.nome)}</span></button>
                      <button type="button" class="botao-icone" data-remover="${c.indice}" aria-label="Remover ${esc(c.nome)}" title="Remover"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
                    </span>
                  </div>
                </li>`;
            })
            .join('')
        : '<li class="vazio"><p>Nenhuma conta cadastrada ainda.</p></li>';

      desenharResumo(lista);
      desenharMeta(); // a meta sugerida usa o total das contas fixas
    }

    el('domLista').addEventListener('click', async (evento) => {
      const pagar = evento.target.closest('[data-pagar]');
      const remover = evento.target.closest('[data-remover]');
      if (!pagar && !remover) return;

      const atual = contas();

      if (pagar) {
        const conta = atual[Number(pagar.dataset.pagar)];
        const esteMes = chaveDoMes(hoje);
        conta.pagaEm = conta.pagaEm === esteMes ? null : esteMes;
      } else {
        const indice = Number(remover.dataset.remover);
        const sim = await confirmar({ titulo: `Remover "${atual[indice].nome}"?`, mensagem: 'Ela sai da sua lista de contas fixas. Suas transações não mudam.', textoConfirmar: 'Remover' });
        if (!sim) return;
        atual.splice(indice, 1);
      }

      Preferencias.salvar('contasFixas', atual);
      desenhar();
    });

    function desenharResumo(lista) {
      const total = lista.reduce((soma, c) => soma + c.valor, 0);
      d.totalContasFixas = total;

      if (lista.length === 0) {
        el('domResumo').innerHTML = '';
        return;
      }

      const renda = salvoOuSugerido(Preferencias.ler().rendaCasa, Math.round(d.receitasDoMes));
      const custoDeAtrasarTudo = lista.reduce((soma, c) => soma + custoDoAtraso(c.valor, 10), 0);

      el('domResumo').innerHTML = `
        <dl>${par('Total das contas fixas', formatarMoeda(total), { destaque: true })}</dl>
        ${campoDinheiro('domRenda', 'Quanto entra na casa por mês', renda, { ajuda: 'Salário, repasse da família ou benefícios. Começa com o que você registrou este mês.' })}
        <div id="domSobra" class="pilha" aria-live="polite"></div>
        <p class="fraco pequeno">Atrasar todas essas contas em 10 dias custaria cerca de ${formatarMoeda(custoDeAtrasarTudo)} em multa e juros.</p>`;

      function calcularSobra() {
        const valor = lerValor(el('domRenda'));
        Preferencias.salvar('rendaCasa', valor);
        const sobra = valor - total;
        el('domSobra').innerHTML = !valor
          ? ''
          : `<dl>${par(sobra < 0 ? 'Falta para pagar as contas fixas' : 'Sobra depois das contas fixas', formatarMoeda(Math.abs(sobra)), { destaque: true, classe: sobra < 0 ? 'alerta-texto' : 'verde' })}</dl>` +
            (sobra < 0 ? recado('perigo', 'As contas fixas passam do que entra. Vale rever o que dá para cortar ou renegociar.') : '');
      }

      aoDigitar(['domRenda'], calcularSobra);
      calcularSobra();
    }

    el('domForm').addEventListener('submit', (evento) => {
      evento.preventDefault();

      const nome = el('domNome').value.trim();
      const valor = lerValor(el('domValor'));
      const dia = Math.floor(lerValor(el('domDia')));

      // Junta tudo o que falta numa frase só e leva o cursor ao primeiro campo.
      const faltas = [];
      if (!nome) faltas.push({ campo: 'domNome', texto: 'o nome da conta' });
      if (!valor) faltas.push({ campo: 'domValor', texto: 'um valor maior que zero' });
      if (dia < 1 || dia > 31) faltas.push({ campo: 'domDia', texto: 'o dia do vencimento, de 1 a 31' });

      const erro = el('domErro');
      if (faltas.length > 0) {
        const textos = faltas.map((f) => f.texto);
        erro.textContent = `Falta informar ${textos.length > 1 ? textos.slice(0, -1).join(', ') + ' e ' + textos[textos.length - 1] : textos[0]}.`;
        erro.hidden = false;
        el(faltas[0].campo).focus();
        return;
      }

      erro.hidden = true;
      Preferencias.salvar('contasFixas', [...contas(), { nome, valor, dia, criadaEm: hojeTexto() }]);
      evento.target.reset();
      el('domNome').focus();
      desenhar();
    });

    desenhar();
  },

  // Desempregado: o seguro-desemprego e por quanto tempo o dinheiro dura.
  desempregado(area, d) {
    const prefs = Preferencias.ler();

    area.innerHTML =
      ferramenta(
        'fa-hand-holding-dollar',
        'Seguro-desemprego',
        'Valor e número de parcelas pelas regras de 2026.',
        duasColunas(
          campoDinheiro('segMedia', 'Média dos 3 últimos salários', prefs.mediaSalarial || 0, { ajuda: 'Valor bruto.' }) +
            campoNumero('segMeses', 'Meses trabalhados', prefs.mesesCarteira || 0, { ajuda: 'Com carteira, nos últimos 36 meses.' }) +
            seletor('segPedido', 'Qual pedido é este?', [[1, '1º pedido'], [2, '2º pedido'], [3, '3º ou mais']], prefs.pedidoSeguro || 1)
        ) + '<div id="segResultado" class="pilha" aria-live="polite"></div>'
      ) +
      ferramenta(
        'fa-hourglass-half',
        'Quanto tempo o seu dinheiro dura',
        'Com o que você tem, o que ainda vai entrar e o quanto gasta.',
        duasColunas(
          campoDinheiro('durSaldo', 'Dinheiro que você tem', Math.max(0, d.saldoPrevistoTotal), { ajuda: 'Começa com o saldo das suas contas, já descontadas as contas a pagar.' }) +
            campoDinheiro('durGasto', 'Gasto por mês', Math.round(d.gastoMedioMensal), { ajuda: 'Começa com a sua média.' }) +
            campoDinheiro('durBicos', 'Bicos por mês (opcional)', prefs.bicos || 0)
        ) +
          `<label class="marcar"><input type="checkbox" id="durUsarSeguro" ${prefs.usarSeguro === false ? '' : 'checked'}><span>Contar as parcelas do seguro-desemprego calculadas acima</span></label>
           <div id="durResultado" class="pilha" aria-live="polite"></div>
           ${poucosDados(d)}`
      );

    let parcelasDoSeguro = [];

    function calcularSeguro() {
      const mediaSalarial = lerValor(el('segMedia'));
      const meses = Math.floor(lerValor(el('segMeses')));
      const pedido = Number(el('segPedido').value);
      Preferencias.salvar('mediaSalarial', mediaSalarial);
      Preferencias.salvar('mesesCarteira', meses);
      Preferencias.salvar('pedidoSeguro', pedido);

      const saida = el('segResultado');
      parcelasDoSeguro = [];

      if (!mediaSalarial || !meses) {
        saida.innerHTML = recado('info', 'Preencha a média salarial e os meses trabalhados para ver o seu seguro.');
      } else if (meses > 36) {
        saida.innerHTML = recado('atencao', 'Conte só os meses com carteira dentro dos últimos 36 meses (3 anos). O máximo é 36.');
      } else {
        const quantidade = parcelasSeguroDesemprego(meses, pedido);
        if (quantidade === 0) {
          const minimo = { 1: 12, 2: 9, 3: 6 }[pedido];
          saida.innerHTML = recado('atencao', `Pelas regras, no ${pedido === 3 ? '3º pedido em diante' : pedido + 'º pedido'} é preciso ter trabalhado pelo menos ${minimo} meses com carteira. Com ${meses}, você ainda não tem direito.`);
        } else {
          const valor = parcelaSeguroDesemprego(mediaSalarial);
          parcelasDoSeguro = Array(quantidade).fill(valor);
          saida.innerHTML = `
            <dl>
              ${par('Valor de cada parcela', formatarMoeda(valor))}
              ${par('Número de parcelas', String(quantidade))}
              ${par('Total a receber', formatarMoeda(valor * quantidade), { destaque: true, classe: 'verde' })}
            </dl>
            <p class="fraco pequeno">Estimativa pelas regras de 2026. O valor oficial aparece na Carteira de Trabalho Digital depois do pedido, que deve ser feito de 7 a 120 dias após a demissão.</p>`;
        }
      }

      calcularDuracao(); // a duração depende das parcelas acima
    }

    function calcularDuracao() {
      const saldo = lerValor(el('durSaldo'));
      const gasto = lerValor(el('durGasto'));
      const bicos = lerValor(el('durBicos'));
      const usarSeguro = el('durUsarSeguro').checked;
      Preferencias.salvar('bicos', bicos);
      Preferencias.salvar('usarSeguro', usarSeguro);

      if (!gasto) {
        el('durResultado').innerHTML = recado('info', 'Informe quanto você gasta por mês.');
        return;
      }

      const entradas = usarSeguro ? parcelasDoSeguro : [];
      const meses = mesesQueODinheiroDura(saldo, gasto, entradas, bicos);

      // E se cortasse metade de Lazer e Compras? (calculado das transações)
      const corte = d.naoEssenciaisMedio / 2;
      const mesesComCorte = corte > 0 ? mesesQueODinheiroDura(saldo, gasto - corte, entradas, bicos) : meses;

      const tipo = meses === Infinity ? 'ok' : meses < 3 ? 'perigo' : meses < 6 ? 'atencao' : 'ok';
      const frase =
        meses === Infinity
          ? 'Com essas entradas, o que entra cobre o que sai: o seu dinheiro não acaba.'
          : `Seu dinheiro dura cerca de <strong>${textoDosMeses(meses)}</strong>, até ${mesEAnoDaqui(meses)}.`;

      el('durResultado').innerHTML =
        recado(tipo, frase) +
        (corte > 0 && meses !== Infinity
          ? recado('info', `Cortando metade do que você gasta com Lazer e Compras (${formatarMoeda(corte)} por mês), ele passa a durar ${textoDosMeses(mesesComCorte)}.`)
          : '');
    }

    aoDigitar(['segMedia', 'segMeses', 'segPedido'], calcularSeguro);
    aoDigitar(['durSaldo', 'durGasto', 'durBicos', 'durUsarSeguro'], calcularDuracao);
    calcularSeguro();
  },

  // Aposentado: o custo real de um empréstimo e os gastos com saúde.
  aposentado(area, d) {
    const prefs = Preferencias.ler();

    const corpoSaude =
      d.gastoSaudeMedio > 0
        ? `<dl>
             ${par('Gasto médio com saúde por mês', formatarMoeda(d.gastoSaudeMedio))}
             ${par('Parte dos seus gastos', d.gastoMedioMensal > 0 ? Math.round((d.gastoSaudeMedio / d.gastoMedioMensal) * 100) + '%' : '—', { destaque: true })}
           </dl>${poucosDados(d)}`
        : recado('info', 'Registre consultas, exames e remédios na categoria Saúde para acompanhar quanto eles pesam no mês.');

    area.innerHTML =
      ferramenta(
        'fa-user-shield',
        'Quanto um empréstimo custa de verdade',
        'A propaganda mostra a parcela. Aqui você vê o total e os juros.',
        duasColunas(
          campoDinheiro('empValor', 'Valor que você recebe', prefs.empValor || 0) +
            campoDinheiro('empParcela', 'Valor de cada parcela', prefs.empParcela || 0) +
            campoNumero('empQuantidade', 'Número de parcelas', prefs.empQuantidade || 0, { exemplo: '48' }) +
            campoDinheiro('empBeneficio', 'Seu benefício por mês', salvoOuSugerido(prefs.beneficio, Math.round(d.receitaMediaMensal)))
        ) + '<div id="empResultado" class="pilha" aria-live="polite"></div>'
      ) + ferramenta('fa-hand-holding-medical', 'Seus gastos com saúde', 'Calculado a partir das suas transações.', corpoSaude);

    function calcular() {
      const valor = lerValor(el('empValor'));
      const parcela = lerValor(el('empParcela'));
      const quantidade = Math.floor(lerValor(el('empQuantidade')));
      const beneficio = lerValor(el('empBeneficio'));
      Preferencias.salvar('empValor', valor);
      Preferencias.salvar('empParcela', parcela);
      Preferencias.salvar('empQuantidade', quantidade);
      Preferencias.salvar('beneficio', beneficio);

      const saida = el('empResultado');
      if (!valor || !parcela || !quantidade) {
        saida.innerHTML = recado('info', 'Preencha os dados da oferta de empréstimo que você recebeu.');
        return;
      }
      if (parcela * quantidade < valor) {
        saida.innerHTML = recado('atencao', 'As parcelas somam menos do que o valor recebido. Confira os números.');
        return;
      }

      const r = custoDoEmprestimo(valor, parcela, quantidade);
      const preso = beneficio ? (parcela / beneficio) * 100 : 0;
      const porcento = (n) => (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';

      saida.innerHTML = `
        <dl>
          ${par('Total que você vai pagar', formatarMoeda(r.totalPago))}
          ${par('Só de juros', formatarMoeda(r.juros), { classe: 'alerta-texto' })}
          ${par('Taxa de juros', `${porcento(r.taxaMensal)} ao mês (${porcento(r.taxaAnual)} ao ano)`)}
          ${beneficio ? par('Parte do benefício que fica presa', Math.round(preso) + '%', { destaque: true, classe: preso > 30 ? 'alerta-texto' : '' }) : ''}
        </dl>
        ${recado('info', `Você pega ${formatarMoeda(valor)} e devolve ${formatarMoeda(r.totalPago)}: paga ${formatarMoeda(r.juros)} a mais, durante ${plural(quantidade, 'mês', 'meses')}.`)}
        ${preso > 30 ? recado('perigo', 'Mais de 30% do benefício preso em parcela deixa pouco para remédios, contas e imprevistos. Pense bem antes de assinar.') : ''}`;
    }

    aoDigitar(['empValor', 'empParcela', 'empQuantidade', 'empBeneficio'], calcular);
    calcular();
  },
};

// ---- META SUGERIDA ----

let dadosResumo = null;
let metasExistentes = [];
let perfilAtivo = null;

const arredondarMeta = (valor) => Math.ceil(valor / 50) * 50;

function dataDaqui(meses) {
  return textoDoDia(new Date(hoje.getFullYear(), hoje.getMonth() + meses, hoje.getDate()));
}

function desenharMeta() {
  const lugar = el('metaSugerida');
  if (!lugar || !perfilAtivo) return;

  const regra = CONTEUDO_PERFIS[perfilAtivo].meta;
  // Desempregado não recebe meta de propósito: o foco é fazer o dinheiro durar.
  if (!regra) {
    lugar.innerHTML = '';
    return;
  }

  const dados = { ...dadosResumo, rendaMensalEstudante: salvoOuSugerido(Preferencias.ler().mesada, dadosResumo.receitaMediaMensal) };
  const meta = regra(dados);
  const valor = arredondarMeta(meta.valor);

  // Metas do mesmo "grupo" servem para a mesma coisa (CLT e Autônomo têm,
  // cada um, uma reserva de emergência). Se uma já existe, a outra não é
  // oferecida de novo para o mesmo dinheiro.
  const equivalentes = meta.grupo
    ? Object.values(CONTEUDO_PERFIS).filter((c) => c.meta).map((c) => c.meta(dados)).filter((m) => m.grupo === meta.grupo).map((m) => m.titulo)
    : [meta.titulo];
  const existente = metasExistentes.find((m) => equivalentes.includes(m.titulo) && m.status !== 'cancelada');

  let pe;
  if (existente) {
    pe = `<p>${existente.titulo === meta.titulo ? 'Você já tem esta meta.' : `Você já tem a meta "${esc(existente.titulo)}", que serve para a mesma coisa.`}</p>
          <a class="botao botao--escuro" href="${RAIZ}/metas">Ver minhas metas</a>`;
  } else if (valor <= 0) {
    pe = '<p>Registre seus gastos por algumas semanas para receber uma sugestão de valor.</p>';
  } else {
    pe = '<button type="button" class="botao botao--escuro" id="criarMetaSugerida">Criar esta meta</button>';
  }

  lugar.innerHTML = `
    <section class="lobo pilha--p" aria-labelledby="tituloMetaSugerida">
      <p class="saldo__rotulo">Meta sugerida para você</p>
      <h3 id="tituloMetaSugerida" style="font-size:1.375rem">${esc(meta.titulo)}</h3>
      ${valor > 0 ? `<p class="numero" style="font-size:2rem">${formatarMoeda(valor)}</p><p>Em ${meta.meses} meses.</p>` : ''}
      <p>${esc(meta.porque)}</p>
      ${pe}
    </section>`;

  const botao = el('criarMetaSugerida');
  if (!botao) return;

  botao.addEventListener('click', async () => {
    const soltar = ocupar(botao, 'Criando...');
    const { ok, dados: resposta } = await chamarApi('/api/meta', {
      method: 'POST',
      body: JSON.stringify({ titulo: meta.titulo, valor_alvo: valor, data_limite: dataDaqui(meta.meses) }),
    });

    if (!ok) {
      soltar();
      return avisar(resposta.erro || 'Não foi possível criar a meta.', 'erro');
    }

    metasExistentes.push(resposta);
    avisar(`Meta "${meta.titulo}" criada! Acompanhe em Metas.`);
    desenharMeta();
  });
}

// ---- A TELA ----

function mostrarPerfil(chave) {
  perfilAtivo = chave;
  const conteudo = CONTEUDO_PERFIS[chave];

  document.querySelectorAll('#abas [role="tab"]').forEach((aba) => {
    const ativa = aba.dataset.perfil === chave;
    aba.setAttribute('aria-selected', String(ativa));
    aba.tabIndex = ativa ? 0 : -1;
  });

  el('tituloPerfil').textContent = conteudo.titulo;
  el('contextoPerfil').textContent = conteudo.contexto;

  el('dicas').innerHTML = conteudo.dicas
    .map((dica) => `<li class="dica"><span class="icone icone--lilas icone--p" aria-hidden="true"><i class="fa-solid ${dica.icone}"></i></span><div><strong>${esc(dica.titulo)}</strong><span class="suave">${esc(dica.texto)}</span></div></li>`)
    .join('');

  FERRAMENTAS[chave](el('ferramentas'), dadosResumo);
  desenharMeta();

  // O endereço guarda a aba aberta: dá para voltar direto nela.
  history.replaceState(null, '', '#' + chave);
}

async function iniciar() {
  const perfis = PerfisSalvos.ler().filter((chave) => PERFIS[chave] && FERRAMENTAS[chave]);

  // Quem ainda não escolheu perfil vê o convite para a pesquisa.
  if (perfis.length === 0) {
    el('semPerfil').hidden = false;
    return;
  }

  const [contas, transacoes, metas] = await Promise.all([
    chamarApi(`/api/usuario/${ID_USUARIO}/conta`),
    chamarApi(`/api/usuario/${ID_USUARIO}/transacao`),
    chamarApi(`/api/usuario/${ID_USUARIO}/meta`),
  ]);

  if (!contas.ok || !transacoes.ok) {
    avisar('Não foi possível carregar seus dados. Confira sua conexão.', 'erro');
    return;
  }

  dadosResumo = resumir(contas.dados, transacoes.dados);
  metasExistentes = metas.ok ? metas.dados : [];

  el('abas').innerHTML = perfis
    .map((chave) => `<button type="button" role="tab" data-perfil="${chave}" aria-controls="painelPerfil"><i class="fa-solid ${PERFIS[chave].icone}" aria-hidden="true"></i> ${PERFIS[chave].nome}</button>`)
    .join('');
  // Com um perfil só, as abas não ajudam em nada.
  el('abas').hidden = perfis.length === 1;

  el('abas').addEventListener('click', (evento) => {
    const aba = evento.target.closest('[role="tab"]');
    // A aba que já está aberta não faz nada: desenhar de novo só piscaria a tela.
    if (aba && aba.dataset.perfil !== perfilAtivo) mostrarPerfil(aba.dataset.perfil);
  });

  // Setas do teclado andam entre as abas, como o padrão de abas pede.
  el('abas').addEventListener('keydown', (evento) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(evento.key)) return;
    const atual = perfis.indexOf(perfilAtivo);
    const proximo = perfis[(atual + (evento.key === 'ArrowRight' ? 1 : -1) + perfis.length) % perfis.length];
    mostrarPerfil(proximo);
    document.querySelector(`#abas [data-perfil="${proximo}"]`).focus();
  });

  el('comPerfil').hidden = false;

  // /novo/meu-perfil#autonomo abre direto naquele perfil.
  const pedido = location.hash.slice(1);
  mostrarPerfil(perfis.includes(pedido) ? pedido : perfis[0]);
}

iniciar();

// Trocar o #perfil no endereço (pelo link da dica do Início, por exemplo)
// também troca a aba, sem recarregar a página.
window.addEventListener('hashchange', () => {
  const pedido = location.hash.slice(1);
  if (dadosResumo && FERRAMENTAS[pedido] && pedido !== perfilAtivo && PerfisSalvos.ler().includes(pedido)) mostrarPerfil(pedido);
});
