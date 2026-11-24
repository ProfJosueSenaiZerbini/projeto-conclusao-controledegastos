// Contas: os lugares onde o dinheiro está, e a conexão com o banco.
//
// Dois tipos de conta, com regras diferentes (decididas no servidor):
//   - MANUAL: a pessoa cria, renomeia, corrige o saldo e exclui.
//   - IMPORTADA do banco: só muda pela sincronização. Para tirar, é
//     preciso desconectar o banco.

const el = (id) => document.getElementById(id);

let contas = [];

// ---- CONTAS ----

function cartaoDaConta(conta) {
  const importada = Boolean(conta.id_conexao);
  const negativo = Number(conta.saldo) < 0;

  const acoes = importada
    ? `<span class="capsula capsula--ceu"><i class="fa-solid fa-building-columns" aria-hidden="true"></i> ${esc(conta.conexao?.banco || 'Banco')}</span>`
    : `<div class="fila" style="gap:.125rem">
         <button type="button" class="botao-icone" data-editar="${conta.id_conta}" aria-label="Editar a conta ${esc(conta.nome)}" title="Editar"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
         <button type="button" class="botao-icone" data-excluir="${conta.id_conta}" aria-label="Excluir a conta ${esc(conta.nome)}" title="Excluir"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
         <button type="button" class="botao-icone" data-transferir="${conta.id_conta}" aria-label="Transferir dinheiro da conta ${esc(conta.nome)}" title="Transferir para outra conta"><i class="fa-solid fa-right-left" aria-hidden="true"></i></button>
       </div>`;

  // O previsto só aparece quando é diferente do saldo de hoje.
  const previsto =
    Number(conta.saldo_previsto) !== Number(conta.saldo)
      ? `<p class="suave pequeno">Depois de pagar o que falta: ${formatarMoeda(conta.saldo_previsto)}</p>`
      : '';

  return `
    <article class="cartao conta">
      <div class="conta__topo">
        <span class="icone ${importada ? 'icone--ceu' : 'icone--folha'}" aria-hidden="true"><i class="fa-solid ${importada ? 'fa-building-columns' : 'fa-wallet'}"></i></span>
        ${acoes}
      </div>
      <h3>${esc(conta.nome)}</h3>
      <p class="numero ${negativo ? 'alerta-texto' : ''}">${formatarMoeda(conta.saldo)}</p>
      ${previsto}
      ${importada ? '<p class="fraco pequeno">Atualizada pelo banco.</p>' : ''}
    </article>`;
}

const BOTAO_NOVA_CONTA = `
  <button type="button" class="novo" id="novaConta">
    <span class="icone" aria-hidden="true"><i class="fa-solid fa-plus"></i></span>
    Nova conta
  </button>`;

async function carregarContas() {
  const { ok, dados } = await chamarApi(`/api/usuario/${ID_USUARIO}/conta`);

  if (!ok) {
    avisar(dados.erro || 'Não foi possível carregar suas contas.', 'erro');
    return;
  }

  contas = dados;

  const total = contas.reduce((soma, c) => soma + Number(c.saldo), 0);
  const previsto = contas.reduce((soma, c) => soma + Number(c.saldo_previsto), 0);
  el('totalGeral').textContent = formatarMoeda(total);
  caberNaLargura(el('totalGeral'), 22);
  el('totalLegenda').textContent =
    plural(contas.length, 'conta', 'contas') +
    (previsto !== total ? ` · depois de pagar o que falta, ficam ${formatarMoeda(previsto)}` : '');

  el('listaContas').innerHTML = contas.map(cartaoDaConta).join('') + BOTAO_NOVA_CONTA;
}

el('listaContas').addEventListener('click', (evento) => {
  if (evento.target.closest('#novaConta')) return abrirFolhaConta(null);

  const editar = evento.target.closest('[data-editar]');
  if (editar) return abrirFolhaConta(contas.find((c) => c.id_conta === Number(editar.dataset.editar)));

  const excluir = evento.target.closest('[data-excluir]');
  if (excluir) return excluirConta(contas.find((c) => c.id_conta === Number(excluir.dataset.excluir)));

  const transferir = evento.target.closest('[data-transferir]');
  if (transferir) abrirTransferencia(Number(transferir.dataset.transferir));
});

