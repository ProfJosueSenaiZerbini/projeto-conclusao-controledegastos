// Tela "Meu perfil" (/meu-perfil): as ferramentas de cada perfil escolhido.
//
// De onde vem cada coisa:
//   PERFIS           → perfil-perguntas.js (nome e ícone de cada perfil)
//   CONTEUDO_PERFIS  → perfil-conteudo.js  (contexto, dicas, meta sugerida)
//   descontoINSS etc → perfil-calculos.js  (as contas)
//   chamarApi, Sessao, PerfisSalvos, formatarMoeda → auth.js
//
// Os perfis continuam guardados só no navegador (PerfisSalvos), como na
// tela de escolha. O que a pessoa digita nas ferramentas (mesada, contas
// fixas da casa...) também fica no navegador, em Preferencias. Nada disso
// mexe no banco: as ferramentas só LEEM contas, transações e metas da API.
// A única escrita é o botão "Criar esta meta", que usa a rota de metas
// que já existe.

// ---- PREFERÊNCIAS DO USUÁRIO NAS FERRAMENTAS ----
// Mesmo esquema do PerfisSalvos: uma chave por usuário, para duas pessoas
// no mesmo computador não verem os dados uma da outra.
const Preferencias = {
  chave() {
    return 'perfil_ferramentas_' + Sessao.idUsuario();
  },
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

// ---- PEQUENOS AJUDANTES ----

const hoje = new Date();

// "2026-10" a partir de uma data ISO. Fatiar a string evita o problema do
// fuso horário que o new Date() teria (a data "voltar" um dia).
function chaveMes(iso) {
  return String(iso).slice(0, 7);
}

function chaveDoMes(data) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

// As N chaves de mês ANTERIORES ao mês atual, do mais recente ao mais
// antigo. O mês atual fica de fora porque ainda está pela metade: a
// média com ele ficaria baixa demais.
function mesesAnteriores(quantidade) {
  const lista = [];
  for (let i = 1; i <= quantidade; i++) {
    lista.push(chaveDoMes(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)));
  }
  return lista;
}

// "2026-10-12": a segunda-feira da semana atual, para somar os gastos da semana.
function inicioDaSemana() {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diaDaSemana = (d.getDay() + 6) % 7; // segunda = 0 ... domingo = 6
  d.setDate(d.getDate() - diaDaSemana);
  return `${chaveDoMes(d)}-${String(d.getDate()).padStart(2, '0')}`;
}

function media(lista) {
  return lista.length ? lista.reduce((a, b) => a + b, 0) / lista.length : 0;
}

// Lê um campo numérico do jeito brasileiro: "1.500,50", "1500,50" e
// "1.500" (mil e quinhentos). Sem esse cuidado, o JavaScript leria
// "1.500" como 1,5 — o ponto para ele é a vírgula decimal.
function lerNumero(campo) {
  const texto = String(campo.value).trim().replace(/^R\$\s*/, '');
  if (!texto) return 0;
  const soMilhar = /^\d{1,3}(\.\d{3})+$/.test(texto);
  const normalizado =
    texto.includes(',') || soMilhar ? texto.replace(/\./g, '').replace(',', '.') : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// "3,5 meses" → "3 meses e 15 dias". É mais fácil de entender.
function textoDosMeses(meses) {
  if (meses === Infinity) return 'não acaba';
  const inteiros = Math.floor(meses);
  const dias = Math.round((meses - inteiros) * 30);
  const partes = [];
  if (inteiros > 0) partes.push(inteiros === 1 ? '1 mês' : `${inteiros} meses`);
  if (dias > 0) partes.push(dias === 1 ? '1 dia' : `${dias} dias`);
  return partes.length ? partes.join(' e ') : 'menos de 1 dia';
}

// Data aproximada daqui a N meses, para dizer "até março de 2027".
function mesAnoDaqui(meses) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + Math.floor(meses * 30.4));
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// ---- RESUMO DOS DADOS DO USUÁRIO ----
//
// Transforma a lista de transações em números que as ferramentas usam.
// Lembrete do modelo: se é receita ou despesa vem de categoria.tipo.
function resumir(contas, transacoes) {
  const porMes = {};
  const semana = inicioDaSemana();
  const mesAtual = chaveDoMes(hoje);
  const anoAtual = String(hoje.getFullYear());
  let gastoDaSemana = 0;
  let receitasDoAno = 0;

  for (const t of transacoes) {
    const mes = chaveMes(t.data_transacao);
    const valor = Number(t.valor_transacao);
    const ehReceita = t.categoria.tipo === 'receita';

    porMes[mes] = porMes[mes] || { receitas: 0, despesas: 0, saude: 0, naoEssenciais: 0 };

    if (ehReceita) {
      porMes[mes].receitas += valor;
      if (mes.startsWith(anoAtual)) receitasDoAno += valor;
    } else {
      porMes[mes].despesas += valor;
      if (t.categoria.nome_categoria === 'Saúde') porMes[mes].saude += valor;
      // Lazer e Compras são o que dá para segurar primeiro num aperto.
      if (['Lazer', 'Compras'].includes(t.categoria.nome_categoria)) porMes[mes].naoEssenciais += valor;
      if (String(t.data_transacao).slice(0, 10) >= semana) gastoDaSemana += valor;
    }
  }

  // Base da média: os últimos 3 meses fechados que têm algum registro.
  // Quem começou a usar agora só tem o mês atual — usamos ele mesmo,
  // avisando que é uma estimativa.
  const fechados = mesesAnteriores(3).filter((m) => porMes[m]);
  const base = fechados.length ? fechados : porMes[mesAtual] ? [mesAtual] : [];
  const daBase = (campo) => media(base.map((m) => porMes[m][campo]));

  return {
    saldoTotal: contas.reduce((soma, c) => soma + Number(c.saldo), 0),
    gastoMedioMensal: daBase('despesas'),
    receitaMediaMensal: daBase('receitas'),
    gastoSaudeMedio: daBase('saude'),
    naoEssenciaisMedio: daBase('naoEssenciais'),
    mesesNaMedia: base.length,
    // Receitas de até 6 meses fechados, só dos meses que têm registro.
    receitasPorMes: mesesAnteriores(6)
      .filter((m) => porMes[m] && porMes[m].receitas > 0)
      .map((m) => porMes[m].receitas),
    receitasDoAno,
    receitasDoMes: porMes[mesAtual] ? porMes[mesAtual].receitas : 0,
    despesasDoMes: porMes[mesAtual] ? porMes[mesAtual].despesas : 0,
    gastoDaSemana,
  };
}

