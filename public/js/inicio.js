// Início: o resumo. Não tem regra própria: lê as mesmas APIs das outras
// telas e apresenta os números de um jeito que se entende de relance.
//
// A ordem da tela segue a ordem das perguntas que a pessoa faz:
//   1. Quanto eu tenho?          -> saldo de hoje
//   2. Como está o meu mês?      -> entrou − saiu = sobrou
//   3. O que vem pela frente?    -> o caminho do mês e as contas a pagar
//   4. Para onde foi o dinheiro? -> gastos por categoria
//   5. E os meus planos?         -> metas

const el = (id) => document.getElementById(id);

const agora = new Date();
const MES_ATUAL = hojeTexto().slice(0, 7); // "2026-11"
const DIAS_NO_MES = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();

el('dataDeHoje').textContent =
  agora.toLocaleDateString('pt-BR', { weekday: 'long' }).replace(/^./, (l) => l.toUpperCase()) +
  ', ' + diaPorExtenso(hojeTexto());
el('nomeMes').textContent = MESES[agora.getMonth()];

const dataDe = (t) => String(t.data_transacao).slice(0, 10);
const tituloDe = (t) => t.descricao || t.categoria.nome_categoria;
const somar = (lista) => lista.reduce((total, t) => total + Number(t.valor_transacao), 0);

// Gasto ainda não pago: pendente (vence hoje ou depois) ou atrasado.
function aPagar(t) {
  const situacao = statusTransacao(t);
  return situacao === 'pendente' || situacao === 'atrasado';
}

// ---- 1. SALDO ----

function mostrarSaldo(contas) {
  const total = contas.reduce((soma, c) => soma + Number(c.saldo), 0);
  const previsto = contas.reduce((soma, c) => soma + Number(c.saldo_previsto), 0);

  const valor = el('saldoHoje');
  valor.textContent = formatarMoeda(total);
  // Valor muito grande não quebra a linha: a letra diminui até caber.
  caberNaLargura(valor, 22);

  // Saldo previsto = o que sobra depois de pagar o que falta (src/saldo.js).
  // Só aparece quando é diferente do saldo de hoje.
  el('saldoLegenda').textContent =
    contas.length === 0
      ? 'Você ainda não tem nenhuma conta.'
      : previsto !== total
        ? `Depois de pagar o que falta, ficam ${formatarMoeda(previsto)}.`
        : total < 0
          ? 'Seu saldo está negativo.'
          : 'Nenhuma conta esperando pagamento.';

  el('saldoContas').innerHTML = contas
    .slice(0, 4)
    .map((c) => `<span class="capsula"><i class="fa-solid ${c.id_conexao ? 'fa-building-columns' : 'fa-wallet'}" aria-hidden="true"></i> ${esc(c.nome)} <strong>${formatarMoeda(c.saldo)}</strong></span>`)
    .join('');
}

// ---- 2. A CONTA DO MÊS ----

function mostrarMes(doMes) {
  // Transferência entre contas não é ganho (ehGanho, em auth.js).
  const entrou = somar(doMes.filter(ehGanho));
  // Só gastos de verdade: dinheiro guardado em meta continua sendo da pessoa
  // (ehGasto, em auth.js).
  const saiu = somar(doMes.filter(ehGasto));
  const aindaAPagar = somar(doMes.filter(ehGasto).filter(aPagar));
  const guardado = somar(doMes.filter(ehDinheiroGuardado));
  const sobra = entrou - saiu;

  el('mesEntrou').textContent = formatarMoeda(entrou);
  el('mesSaiu').textContent = formatarMoeda(saiu);
  el('mesAPagar').textContent = aindaAPagar > 0 ? `${formatarMoeda(aindaAPagar)} ainda a pagar` : '';

  el('mesRotuloSobra').textContent = sobra < 0 ? 'Faltou' : 'Sobrou';
  el('mesSobrou').textContent = formatarMoeda(Math.abs(sobra));
  el('mesSobrou').classList.toggle('alerta-texto', sobra < 0);
  el('mesGuardado').textContent = guardado > 0 ? `Além disso, você guardou ${formatarMoeda(guardado)} em metas neste mês.` : '';
  el('mesGuardado').hidden = guardado === 0;
}

