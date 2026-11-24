// Telas de acesso: entrar, criar conta, esqueci a senha, redefinir a senha
// e confirmar e-mail. Cada tela diz quem é em <body data-pagina="...">, e
// este arquivo liga só a parte dela.
//
// A validação feita aqui é só conforto: responde na hora, sem ir até o
// servidor. A validação que VALE é a do servidor, porque o navegador pode
// ser burlado.

const el = (id) => document.getElementById(id);
const PAGINA_DE_ACESSO = document.body.dataset.pagina;

// Recado fixo acima do formulário (erro ou sucesso).
function mostrarRecado(tipo, texto) {
  el('recado').innerHTML = texto ? recado(tipo, esc(texto)) : '';
}

// Botão do olho: mostra ou esconde a senha digitada. Quem digita devagar,
// ou no celular, erra menos quando pode conferir o que escreveu.
document.querySelectorAll('[data-olho]').forEach((botao) => {
  botao.addEventListener('click', () => {
    const campo = el(botao.dataset.olho);
    const mostrando = campo.type === 'text';
    campo.type = mostrando ? 'password' : 'text';
    botao.setAttribute('aria-label', mostrando ? 'Mostrar a senha' : 'Esconder a senha');
    botao.setAttribute('aria-pressed', String(!mostrando));
    botao.querySelector('i').className = mostrando ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
  });
});

// Depois de entrar: quem ainda não escolheu perfil passa pela pesquisa.
function irParaDentro() {
  window.location.href = RAIZ + (PerfisSalvos.ler().length > 0 ? '/inicio' : '/perfil');
}

