
const listaContas = document.getElementById('listaContas');
const totalGeral = document.getElementById('totalGeral');
const formConta = document.getElementById('formConta');
const salvarConta = document.getElementById('salvarConta');
const tituloPainel = document.getElementById('tituloPainel');
const campoSaldo = document.getElementById('campoSaldo');

const painel = criarPainel('painelConta', 'fundoPainel');
document.getElementById('fecharPainel').addEventListener('click', painel.fechar);

// Escapa caracteres perigosos antes de jogar texto no HTML.
// Sem isso, alguém chamado <script>... executaria código na própria tela.
function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function cartaoConta(conta) {
  // Conta importada de um banco: mostra de onde veio e não tem os botões
  // de editar e excluir. Quem atualiza essa conta é o banco, pela
  // sincronização (o servidor também recusa, caso alguém tente pela API).
  const importada = Boolean(conta.id_conexao);

  const icone = importada
    ? `<div class="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
         <i class="fa-solid fa-building-columns"></i>
       </div>`
    : `<div class="w-11 h-11 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
         <i class="fa-regular fa-credit-card"></i>
       </div>`;

  const acoes = importada
    ? ''
    : `<div class="flex gap-1">
          <button data-editar="${conta.id_conta}" title="Editar"
                  class="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <i class="fa-solid fa-pen text-xs"></i>
          </button>
          <button data-excluir="${conta.id_conta}" title="Excluir"
                  class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </div>`;

  const selo = importada
    ? `<span class="inline-flex items-center gap-1.5 mt-3 w-fit text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
         <i class="fa-solid fa-building-columns"></i> ${escapar(conta.conexao?.banco || 'Banco')}
       </span>`
    : '';

  return `
    <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
      <div class="flex justify-between items-start mb-4">
        ${icone}
        ${acoes}
      </div>
      <p class="text-gray-500 text-sm">${escapar(conta.nome)}</p>
      <h3 class="text-2xl font-bold text-gray-900 mt-1">${formatarMoeda(conta.saldo)}</h3>
      ${selo}
    </div>`;
}

const cartaoNovaConta = `
  <button id="novaConta"
          class="border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors min-h-[150px]">
    <i class="fa-solid fa-plus text-2xl"></i>
    <span class="text-sm font-medium">Nova conta</span>
  </button>`;

async function carregarContas() {
  const { ok, dados } = await chamarApi('/api/usuario/' + Sessao.idUsuario() + '/conta');

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível carregar suas contas.', 'erro');
    return;
  }

  const total = dados.reduce((soma, c) => soma + Number(c.saldo), 0);
  totalGeral.textContent = formatarMoeda(total);

  listaContas.innerHTML = dados.map(cartaoConta).join('') + cartaoNovaConta;

  document.getElementById('novaConta').addEventListener('click', abrirNova);

  listaContas.querySelectorAll('[data-editar]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const conta = dados.find((c) => c.id_conta === Number(botao.dataset.editar));
      abrirEdicao(conta);
    });
  });

  listaContas.querySelectorAll('[data-excluir]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const conta = dados.find((c) => c.id_conta === Number(botao.dataset.excluir));
      excluirConta(conta);
    });
  });
}

function abrirNova() {
  formConta.reset();
  document.getElementById('idConta').value = '';
  tituloPainel.textContent = 'Nova conta';
  salvarConta.textContent = 'Criar conta';
  campoSaldo.classList.remove('hidden');
  painel.abrir();
}

function abrirEdicao(conta) {
  document.getElementById('idConta').value = conta.id_conta;
  document.getElementById('nomeConta').value = conta.nome;
  tituloPainel.textContent = 'Editar conta';
  salvarConta.textContent = 'Salvar';

  // O campo já vem com o saldo atual, para a pessoa só corrigir o valor.
  // Serve principalmente para a Carteira, que nasce zerada no cadastro.
  document.getElementById('saldoConta').value = Number(conta.saldo).toFixed(2);
  campoSaldo.classList.remove('hidden');
  painel.abrir();
}

async function excluirConta(conta) {
  const confirmou = await confirmar({
    titulo: `Excluir "${conta.nome}"?`,
    mensagem: 'Essa ação não pode ser desfeita.',
    aviso: 'Todas as transações dessa conta serão apagadas junto.',
    textoConfirmar: 'Excluir conta',
  });

  if (!confirmou) return;

  const { ok, dados } = await chamarApi('/api/conta/' + conta.id_conta, { method: 'DELETE' });

 if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível excluir a conta.', 'erro');
    return;
  }

  esconderMensagem();
  carregarContas();
}

