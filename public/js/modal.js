// Modais do Verdanz — substituem confirm(), prompt() e alert() do navegador.
//
// Por que trocar: as caixas nativas travam a página inteira enquanto
// estão abertas, não aceitam formatação nem texto explicativo, e têm a
// aparência do sistema operacional, não do site.
//
// As duas funções abaixo devolvem uma Promise, então quem chama continua
// As funções abaixo devolvem uma Promise, então quem chama continua
// escrevendo de cima para baixo, quase igual ao código antigo:
//
//   const ok = await confirmar({ ... });
//   if (!ok) return;
//
// O HTML fica aqui em vez de repetido nas três telas, para os modais não
// saírem diferentes um do outro com o tempo.

const MARCACAO_MODAL = `
  <div id="fundoModal" class="hidden fixed inset-0 bg-black/40 z-[60]"></div>

  <div id="caixaModal" role="dialog" aria-modal="true" aria-labelledby="tituloModal"
       class="hidden fixed inset-0 z-[70] items-center justify-center p-4 pointer-events-none">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-hidden">

      <div class="p-6">
        <div class="flex items-start gap-4">
          <div id="iconeModal" class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"></div>
          <div class="min-w-0 flex-1">
            <h3 id="tituloModal" class="font-bold text-gray-900"></h3>
            <p id="mensagemModal" class="text-sm text-gray-500 mt-1"></p>
          </div>
        </div>

        <div id="avisoModal" class="hidden mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700"></div>

        <div id="campoModal" class="hidden mt-5">
          <label id="rotuloModal" for="valorModal" class="block text-sm font-semibold text-gray-700 mb-2"></label>
          <input type="number" id="valorModal" step="0.01" inputmode="decimal" placeholder="0,00"
                 class="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50 outline-none transition text-2xl font-bold text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
          <p id="erroModal" class="hidden text-sm text-red-600 mt-2"></p>
        </div>
      </div>

      <div class="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
        <button type="button" id="cancelarModal"
                class="flex-1 py-3 rounded-xl border border-gray-200 bg-white text-gray-600 font-medium transition hover:bg-gray-100">
          Cancelar
        </button>
        <button type="button" id="confirmarModal"
                class="flex-1 py-3 rounded-xl text-white font-bold transition">
        </button>
      </div>

    </div>
  </div>`;

document.body.insertAdjacentHTML('beforeend', MARCACAO_MODAL);

const fundoModal = document.getElementById('fundoModal');
const caixaModal = document.getElementById('caixaModal');
const iconeModal = document.getElementById('iconeModal');
const tituloModal = document.getElementById('tituloModal');
const mensagemModal = document.getElementById('mensagemModal');
const avisoModal = document.getElementById('avisoModal');
const campoModal = document.getElementById('campoModal');
const rotuloModal = document.getElementById('rotuloModal');
const valorModal = document.getElementById('valorModal');
const erroModal = document.getElementById('erroModal');
const cancelarModal = document.getElementById('cancelarModal');
const confirmarModal = document.getElementById('confirmarModal');

const semMovimentoModal = window.matchMedia('(prefers-reduced-motion: reduce)');

// Guarda a função que resolve a Promise da chamada atual. Fica em uma
// variável de módulo porque quem resolve é o clique nos botões, que
// acontece muito depois de a função ter retornado.
let resolverModal = null;

function esconderModal() {
  caixaModal.classList.remove('flex', 'recolhendo');
  caixaModal.classList.add('hidden');
  fundoModal.classList.remove('recolhendo');
  fundoModal.classList.add('hidden');
}

function fecharModal(resposta) {
  if (caixaModal.classList.contains('hidden')) return;

  if (resolverModal) {
    resolverModal(resposta);
    resolverModal = null;
  }

  if (semMovimentoModal.matches) {
    esconderModal();
    return;
  }

  caixaModal.classList.add('recolhendo');
  fundoModal.classList.add('recolhendo');

  // aoTerminarAnimacao vem de layout.js e tem prazo máximo: sem ele, se
  // o navegador congelar a animação o modal ficaria travado por cima da
  // tela, com o fundo escuro bloqueando tudo.
  aoTerminarAnimacao(caixaModal, function () {
    // Se outro modal abriu no meio da animação, 'recolhendo' já saiu.
    if (caixaModal.classList.contains('recolhendo')) esconderModal();
  });
}

function abrirModal() {
  caixaModal.classList.remove('hidden', 'recolhendo');
fundoModal.classList.remove('hidden', 'recolhendo');
}

// Clicar fora e apertar Esc cancelam — é o que todo mundo espera.
fundoModal.addEventListener('click', () => fecharModal(null));

document.addEventListener('keydown', function (evento) {
  if (evento.key === 'Escape') fecharModal(null);
  if (evento.key !== 'Escape' || caixaModal.classList.contains('hidden')) return;

  // Com o modal aberto por cima do painel lateral, o Esc fecha só o modal.
  // Sem isso o painel também fecharia e a pessoa perderia o que digitou.
  evento.stopImmediatePropagation();
  fecharModal(null);
});

