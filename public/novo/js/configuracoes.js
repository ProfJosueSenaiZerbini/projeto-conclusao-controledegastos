// Configurações.
//
// Onde cada coisa é guardada:
//   Nome, e-mail, senha, categorias -> no banco, pela API
//   Tema, tamanho da letra, avisos  -> só neste navegador (localStorage),
//                                      no objeto "preferencias_<id>"
//
// O tema e o tamanho da letra são aplicados pelo /js/tema.js, que roda no
// <head> de todas as telas. Aqui só se grava a escolha e se pede para ele
// aplicar na hora (window.aplicarTema / window.aplicarFonte).

const el = (id) => document.getElementById(id);

// ---- PREFERÊNCIAS DESTE NAVEGADOR ----

const CHAVE_PREFERENCIAS = 'preferencias_' + ID_USUARIO;

function lerPreferencias() {
  return lerDoNavegador(CHAVE_PREFERENCIAS, {});
}

function salvarPreferencia(nome, valor) {
  const preferencias = lerPreferencias();
  preferencias[nome] = valor;
  localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(preferencias));
}

function prepararAparencia() {
  const preferencias = lerPreferencias();

  // Marca a opção salva e aplica a nova na hora em que a pessoa escolhe.
  const ligar = (nome, padrao, aplicar) => {
    document.querySelectorAll(`[name="${nome}"]`).forEach((radio) => {
      radio.checked = radio.value === (preferencias[nome] || padrao);
      radio.addEventListener('change', () => {
        salvarPreferencia(nome, radio.value);
        aplicar(radio.value);
      });
    });
  };

  ligar('tema', 'claro', window.aplicarTema);
  ligar('fonte', 'normal', window.aplicarFonte);

  // Avisos: ligado é o padrão (só "false" gravado desliga).
  document.querySelectorAll('[data-preferencia]').forEach((caixa) => {
    caixa.checked = preferencias[caixa.dataset.preferencia] !== false;
    caixa.addEventListener('change', () => {
      salvarPreferencia(caixa.dataset.preferencia, caixa.checked);
      anunciarMudanca(); // o sino conta de novo
    });
  });
}

// ---- SEUS DADOS ----

let usuario = null;

function mostrarUsuario(dados) {
  usuario = dados;
  el('nomeUsuario').value = dados.nome_usuario;
  el('emailUsuario').value = dados.email;
  el('emailSeguranca').textContent = dados.email;
  el('membroDesde').textContent = 'Você está no Verdanz desde ' + formatarData(dados.data_cadastro) + '.';
}

// A casca já busca o usuário: aqui só se espera o aviso dela.
document.addEventListener('verdanz:usuario', (evento) => mostrarUsuario(evento.detail));

el('formDados').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (!usuario) return;

  const nome = el('nomeUsuario').value.trim();
  erroNoCampo(el('nomeUsuario'), nome ? '' : 'Digite o seu nome.');
  if (!nome) return el('nomeUsuario').focus();
  if (nome === usuario.nome_usuario) return avisar('O nome já é esse.');

  const soltar = ocupar(el('salvarDados'), 'Salvando...');
  const { ok, dados } = await chamarApi('/api/usuario/' + ID_USUARIO, { method: 'PUT', body: JSON.stringify({ nome_usuario: nome }) });
  soltar();

  if (!ok) return avisar(dados.erro || 'Não foi possível salvar.', 'erro');

  avisar('Nome atualizado.');
  carregarUsuario(); // da casca: atualiza o nome no menu também
});

// ---- TROCAR E-MAIL ----

el('abrirTrocaEmail').addEventListener('click', () => {
  el('formEmail').reset();
  el('respostaEmail').innerHTML = '';
  erroNoCampo(el('emailNovo'), '');
  erroNoCampo(el('senhaAtual'), '');
  el('emailAtual').textContent = usuario ? usuario.email : '';
  abrirJanela(el('folhaEmail'));
  el('emailNovo').focus();
});

