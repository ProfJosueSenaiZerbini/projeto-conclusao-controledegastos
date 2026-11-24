// Sininho de notificações, comum às telas de dentro do sistema.
//
// O botão é criado aqui, ao lado do avatar, em vez de repetido no HTML de
// cada tela: assim não existe uma cópia para esquecer de atualizar.
//
// Quais avisos existem é decidido pelo servidor (src/notificacoes.js). Aqui
// ficam duas coisas que são só deste navegador, no localStorage:
//   - quais tipos de aviso a pessoa quer ver (Configurações > Notificações);
//   - quais avisos ela já viu, para o número do sininho contar só os novos.
//
// Tudo fica dentro de uma função para os nomes daqui não colidirem com os
// do script de cada tela.

(function () {
  const linkPerfil = document.getElementById('linkPerfil');
  const idUsuario = Sessao.idUsuario();
  if (!linkPerfil || !Sessao.token() || !idUsuario) return;

  const chaveVistas = 'notificacoes_vistas_' + idUsuario;

  // Qual escolha de Configurações liga ou desliga cada tipo de aviso.
  const PREFERENCIA_DO_TIPO = {
    conta: 'notif_contas',
    meta: 'notif_metas',
    saldo: 'notif_saldo',
    limite: 'notif_limites',
  };

  const ICONE_DO_TIPO = {
    conta: 'fa-regular fa-calendar',
    meta: 'fa-solid fa-bullseye',
    saldo: 'fa-solid fa-wallet',
    limite: 'fa-solid fa-gauge-high',
  };

  const COR_DA_GRAVIDADE = { alerta: 'text-red-500', atencao: 'text-amber-500' };

  function escapar(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
  }

  function lerJson(chave, padrao) {
    try {
      return JSON.parse(localStorage.getItem(chave)) || padrao;
    } catch (e) {
      return padrao;
    }
  }

  // ---- MONTAR O SININHO ----

  const caixa = document.createElement('div');
  caixa.className = 'relative';
  caixa.innerHTML = `
    <button type="button" id="botaoNotificacoes" title="Notificações" aria-label="Notificações"
            aria-expanded="false" aria-controls="painelNotificacoes"
            class="relative flex items-center justify-center w-11 h-11 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
      <i class="fa-regular fa-bell text-xl"></i>
      <span id="contagemNotificacoes"
            class="hidden absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold leading-[18px] text-center"></span>
    </button>

    <!-- No celular o painel ocupa a largura da tela; no computador fica preso ao sininho. -->
    <div id="painelNotificacoes"
         class="hidden fixed inset-x-4 top-20 z-30 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-3 sm:w-96 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
      <p class="px-5 py-4 font-bold text-gray-900 border-b border-gray-100">Notificações</p>
      <div id="listaNotificacoes" class="max-h-96 overflow-y-auto divide-y divide-gray-100"></div>
      <a href="/configuracoes" class="block px-5 py-3 text-center text-xs text-gray-500 border-t border-gray-100 hover:bg-gray-50 transition-colors">
        Escolher quais avisos receber
      </a>
    </div>`;

  linkPerfil.parentElement.insertBefore(caixa, linkPerfil);

  const botao = document.getElementById('botaoNotificacoes');
  const contagem = document.getElementById('contagemNotificacoes');
  const painel = document.getElementById('painelNotificacoes');
  const lista = document.getElementById('listaNotificacoes');

  let avisos = [];

  // ---- BUSCAR E MOSTRAR ----

  // Devolve false se a API falhou.
  async function carregar() {
    try {
      const { ok, dados } = await chamarApi('/api/usuario/' + idUsuario + '/notificacao');
      if (!ok) return false;

      // Sem escolha salva, o aviso nasce ligado (como em configuracoes.js).
      const preferencias = lerJson('preferencias_' + idUsuario, {});
      avisos = dados.filter((a) => preferencias[PREFERENCIA_DO_TIPO[a.tipo]] !== false);
      return true;
    } catch (erro) {
      console.error('Erro de conexão:', erro);
      return false;
    }
  }

  function mostrarContagem() {
    const vistas = lerJson(chaveVistas, []);
    const novas = avisos.filter((a) => !vistas.includes(a.chave)).length;

    contagem.textContent = novas > 9 ? '9+' : novas;
    contagem.classList.toggle('hidden', novas === 0);
    botao.setAttribute('aria-label', novas > 0 ? `Notificações: ${novas} novas` : 'Notificações');
  }

  function itemAviso(aviso) {
    return `
      <a href="${aviso.link}" class="flex gap-3 px-5 py-4 hover:bg-gray-50 transition-colors">
        <i class="${ICONE_DO_TIPO[aviso.tipo]} ${COR_DA_GRAVIDADE[aviso.gravidade]} w-5 text-center mt-0.5 flex-shrink-0"></i>
        <span class="min-w-0">
          <span class="block text-sm font-semibold text-gray-900">${escapar(aviso.titulo)}</span>
          <span class="block text-sm text-gray-500 break-words">${escapar(aviso.mensagem)}</span>
        </span>
      </a>`;
  }

  function mostrarLista() {
    lista.innerHTML = avisos.length
      ? avisos.map(itemAviso).join('')
      : '<p class="px-5 py-8 text-center text-sm text-gray-500">Tudo em dia. Nenhum aviso por aqui.</p>';
  }

  // ---- ABRIR E FECHAR ----

  function fecharPainel() {
    painel.classList.add('hidden');
    botao.setAttribute('aria-expanded', 'false');
  }

  // Abre na hora com o que já tem e atualiza em seguida: a pessoa pode ter
  // pago uma conta nesta mesma tela desde que ela abriu.
  async function abrirPainel() {
    mostrarLista();
    painel.classList.remove('hidden');
    botao.setAttribute('aria-expanded', 'true');

    if (await carregar()) {
      mostrarLista();
    } else if (avisos.length === 0) {
      lista.innerHTML = '<p class="px-5 py-8 text-center text-sm text-gray-500">Não foi possível carregar os avisos.</p>';
    }

    // Grava só os avisos de agora, em vez de somar à lista antiga. Assim
    // ela não cresce para sempre, e um saldo que volta a ficar negativo
    // conta como aviso novo.
    localStorage.setItem(chaveVistas, JSON.stringify(avisos.map((a) => a.chave)));
    mostrarContagem();
  }

  botao.addEventListener('click', function () {
    if (painel.classList.contains('hidden')) abrirPainel();
    else fecharPainel();
  });

  document.addEventListener('click', function (evento) {
    if (!caixa.contains(evento.target)) fecharPainel();
  });

  document.addEventListener('keydown', function (evento) {
    if (evento.key === 'Escape') fecharPainel();
  });

  carregar().then(mostrarContagem);
})();