// ---- TRANSFERIR ENTRE CONTAS ----
//
// Só entre contas MANUAIS: o Verdanz não consegue mexer no dinheiro de
// verdade de um banco conectado. No servidor, a transferência vira uma
// saída na origem e uma entrada no destino (contaController.js), e as duas
// ficam fora das somas de ganhos e gastos.

const contasManuais = () => contas.filter((c) => !c.id_conexao);
const opcaoDaConta = (c) => `<option value="${c.id_conta}">${esc(c.nome)} · ${formatarMoeda(c.saldo)}</option>`;

async function abrirTransferencia(idOrigem) {
  const manuais = contasManuais();

  if (manuais.length < 2) {
    const criar = await confirmar({
      titulo: 'Você precisa de outra conta',
      mensagem: 'Para transferir, é preciso ter pelo menos duas contas criadas por você (bancos conectados não entram). Crie a conta que vai receber o dinheiro.',
      textoConfirmar: 'Criar uma conta',
      perigo: false,
    });
    if (criar) abrirFolhaConta(null);
    return;
  }

  el('formTransferir').reset();
  erroNoCampo(el('transValor'), '');
  erroNoCampo(el('transDestino'), '');

  el('transOrigem').innerHTML = manuais.map(opcaoDaConta).join('');
  el('transOrigem').value = idOrigem;
  preencherDestino();

  abrirJanela(el('folhaTransferir'));
  el('transValor').focus();
}

// O destino é qualquer conta manual MENOS a de origem.
function preencherDestino() {
  const idOrigem = Number(el('transOrigem').value);
  const anterior = Number(el('transDestino').value);
  const outras = contasManuais().filter((c) => c.id_conta !== idOrigem);

  el('transDestino').innerHTML = outras.map(opcaoDaConta).join('');
  if (outras.some((c) => c.id_conta === anterior)) el('transDestino').value = anterior;

  const origem = contas.find((c) => c.id_conta === idOrigem);
  el('transValorAjuda').textContent = `Disponível hoje em "${origem.nome}": ${formatarMoeda(origem.saldo)}.`;
}

el('transOrigem').addEventListener('change', preencherDestino);

el('formTransferir').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const campoValor = el('transValor');
  const valor = lerValor(campoValor);
  const origem = contas.find((c) => c.id_conta === Number(el('transOrigem').value));
  const destino = contas.find((c) => c.id_conta === Number(el('transDestino').value));

  if (!valor) {
    erroNoCampo(campoValor, 'Digite um valor maior que zero, como 100,00.');
    return campoValor.focus();
  }

  // Transferir é mover dinheiro que existe: o servidor confere de novo.
  if (Math.round(valor * 100) > Math.round(Number(origem.saldo) * 100)) {
    erroNoCampo(campoValor, `"${origem.nome}" tem ${formatarMoeda(origem.saldo)} hoje. Escolha um valor menor ou outra conta.`);
    return campoValor.focus();
  }
  erroNoCampo(campoValor, '');

  const soltar = ocupar(el('salvarTransferencia'), 'Transferindo...');
  const { ok, dados } = await chamarApi('/api/conta/transferencia', {
    method: 'POST',
    body: JSON.stringify({ id_origem: origem.id_conta, id_destino: destino.id_conta, valor }),
  });
  soltar();

  if (!ok) return erroNoCampo(campoValor, dados.erro || 'Não foi possível transferir.');

  el('folhaTransferir').close();
  avisar(`${formatarMoeda(valor)} transferidos de "${origem.nome}" para "${destino.nome}".`);
  anunciarMudanca();
});

// conta = null -> criar; conta = {...} -> editar
function abrirFolhaConta(conta) {
  el('formConta').reset();
  erroNoCampo(el('nomeConta'), '');
  erroNoCampo(el('saldoConta'), '');

  el('idConta').value = conta ? conta.id_conta : '';
  el('tituloFolhaConta').textContent = conta ? 'Editar conta' : 'Nova conta';
  el('salvarConta').textContent = conta ? 'Salvar' : 'Criar conta';

  if (conta) {
    el('nomeConta').value = conta.nome;
    // Ao editar, a pessoa informa o saldo DE HOJE. O servidor soma de volta
    // os ganhos com data futura antes de gravar (ver src/saldo.js).
    el('saldoConta').value = (Number(conta.saldo) < 0 ? '-' : '') + valorNoCampo(Math.abs(conta.saldo));
  }

  abrirJanela(el('folhaConta'));
  el('nomeConta').focus();
}