el('formEmail').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const novo = el('emailNovo').value.trim();
  const senha = el('senhaAtual').value;
  erroNoCampo(el('emailNovo'), novo ? '' : 'Digite o e-mail novo.');
  erroNoCampo(el('senhaAtual'), senha ? '' : 'Digite sua senha atual.');
  if (!novo) return el('emailNovo').focus();
  if (!senha) return el('senhaAtual').focus();

  const soltar = ocupar(el('salvarEmail'), 'Enviando...');
  const { ok, dados } = await chamarApi(`/api/usuario/${ID_USUARIO}/email`, {
    method: 'POST',
    body: JSON.stringify({ email_novo: novo, senha_atual: senha }),
  });
  soltar();

  // A resposta fica dentro da folha: a pessoa precisa ler com calma.
  el('respostaEmail').innerHTML = ok
    ? recado('ok', esc(dados.mensagem || 'Link enviado. Confira a caixa de entrada do e-mail novo.'))
    : recado('perigo', esc(dados.erro || 'Não foi possível pedir a troca.'));
  if (ok) el('formEmail').reset();
});

// ---- CATEGORIAS ----
//
// Regras do servidor (src/categorias.js) que a tela mostra:
//   - o nome não pode repetir o de outra categoria sua nem do sistema;
//   - o tipo só muda enquanto a categoria não tem transações;
//   - ao excluir uma categoria com transações, elas vão para "Outras
//     despesas" ou "Outras receitas" (mesmo tipo, então nenhum saldo muda).

let categorias = [];

const tipoEscolhido = () => document.querySelector('[name="tipoCategoria"]:checked').value;

function linhaDaCategoria(c) {
  return `
    <li class="mov">
      <div class="mov__linha mov__linha--simples">
        ${iconeDaCategoria(c)}
        <span class="mov__texto">
          <strong>${esc(c.nome_categoria)}</strong>
          <small>${c.tipo === 'receita' ? 'Ganho' : 'Gasto'} · ${plural(c.total_transacoes, 'transação', 'transações')}</small>
        </span>
        <span class="fila" style="gap:.125rem">
          <button type="button" class="botao-icone" data-editar-categoria="${c.id_categoria}" aria-label="Editar a categoria ${esc(c.nome_categoria)}" title="Editar"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
          <button type="button" class="botao-icone" data-excluir-categoria="${c.id_categoria}" aria-label="Excluir a categoria ${esc(c.nome_categoria)}" title="Excluir"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </span>
      </div>
    </li>`;
}

async function carregarCategorias() {
  const { ok, dados } = await chamarApi('/api/categoria');
  if (!ok) return;

  categorias = dados;
  const minhas = dados.filter((c) => c.personalizada);
  el('listaCategorias').innerHTML = minhas.length
    ? minhas.map(linhaDaCategoria).join('')
    : '<li class="suave">Você ainda não criou nenhuma categoria.</li>';
}

function limparFormCategoria() {
  el('formCategoria').reset();
  el('idCategoria').value = '';
  erroNoCampo(el('nomeCategoria'), '');
  document.querySelectorAll('[name="tipoCategoria"]').forEach((r) => (r.disabled = false));
  el('avisoTipoCategoria').hidden = true;
  el('cancelarCategoria').hidden = true;
  el('tituloFormCategoria').textContent = 'Nova categoria';
  el('salvarCategoria').textContent = 'Criar categoria';
}

function editarCategoria(c) {
  el('idCategoria').value = c.id_categoria;
  el('nomeCategoria').value = c.nome_categoria;
  document.querySelector(`[name="tipoCategoria"][value="${c.tipo}"]`).checked = true;

  const temTransacoes = c.total_transacoes > 0;
  document.querySelectorAll('[name="tipoCategoria"]').forEach((r) => (r.disabled = temTransacoes));
  el('avisoTipoCategoria').hidden = !temTransacoes;

  el('cancelarCategoria').hidden = false;
  el('tituloFormCategoria').textContent = `Editando "${c.nome_categoria}"`;
  el('salvarCategoria').textContent = 'Salvar alterações';
  el('nomeCategoria').focus();
}

