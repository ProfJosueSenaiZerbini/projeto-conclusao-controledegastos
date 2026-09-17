
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
  return `
    <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
      <div class="flex justify-between items-start mb-4">
        <div class="w-11 h-11 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
          <i class="fa-regular fa-credit-card"></i>
        </div>
        <div class="flex gap-1">
          <button data-editar="${conta.id_conta}" title="Editar"
                  class="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <i class="fa-solid fa-pen text-xs"></i>
          </button>
          <button data-excluir="${conta.id_conta}" title="Excluir"
                  class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </div>
      </div>
      <p class="text-gray-500 text-sm">${escapar(conta.nome)}</p>
      <h3 class="text-2xl font-bold text-gray-900 mt-1">${formatarMoeda(conta.saldo)}</h3>
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

carregarContas();