// ---- CONFIRMAÇÃO ----
//
// Substitui o confirm(). Devolve true se a pessoa confirmou.
//
//   await confirmar({
//     titulo: 'Excluir a conta "Nubank"?',
//     mensagem: 'Essa ação não pode ser desfeita.',
//     aviso: 'As 12 transações dela serão apagadas junto.',
//     textoConfirmar: 'Excluir conta',
//   })

function confirmar({ titulo, mensagem = '', aviso = '', textoConfirmar = 'Confirmar' }) {
  tituloModal.textContent = titulo;
  mensagemModal.textContent = mensagem;
  mensagemModal.classList.toggle('hidden', !mensagem);

  iconeModal.className =
    'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-50 text-red-500';
  iconeModal.innerHTML = '<i class="fa-solid fa-trash"></i>';

  avisoModal.textContent = aviso;
  avisoModal.classList.toggle('hidden', !aviso);

  campoModal.classList.add('hidden');
  cancelarModal.classList.remove('hidden');
  
  confirmarModal.textContent = textoConfirmar;
  confirmarModal.className =
    'flex-1 py-3 rounded-xl text-white font-bold transition bg-red-600 hover:bg-red-700';

  abrirModal();

  // O foco vai para Cancelar: numa ação destrutiva, o Enter distraído
  // não deve apagar nada.
  cancelarModal.focus();

  return new Promise((resolver) => {
    resolverModal = (resposta) => resolver(resposta === true);

    cancelarModal.onclick = () => fecharModal(false);
    confirmarModal.onclick = () => fecharModal(true);
  });
}

// ---- PEDIR UM VALOR ----
//
// Substitui o prompt(). Devolve o número digitado, ou null se cancelou.
//
//   await pedirValor({
//     titulo: 'Adicionar à meta',
//     mensagem: 'Quanto você guardou para "Viagem"?',
//     rotulo: 'Valor guardado',
//   })

function pedirValor({ titulo, mensagem = '', rotulo = 'Valor', textoConfirmar = 'Adicionar' }) {
  tituloModal.textContent = titulo;
  mensagemModal.textContent = mensagem;
  mensagemModal.classList.toggle('hidden', !mensagem);

  iconeModal.className =
    'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50 text-blue-500';
  iconeModal.innerHTML = '<i class="fa-solid fa-plus"></i>';

  avisoModal.classList.add('hidden');

  rotuloModal.textContent = rotulo;
  valorModal.value = '';
  erroModal.classList.add('hidden');
  campoModal.classList.remove('hidden');
  cancelarModal.classList.remove('hidden');

  confirmarModal.textContent = textoConfirmar;
  confirmarModal.className =
    'flex-1 py-3 rounded-xl text-white font-bold transition bg-blue-600 hover:bg-blue-700';
abrirModal();
  valorModal.focus();

  return new Promise((resolver) => {
    resolverModal = (resposta) => resolver(resposta);

    // Valida antes de fechar: valor vazio ou zerado mostra o erro no
    // próprio modal, sem perder o que já foi digitado.
    function tentarConfirmar() {
      const valor = Number(String(valorModal.value).replace(',', '.'));

      if (!Number.isFinite(valor) || valor <= 0) {
        erroModal.textContent = 'Informe um valor maior que zero.';
        erroModal.classList.remove('hidden');
        valorModal.focus();
        return;
      }

      fecharModal(valor);
    }

    valorModal.oninput = () => erroModal.classList.add('hidden');

    // Enter confirma, para não obrigar a tirar a mão do teclado.
    valorModal.onkeydown = (evento) => {
      if (evento.key === 'Enter') {
        evento.preventDefault();
        tentarConfirmar();
      }
    };

    cancelarModal.onclick = () => fecharModal(null);
    confirmarModal.onclick = tentarConfirmar;
  });
}

function avisar({ titulo, mensagem = '', textoBotao = 'Entendi' }) {
  tituloModal.textContent = titulo;
  mensagemModal.textContent = mensagem;
  mensagemModal.classList.toggle('hidden', !mensagem);

  iconeModal.className =
    'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-500';
  iconeModal.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';

  avisoModal.classList.add('hidden');
  campoModal.classList.add('hidden');

  // Não há o que cancelar: sobra só o botão de fechar.
  cancelarModal.classList.add('hidden');

  confirmarModal.textContent = textoBotao;
  confirmarModal.className =
    'flex-1 py-3 rounded-xl text-white font-bold transition bg-blue-600 hover:bg-blue-700';

  abrirModal();
  confirmarModal.focus();

  return new Promise((resolver) => {
    resolverModal = () => resolver();
    confirmarModal.onclick = () => fecharModal();
  });
}