async function excluirCategoria(c) {
  let endereco = '/api/categoria/' + c.id_categoria;
  let aviso = 'Essa ação não pode ser desfeita.';

  if (c.total_transacoes > 0) {
    const nomeDoDestino = c.tipo === 'receita' ? 'Outras receitas' : 'Outras despesas';
    const destino = categorias.find((x) => !x.personalizada && x.nome_categoria === nomeDoDestino);
    if (!destino) return avisar(`Não encontramos a categoria "${nomeDoDestino}" para receber as transações.`, 'erro');

    endereco += '?mover_para=' + destino.id_categoria;
    aviso = `${c.total_transacoes === 1 ? 'A transação dela vai' : `As ${c.total_transacoes} transações dela vão`} para "${nomeDoDestino}". Nenhum saldo muda.`;
  }

  const sim = await confirmar({
    titulo: `Excluir a categoria "${c.nome_categoria}"?`,
    mensagem: 'Se ela tiver um limite de gasto, ele também será removido.',
    aviso,
    textoConfirmar: 'Excluir categoria',
  });
  if (!sim) return;

  const { ok, dados } = await chamarApi(endereco, { method: 'DELETE' });
  if (!ok) return avisar(dados.erro || 'Não foi possível excluir a categoria.', 'erro');

  avisar(dados.transacoes_movidas > 0 ? `Categoria excluída. ${plural(dados.transacoes_movidas, 'transação foi', 'transações foram')} para "${dados.movidas_para}".` : 'Categoria excluída.');
  if (Number(el('idCategoria').value) === c.id_categoria) limparFormCategoria();
  carregarCategorias();
}

el('listaCategorias').addEventListener('click', (evento) => {
  const editar = evento.target.closest('[data-editar-categoria]');
  const excluir = evento.target.closest('[data-excluir-categoria]');
  if (!editar && !excluir) return;

  const id = Number((editar || excluir).dataset[editar ? 'editarCategoria' : 'excluirCategoria']);
  const categoria = categorias.find((c) => c.id_categoria === id);
  if (!categoria) return;
  editar ? editarCategoria(categoria) : excluirCategoria(categoria);
});

el('cancelarCategoria').addEventListener('click', limparFormCategoria);

el('formCategoria').addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const nome = el('nomeCategoria').value.trim();
  erroNoCampo(el('nomeCategoria'), nome ? '' : 'Dê um nome para a categoria.');
  if (!nome) return el('nomeCategoria').focus();

  const id = el('idCategoria').value;
  const corpo = { nome_categoria: nome };
  // Tipo travado (categoria com transações) não é enviado.
  if (!document.querySelector('[name="tipoCategoria"]').disabled) corpo.tipo = tipoEscolhido();

  const soltar = ocupar(el('salvarCategoria'), 'Salvando...');
  const { ok, dados } = await chamarApi(id ? '/api/categoria/' + id : '/api/categoria', { method: id ? 'PUT' : 'POST', body: JSON.stringify(corpo) });
  soltar();

  // Nome repetido e outros erros de regra aparecem junto do campo.
  if (!ok) return erroNoCampo(el('nomeCategoria'), dados.erro || 'Não foi possível salvar a categoria.');

  avisar(id ? 'Categoria atualizada.' : `Categoria "${dados.nome_categoria}" criada.`);
  limparFormCategoria();
  carregarCategorias();
});

// ---- PERFIS ----

function mostrarPerfis() {
  const perfis = PerfisSalvos.ler().filter((chave) => PERFIS[chave]);
  el('perfisAtuais').innerHTML = perfis.length
    ? perfis.map((chave) => `<span class="capsula capsula--lilas"><i class="fa-solid ${PERFIS[chave].icone}" aria-hidden="true"></i> ${PERFIS[chave].nome}</span>`).join('')
    : '<span class="suave">Você ainda não escolheu nenhum perfil.</span>';
  el('linkPerfis').textContent = perfis.length ? 'Trocar meus perfis' : 'Descobrir meu perfil';
}

// ---- SEGURANÇA ----

el('enviarLinkSenha').addEventListener('click', async () => {
  if (!usuario) return;

  const botao = el('enviarLinkSenha');
  botao.disabled = true;

  const { ok, dados } = await chamarApi('/api/usuario/esqueci-senha', { method: 'POST', body: JSON.stringify({ email: usuario.email }) });

  if (!ok) {
    botao.disabled = false;
    return avisar(dados.erro || 'Não foi possível enviar o link.', 'erro');
  }

  avisar('Link enviado! Confira a sua caixa de entrada.');
  // Meio minuto de espera antes de poder pedir outro link.
  setTimeout(() => (botao.disabled = false), 30000);
});