// ---- 3. O CAMINHO DO MÊS ----
//
// Um quadradinho para cada dia do mês. Os dias que já passaram ficam
// cheios, os que faltam ficam vazios, e o de hoje tem o "Você está aqui".
//
// Um dia com conta a pagar (ou ganho previsto) ganha cor: vermelho se tem
// gasto, verde se tem ganho, metade de cada se tem os dois. Os registros NÃO
// aparecem de cara (com vários no mesmo dia, ou em dias vizinhos, eles
// ficavam um em cima do outro): clicar no dia abre, acima dele, a lista com
// todos os registros daquele dia. Só uma lista fica aberta por vez.

// Cor do quadradinho: o que sai é vermelho, o que entra é verde.
function corDoDia(lista) {
  const temGasto = lista.some((t) => t.categoria.tipo === 'despesa');
  const temGanho = lista.some((t) => t.categoria.tipo === 'receita');
  if (temGasto && temGanho) return 'dia--os-dois';
  return temGasto ? 'dia--gasto' : 'dia--ganho';
}

// A lista que abre acima do dia: um registro embaixo do outro.
function balaoDoDia(chave, lista) {
  const titulo = chave === 'antes' ? 'Atrasadas de meses anteriores' : `Dia ${Number(chave)} de ${MESES[agora.getMonth()]}`;
  const itens = lista
    .map((t) => {
      const situacao = statusTransacao(t);
      const ganho = t.categoria.tipo === 'receita';
      return `
        <li>
          <a class="balao__item" href="/transacoes?situacao=${situacao === 'previsto' ? 'todos' : situacao}">
            ${iconeDaCategoria(t.categoria, 'icone--p')}
            <span class="balao__texto">
              <strong>${esc(tituloDe(t))}</strong>
              <small>${esc(t.categoria.nome_categoria)}${chave === 'antes' ? ' · ' + formatarData(t.data_transacao) : ''}</small>
            </span>
            <span class="balao__valor">
              <span class="numero ${ganho ? 'verde' : ''}">${formatarMoeda(ganho ? t.valor_transacao : -t.valor_transacao, { sinal: true })}</span>
              ${etiquetaDaSituacao(situacao)}
            </span>
          </a>
        </li>`;
    })
    .join('');

  return `
    <div class="balao" id="balaoDia" role="region" aria-label="${esc(titulo)}">
      <div class="balao__topo">
        <strong>${titulo}</strong>
        <button type="button" class="botao-icone botao-icone--p" data-fechar-balao aria-label="Fechar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      <ul class="balao__lista">${itens}</ul>
      <span class="balao__ponta" aria-hidden="true"></span>
    </div>`;
}

// Registros agrupados por dia: "05" -> [...], e "antes" para as contas
// atrasadas de meses anteriores. Fica aqui fora para o clique encontrar.
let registrosPorDia = new Map();
let diaAberto = null;

