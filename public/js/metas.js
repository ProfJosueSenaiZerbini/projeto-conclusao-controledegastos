// Tela de Metas: cria metas e acompanha o progresso.

const listaMetas = document.getElementById('listaMetas');
const metasAtivas = document.getElementById('metasAtivas');
const formMeta = document.getElementById('formMeta');
const salvarMeta = document.getElementById('salvarMeta');

const painel = criarPainel('painelMeta', 'fundoPainel');
document.getElementById('fecharPainel').addEventListener('click', painel.fechar);

const selectContaMeta = document.getElementById('contaMeta');
const campoValorInicial = document.getElementById('valorInicialMeta');

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// ---- CONTAS DE ONDE O DINHEIRO SAI ----
//
// Guardar dinheiro numa meta tira o valor de uma conta. Só entram aqui as
// contas criadas no Verdanz: conta importada de banco só muda pelo banco
// (o servidor também recusa, esta lista só evita oferecer o que não vale).

let contasManuais = [];

async function carregarContas() {
  const { ok, dados } = await chamarApi('/api/usuario/' + Sessao.idUsuario() + '/conta');
  if (!ok) return;

  contasManuais = dados.filter((c) => !c.id_conexao);

  // textContent em vez de innerHTML: o nome da conta nunca vira HTML.
  selectContaMeta.innerHTML = '';
  contasManuais.forEach((c) => {
    const opcao = document.createElement('option');
    opcao.value = c.id_conta;
    opcao.textContent = textoConta(c);
    selectContaMeta.appendChild(opcao);
  });

  // Sem conta para usar, o valor inicial fica desligado.
  campoValorInicial.disabled = contasManuais.length === 0;
  selectContaMeta.disabled = contasManuais.length === 0;
  if (contasManuais.length === 0) {
    const opcao = document.createElement('option');
    opcao.textContent = 'Nenhuma conta disponível';
    selectContaMeta.appendChild(opcao);
  }
}

// "Carteira · R$ 1.500,00": mostrar o saldo ajuda a escolher a conta.
function textoConta(conta) {
  return `${conta.nome} · ${formatarMoeda(conta.saldo)}`;
}

// Mesmo aviso da tela de Transações, para o usuário ver a mesma
// explicação nos dois lugares.
function avisarSaldoInsuficiente(conta, valor) {
  return avisar({
    titulo: 'Saldo insuficiente',
    mensagem:
      `A conta "${conta.nome}" tem ${formatarMoeda(conta.saldo)}, e você quer guardar ` +
      `${formatarMoeda(valor)}. Escolha outra conta ou um valor menor.`,
  });
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
// O valor sai de uma conta escolhida pela pessoa.
async function adicionarValor(meta) {
  const falta = Number(meta.valor_alvo) - Number(meta.valor_atual);

  if (contasManuais.length === 0) {
    await avisar({
      titulo: 'Nenhuma conta disponível',
      mensagem: 'O valor guardado sai de uma conta. Crie uma conta na tela de Contas para guardar dinheiro na meta.',
    });
    return;
  }

  // O modal já valida o valor e mostra o erro dentro dele, então aqui
  // só chega um valor válido com a conta escolhida — ou null, se cancelou.
  const resposta = await pedirValor({
    titulo: 'Adicionar valor',
    mensagem:
      `Quanto você quer guardar para "${meta.titulo}"? Faltam ${formatarMoeda(falta)}. ` +
      'O valor sai da conta escolhida e aparece em Transações.',
    rotulo: 'Valor a guardar',
    escolha: {
      rotulo: 'De qual conta sai o dinheiro?',
      opcoes: contasManuais.map((c) => ({ valor: c.id_conta, texto: textoConta(c) })),
    },
  });

  if (resposta === null) return;

  const { valor, escolha: idConta } = resposta;
  const conta = contasManuais.find((c) => c.id_conta === idConta);

  // Se a pessoa informou mais do que falta, só o que falta sai da conta.
  // Checar o saldo aqui só agiliza o aviso; quem garante é o servidor.
  const vaiSair = Math.min(valor, falta);
  if (vaiSair > Number(conta.saldo)) {
    await avisarSaldoInsuficiente(conta, vaiSair);
    return;
  }

  const { ok, dados } = await chamarApi('/api/meta/' + meta.id_meta, {
    method: 'PUT',
    body: JSON.stringify({ adicionar: valor, id_conta: idConta }),
  });

  // O saldo que a tela conhecia estava velho (outra aba, por exemplo).
  if (!ok && dados.codigo === 'SALDO_INSUFICIENTE') {
    await avisar({ titulo: 'Valor não guardado', mensagem: dados.erro + '.' });
    carregarContas();
    return;
  }

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível atualizar a meta.', 'erro');
    return;
  }

  // valor_guardado é quanto saiu da conta de fato, segundo o servidor.
  // Se a pessoa informou mais do que faltava, a tela conta o que
  // aconteceu, em vez de o número mudar sem explicação.
  const saiu = formatarMoeda(dados.valor_guardado);

  if (valor > falta) {
    mostrarMensagem(
      `Meta "${meta.titulo}" concluída! Você informou ${formatarMoeda(valor)}, mas faltavam só ` +
        `${saiu}, então só ${saiu} saíram da conta "${conta.nome}".`,
      'sucesso'
    );
  } else {
    mostrarMensagem(`${saiu} saíram da conta "${conta.nome}" e foram guardados em "${meta.titulo}".`, 'sucesso');
  }

  carregarMetas();
  carregarContas();
}