// ---- ZONA DE PERIGO ----
//
// As duas ações pedem a senha, e quem confere é o servidor
// (exclusaoController.js). A tela só abre as janelas e mostra a resposta.

// O que fica guardado neste navegador com o id da pessoa (perfis, o que foi
// anotado nas ferramentas de Meu perfil, avisos já vistos). O tema, a letra
// e os avisos escolhidos (preferencias_) são ajustes da tela e ficam.
function apagarDadosDoNavegador() {
  ['perfis_', 'perfil_ferramentas_', 'notificacoes_vistas_'].forEach((chave) => localStorage.removeItem(chave + ID_USUARIO));
}

el('abrirResetar').addEventListener('click', () => {
  el('formResetar').reset();
  erroNoCampo(el('senhaResetar'), '');
  abrirJanela(el('folhaResetar'));
  el('senhaResetar').focus();
});

el('formResetar').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const campo = el('senhaResetar');
  if (!campo.value) {
    erroNoCampo(campo, 'Digite a sua senha.');
    return campo.focus();
  }

  const soltar = ocupar(el('salvarResetar'), 'Apagando...');
  const { ok, dados } = await chamarApi(`/api/usuario/${ID_USUARIO}/resetar`, { method: 'POST', body: JSON.stringify({ senha: campo.value }) });

  if (!ok) {
    soltar();
    erroNoCampo(campo, dados.erro || 'Não foi possível resetar os dados.');
    return campo.focus();
  }

  apagarDadosDoNavegador();
  // Leva ao Início já zerado, com o recado de que deu certo.
  sessionStorage.setItem('recado_inicio', dados.mensagem);
  window.location.href = RAIZ + '/inicio';
});

el('abrirExcluir').addEventListener('click', () => {
  el('formExcluir').reset();
  erroNoCampo(el('senhaExcluir'), '');
  el('respostaExcluir').innerHTML = '';
  el('salvarExcluir').hidden = false;
  el('senhaExcluir').closest('.campo').hidden = false;
  if (usuario) el('emailExcluir').textContent = usuario.email;
  abrirJanela(el('folhaExcluir'));
  el('senhaExcluir').focus();
});

el('formExcluir').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const campo = el('senhaExcluir');
  if (!campo.value) {
    erroNoCampo(campo, 'Digite a sua senha.');
    return campo.focus();
  }

  const soltar = ocupar(el('salvarExcluir'), 'Enviando...');
  const { ok, dados } = await chamarApi(`/api/usuario/${ID_USUARIO}/excluir-conta`, { method: 'POST', body: JSON.stringify({ senha: campo.value }) });
  soltar();

  if (!ok) {
    erroNoCampo(campo, dados.erro || 'Não foi possível pedir a exclusão.');
    return campo.focus();
  }

  // Nada foi apagado ainda: só o link foi enviado.
  erroNoCampo(campo, '');
  campo.value = '';
  el('salvarExcluir').hidden = true;
  campo.closest('.campo').hidden = true;
  el('respostaExcluir').innerHTML = recado('ok', `${esc(dados.mensagem)} O link vale por 30 minutos.`);
});

// ---- COMEÇAR ----

prepararAparencia();
mostrarPerfis();
carregarCategorias();
if (usuarioAtual) mostrarUsuario(usuarioAtual);

// O topo fica preso em cima ao rolar (body.tela-fixa, no verdanz.css), e o
// índice das seções fica preso logo abaixo dele. Para isso o CSS precisa
// saber a altura do topo, que muda com o tamanho da letra e da tela: o
// ResizeObserver avisa sempre que ela muda.
(function () {
  const topo = document.getElementById('topo');
  if (!topo || !window.ResizeObserver) return;
  new ResizeObserver(() => {
    document.body.style.setProperty('--altura-topo', topo.offsetHeight + 'px');
  }).observe(topo);
})();