async function entrar(email, senha) {
  const { ok, dados } = await chamarApi('/api/usuario/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
  if (ok) Sessao.salvar(dados.token, dados.id_usuario);
  return { ok, dados };
}

const TELAS = {
  // ---- ENTRAR ----
  entrar() {
    // Quem já está com a sessão aberta não precisa ver o formulário.
    if (Sessao.token() && Sessao.idUsuario()) return irParaDentro();

    el('formEntrar').addEventListener('submit', async (evento) => {
      evento.preventDefault();
      mostrarRecado();

      const email = el('email').value.trim();
      const senha = el('senha').value;
      erroNoCampo(el('email'), email ? '' : 'Digite o seu e-mail.');
      erroNoCampo(el('senha'), senha ? '' : 'Digite a sua senha.');
      if (!email) return el('email').focus();
      if (!senha) return el('senha').focus();

      const soltar = ocupar(el('botaoEntrar'), 'Entrando...');
      try {
        const { ok, dados } = await entrar(email, senha);
        // O servidor responde a mesma mensagem para e-mail que não existe e
        // para senha errada, de propósito: não conta a ninguém quais
        // e-mails têm conta.
        if (!ok) return mostrarRecado('perigo', dados.erro || 'Não foi possível entrar.');
        irParaDentro();
      } catch (erro) {
        mostrarRecado('perigo', 'Sem conexão com o servidor. Tente de novo em instantes.');
      } finally {
        soltar();
      }
    });
  },

  // ---- CRIAR CONTA ----
  'criar-conta'() {
    const campoDocumento = el('cpf_cnpj');
    const soDigitos = (valor) => valor.replace(/\D/g, '');

    // Põe os pontos e o traço enquanto a pessoa digita: 000.000.000-00
    function formatarDocumento(valor) {
      const d = soDigitos(valor).slice(0, 14);
      if (d.length <= 11) {
        return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      }
      return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
    }
    campoDocumento.addEventListener('input', () => (campoDocumento.value = formatarDocumento(campoDocumento.value)));

    el('formCriar').addEventListener('submit', async (evento) => {
      evento.preventDefault();
      mostrarRecado();

      const dados = {
        nome_usuario: el('nome').value.trim(),
        cpf_cnpj: soDigitos(campoDocumento.value),
        email: el('email').value.trim(),
        senha: el('senha').value,
      };

      // Confere de cima para baixo e leva o cursor ao primeiro problema.
      const problemas = [
        [el('nome'), dados.nome_usuario ? '' : 'Digite o seu nome.'],
        [campoDocumento, [11, 14].includes(dados.cpf_cnpj.length) ? '' : 'O CPF tem 11 números (e o CNPJ, 14).'],
        [el('email'), /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email) ? '' : 'Digite um e-mail válido, como nome@exemplo.com.'],
        [el('senha'), dados.senha.length >= 6 ? '' : 'A senha precisa de pelo menos 6 caracteres.'],
      ];
      problemas.forEach(([campo, mensagem]) => erroNoCampo(campo, mensagem));
      const primeiro = problemas.find(([, mensagem]) => mensagem);
      if (primeiro) return primeiro[0].focus();

      const soltar = ocupar(el('botaoCriar'), 'Criando sua conta...');
      try {
        const { ok, dados: resposta } = await chamarApi('/api/usuario', { method: 'POST', body: JSON.stringify(dados) });
        // O servidor já devolve mensagens prontas ("Email já cadastrado").
        if (!ok) return mostrarRecado('perigo', resposta.erro || 'Não foi possível criar a conta.');

        // Um usuário novo começa sem perfis: limpa o que possa ter sobrado
        // no navegador de alguém que usou o mesmo número de id antes.
        PerfisSalvos.apagarTudo(resposta.id_usuario);

        // Já entra direto, sem pedir e-mail e senha de novo.
        const login = await entrar(dados.email, dados.senha);
        window.location.href = RAIZ + (login.ok ? '/perfil' : '/entrar');
      } catch (erro) {
        mostrarRecado('perigo', 'Sem conexão com o servidor. Tente de novo em instantes.');
      } finally {
        soltar();
      }
    });
  },

  // ---- ESQUECI A SENHA ----
  'esqueci-senha'() {
    el('formEsqueci').addEventListener('submit', async (evento) => {
      evento.preventDefault();
      mostrarRecado();

      const email = el('email').value.trim();
      const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      erroNoCampo(el('email'), valido ? '' : 'Digite um e-mail válido, como nome@exemplo.com.');
      if (!valido) return el('email').focus();

      const soltar = ocupar(el('botaoEnviar'), 'Enviando...');
      try {
        const { ok, dados } = await chamarApi('/api/usuario/esqueci-senha', { method: 'POST', body: JSON.stringify({ email }) });
        if (!ok) return mostrarRecado('perigo', dados.erro || 'Não foi possível enviar o link.');
        mostrarRecado('ok', dados.mensagem);
        el('formEsqueci').hidden = true;
      } catch (erro) {
        mostrarRecado('perigo', 'Sem conexão com o servidor. Tente de novo em instantes.');
      } finally {
        soltar();
      }
    });
  },

  // ---- REDEFINIR A SENHA (chega pelo link do e-mail) ----
  'redefinir-senha'() {
    const token = new URLSearchParams(location.search).get('token');
    // Tira o token do endereço: ele não deve ficar no histórico do navegador.
    history.replaceState(null, '', location.pathname);

    function linkInvalido(texto) {
      el('formRedefinir').hidden = true;
      mostrarRecado('perigo', texto || 'Este link não vale mais. Peça um novo.');
      el('linkVoltar').href = RAIZ + '/esqueci-senha';
      el('linkVoltar').textContent = 'Pedir um link novo';
    }

    (async () => {
      if (!token) return linkInvalido('Link incompleto. Peça um link novo em "Esqueci minha senha".');
      const { ok, dados } = await chamarApi('/api/usuario/redefinir-senha/verificar', { method: 'POST', body: JSON.stringify({ token }) });
      if (!ok) return linkInvalido(dados.erro);
      el('formRedefinir').hidden = false;
      el('senha').focus();
    })();

    el('formRedefinir').addEventListener('submit', async (evento) => {
      evento.preventDefault();
      mostrarRecado();

      const senha = el('senha').value;
      const repetida = el('confirmarSenha').value;
      erroNoCampo(el('senha'), senha.length >= 6 ? '' : 'A senha precisa de pelo menos 6 caracteres.');
      erroNoCampo(el('confirmarSenha'), senha === repetida ? '' : 'As duas senhas não são iguais.');
      if (senha.length < 6) return el('senha').focus();
      if (senha !== repetida) return el('confirmarSenha').focus();

      const soltar = ocupar(el('botaoSalvar'), 'Salvando...');
      const { ok, dados } = await chamarApi('/api/usuario/redefinir-senha', { method: 'POST', body: JSON.stringify({ token, senha }) });
      soltar();

      if (!ok) {
        if (dados.erro && dados.erro.includes('link')) return linkInvalido(dados.erro);
        return mostrarRecado('perigo', dados.erro || 'Não foi possível trocar a senha.');
      }

      el('formRedefinir').hidden = true;
      mostrarRecado('ok', 'Senha trocada! Agora é só entrar com a senha nova.');
      el('linkVoltar').textContent = 'Entrar';
    });
  },

  // ---- CONFIRMAR A TROCA DE E-MAIL (chega pelo link do e-mail) ----
  'confirmar-email'() {
    const token = new URLSearchParams(location.search).get('token');
    const botao = el('botaoConfirmar');

    (async () => {
      if (!token) {
        el('subtitulo').textContent = 'Este endereço está incompleto.';
        return mostrarRecado('perigo', 'O link não trouxe o código de confirmação. Abra de novo o link do e-mail.');
      }

      const { ok, dados } = await chamarApi('/api/usuario/confirmar-email/verificar', { method: 'POST', body: JSON.stringify({ token }) });
      if (!ok) {
        el('subtitulo').textContent = 'Este link não vale mais.';
        return mostrarRecado('perigo', dados.erro || 'Peça a troca de novo em Configurações.');
      }

      el('subtitulo').textContent = 'Confirme para passar a usar este endereço:';
      el('emailNovo').textContent = dados.email_novo;
      el('emailNovo').hidden = false;
      botao.hidden = false;
    })();

    botao.addEventListener('click', async () => {
      const soltar = ocupar(botao, 'Confirmando...');
      const { ok, dados } = await chamarApi('/api/usuario/confirmar-email', { method: 'POST', body: JSON.stringify({ token }) });

      if (!ok) {
        soltar();
        return mostrarRecado('perigo', dados.erro || 'Não foi possível confirmar.');
      }

      botao.hidden = true;
      el('emailNovo').hidden = true;
      el('subtitulo').textContent = 'Pronto!';
      mostrarRecado('ok', `Seu e-mail agora é ${dados.email}. Use ele para entrar a partir de agora.`);
      // O e-mail mudou: a sessão antiga é encerrada.
      Sessao.limpar();
      el('linkVoltar').hidden = false;
    });
  },

  // ---- EXCLUIR A CONTA (chega pelo link do e-mail) ----
  //
  // A página mostra o que some e o que fica, e só exclui depois que a
  // pessoa marca "Entendi" e clica. Nada é apagado só por abrir o link.
  'excluir-conta'() {
    const token = new URLSearchParams(location.search).get('token');
    const botao = el('botaoExcluir');
    let dadosDoLink = null;

    // "3 transações", ou nada se for zero: a lista mostra só o que existe.
    const item = (quantidade, um, varios, extra = '') =>
      quantidade > 0 ? `<li><strong>${plural(quantidade, um, varios)}</strong>${extra}</li>` : '';

    (async () => {
      if (!token) {
        el('subtitulo').textContent = 'Este endereço está incompleto.';
        return mostrarRecado('perigo', 'O link não trouxe o código de confirmação. Abra de novo o link do e-mail.');
      }

      const { ok, dados } = await chamarApi('/api/usuario/excluir-conta/verificar', { method: 'POST', body: JSON.stringify({ token }) });
      if (!ok) {
        el('subtitulo').textContent = 'Este link não vale mais.';
        mostrarRecado('perigo', dados.erro || 'Peça a exclusão de novo em Configurações.');
        el('linkVoltar').hidden = false;
        return;
      }

      dadosDoLink = dados;
      const r = dados.resumo;
      el('subtitulo').textContent = `Olá, ${dados.nome.split(' ')[0]}. Confira o que acontece se você continuar.`;
      el('listaSome').innerHTML =
        `<li><strong>Sua conta de acesso</strong>: nome, e-mail (${esc(dados.email)}), senha e CPF.</li>` +
        item(r.contas, 'conta', 'contas', ' com os saldos') +
        item(r.transacoes, 'gasto ou ganho registrado', 'gastos e ganhos registrados') +
        item(r.metas, 'meta', 'metas', ', com o que já foi guardado nelas') +
        item(r.limites, 'limite de gasto', 'limites de gasto') +
        item(r.categorias, 'categoria criada por você', 'categorias criadas por você') +
        item(r.bancos, 'banco conectado', 'bancos conectados', ' (só a conexão: nada muda no banco)') +
        '<li>Os perfis e o que você anotou nas ferramentas de Meu perfil, neste navegador.</li>';
      el('etapaDecidir').hidden = false;
    })();

    // O botão só acorda depois do "Entendi": um clique sem querer não basta.
    el('entendi').addEventListener('change', (evento) => {
      botao.disabled = !evento.target.checked;
    });

    botao.addEventListener('click', async () => {
      const soltar = ocupar(botao, 'Excluindo...');
      const { ok, dados } = await chamarApi('/api/usuario/excluir-conta', { method: 'POST', body: JSON.stringify({ token }) });

      if (!ok) {
        soltar();
        return mostrarRecado('perigo', dados.erro || 'Não foi possível excluir a conta.');
      }

      // O que a pessoa guardou neste navegador também sai. Se a sessão aberta
      // aqui era da conta excluída, ela é encerrada.
      const id = dadosDoLink.id_usuario;
      ['perfis_', 'perfil_ferramentas_', 'preferencias_', 'notificacoes_vistas_'].forEach((chave) => localStorage.removeItem(chave + id));
      if (String(Sessao.idUsuario()) === String(id)) Sessao.limpar();

      el('etapaConferindo').hidden = true;
      el('etapaDecidir').hidden = true;
      mostrarRecado('', '');
      el('textoFim').textContent = `Tudo o que era seu foi apagado do Verdanz, ${dados.nome.split(' ')[0]}. Obrigado por ter cuidado do seu dinheiro com a gente.`;
      el('ladoTexto').innerHTML = '<h2>Obrigado pela companhia.</h2>';
      el('etapaFim').hidden = false;
      el('tituloFim').focus();
    });
  },
};

TELAS[PAGINA_DE_ACESSO]?.();