el('formConta').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const nome = el('nomeConta').value.trim();
  const saldo = lerSaldo(el('saldoConta'));

  erroNoCampo(el('nomeConta'), nome ? '' : 'Dê um nome para a conta.');
  erroNoCampo(el('saldoConta'), saldo === null ? 'Use só números, como 1.500,50.' : '');
  if (!nome) return el('nomeConta').focus();
  if (saldo === null) return el('saldoConta').focus();

  const id = el('idConta').value;
  const soltar = ocupar(el('salvarConta'), 'Salvando...');
  const { ok, dados } = await chamarApi(id ? '/api/conta/' + id : '/api/conta', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify({ nome, saldo }),
  });
  soltar();

  if (!ok) return avisar(dados.erro || 'Não foi possível salvar a conta.', 'erro');

  el('folhaConta').close();
  avisar(id ? 'Conta atualizada.' : `Conta "${nome}" criada.`);
  anunciarMudanca();
});

async function excluirConta(conta) {
  const sim = await confirmar({
    titulo: `Excluir a conta "${conta.nome}"?`,
    mensagem: 'Essa ação não pode ser desfeita.',
    aviso: 'Todas as transações dessa conta serão apagadas junto.',
    textoConfirmar: 'Excluir conta',
  });
  if (!sim) return;

  const { ok, dados } = await chamarApi('/api/conta/' + conta.id_conta, { method: 'DELETE' });
  if (!ok) return avisar(dados.erro || 'Não foi possível excluir a conta.', 'erro');

  avisar(`Conta "${conta.nome}" excluída.`);
  anunciarMudanca();
}

// ---- BANCOS CONECTADOS ----
//
// O banco é simulado, mas o caminho imita o Open Finance de verdade:
//   1. o Verdanz pede o consentimento e recebe o endereço da tela do banco;
//   2. a pessoa autoriza lá e volta para cá com um código na URL;
//   3. o servidor troca o código pelo acesso e importa as contas.
// O acesso (token) nunca passa pelo navegador.

function dataEHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function mostrarResumo(resumo, primeiraVez) {
  let texto;
  if (primeiraVez) {
    texto = `Banco conectado! ${plural(resumo.contas.length, 'conta', 'contas')} e ${plural(resumo.transacoes_novas, 'transação importada', 'transações importadas')}.`;
  } else if (resumo.transacoes_novas === 0) {
    texto = 'Tudo em dia: nenhuma transação nova no banco.';
  } else {
    texto = `${plural(resumo.transacoes_novas, 'transação nova importada', 'transações novas importadas')}.`;
  }

  if (!resumo.saldos_conferem) {
    return avisar(texto + ' Atenção: o saldo de alguma conta não bateu com o informado pelo banco.', 'erro');
  }
  avisar(texto);
}

function cartaoDaConexao(conexao) {
  const situacao = conexao.expirada
    ? '<span class="capsula capsula--coral">Autorização vencida</span>'
    : '<span class="capsula capsula--folha"><i class="fa-solid fa-check" aria-hidden="true"></i> Conectado</span>';

  const sincronizacao = conexao.ultima_sincronizacao
    ? 'Atualizado em ' + dataEHora(conexao.ultima_sincronizacao)
    : 'Ainda não atualizado';

  const principal = conexao.expirada
    ? '<button type="button" class="botao botao--p" data-conectar>Conectar de novo</button>'
    : `<button type="button" class="botao botao--p" data-sincronizar="${conexao.id_conexao}"><i class="fa-solid fa-rotate" aria-hidden="true"></i> Atualizar agora</button>`;

  return `
    <article class="cartao fila fila--entre">
      <div class="cartao__titulo">
        <span class="icone icone--ceu" aria-hidden="true"><i class="fa-solid fa-building-columns"></i></span>
        <div>
          <h3 class="fila" style="gap:.5rem">${esc(conexao.banco)} ${situacao}</h3>
          <p class="suave pequeno">${plural(conexao._count.contas, 'conta importada', 'contas importadas')} · ${sincronizacao}</p>
          <p class="fraco pequeno">Autorização válida até ${formatarData(conexao.acesso_expira_em)}</p>
        </div>
      </div>
      <div class="fila">
        ${principal}
        <button type="button" class="botao botao--quieto botao--p" data-desconectar="${conexao.id_conexao}">Desconectar</button>
      </div>
    </article>`;
}