formConta.addEventListener('submit', async function (evento) {
  evento.preventDefault();
  esconderMensagem();

  const id = document.getElementById('idConta').value;
  const nome = document.getElementById('nomeConta').value.trim();
  const saldo = document.getElementById('saldoConta').value;

  if (!nome) {
    mostrarMensagem('Dê um nome para a conta.', 'erro');
    return;
  }

  if (Number(saldo) < 0) {
    await avisar({
      titulo: 'Saldo negativo não é permitido',
      mensagem: 'Informe quanto você tem nessa conta hoje, a partir de R$ 0,00.',
    });
    return;
  }

  salvarConta.disabled = true;

  const editando = Boolean(id);
  const { ok, dados } = await chamarApi(editando ? '/api/conta/' + id : '/api/conta', {
    method: editando ? 'PUT' : 'POST',
    body: JSON.stringify({ nome, saldo }),
  });

  salvarConta.disabled = false;

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível salvar a conta.', 'erro');
    return;
  }

  painel.fechar();
  carregarContas();
});

// ---- BANCOS CONECTADOS ----
//
// O fluxo de conexão passa por três lugares:
//   1. Aqui: "Conectar banco" pede ao servidor o endereço da tela do banco.
//   2. Na tela do BANCO (outro site): a pessoa autoriza ou recusa.
//   3. Aqui de novo: o banco devolve a pessoa para /contas com um código
//      na URL, e esta tela pede ao servidor para concluir e importar.

const listaConexoes = document.getElementById('listaConexoes');
const botaoConectar = document.getElementById('conectarBanco');

// "3 contas", "1 transação": evita o "1 transações" na mensagem.
function plural(quantidade, singular, varios) {
  return `${quantidade} ${quantidade === 1 ? singular : varios}`;
}

// Data e hora no padrão brasileiro: "08/10/2026, 14:32".
function formatarDataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// Transforma o resumo da importação numa frase para a pessoa.
function mostrarResumo(resumo, primeiraVez) {
  let texto;

  if (primeiraVez) {
    texto =
      `Banco conectado! ${plural(resumo.contas.length, 'conta', 'contas')} e ` +
      `${plural(resumo.transacoes_novas, 'transação importada', 'transações importadas')}.`;
  } else if (resumo.transacoes_novas === 0) {
    texto = 'Tudo em dia: nenhuma transação nova no banco.';
  } else {
    texto = `${plural(resumo.transacoes_novas, 'transação nova importada', 'transações novas importadas')}.`;
  }

  // Se o saldo de alguma conta não bate com o banco, a tela avisa em vez
  // de esconder. Isso não deveria acontecer, mas se acontecer, a pessoa
  // precisa saber.
  if (!resumo.saldos_conferem) {
    mostrarMensagem(texto + ' Atenção: o saldo de alguma conta não bateu com o informado pelo banco.', 'erro');
    return;
  }

  mostrarMensagem(texto, 'sucesso');
}

function cartaoConexao(conexao) {
  const situacao = conexao.expirada
    ? '<span class="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">autorização expirada</span>'
    : '<span class="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-lg">conectado</span>';

  const sincronizacao = conexao.ultima_sincronizacao
    ? 'Última sincronização: ' + formatarDataHora(conexao.ultima_sincronizacao)
    : 'Ainda não sincronizado';

  // Com a autorização vencida, sincronizar não funciona: o botão passa a
  // reconectar, o que renova a autorização sem perder as contas.
  const botaoPrincipal = conexao.expirada
    ? `<button data-reconectar class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold transition hover:bg-blue-700">
         Reconectar
       </button>`
    : `<button data-sincronizar="${conexao.id_conexao}" class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold transition hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">
         <i class="fa-solid fa-rotate mr-1"></i> Sincronizar
       </button>`;

  return `
    <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center flex-shrink-0">
          <i class="fa-solid fa-building-columns"></i>
        </div>
        <div>
          <p class="font-semibold text-gray-900 flex items-center gap-2 flex-wrap">${escapar(conexao.banco)} ${situacao}</p>
          <p class="text-xs text-gray-500 mt-1">
            ${plural(conexao._count.contas, 'conta importada', 'contas importadas')} · ${sincronizacao}
          </p>
          <p class="text-xs text-gray-400 mt-0.5">Autorização válida até ${formatarData(conexao.acesso_expira_em)}</p>
        </div>
      </div>
      <div class="flex gap-2 flex-shrink-0">
        ${botaoPrincipal}
        <button data-desconectar="${conexao.id_conexao}"
                class="px-4 py-2 rounded-xl text-gray-500 text-sm font-semibold transition hover:bg-red-50 hover:text-red-500">
          Desconectar
        </button>
      </div>
    </div>`;
}