function fecharBalao() {
  const caminho = el('caminho');
  caminho.querySelector('.balao')?.remove();
  caminho.querySelectorAll('[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  diaAberto = null;
}

function abrirBalao(botao) {
  const chave = botao.dataset.dia;
  // Clicar de novo no dia aberto fecha a lista.
  if (diaAberto === chave) return fecharBalao();

  // Outro dia estava aberto: fecha primeiro, depois abre o novo.
  fecharBalao();
  diaAberto = chave;
  botao.setAttribute('aria-expanded', 'true');

  const caminho = el('caminho');
  caminho.insertAdjacentHTML('beforeend', balaoDoDia(chave, registrosPorDia.get(chave)));
  const balao = caminho.querySelector('.balao');

  // Centraliza a lista em cima do dia, sem deixar passar das bordas do cartão.
  const area = caminho.getBoundingClientRect();
  const dia = botao.getBoundingClientRect();
  const centro = dia.left - area.left + dia.width / 2;
  const esquerda = Math.min(Math.max(0, centro - balao.offsetWidth / 2), area.width - balao.offsetWidth);
  balao.style.left = esquerda + 'px';
  balao.style.bottom = area.bottom - dia.top + 12 + 'px';
  // A pontinha do balão aponta sempre para o dia clicado.
  balao.querySelector('.balao__ponta').style.left = centro - esquerda + 'px';
}

el('caminho').addEventListener('click', (evento) => {
  if (evento.target.closest('[data-fechar-balao]')) return fecharBalao();
  const dia = evento.target.closest('[data-dia]');
  if (dia) abrirBalao(dia);
});

// Clique fora do caminho ou Esc fecham a lista aberta.
document.addEventListener('click', (evento) => {
  if (diaAberto && !evento.target.closest('#caminho')) fecharBalao();
});
document.addEventListener('keydown', (evento) => {
  if (evento.key !== 'Escape' || !diaAberto || document.querySelector('dialog[open]')) return;
  const botao = el('caminho').querySelector(`[data-dia="${diaAberto}"]`);
  fecharBalao();
  if (botao) botao.focus();
});
window.addEventListener('resize', fecharBalao);

function mostrarCaminho(transacoes) {
  const hoje = agora.getDate();

  // O que ainda vai acontecer neste mês, ou já devia ter acontecido.
  const pontos = transacoes
    .filter((t) => {
      const situacao = statusTransacao(t);
      if (situacao === 'atrasado') return true; // de qualquer mês
      return (situacao === 'pendente' || situacao === 'previsto') && dataDe(t).slice(0, 7) === MES_ATUAL;
    })
    .sort((a, b) => dataDe(a).localeCompare(dataDe(b)));

  const atrasadas = pontos.filter((t) => statusTransacao(t) === 'atrasado').length;
  const faltam = DIAS_NO_MES - hoje;

  el('caminhoResumo').textContent =
    `Dia ${hoje} de ${DIAS_NO_MES}. ` +
    (faltam === 0 ? 'Hoje é o último dia do mês.' : `${faltam === 1 ? 'Falta 1 dia' : `Faltam ${faltam} dias`} para o mês acabar.`) +
    (pontos.length === 0 ? ' Nada marcado até lá.' : '');

  const cor = (t) => ({ atrasado: 'coral', pendente: 'sol', previsto: 'folha' })[statusTransacao(t)];

  // Agrupa por dia. Atrasada de outro mês vai para o "antes", que fica
  // antes do dia 1.
  registrosPorDia = new Map();
  pontos.forEach((t) => {
    const chave = dataDe(t).slice(0, 7) === MES_ATUAL ? dataDe(t).slice(8) : 'antes';
    if (!registrosPorDia.has(chave)) registrosPorDia.set(chave, []);
    registrosPorDia.get(chave).push(t);
  });

  // Um quadradinho por dia. Só os dias com registro são botões.
  const quadrado = (chave, rotulo, classes, descricao) => {
    const lista = registrosPorDia.get(chave);
    if (!lista) return `<span class="dia ${classes}" aria-hidden="true">${rotulo}</span>`;

    const quantos = plural(lista.length, 'registro', 'registros');
    return `
      <button type="button" class="dia ${classes} ${corDoDia(lista)}" data-dia="${chave}"
              aria-expanded="false" aria-controls="balaoDia" aria-label="${descricao}: ${quantos}" title="${quantos}">
        ${rotulo}
        ${lista.length > 1 ? `<span class="dia__conta" aria-hidden="true">${lista.length}</span>` : ''}
      </button>`;
  };

  const dias = [];
  if (registrosPorDia.has('antes')) {
    dias.push(quadrado('antes', '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>', 'dia--antes', 'Contas atrasadas de meses anteriores'));
  }
  for (let d = 1; d <= DIAS_NO_MES; d++) {
    const chave = String(d).padStart(2, '0');
    const tempo = d < hoje ? 'dia--passou' : d === hoje ? 'dia--hoje' : '';
    dias.push(quadrado(chave, d, tempo, `Dia ${d}${d === hoje ? ' (hoje)' : ''}`));
  }

  // O rótulo "Você está aqui" fica embaixo do dia de hoje, sem passar das
  // bordas. Com o quadradinho "antes", todos os dias andam uma casa.
  const casas = dias.length;
  const casaDeHoje = hoje - 1 + (casas - DIAS_NO_MES);
  const xHoje = ((casaDeHoje + 0.5) / casas) * 100;

  fecharBalao();
  el('caminho').innerHTML = `
    <div class="caminho__dias" style="--casas:${casas}">${dias.join('')}</div>
    <div class="caminho__pe">
      <span class="caminho__hoje-rotulo" style="left:${Math.min(88, Math.max(12, xHoje))}%"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> Você está aqui · dia ${hoje}</span>
    </div>
    <ul class="caminho__legenda" aria-label="Legenda">
      <li><span class="dia dia--gasto" aria-hidden="true"></span> Gasto a pagar</li>
      <li><span class="dia dia--ganho" aria-hidden="true"></span> Ganho previsto</li>
      <li><span class="dia dia--passou" aria-hidden="true"></span> Dias que já passaram</li>
      ${pontos.length ? '<li class="fraco">Clique num dia colorido para ver o que tem nele.</li>' : ''}
    </ul>`;

  // A mesma informação em lista: é o que o celular e o leitor de tela usam.
  el('caminhoLista').innerHTML = pontos.length
    ? pontos
        .slice(0, 6)
        .map((t) => {
          const situacao = statusTransacao(t);
          const quando = situacao === 'previsto' ? `entra dia ${Number(dataDe(t).slice(8))}` : textoPrazo(t.data_transacao);
          return `<li class="fila fila--entre"><span><span class="capsula capsula--${cor(t)}">${quando}</span> ${esc(tituloDe(t))}</span><strong class="numero">${formatarMoeda(t.valor_transacao)}</strong></li>`;
        })
        .join('')
    : '<li class="suave">Nenhuma conta para vencer até o fim do mês.</li>';

  if (atrasadas > 0) {
    el('caminhoResumo').innerHTML += ` <span class="capsula capsula--coral">${plural(atrasadas, 'conta atrasada', 'contas atrasadas')}</span>`;
  }
}

// ---- CONTAS A PAGAR ----

function mostrarAPagar(transacoes) {
  // Primeiro o que vence primeiro: as atrasadas ficam no topo.
  const pendentes = transacoes.filter(aPagar).sort((a, b) => dataDe(a).localeCompare(dataDe(b)));
  const lista = el('aPagarLista');

  if (pendentes.length === 0) {
    el('aPagarResumo').textContent = 'Tudo em dia';
    lista.innerHTML = '<li class="vazio"><p>Nenhuma conta esperando pagamento.</p></li>';
    return;
  }

  el('aPagarResumo').textContent = `${plural(pendentes.length, 'conta', 'contas')} · ${formatarMoeda(somar(pendentes))} no total`;

  lista.innerHTML = pendentes
    .slice(0, 4)
    .map((t) => {
      const atrasada = statusTransacao(t) === 'atrasado';
      // Conta importada: quem diz o que foi pago é o banco.
      const podePagar = !t.conta.id_conexao;
      return `
        <li class="mov">
          <div class="mov__linha mov__linha--acao">
            ${iconeDaCategoria(t.categoria)}
            <span class="mov__texto">
              <strong>${esc(tituloDe(t))}</strong>
              <small class="${atrasada ? 'alerta-texto' : ''}">${atrasada ? '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ' : ''}${textoPrazo(t.data_transacao)} · ${formatarData(t.data_transacao)}</small>
            </span>
            <span class="mov__valor">${formatarMoeda(t.valor_transacao)}</span>
            ${podePagar ? `<button type="button" class="botao botao--linha botao--p" data-pagar="${t.id_transacao}"><i class="fa-solid fa-check" aria-hidden="true"></i> Paguei</button>` : ''}
          </div>
        </li>`;
    })
    .join('');

  lista.querySelectorAll('[data-pagar]').forEach((botao) => {
    botao.addEventListener('click', async () => {
      const t = pendentes.find((x) => x.id_transacao === Number(botao.dataset.pagar));
      const soltar = ocupar(botao);
      const { ok, dados } = await chamarApi(`/api/transacao/${t.id_transacao}/pagamento`, {
        method: 'PATCH',
        body: JSON.stringify({ pago: true }),
      });
      if (!ok) {
        soltar();
        return avisar(dados.erro || 'Não foi possível marcar como paga.', 'erro');
      }
      avisar(`"${tituloDe(t)}" paga. ${formatarMoeda(t.valor_transacao)} saíram de "${t.conta.nome}".`);
      anunciarMudanca();
    });
  });
}

// ---- 4. PARA ONDE FOI ----

const BARRA_DO_LIMITE = { ok: '', atencao: 'barra--sol', estourado: 'barra--coral' };

function mostrarCategorias(doMes, limites) {
  const gastos = doMes.filter(ehGasto);
  const caixa = el('categorias');

  if (gastos.length === 0) {
    caixa.innerHTML = '<div class="vazio"><p>Nenhum gasto registrado neste mês.</p><button type="button" class="botao botao--linha" data-registrar="despesa">Registrar um gasto</button></div>';
    return;
  }

  // A chave é o id, e não o nome: uma categoria criada pela pessoa pode ter
  // o mesmo nome que outra, e é o id que liga a categoria ao limite dela.
  const porCategoria = new Map();
  gastos.forEach((t) => {
    const atual = porCategoria.get(t.categoria.id_categoria) || { categoria: t.categoria, valor: 0 };
    atual.valor += Number(t.valor_transacao);
    porCategoria.set(t.categoria.id_categoria, atual);
  });

  const total = somar(gastos);
  const maiores = [...porCategoria.values()].sort((a, b) => b.valor - a.valor).slice(0, 5);
  const limiteDe = new Map(limites.map((l) => [l.id_categoria, l]));
  // A que mais pesou e ainda não tem limite ganha o convite para criar um.
  const sugerida = maiores.find((c) => !limiteDe.has(c.categoria.id_categoria));

  caixa.innerHTML = maiores
    .map((c) => {
      const limite = limiteDe.get(c.categoria.id_categoria);
      const nome = esc(c.categoria.nome_categoria);

      // Com limite, a barra mede quanto do LIMITE já foi usado. A situação
      // (ok, atenção, estourado) já vem calculada do servidor.
      if (limite) {
        const pct = Math.round(limite.percentual);
        return `
          <div class="cat">
            <div class="cat__topo"><span>${nome}</span><span class="numero">${formatarMoeda(limite.gasto_mes)}</span></div>
            <div class="barra ${BARRA_DO_LIMITE[limite.situacao]}" role="img" aria-label="${pct}% do limite"><span style="width:${Math.min(100, pct)}%"></span></div>
            <small>${pct}% do limite de ${formatarMoeda(limite.valor_limite)}${limite.situacao === 'estourado' ? ' · <strong class="alerta-texto">passou do limite</strong>' : ''}</small>
          </div>`;
      }

      const pct = Math.round((c.valor / total) * 100);
      return `
        <div class="cat">
          <div class="cat__topo"><span>${nome}</span><span class="numero">${formatarMoeda(c.valor)}</span></div>
          <div class="barra" role="img" aria-label="${pct}% dos gastos do mês"><span style="width:${pct}%"></span></div>
          <small>${pct}% dos gastos do mês${c === sugerida ? ` · <a href="/metas?limite=${c.categoria.id_categoria}">Definir um limite</a>` : ''}</small>
        </div>`;
    })
    .join('');
}

// ---- 5. METAS ----

function mostrarMetas(metas) {
  const ativas = metas.filter((m) => m.status === 'em_progresso');
  const caixa = el('metas');

  if (ativas.length === 0) {
    caixa.innerHTML = `<div class="vazio"><p>Uma meta ajuda a guardar dinheiro com um objetivo: uma viagem, uma reserva, um presente.</p><a class="botao botao--linha" href="/metas?nova=meta">Criar uma meta</a></div>`;
    return;
  }

  caixa.innerHTML = ativas
    .slice(0, 3)
    .map((m) => {
      const pct = Math.min(100, Math.round(m.progresso));
      return `
        <div class="cat">
          <div class="cat__topo"><span>${esc(m.titulo)}</span><span class="numero">${pct}%</span></div>
          <div class="barra barra--ceu" role="img" aria-label="${pct}% guardado"><span style="width:${pct}%"></span></div>
          <small>${formatarMoeda(m.valor_atual)} de ${formatarMoeda(m.valor_alvo)} · até ${formatarData(m.data_limite)}</small>
        </div>`;
    })
    .join('');
}

// ---- ÚLTIMAS TRANSAÇÕES ----

function mostrarUltimas(transacoes) {
  const lista = el('ultimas');

  if (transacoes.length === 0) {
    lista.innerHTML = '<li class="vazio"><p>Nada registrado ainda. Comece anotando um gasto ou um ganho.</p><button type="button" class="botao" data-registrar="despesa">Registrar agora</button></li>';
    return;
  }

  lista.innerHTML = transacoes
    .slice(0, 5)
    .map((t) => {
      const ganho = t.categoria.tipo === 'receita';
      return `
        <li class="mov">
          <div class="mov__linha mov__linha--simples">
            ${iconeDaCategoria(t.categoria)}
            <span class="mov__texto">
              <strong>${esc(tituloDe(t))}</strong>
              <small>${esc(t.categoria.nome_categoria)} · ${formatarData(t.data_transacao)} ${etiquetaDaSituacao(statusTransacao(t))}</small>
            </span>
            <span class="mov__valor ${ganho ? 'mov__valor--entrou' : ''}">${formatarMoeda(ganho ? t.valor_transacao : -t.valor_transacao, { sinal: true })}</span>
          </div>
        </li>`;
    })
    .join('');
}

// ---- DICA DO DIA ----
//
// Quem já escolheu um perfil recebe uma dica dele, que muda a cada dia.
// Quem não escolheu vê o convite para a pesquisa (o texto que já está no HTML).
function mostrarDica() {
  const perfis = PerfisSalvos.ler().filter((chave) => PERFIS[chave]);
  if (perfis.length === 0) return;

  const todas = perfis.flatMap((chave) => CONTEUDO_PERFIS[chave].dicas.map((dica) => ({ chave, dica })));
  const { chave, dica } = todas[agora.getDate() % todas.length];

  el('dicaTitulo').textContent = dica.titulo;
  el('dicaTexto').textContent = dica.texto;
  el('dicaLink').href = `/meu-perfil#${chave}`;
  el('dicaLink').textContent = `Ferramentas de ${PERFIS[chave].nome}`;
}

// ---- BUSCAR E MOSTRAR ----

async function carregar() {
  // As quatro chamadas não dependem uma da outra: vão juntas.
  const [contas, transacoes, metas, limites] = await Promise.all([
    chamarApi(`/api/usuario/${ID_USUARIO}/conta`),
    chamarApi(`/api/usuario/${ID_USUARIO}/transacao`),
    chamarApi(`/api/usuario/${ID_USUARIO}/meta`),
    chamarApi(`/api/usuario/${ID_USUARIO}/limite`),
  ]);

  if (contas.ok) mostrarSaldo(contas.dados);

  if (transacoes.ok) {
    const doMes = transacoes.dados.filter((t) => dataDe(t).slice(0, 7) === MES_ATUAL);
    mostrarMes(doMes);
    mostrarCaminho(transacoes.dados);
    mostrarAPagar(transacoes.dados);
    mostrarCategorias(doMes, limites.ok ? limites.dados : []);
    mostrarUltimas(transacoes.dados);
  }

  if (metas.ok) mostrarMetas(metas.dados);

  if (!contas.ok || !transacoes.ok) avisar('Não foi possível carregar seus dados. Confira sua conexão.', 'erro');
}

mostrarDica();
carregar();

// Recado deixado por outra tela antes de trazer a pessoa para cá (o
// "Resetar dados" de Configurações, por exemplo). Aparece uma vez só.
(function () {
  const texto = sessionStorage.getItem('recado_inicio');
  if (!texto) return;
  sessionStorage.removeItem('recado_inicio');
  avisar(texto);
})();

// Registrou um gasto, pagou uma conta: os números são buscados de novo.
document.addEventListener('verdanz:mudou', carregar);
window.addEventListener('resize', () => caberNaLargura(el('saldoHoje'), 22));