let conexoes = [];

async function carregarConexoes() {
  const { ok, dados } = await chamarApi('/api/conexao-bancaria');
  conexoes = ok ? dados : [];

  el('listaConexoes').innerHTML = conexoes.length
    ? conexoes.map(cartaoDaConexao).join('')
    : `<div class="cartao fila fila--entre">
         <div class="cartao__titulo">
           <span class="icone icone--ceu" aria-hidden="true"><i class="fa-solid fa-building-columns"></i></span>
           <p class="suave">Nenhum banco conectado ainda. Você autoriza no site do banco e pode desconectar quando quiser.</p>
         </div>
         <button type="button" class="botao botao--linha" data-conectar><i class="fa-solid fa-link" aria-hidden="true"></i> Conectar um banco</button>
       </div>`;
}

async function conectarBanco(botao) {
  const soltar = ocupar(botao, 'Abrindo o banco...');
  // "retorno" diz ao servidor para qual tela o banco deve devolver a pessoa.
  const { ok, dados } = await chamarApi('/api/conexao-bancaria', {
    method: 'POST',
    body: JSON.stringify({ retorno: RAIZ + '/contas' }),
  });

  if (!ok) {
    soltar();
    return avisar(dados.erro || 'Não foi possível conectar ao banco.', 'erro');
  }

  // Sai do Verdanz e vai para a tela de autorização do banco.
  window.location.href = dados.url;
}

async function sincronizar(botao) {
  const soltar = ocupar(botao, 'Atualizando...');
  const { ok, dados } = await chamarApi(`/api/conexao-bancaria/${botao.dataset.sincronizar}/sincronizar`, { method: 'POST' });
  soltar();

  if (ok) mostrarResumo(dados, false);
  else avisar(dados.erro || 'Não foi possível atualizar.', 'erro');
  anunciarMudanca();
}

async function desconectar(conexao) {
  const sim = await confirmar({
    titulo: `Desconectar o ${conexao.banco}?`,
    mensagem: 'As contas importadas e todas as transações delas saem do Verdanz.',
    aviso: 'Nada muda no banco. Você pode conectar de novo depois e importar tudo outra vez.',
    textoConfirmar: 'Desconectar',
  });
  if (!sim) return;

  const { ok, dados } = await chamarApi('/api/conexao-bancaria/' + conexao.id_conexao, { method: 'DELETE' });
  if (!ok) return avisar(dados.erro || 'Não foi possível desconectar o banco.', 'erro');

  avisar(`${conexao.banco} desconectado.`);
  anunciarMudanca();
}

el('listaConexoes').addEventListener('click', (evento) => {
  const conectar = evento.target.closest('[data-conectar]');
  if (conectar) return conectarBanco(conectar);

  const atualizar = evento.target.closest('[data-sincronizar]');
  if (atualizar) return sincronizar(atualizar);

  const sairDoBanco = evento.target.closest('[data-desconectar]');
  if (sairDoBanco) desconectar(conexoes.find((c) => c.id_conexao === Number(sairDoBanco.dataset.desconectar)));
});

// Volta da tela do banco: /novo/contas?code=...&state=...  (ou ?error=...)
async function tratarVoltaDoBanco() {
  const parametros = new URLSearchParams(location.search);
  const code = parametros.get('code');
  const recusou = parametros.get('error');
  if (!code && !recusou) return;

  // Limpa o endereço: recarregar a página não pode reenviar o código.
  history.replaceState(null, '', location.pathname);

  if (recusou) return avisar('Conexão cancelada: o acesso foi recusado no banco.', 'erro');

  avisar('Importando suas contas do banco...');
  const { ok, dados } = await chamarApi('/api/conexao-bancaria/finalizar', {
    method: 'POST',
    body: JSON.stringify({ code, state: parametros.get('state') }),
  });

  if (!ok) return avisar(dados.erro || 'Não foi possível concluir a conexão.', 'erro');
  mostrarResumo(dados.resumo, true);
}

// ---- COMEÇAR ----

function carregar() {
  carregarContas();
  carregarConexoes();
}

tratarVoltaDoBanco().then(carregar);
document.addEventListener('verdanz:mudou', carregar);
window.addEventListener('resize', () => caberNaLargura(el('totalGeral'), 22));