async function excluirMeta(meta) {
  // O dinheiro guardado saiu de uma conta e está registrado em Transações.
  // Excluir a meta não devolve esse valor, e a pessoa precisa saber disso
  // antes de confirmar.
  const aviso =
    Number(meta.valor_atual) > 0
      ? `Os ${formatarMoeda(meta.valor_atual)} guardados não voltam para a conta: eles continuam em Transações como "Meta: ${meta.titulo}". Essa ação não pode ser desfeita.`
      : 'Essa ação não pode ser desfeita.';

  const confirmou = await confirmar({
    titulo: `Excluir "${meta.titulo}"?`,
    mensagem: `Você já guardou ${formatarMoeda(meta.valor_atual)} nessa meta.`,
    aviso,
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

  const corpo = { titulo, valor_alvo: valor, data_limite: prazo };

  // Valor inicial é opcional: campo vazio = meta começa zerada.
  const textoInicial = campoValorInicial.value.trim();
  let conta = null;

  if (textoInicial !== '') {
    const valorInicial = Number(textoInicial);

    if (!Number.isFinite(valorInicial) || valorInicial < 0) {
      mostrarMensagem('O valor inicial deve ser um número maior que zero.', 'erro');
      return;
    }

    if (valorInicial > valor) {
      mostrarMensagem('O valor inicial não pode ser maior que o valor da meta.', 'erro');
      return;
    }

    if (valorInicial > 0) {
      conta = contasManuais.find((c) => c.id_conta === Number(selectContaMeta.value));

      if (!conta) {
        mostrarMensagem('Escolha de qual conta o valor inicial vai sair.', 'erro');
        return;
      }

      if (valorInicial > Number(conta.saldo)) {
        await avisarSaldoInsuficiente(conta, valorInicial);
        return;
      }

      corpo.valor_inicial = valorInicial;
      corpo.id_conta = conta.id_conta;
    }
  }

  salvarMeta.disabled = true;

  const { ok, dados } = await chamarApi('/api/meta', {
    method: 'POST',
    body: JSON.stringify(corpo),
  });

  salvarMeta.disabled = false;

  // Sem saldo, o servidor não cria nem a meta (é tudo uma operação só).
  if (!ok && dados.codigo === 'SALDO_INSUFICIENTE') {
    await avisar({ titulo: 'Meta não criada', mensagem: dados.erro + '.' });
    carregarContas();
    return;
  }

  if (!ok) {
    mostrarMensagem(dados.erro || 'Não foi possível criar a meta.', 'erro');
    return;
  }

  painel.fechar();

  if (conta) {
    mostrarMensagem(
      `Meta "${dados.titulo}" criada com ${formatarMoeda(dados.valor_atual)} tirados da conta "${conta.nome}".`,
      'sucesso'
    );
  }

  carregarMetas();
  carregarContas();
});

carregarMetas();
carregarContas();