async function carregarConexoes() {
  const { ok, dados } = await chamarApi('/api/conexao-bancaria');

  if (!ok) {
    listaConexoes.innerHTML = '';
    return;
  }

  listaConexoes.innerHTML = dados.length
    ? dados.map(cartaoConexao).join('')
    : '<p class="text-sm text-gray-400">Nenhum banco conectado ainda.</p>';

  // Por enquanto só existe um banco, e ele só pode ser conectado uma vez.
  botaoConectar.classList.toggle('hidden', dados.length > 0);

  listaConexoes.querySelectorAll('[data-sincronizar]').forEach((botao) => {
    botao.addEventListener('click', () => sincronizarConexao(botao));
  });

  listaConexoes.querySelectorAll('[data-reconectar]').forEach((botao) => {
    botao.addEventListener('click', conectarBanco);
  });

  listaConexoes.querySelectorAll('[data-desconectar]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const conexao = dados.find((c) => c.id_conexao === Number(botao.dataset.desconectar));
      desconectarBanco(conexao);
    });
  });
}

// Passo 1: pede ao servidor o endereço da tela do banco e vai até lá.
async function conectarBanco() {
  esconderMensagem();
  botaoConectar.disabled = true;

  const { ok, dados } = await chamarApi('/api/conexao-bancaria', { method: 'POST' });

  if (!ok) {
    botaoConectar.disabled = false;
    mostrarMensagem(dados.erro || 'Não foi possível conectar ao banco.', 'erro');
    return;
  }

  window.location.href = dados.url;
}

// Passo 3: a pessoa voltou do banco. A URL traz o resultado:
//   /contas?code=...&state=...           autorizou
//   /contas?error=access_denied&state=... recusou
async function tratarRetornoDoBanco() {
  const parametros = new URLSearchParams(window.location.search);
  const code = parametros.get('code');
  const state = parametros.get('state');
  const recusou = parametros.get('error');

  if (!code && !recusou) return;

  // Tira o código da barra de endereço logo de cara: ele não deve ficar
  // no histórico do navegador nem ser reenviado se a página recarregar.
  history.replaceState(null, '', '/contas');

  if (recusou) {
    mostrarMensagem('Conexão cancelada: o acesso foi recusado no banco.', 'erro');
    return;
  }

  mostrarMensagem('Importando suas contas do banco...', 'sucesso');

  const { ok, dados } = await chamarApi('/api/conexao-bancaria/finalizar', {
    method: 'POST',
    body: JSON.stringify({ code, state }),
  });

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível concluir a conexão.', 'erro');
    return;
  }

  mostrarResumo(dados.resumo, true);
}

async function sincronizarConexao(botao) {
  esconderMensagem();
  botao.disabled = true;
  botao.innerHTML = '<i class="fa-solid fa-rotate fa-spin mr-1"></i> Sincronizando...';

  const { ok, dados } = await chamarApi(`/api/conexao-bancaria/${botao.dataset.sincronizar}/sincronizar`, {
    method: 'POST',
  });

  if (ok) {
    mostrarResumo(dados, false);
  } else {
    mostrarMensagem(dados.erro || 'Não foi possível sincronizar.', 'erro');
  }

  carregarContas();
  carregarConexoes();
}

async function desconectarBanco(conexao) {
  const confirmou = await confirmar({
    titulo: `Desconectar o ${conexao.banco}?`,
    mensagem: 'As contas importadas e todas as transações delas serão removidas do Verdanz.',
    aviso: 'Nada muda no banco. Você pode conectar de novo depois e importar tudo outra vez.',
    textoConfirmar: 'Desconectar',
  });

  if (!confirmou) return;

  const { ok, dados } = await chamarApi('/api/conexao-bancaria/' + conexao.id_conexao, { method: 'DELETE' });

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível desconectar o banco.', 'erro');
    return;
  }

  mostrarMensagem(`${conexao.banco} desconectado.`, 'sucesso');
  carregarContas();
  carregarConexoes();
}

botaoConectar.addEventListener('click', conectarBanco);

// Primeiro trata a volta do banco (se for o caso), porque ela importa
// contas novas. Só depois carrega as listas, já com o que foi importado.
async function iniciar() {
  await tratarRetornoDoBanco();
  carregarContas();
  carregarConexoes();
}

iniciar();
