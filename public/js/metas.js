// Tela de Metas: cria metas e acompanha o progresso.

const listaMetas = document.getElementById('listaMetas');
const metasAtivas = document.getElementById('metasAtivas');
const formMeta = document.getElementById('formMeta');
const salvarMeta = document.getElementById('salvarMeta');

const painel = criarPainel('painelMeta', 'fundoPainel');
document.getElementById('fecharPainel').addEventListener('click', painel.fechar);

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function cartaoMeta(meta) {
  const pct = Math.round(meta.progresso);
  const concluida = pct >= 100;

  return `
    <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <div class="flex justify-between items-start mb-4">
        <div class="min-w-0">
          <p class="font-bold text-gray-900 truncate">${escapar(meta.titulo)}</p>
          <p class="text-xs text-gray-400 mt-1">Até ${formatarData(meta.data_limite)}</p>
        </div>
        <button data-excluir="${meta.id_meta}" title="Excluir meta"
                class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
          <i class="fa-solid fa-trash text-xs"></i>
        </button>
      </div>

      <div class="flex justify-between items-end mb-2">
        <p class="text-sm text-gray-500">
          <span class="font-bold text-gray-900">${formatarMoeda(meta.valor_atual)}</span>
          de ${formatarMoeda(meta.valor_alvo)}
        </p>
        <span class="text-sm font-bold ${concluida ? 'text-green-600' : 'text-blue-600'}">${pct}%</span>
      </div>

      <div class="w-full bg-gray-100 rounded-full h-2 mb-4">
        <div class="${concluida ? 'bg-green-500' : 'bg-blue-600'} h-2 rounded-full transition-all"
             style="width: ${Math.min(100, pct)}%"></div>
      </div>

      ${
        concluida
          ? `<p class="text-center text-sm font-medium text-green-600 py-2">
               <i class="fa-solid fa-check mr-1"></i> Meta alcançada
             </p>`
          : `<button data-adicionar="${meta.id_meta}"
                     class="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium transition hover:border-blue-300 hover:text-blue-600">
               <i class="fa-solid fa-plus mr-1"></i> Adicionar valor
             </button>`
      }
    </div>`;
}

const cartaoNovaMeta = `
  <button id="novaMeta"
          class="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors min-h-[200px]">
    <i class="fa-solid fa-plus text-2xl"></i>
    <span class="text-sm font-medium">Nova meta</span>
  </button>`;

async function carregarMetas() {
  const { ok, dados } = await chamarApi('/api/usuario/' + Sessao.idUsuario() + '/meta');

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível carregar suas metas.', 'erro');
    return;
  }

  metasAtivas.textContent = dados.filter((m) => m.status === 'em_progresso').length;
  listaMetas.innerHTML = dados.map(cartaoMeta).join('') + cartaoNovaMeta;

  document.getElementById('novaMeta').addEventListener('click', abrirNova);

  listaMetas.querySelectorAll('[data-adicionar]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const meta = dados.find((m) => m.id_meta === Number(botao.dataset.adicionar));
      adicionarValor(meta);
    });
  });

  listaMetas.querySelectorAll('[data-excluir]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const meta = dados.find((m) => m.id_meta === Number(botao.dataset.excluir));
      excluirMeta(meta);
    });
  });
}

function abrirNova() {
  formMeta.reset();
  document.getElementById('idMeta').value = '';
  painel.abrir();
}

// Somar direto em vez de abrir um formulário de edição inteiro: quem
// guardou dinheiro quer informar quanto guardou, não recalcular o total.
async function adicionarValor(meta) {
  const falta = Number(meta.valor_alvo) - Number(meta.valor_atual);

  // O modal já valida o valor e mostra o erro dentro dele, então aqui
  // só chega número válido — ou null, se a pessoa cancelou.
  const valor = await pedirValor({
    titulo: 'Adicionar valor',
    mensagem: `Quanto você guardou para "${meta.titulo}"? Faltam ${formatarMoeda(falta)}.`,
    rotulo: 'Valor guardado',
  });

  if (valor === null) return;

  const { ok, dados } = await chamarApi('/api/meta/' + meta.id_meta, {
    method: 'PUT',
    body: JSON.stringify({ adicionar: valor }),
  });

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível atualizar a meta.', 'erro');
    return;
  }

  esconderMensagem();
  carregarMetas();
}

async function excluirMeta(meta) {
  const confirmou = await confirmar({
    titulo: `Excluir "${meta.titulo}"?`,
    mensagem: `Você já guardou ${formatarMoeda(meta.valor_atual)} nessa meta.`,
    aviso: 'Essa ação não pode ser desfeita.',
    textoConfirmar: 'Excluir meta',
  });

  if (!confirmou) return;

  const { ok, dados } = await chamarApi('/api/meta/' + meta.id_meta, { method: 'DELETE' });

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível excluir a meta.', 'erro');
    return;
  }

  esconderMensagem();
  carregarMetas();
}

formMeta.addEventListener('submit', async function (evento) {
  evento.preventDefault();
  esconderMensagem();

  const titulo = document.getElementById('tituloMeta').value.trim();
  const valor = Number(document.getElementById('valorMeta').value);
  const prazo = document.getElementById('prazoMeta').value;

  if (!titulo) {
    mostrarMensagem('Dê um nome para a meta.', 'erro');
    return;
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    mostrarMensagem('Informe quanto custa, em valor maior que zero.', 'erro');
    return;
  }

  if (!prazo) {
    mostrarMensagem('Escolha uma data limite.', 'erro');
    return;
  }

  salvarMeta.disabled = true;

  const { ok, dados } = await chamarApi('/api/meta', {
    method: 'POST',
    body: JSON.stringify({ titulo, valor_alvo: valor, data_limite: prazo }),
  });

  salvarMeta.disabled = false;

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível criar a meta.', 'erro');
    return;
  }

  painel.fechar();
  carregarMetas();
});

carregarMetas();