// ---- PEÇAS DE TELA REAPROVEITADAS ----

function cartao(icone, titulo, subtitulo, corpo) {
  return `
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div class="flex items-start gap-3 mb-5">
        <div class="w-10 h-10 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <i class="fa-solid ${icone}"></i>
        </div>
        <div>
          <h4 class="font-bold text-gray-900">${titulo}</h4>
          ${subtitulo ? `<p class="text-xs text-gray-500 mt-0.5">${subtitulo}</p>` : ''}
        </div>
      </div>
      ${corpo}
    </div>`;
}

function campo(id, rotulo, valor, { prefixo = 'R$', dica = '', tipo = 'text' } = {}) {
  return `
    <label class="block">
      <span class="block text-xs font-semibold text-gray-600 mb-1.5">${rotulo}</span>
      <span class="flex items-center rounded-xl border border-gray-200 bg-gray-50 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition">
        ${prefixo ? `<span class="pl-3 text-sm text-gray-400">${prefixo}</span>` : ''}
        <input id="${id}" type="${tipo}" inputmode="decimal" value="${valor ? String(Math.round(valor * 100) / 100).replace('.', ',') : ''}"
               class="w-full bg-transparent px-3 py-2.5 text-sm outline-none" autocomplete="off">
      </span>
      ${dica ? `<span class="block text-[11px] text-gray-400 mt-1">${dica}</span>` : ''}
    </label>`;
}

function seletor(id, rotulo, opcoes, selecionado) {
  return `
    <label class="block">
      <span class="block text-xs font-semibold text-gray-600 mb-1.5">${rotulo}</span>
      <select id="${id}" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
        ${opcoes
          .map(([valor, texto]) => `<option value="${valor}" ${String(valor) === String(selecionado) ? 'selected' : ''}>${texto}</option>`)
          .join('')}
      </select>
    </label>`;
}

function linha(rotulo, valor, { destaque = false, cor = '' } = {}) {
  return `
    <div class="flex justify-between items-baseline gap-4 py-2 ${destaque ? 'border-t border-gray-100 mt-1 pt-3' : ''}">
      <span class="text-sm ${destaque ? 'font-semibold text-gray-800' : 'text-gray-500'}">${rotulo}</span>
      <span class="${destaque ? 'text-lg font-bold' : 'text-sm font-semibold'} ${cor || 'text-gray-900'} text-right">${valor}</span>
    </div>`;
}

// Faixa colorida de aviso. tipo: 'info', 'atencao' ou 'perigo'.
function aviso(tipo, texto) {
  const estilos = {
    info: 'bg-blue-50 text-blue-800 border-blue-100',
    atencao: 'bg-amber-50 text-amber-800 border-amber-100',
    perigo: 'bg-red-50 text-red-700 border-red-100',
    ok: 'bg-green-50 text-green-800 border-green-100',
  };
  const icones = { info: 'fa-circle-info', atencao: 'fa-triangle-exclamation', perigo: 'fa-triangle-exclamation', ok: 'fa-check' };
  return `
    <div class="flex gap-3 items-start text-sm rounded-xl border px-4 py-3 ${estilos[tipo]}">
      <i class="fa-solid ${icones[tipo]} mt-0.5"></i>
      <p>${texto}</p>
    </div>`;
}

function aoDigitar(ids, funcao) {
  ids.forEach((id) => {
    const elemento = document.getElementById(id);
    elemento.addEventListener('input', funcao);
    elemento.addEventListener('change', funcao);
  });
}

// Aviso de que a média usa poucos dados (pessoa começou a usar agora).
function avisoPoucosDados(d) {
  if (d.mesesNaMedia >= 2) return '';
  return `<p class="text-[11px] text-gray-400 mt-3">
    <i class="fa-solid fa-circle-info mr-1"></i>
    Calculado com ${d.mesesNaMedia === 0 ? 'nenhum mês' : 'só 1 mês'} de registros. Quanto mais você registrar, mais preciso fica.
  </p>`;
}

// =====================================================================
// FERRAMENTAS DE CADA PERFIL
// Cada função recebe a área da tela e o resumo dos dados (d), desenha
// a ferramenta e liga os campos às contas. Quando algo muda que afeta a
// meta sugerida, ela chama desenharMeta() de novo.
// =====================================================================

const FERRAMENTAS = {
  // ---------- CLT ----------
  clt(area, d) {
    const prefs = Preferencias.ler();
    const salarioInicial = prefs.salario || Math.round(d.receitaMediaMensal);
    const mesesInicial = prefs.mesesTrabalhados || 12;

    area.innerHTML = cartao(
      'fa-calculator',
      'Planejador do 13º salário',
      'Veja quanto cai em cada parcela antes de o dinheiro chegar.',
      `
      <div class="grid sm:grid-cols-2 gap-4">
        ${campo('cltSalario', 'Salário bruto (do holerite)', salarioInicial, { dica: 'O valor antes dos descontos.' })}
        ${seletor(
          'cltMeses',
          'Meses trabalhados neste ano',
          Array.from({ length: 12 }, (_, i) => [12 - i, `${12 - i} ${12 - i === 1 ? 'mês' : 'meses'}`]),
          mesesInicial
        )}
      </div>
      <div id="cltResultado" class="mt-5"></div>
      `
    );

    function calcular() {
      const salario = lerNumero(document.getElementById('cltSalario'));
      const meses = Number(document.getElementById('cltMeses').value);
      Preferencias.salvar('salario', salario);
      Preferencias.salvar('mesesTrabalhados', meses);

      const saida = document.getElementById('cltResultado');
      if (!salario) {
        saida.innerHTML = aviso('info', 'Digite seu salário bruto para ver as parcelas.');
        return;
      }

      const r = decimoTerceiro(salario, meses);
      saida.innerHTML = `
        ${linha('13º bruto', formatarMoeda(r.bruto))}
        ${linha('1ª parcela — até 30 de novembro (sem descontos)', formatarMoeda(r.primeiraParcela), { cor: 'text-green-600' })}
        ${linha('INSS do 13º (sai da 2ª parcela)', '− ' + formatarMoeda(r.inss), { cor: 'text-red-500' })}
        ${linha('2ª parcela — até 20 de dezembro', formatarMoeda(r.segundaParcela), { destaque: true })}
        <p class="text-[11px] text-gray-400 mt-1 mb-4">
          A 2ª parcela também pode ter desconto de Imposto de Renda, que depende de dependentes e outras
          deduções. Ele não é calculado aqui — confira no seu holerite.
        </p>
        ${aviso(
          'info',
          `Seu INSS mensal é de ${formatarMoeda(descontoINSS(salario))}. Se você tem dívida no cartão ou no cheque
           especial, usar o 13º para quitá-la rende mais do que qualquer aplicação: nenhum investimento paga o que
           esses juros cobram.`
        )}
      `;
    }

    aoDigitar(['cltSalario', 'cltMeses'], calcular);
    calcular();
  },

  // ---------- AUTÔNOMO ----------
  autonomo(area, d) {
    const prefs = Preferencias.ler();
    const r = salarioSeguroAutonomo(d.receitasPorMes);

    let corpoSalario;
    if (!r || r.mesesAnalisados < 2) {
      corpoSalario = aviso(
        'info',
        'Para calcular o seu salário, o Verdanz precisa das suas entradas de pelo menos 2 meses fechados. ' +
          'Registre o que você recebe em Transações (categoria Freelance, por exemplo) ou conecte seu banco em Contas.'
      );
    } else {
      const faltaNoMesFraco = d.gastoMedioMensal - r.salarioSeguro;
      corpoSalario = `
        ${linha(`Média de entradas (${r.mesesAnalisados} meses)`, formatarMoeda(r.media))}
        ${linha('Mês mais fraco', formatarMoeda(r.menorMes))}
        ${linha('Mês mais forte', formatarMoeda(r.maiorMes))}
        ${linha('Seu "salário" seguro', formatarMoeda(r.salarioSeguro), { destaque: true, cor: 'text-blue-600' })}
        <p class="text-xs text-gray-500 mt-1 mb-4">
          É a média dos seus meses mais fracos. Viva com este valor todo mês e guarde o que entrar a mais nos meses
          bons — é essa sobra que paga os meses ruins.
        </p>
        ${
          faltaNoMesFraco > 0
            ? aviso(
                'atencao',
                `Seus gastos (${formatarMoeda(d.gastoMedioMensal)} por mês) passam do seu salário seguro em
                 ${formatarMoeda(faltaNoMesFraco)}. Num mês fraco, essa diferença sai da reserva ou vira dívida.`
              )
            : aviso('ok', 'Seus gastos cabem no seu salário seguro. Ótimo sinal para atravessar os meses fracos.')
        }
      `;
    }

    const atividade = prefs.atividadeMEI || 'servicos';
    const diasAteDAS = diasAteVencimento(VALORES_2026.diaVencimentoDAS, hoje);
    const mesesDoAno = hoje.getMonth() + 1;
    const projecaoAno = (d.receitasDoAno / mesesDoAno) * 12;
    const usoLimite = Math.min(100, (d.receitasDoAno / VALORES_2026.limiteAnualMEI) * 100);

    area.innerHTML = `
      <div class="space-y-6">
        ${cartao('fa-wallet', 'Seu salário de autônomo', 'Um valor fixo para viver, mesmo com renda que sobe e desce.', corpoSalario)}
        ${cartao(
          'fa-receipt',
          'MEI em dia',
          'Guia mensal (DAS) e limite de faturamento de 2026.',
          `
          ${seletor('meiAtividade', 'Sua atividade', [
            ['comercio', 'Comércio ou indústria'],
            ['servicos', 'Prestação de serviços'],
            ['ambos', 'Comércio e serviços'],
          ], atividade)}
          <div id="meiDAS" class="mt-4"></div>
          <div class="mt-5">
            <div class="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Entradas registradas em ${hoje.getFullYear()}</span>
              <span>${formatarMoeda(d.receitasDoAno)} de ${formatarMoeda(VALORES_2026.limiteAnualMEI)}</span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2">
              <div class="${projecaoAno > VALORES_2026.limiteAnualMEI ? 'bg-amber-500' : 'bg-blue-600'} h-2 rounded-full" style="width: ${usoLimite}%"></div>
            </div>
            <p class="text-[11px] text-gray-400 mt-2">
              Considera todas as entradas registradas no Verdanz, então é uma aproximação do seu faturamento.
            </p>
            ${
              projecaoAno > VALORES_2026.limiteAnualMEI
                ? `<div class="mt-3">${aviso(
                    'atencao',
                    `No ritmo atual, você fecha o ano com cerca de ${formatarMoeda(projecaoAno)} — acima do limite do MEI.
                     Converse com um contador antes de passar dele.`
                  )}</div>`
                : ''
            }
          </div>
          `
        )}
      </div>`;

    function atualizarDAS() {
      const escolhida = document.getElementById('meiAtividade').value;
      Preferencias.salvar('atividadeMEI', escolhida);
      document.getElementById('meiDAS').innerHTML = `
        ${linha('Valor do DAS em 2026', formatarMoeda(VALORES_2026.dasMEI[escolhida]))}
        ${linha(
          'Próximo vencimento (dia 20)',
          diasAteDAS === 0 ? 'vence hoje' : `em ${diasAteDAS} ${diasAteDAS === 1 ? 'dia' : 'dias'}`,
          { cor: diasAteDAS <= 3 ? 'text-red-500' : '' }
        )}`;
    }
    aoDigitar(['meiAtividade'], atualizarDAS);
    atualizarDAS();
  },

  // ---------- ESTUDANTE ----------
  estudante(area, d) {
    const prefs = Preferencias.ler();
    const valorInicial = prefs.mesada || Math.round(d.receitaMediaMensal);
    const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const diasRestantes = diasNoMes - hoje.getDate() + 1;

    area.innerHTML = cartao(
      'fa-coins',
      'Seu limite da semana',
      'Divida o que você recebe no mês em semanas e saiba quando segurar.',
      `
      ${campo('estMesada', 'Quanto você recebe por mês', valorInicial, { dica: 'Mesada, bolsa, estágio ou a soma deles.' })}
      <div id="estResultado" class="mt-5"></div>
      `
    );

    function calcular() {
      const mesada = lerNumero(document.getElementById('estMesada'));
      Preferencias.salvar('mesada', mesada);
      desenharMeta(); // a meta sugerida usa a mesada

      const saida = document.getElementById('estResultado');
      if (!mesada) {
        saida.innerHTML = aviso('info', 'Digite quanto você recebe por mês para ver o seu limite semanal.');
        return;
      }

      const limite = limiteSemanal(mesada, diasNoMes);
      const situacao = situacaoDoLimite(d.gastoDaSemana, limite);
      const uso = Math.min(100, (d.gastoDaSemana / limite) * 100);
      const restaNoMes = mesada - d.despesasDoMes;
      const cores = { ok: 'bg-blue-600', atencao: 'bg-amber-500', estourou: 'bg-red-500' };
      const mensagens = {
        ok: aviso('ok', 'Você está dentro do limite desta semana.'),
        atencao: aviso('atencao', 'Você já usou mais de 80% do limite da semana. Hora de segurar os gastos até segunda.'),
        estourou: aviso(
          'perigo',
          `Você passou do limite da semana em ${formatarMoeda(d.gastoDaSemana - limite)}. Isso sai das próximas semanas.`
        ),
      };

      saida.innerHTML = `
        <div class="flex justify-between text-sm mb-1.5">
          <span class="text-gray-500">Gasto nesta semana</span>
          <span class="font-semibold">${formatarMoeda(d.gastoDaSemana)} de ${formatarMoeda(limite)}</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2.5 mb-4">
          <div class="${cores[situacao]} h-2.5 rounded-full" style="width: ${uso}%"></div>
        </div>
        ${mensagens[situacao]}
        <div class="mt-4">
          ${linha('Gasto neste mês', formatarMoeda(d.despesasDoMes))}
          ${linha(
            `Ainda pode gastar até o fim do mês (${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'})`,
            formatarMoeda(Math.max(0, restaNoMes)),
            { destaque: true, cor: restaNoMes < 0 ? 'text-red-500' : 'text-blue-600' }
          )}
          ${restaNoMes > 0 ? linha('Por dia', formatarMoeda(restaNoMes / diasRestantes)) : ''}
        </div>
      `;
    }

    aoDigitar(['estMesada'], calcular);
    calcular();
  },

  // ---------- DOMÉSTICO ----------
  domestico(area, d) {
    area.innerHTML = cartao(
      'fa-file-invoice-dollar',
      'Contas fixas da casa',
      'Cadastre as contas de todo mês e veja os vencimentos e quanto sobra.',
      `
      <form id="domForm" class="grid grid-cols-2 sm:grid-cols-[1fr_8rem_6rem_auto] gap-3 items-end">
        <label class="block col-span-2 sm:col-span-1">
          <span class="block text-xs font-semibold text-gray-600 mb-1.5">Conta</span>
          <input id="domNome" list="domSugestoes" required maxlength="40" placeholder="Ex.: Luz"
                 class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
          <datalist id="domSugestoes">
            <option value="Aluguel"><option value="Luz"><option value="Água"><option value="Internet">
            <option value="Gás"><option value="Condomínio"><option value="Escola"><option value="Mercado">
          </datalist>
        </label>
        ${campo('domValor', 'Valor', 0)}
        ${campo('domDia', 'Vence dia', 0, { prefixo: '' })}
        <button type="submit" class="h-[42px] px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition">
          <i class="fa-solid fa-plus"></i><span class="sm:hidden ml-2">Adicionar</span>
        </button>
      </form>
      <p id="domErro" class="hidden text-xs text-red-600 mt-2"></p>
      <ul id="domLista" class="mt-5 divide-y divide-gray-100"></ul>
      <div id="domResumo" class="mt-4"></div>
      `
    );

    function contas() {
      return Preferencias.ler().contasFixas || [];
    }

    function desenhar() {
      const lista = contas()
        .map((c, indice) => ({ ...c, indice, dias: diasAteVencimento(c.dia, hoje) }))
        .sort((a, b) => a.dias - b.dias);

      const ul = document.getElementById('domLista');
      if (lista.length === 0) {
        ul.innerHTML = `<li class="py-6 text-center text-sm text-gray-400">Nenhuma conta cadastrada ainda.</li>`;
      } else {
        ul.innerHTML = lista
          .map((c) => {
            // Quanto mais perto do vencimento, mais forte a cor.
            let selo = `<span class="text-xs text-gray-400">em ${c.dias} dias</span>`;
            if (c.dias === 0) selo = `<span class="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">vence hoje</span>`;
            else if (c.dias <= 3) selo = `<span class="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">em ${c.dias} ${c.dias === 1 ? 'dia' : 'dias'}</span>`;
            else if (c.dias <= 7) selo = `<span class="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">em ${c.dias} dias</span>`;

            return `
              <li class="flex items-center gap-3 py-3">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-800 truncate">${escapar(c.nome)}</p>
                  <p class="text-xs text-gray-400">Vence todo dia ${c.dia}</p>
                </div>
                ${selo}
                <span class="text-sm font-semibold w-28 text-right">${formatarMoeda(c.valor)}</span>
                <button type="button" data-remover="${c.indice}" title="Remover ${escapar(c.nome)}"
                        class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <i class="fa-solid fa-trash text-xs"></i>
                </button>
              </li>`;
          })
          .join('');
      }

      ul.querySelectorAll('[data-remover]').forEach((botao) => {
        botao.addEventListener('click', () => {
          const atual = contas();
          atual.splice(Number(botao.dataset.remover), 1);
          Preferencias.salvar('contasFixas', atual);
          desenhar();
        });
      });

      desenharResumo(lista);
      desenharMeta(); // a meta sugerida usa o total das contas fixas
    }

    function desenharResumo(lista) {
      const total = lista.reduce((soma, c) => soma + c.valor, 0);
      d.totalContasFixas = total;
      const resumo = document.getElementById('domResumo');
      if (lista.length === 0) {
        resumo.innerHTML = '';
        return;
      }

      const prefs = Preferencias.ler();
      const renda = prefs.rendaCasa || Math.round(d.receitasDoMes);
      const custoDeAtrasarTudo = lista.reduce((soma, c) => soma + custoDoAtraso(c.valor, 10), 0);

      resumo.innerHTML = `
        ${linha('Total das contas fixas', formatarMoeda(total), { destaque: true })}
        <div class="mt-4">${campo('domRenda', 'Dinheiro que entra na casa por mês', renda, {
          dica: 'Salário, repasse da família ou benefícios. Começa com o que você registrou este mês.',
        })}</div>
        <div id="domSobra" class="mt-3"></div>
        <p class="text-xs text-gray-500 mt-4">
          <i class="fa-solid fa-triangle-exclamation text-amber-500 mr-1"></i>
          Atrasar todas essas contas em 10 dias custaria cerca de ${formatarMoeda(custoDeAtrasarTudo)} em multa e juros.
        </p>`;

      function calcularSobra() {
        const valor = lerNumero(document.getElementById('domRenda'));
        Preferencias.salvar('rendaCasa', valor);
        const sobra = valor - total;
        document.getElementById('domSobra').innerHTML = valor
          ? linha('Sobra depois das contas fixas', formatarMoeda(sobra), {
              cor: sobra < 0 ? 'text-red-500' : 'text-blue-600',
            }) +
            (sobra < 0
              ? aviso('perigo', 'As contas fixas passam do que entra. Vale rever o que dá para cortar ou renegociar.')
              : '')
          : '';
      }
      aoDigitar(['domRenda'], calcularSobra);
      calcularSobra();
    }

    document.getElementById('domForm').addEventListener('submit', (evento) => {
      evento.preventDefault();
      const erro = document.getElementById('domErro');
      const nome = document.getElementById('domNome').value.trim();
      const valor = lerNumero(document.getElementById('domValor'));
      const dia = Math.floor(lerNumero(document.getElementById('domDia')));

      if (!nome || !valor || dia < 1 || dia > 31) {
        erro.textContent = 'Preencha o nome, um valor maior que zero e um dia de 1 a 31.';
        erro.classList.remove('hidden');
        return;
      }
      erro.classList.add('hidden');

      Preferencias.salvar('contasFixas', [...contas(), { nome, valor, dia }]);
      evento.target.reset();
      document.getElementById('domNome').focus();
      desenhar();
    });

    desenhar();
  },

  // ---------- DESEMPREGADO ----------
  desempregado(area, d) {
    const prefs = Preferencias.ler();

    area.innerHTML = `
      <div class="space-y-6">
        ${cartao(
          'fa-hand-holding-dollar',
          'Seguro-desemprego',
          'Valor e número de parcelas pelas regras de 2026.',
          `
          <div class="grid sm:grid-cols-3 gap-4">
            ${campo('segMedia', 'Média dos 3 últimos salários', prefs.mediaSalarial || 0, { dica: 'Valor bruto.' })}
            ${campo('segMeses', 'Meses trabalhados', prefs.mesesCarteira || 0, {
              prefixo: '',
              dica: 'Com carteira, nos últimos 36 meses.',
            })}
            ${seletor('segPedido', 'Qual pedido é este?', [
              [1, '1º pedido'],
              [2, '2º pedido'],
              [3, '3º ou mais'],
            ], prefs.pedidoSeguro || 1)}
          </div>
          <div id="segResultado" class="mt-5"></div>
          `
        )}
        ${cartao(
          'fa-hourglass-half',
          'Quanto tempo o seu dinheiro dura',
          'Com o que você tem, o que ainda vai entrar e o quanto gasta.',
          `
          <div class="grid sm:grid-cols-3 gap-4">
            ${campo('durSaldo', 'Dinheiro que você tem', Math.max(0, d.saldoTotal), { dica: 'Começa com o saldo das suas contas.' })}
            ${campo('durGasto', 'Gasto por mês', Math.round(d.gastoMedioMensal), { dica: 'Começa com a sua média.' })}
            ${campo('durBicos', 'Bicos por mês (opcional)', prefs.bicos || 0)}
          </div>
          <label class="flex items-center gap-2 mt-4 text-sm text-gray-600">
            <input id="durUsarSeguro" type="checkbox" class="w-4 h-4 accent-blue-600" ${prefs.usarSeguro === false ? '' : 'checked'}>
            Contar as parcelas do seguro-desemprego calculadas acima
          </label>
          <div id="durResultado" class="mt-5"></div>
          ${avisoPoucosDados(d)}
          `
        )}
      </div>`;

    let parcelasDoSeguro = [];

    function calcularSeguro() {
      const mediaSalarial = lerNumero(document.getElementById('segMedia'));
      const meses = Math.floor(lerNumero(document.getElementById('segMeses')));
      const pedido = Number(document.getElementById('segPedido').value);
      Preferencias.salvar('mediaSalarial', mediaSalarial);
      Preferencias.salvar('mesesCarteira', meses);
      Preferencias.salvar('pedidoSeguro', pedido);

      const saida = document.getElementById('segResultado');
      parcelasDoSeguro = [];

      if (!mediaSalarial || !meses) {
        saida.innerHTML = aviso('info', 'Preencha a média salarial e os meses trabalhados para ver o seu seguro.');
      } else {
        const quantidade = parcelasSeguroDesemprego(meses, pedido);
        if (quantidade === 0) {
          const minimo = { 1: 12, 2: 9, 3: 6 }[pedido];
          saida.innerHTML = aviso(
            'atencao',
            `Pelas regras, no ${pedido === 3 ? '3º pedido em diante' : pedido + 'º pedido'} é preciso ter
             trabalhado pelo menos ${minimo} meses com carteira. Com ${meses}, você ainda não tem direito.`
          );
        } else {
          const valor = parcelaSeguroDesemprego(mediaSalarial);
          parcelasDoSeguro = Array(quantidade).fill(valor);
          saida.innerHTML = `
            ${linha('Valor de cada parcela', formatarMoeda(valor))}
            ${linha('Número de parcelas', String(quantidade))}
            ${linha('Total a receber', formatarMoeda(valor * quantidade), { destaque: true, cor: 'text-blue-600' })}
            <p class="text-[11px] text-gray-400 mt-2">
              Estimativa pelas regras de 2026. O valor oficial aparece na Carteira de Trabalho Digital depois do pedido,
              que deve ser feito de 7 a 120 dias após a demissão.
            </p>`;
        }
      }
      calcularDuracao();
    }

    function calcularDuracao() {
      const saldo = lerNumero(document.getElementById('durSaldo'));
      const gasto = lerNumero(document.getElementById('durGasto'));
      const bicos = lerNumero(document.getElementById('durBicos'));
      const usarSeguro = document.getElementById('durUsarSeguro').checked;
      Preferencias.salvar('bicos', bicos);
      Preferencias.salvar('usarSeguro', usarSeguro);

      const saida = document.getElementById('durResultado');
      if (!gasto) {
        saida.innerHTML = aviso('info', 'Informe quanto você gasta por mês.');
        return;
      }

      const entradas = usarSeguro ? parcelasDoSeguro : [];
      const meses = mesesQueODinheiroDura(saldo, gasto, entradas, bicos);
      const corte = d.naoEssenciaisMedio / 2;
      const mesesComCorte = corte > 0 ? mesesQueODinheiroDura(saldo, gasto - corte, entradas, bicos) : meses;

      const tipo = meses === Infinity ? 'ok' : meses < 3 ? 'perigo' : meses < 6 ? 'atencao' : 'ok';
      const frase =
        meses === Infinity
          ? 'Com essas entradas, o que entra cobre o que sai: o seu dinheiro não acaba.'
          : `Seu dinheiro dura cerca de <strong>${textoDosMeses(meses)}</strong>, até ${mesAnoDaqui(meses)}.`;

      saida.innerHTML = `
        ${aviso(tipo, frase)}
        ${
          corte > 0 && meses !== Infinity
            ? `<div class="mt-3">${aviso(
                'info',
                `Cortando metade do que você gasta com Lazer e Compras (${formatarMoeda(corte)} por mês),
                 ele passa a durar ${textoDosMeses(mesesComCorte)}.`
              )}</div>`
            : ''
        }`;
    }

    aoDigitar(['segMedia', 'segMeses', 'segPedido'], calcularSeguro);
    aoDigitar(['durSaldo', 'durGasto', 'durBicos', 'durUsarSeguro'], calcularDuracao);
    calcularSeguro();
  },

  // ---------- APOSENTADO ----------
  aposentado(area, d) {
    const prefs = Preferencias.ler();
    const beneficioInicial = prefs.beneficio || Math.round(d.receitaMediaMensal);

    const corpoSaude =
      d.gastoSaudeMedio > 0
        ? `
          ${linha('Gasto médio com saúde por mês', formatarMoeda(d.gastoSaudeMedio))}
          ${linha(
            'Parte dos seus gastos',
            d.gastoMedioMensal > 0 ? Math.round((d.gastoSaudeMedio / d.gastoMedioMensal) * 100) + '%' : '—',
            { destaque: true }
          )}
          ${avisoPoucosDados(d)}`
        : aviso(
            'info',
            'Registre consultas, exames e remédios na categoria Saúde, em Transações, para acompanhar quanto eles pesam no mês.'
          );

    area.innerHTML = `
      <div class="space-y-6">
        ${cartao(
          'fa-user-shield',
          'Quanto um empréstimo custa de verdade',
          'A propaganda mostra a parcela. Aqui você vê o total e os juros.',
          `
          <div class="grid sm:grid-cols-2 gap-4">
            ${campo('empValor', 'Valor que você recebe', prefs.empValor || 0)}
            ${campo('empParcela', 'Valor de cada parcela', prefs.empParcela || 0)}
            ${campo('empQuantidade', 'Número de parcelas', prefs.empQuantidade || 0, { prefixo: '' })}
            ${campo('empBeneficio', 'Seu benefício por mês', beneficioInicial)}
          </div>
          <div id="empResultado" class="mt-5"></div>
          `
        )}
        ${cartao('fa-hand-holding-medical', 'Seus gastos com saúde', 'Calculado a partir das suas transações.', corpoSaude)}
      </div>`;

    function calcular() {
      const valor = lerNumero(document.getElementById('empValor'));
      const parcela = lerNumero(document.getElementById('empParcela'));
      const quantidade = Math.floor(lerNumero(document.getElementById('empQuantidade')));
      const beneficio = lerNumero(document.getElementById('empBeneficio'));
      ['empValor', 'empParcela', 'empQuantidade'].forEach((id, i) =>
        Preferencias.salvar(id, [valor, parcela, quantidade][i])
      );
      Preferencias.salvar('beneficio', beneficio);

      const saida = document.getElementById('empResultado');
      if (!valor || !parcela || !quantidade) {
        saida.innerHTML = aviso('info', 'Preencha os dados da oferta de empréstimo que você recebeu.');
        return;
      }
      if (parcela * quantidade < valor) {
        saida.innerHTML = aviso('atencao', 'As parcelas somam menos do que o valor recebido. Confira os números.');
        return;
      }

      const r = custoDoEmprestimo(valor, parcela, quantidade);
      const comprometido = beneficio ? (parcela / beneficio) * 100 : 0;
      const porcento = (n) => (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';

      saida.innerHTML = `
        ${linha('Total que você vai pagar', formatarMoeda(r.totalPago))}
        ${linha('Só de juros', formatarMoeda(r.juros), { cor: 'text-red-500' })}
        ${linha('Taxa de juros', `${porcento(r.taxaMensal)} ao mês (${porcento(r.taxaAnual)} ao ano)`)}
        ${beneficio ? linha('Parte do benefício que fica presa', Math.round(comprometido) + '%', { destaque: true, cor: comprometido > 30 ? 'text-red-500' : 'text-gray-900' }) : ''}
        <div class="mt-4 space-y-3">
          ${aviso(
            'info',
            `Você pega ${formatarMoeda(valor)} e devolve ${formatarMoeda(r.totalPago)}: paga
             ${formatarMoeda(r.juros)} a mais, durante ${quantidade} meses.`
          )}
          ${
            comprometido > 30
              ? aviso(
                  'perigo',
                  'Mais de 30% do benefício preso em parcela deixa pouco para remédios, contas e imprevistos. Pense bem antes de assinar.'
                )
              : ''
          }
        </div>`;
    }

    aoDigitar(['empValor', 'empParcela', 'empQuantidade', 'empBeneficio'], calcular);
    calcular();
  },
};

// =====================================================================
// META SUGERIDA
// =====================================================================

let dadosResumo = null;
let metasExistentes = [];
let perfilAtivo = null;

// Arredonda a meta para cima, de 50 em 50: "R$ 6.350" é mais fácil de
// lembrar (e de comemorar) do que "R$ 6.327,48".
function arredondarMeta(valor) {
  return Math.ceil(valor / 50) * 50;
}

function dataDaqui(meses) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + meses, hoje.getDate());
  return `${chaveDoMes(d)}-${String(d.getDate()).padStart(2, '0')}`;
}

function desenharMeta() {
  const alvo = document.getElementById('metaSugerida');
  if (!alvo) return;

  const regra = CONTEUDO_PERFIS[perfilAtivo].meta;
  if (!regra) {
    alvo.innerHTML = '';
    return;
  }

  // A meta do estudante usa a mesada digitada na ferramenta.
  const prefs = Preferencias.ler();
  const dados = { ...dadosResumo, rendaMensalEstudante: prefs.mesada || dadosResumo.receitaMediaMensal };
  const meta = regra(dados);
  const valor = arredondarMeta(meta.valor);
  const jaExiste = metasExistentes.some((m) => m.titulo === meta.titulo && m.status !== 'cancelada');

  let rodape;
  if (jaExiste) {
    rodape = `<a href="/metas" class="block text-center text-sm font-medium text-blue-600 hover:underline">
                <i class="fa-solid fa-check mr-1"></i> Você já tem esta meta. Ver metas
              </a>`;
  } else if (valor <= 0) {
    rodape = `<p class="text-xs text-gray-500">Registre seus gastos por algumas semanas para receber uma sugestão de valor.</p>`;
  } else {
    rodape = `<button id="botaoCriarMeta" type="button"
                class="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60">
                Criar esta meta
              </button>`;
  }

  alvo.innerHTML = `
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Meta sugerida</p>
      <h4 class="font-bold text-gray-900 mt-2">${meta.titulo}</h4>
      ${valor > 0 ? `<p class="text-2xl font-bold text-gray-900 mt-1">${formatarMoeda(valor)}</p>
      <p class="text-xs text-gray-500">em ${meta.meses} meses · cerca de ${formatarMoeda(valor / meta.meses)} por mês</p>` : ''}
      <p class="text-sm text-gray-600 mt-3 mb-4">${meta.porque}</p>
      ${rodape}
    </div>`;

  const botao = document.getElementById('botaoCriarMeta');
  if (botao) {
    botao.addEventListener('click', async () => {
      botao.disabled = true;
      botao.textContent = 'Criando...';
      try {
        const { ok, dados: resposta } = await chamarApi('/api/meta', {
          method: 'POST',
          body: JSON.stringify({ titulo: meta.titulo, valor_alvo: valor, data_limite: dataDaqui(meta.meses) }),
        });
        if (!ok) {
          mostrarMensagem(resposta.erro || 'Não foi possível criar a meta.', 'erro');
          botao.disabled = false;
          botao.textContent = 'Criar esta meta';
          return;
        }
        metasExistentes.push(resposta);
        mostrarMensagem(`Meta "${meta.titulo}" criada! Acompanhe em Metas.`, 'sucesso');
        desenharMeta();
      } catch (erro) {
        mostrarMensagem('Erro de conexão com o servidor.', 'erro');
        botao.disabled = false;
        botao.textContent = 'Criar esta meta';
      }
    });
  }
}

// =====================================================================
// ABAS E MONTAGEM DA TELA
// =====================================================================

function desenharAbas(perfis) {
  const abas = document.getElementById('abasPerfil');
  abas.innerHTML = perfis
    .map((chave) => {
      const ativa = chave === perfilAtivo;
      return `
        <button type="button" role="tab" aria-selected="${ativa}" data-perfil="${chave}"
                class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition
                       ${ativa ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'}">
          <i class="fa-solid ${PERFIS[chave].icone}"></i> ${PERFIS[chave].nome}
        </button>`;
    })
    .join('');

  abas.querySelectorAll('[data-perfil]').forEach((botao) => {
    botao.addEventListener('click', () => {
      perfilAtivo = botao.dataset.perfil;
      // O endereço guarda a aba (/meu-perfil#autonomo): recarregar a
      // página ou abrir o link do dashboard cai direto na aba certa.
      history.replaceState(null, '', '#' + perfilAtivo);
      esconderMensagem();
      desenharAbas(perfis);
      desenharConteudo();
    });
  });
}

function desenharConteudo() {
  const conteudo = CONTEUDO_PERFIS[perfilAtivo];
  const area = document.getElementById('conteudoPerfil');

  area.innerHTML = `
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
      <h3 class="text-lg font-bold text-gray-900">${conteudo.titulo}</h3>
      <p class="text-sm text-gray-600 mt-2 leading-relaxed">${conteudo.contexto}</p>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <div id="areaFerramenta" class="lg:col-span-2"></div>
      <div class="space-y-6">
        <div id="metaSugerida"></div>
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h4 class="font-bold text-gray-900 mb-4">Bom saber</h4>
          <ul class="space-y-4">
            ${conteudo.dicas
              .map(
                (dica) => `
              <li class="flex gap-3">
                <div class="w-8 h-8 shrink-0 rounded-lg bg-[#f2fbf6] text-green-600 flex items-center justify-center text-sm">
                  <i class="fa-solid ${dica.icone}"></i>
                </div>
                <div>
                  <p class="text-sm font-semibold text-gray-800">${dica.titulo}</p>
                  <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">${dica.texto}</p>
                </div>
              </li>`
              )
              .join('')}
          </ul>
        </div>
      </div>
    </div>`;

  FERRAMENTAS[perfilAtivo](document.getElementById('areaFerramenta'), dadosResumo);
  desenharMeta();
}

async function iniciar() {
  const perfis = PerfisSalvos.ler().filter((chave) => PERFIS[chave]);

  if (perfis.length === 0) {
    document.getElementById('semPerfil').classList.remove('hidden');
    return;
  }

  const id = Sessao.idUsuario();
  if (!id) return; // o layout.js já leva para o login

  try {
    // As três chamadas são independentes, então vão juntas.
    const [contas, transacoes, metas] = await Promise.all([
      chamarApi('/api/usuario/' + id + '/conta'),
      chamarApi('/api/usuario/' + id + '/transacao'),
      chamarApi('/api/usuario/' + id + '/meta'),
    ]);

    if (!contas.ok || !transacoes.ok) {
      mostrarMensagem('Não foi possível carregar seus dados.', 'erro');
      return;
    }

    dadosResumo = resumir(contas.dados, transacoes.dados);
    metasExistentes = metas.ok ? metas.dados : [];
  } catch (erro) {
    mostrarMensagem('Erro de conexão com o servidor.', 'erro');
    return;
  }

  const daUrl = location.hash.slice(1);
  perfilAtivo = perfis.includes(daUrl) ? daUrl : perfis[0];

  document.getElementById('comPerfil').classList.remove('hidden');
  desenharAbas(perfis);
  desenharConteudo();
}

iniciar();
