// Tela de perfil: pesquisa + seleção.
//
// As perguntas, os perfis e a regra de sugestão vêm do perfil-perguntas.js
// (PERFIS, PERGUNTAS, calcularSugestao). Este arquivo só cuida da tela:
// mostrar a etapa certa, guardar as respostas e a escolha final.

// ---- ESTADO DA TELA ----
// Tudo o que a tela "lembra" fica nestas variáveis.

let perguntaAtual = 0;

// { indiceDaPergunta: [indicesDasAlternativasMarcadas] }
// Sempre uma lista, mesmo nas perguntas de uma resposta só — assim a
// mesma lógica serve para os dois tipos de pergunta.
const respostas = {};

// ---- SUGESTÃO SALVA ----
// A ideia é a pessoa responder as perguntas UMA vez só. Por isso a
// sugestão da pesquisa fica guardada: quem volta pelo "Trocar perfis" e
// pula as perguntas continua vendo quais perfis foram sugeridos.
// Mesmo esquema do PerfisSalvos: o id do usuário vai na chave.
const SugestaoSalva = {
  chave() {
    return 'sugestao_perfis_' + Sessao.idUsuario();
  },
  salvar(lista) {
    localStorage.setItem(this.chave(), JSON.stringify(lista));
  },
  ler() {
    try {
      return JSON.parse(localStorage.getItem(this.chave())) || [];
    } catch (e) {
      return [];
    }
  },
};

// Perfis marcados na etapa de seleção.
//
// REGRA: um perfil só fica marcado quando a pessoa clica nele, ali, na
// hora. Por isso a seleção SEMPRE abre vazia — depois das perguntas, ao
// pular as perguntas e ao refazer. Nem a sugestão nem a escolha antiga
// marcam nada sozinhas: a sugestão vira só o selo "Sugerido para você",
// e os perfis atuais aparecem só como texto.
let selecionados = [];

// Perfis sugeridos pela pesquisa.
let sugeridos = [];

// Já fez a pesquisa antes? Quem já tem perfil salvo, ou uma sugestão
// guardada, pode pular as perguntas.
const jaRespondeu = PerfisSalvos.ler().length > 0 || SugestaoSalva.ler().length > 0;

// ---- TROCA DE ETAPA ----

const ETAPAS = ['etapaIntro', 'etapaPerguntas', 'etapaSelecao'];

function mostrarEtapa(idEtapa) {
  ETAPAS.forEach((id) => {
    document.getElementById(id).classList.toggle('hidden', id !== idEtapa);
  });

  // No cabeçalho: "1 de 7" durante as perguntas, "Olá, Fulano" no resto.
  const naPesquisa = idEtapa === 'etapaPerguntas';
  document.getElementById('contadorPergunta').classList.toggle('hidden', !naPesquisa);
  document.getElementById('saudacao').classList.toggle('hidden', naPesquisa);

  animarEntrada(document.getElementById(idEtapa));
  window.scrollTo(0, 0);
}

// Reinicia a animação de entrada (a classe precisa sair e voltar).
function animarEntrada(elemento) {
  elemento.classList.remove('entrando');
  void elemento.offsetWidth; // força o navegador a "perceber" a remoção
  elemento.classList.add('entrando');
}

// Cria um <i> do Font Awesome. aria-hidden porque o ícone é só enfeite:
// o texto ao lado já diz tudo para quem usa leitor de tela.
function criarIcone(classe) {
  const i = document.createElement('i');
  i.className = 'fa-solid ' + classe;
  i.setAttribute('aria-hidden', 'true');
  return i;
}

// ---- ETAPA 1: INTRODUÇÃO ----

function montarIntro() {
  const lista = document.getElementById('listaPerfisIntro');

  Object.values(PERFIS).forEach((perfil) => {
    const cartao = document.createElement('div');
    cartao.className = 'rounded-2xl border border-slate-200 bg-white p-4 flex flex-col items-center';
    cartao.innerHTML = `
      <div class="w-11 h-11 rounded-full bg-soft text-brand flex items-center justify-center text-lg"></div>
      <p class="font-bold text-sm mt-3"></p>
      <p class="text-[11.5px] text-sub mt-1 leading-snug"></p>
    `;
    cartao.querySelector('div').appendChild(criarIcone(perfil.icone));
    // textContent em vez de colocar o texto no innerHTML: o navegador trata
    // como texto puro, nunca como HTML. É um bom hábito mesmo com texto fixo.
    cartao.querySelectorAll('p')[0].textContent = perfil.nome;
    cartao.querySelectorAll('p')[1].textContent = perfil.resumo;
    lista.appendChild(cartao);
  });
}

document.getElementById('botaoComecar').addEventListener('click', function () {
  perguntaAtual = 0;
  mostrarPergunta();
  mostrarEtapa('etapaPerguntas');
});

// ---- ETAPA 2: PERGUNTAS ----

const botaoProxima = document.getElementById('botaoProxima');

function mostrarPergunta() {
  const pergunta = PERGUNTAS[perguntaAtual];
  const total = PERGUNTAS.length;

  // Progresso: "1 de 7" e a barrinha (a barra conta a pergunta atual,
  // como na Perguntas.html: na 1ª já aparece um pedaço preenchido).
  const porcentagem = Math.round(((perguntaAtual + 1) / total) * 100);
  document.getElementById('contadorPergunta').textContent = `${perguntaAtual + 1} de ${total}`;
  document.getElementById('barraProgresso').style.width = porcentagem + '%';
  document.getElementById('trilhaProgresso').setAttribute('aria-valuenow', porcentagem);

  const iconePergunta = document.getElementById('iconePergunta');
  iconePergunta.innerHTML = '';
  iconePergunta.appendChild(criarIcone(pergunta.icone));

  document.getElementById('textoPergunta').textContent = pergunta.texto;
  document.getElementById('ajudaPergunta').textContent =
    pergunta.ajuda || 'Escolha a opção que mais combina com você.';

  // Na última pergunta o botão muda de nome.
  const ultima = perguntaAtual === total - 1;
  botaoProxima.innerHTML = ultima
    ? 'Ver resultado <i class="fa-solid fa-check" aria-hidden="true"></i>'
    : 'Próximo <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>';

  desenharAlternativas();
  animarEntrada(document.getElementById('conteudoPergunta'));
}

// A bolinha (resposta única) ou o quadradinho (múltipla) à direita de
// cada alternativa — o mesmo código visual que o usuário já conhece.
function marcadorHtml(marcada, multipla) {
  if (multipla) {
    return `<span class="w-5 h-5 shrink-0 rounded-md border flex items-center justify-center
                  ${marcada ? 'bg-brand border-brand' : 'border-slate-300 bg-white'}">
              ${marcada ? '<i class="fa-solid fa-check text-white text-[10px]" aria-hidden="true"></i>' : ''}
            </span>`;
  }
  return `<span class="w-5 h-5 shrink-0 rounded-full border flex items-center justify-center
                ${marcada ? 'border-brand' : 'border-slate-300 bg-white'}">
            ${marcada ? '<span class="w-2.5 h-2.5 rounded-full bg-brand"></span>' : ''}
          </span>`;
}

function desenharAlternativas() {
  const pergunta = PERGUNTAS[perguntaAtual];
  const marcadas = respostas[perguntaAtual] || [];
  const lista = document.getElementById('listaAlternativas');
  lista.innerHTML = '';

  pergunta.alternativas.forEach((alternativa, indice) => {
    const marcada = marcadas.includes(indice);

    const botao = document.createElement('button');
    botao.type = 'button';
    // aria-pressed avisa leitores de tela que a alternativa está marcada.
    botao.setAttribute('aria-pressed', marcada);
    botao.className =
      'w-full flex items-center gap-3 text-left border rounded-xl px-4 py-3 transition ' +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ' +
      (marcada ? 'border-brand bg-soft' : 'border-slate-200 bg-white hover:border-brand/50');

    botao.innerHTML = `
      <span class="w-9 h-9 shrink-0 rounded-lg bg-soft text-brand flex items-center justify-center"></span>
      <span class="flex-1">
        <span class="block text-[13.5px] font-semibold text-ink" data-campo="texto"></span>
        <span class="block text-[11.5px] text-sub mt-0.5" data-campo="sub"></span>
      </span>
      ${marcadorHtml(marcada, pergunta.multipla)}
    `;
    botao.querySelector('span').appendChild(criarIcone(alternativa.icone));
    botao.querySelector('[data-campo="texto"]').textContent = alternativa.texto;
    botao.querySelector('[data-campo="sub"]').textContent = alternativa.sub || '';

    botao.addEventListener('click', () => marcarAlternativa(indice));
    lista.appendChild(botao);
  });

  // Só deixa avançar depois de responder.
  botaoProxima.disabled = marcadas.length === 0;
}

function marcarAlternativa(indice) {
  const pergunta = PERGUNTAS[perguntaAtual];
  let marcadas = respostas[perguntaAtual] || [];

  if (!pergunta.multipla) {
    // Resposta única: a nova escolha substitui a anterior.
    marcadas = [indice];
  } else if (marcadas.includes(indice)) {
    // Múltipla, já marcada: desmarca.
    marcadas = marcadas.filter((i) => i !== indice);
  } else if (pergunta.alternativas[indice].exclusiva) {
    // "Nenhuma destas" não faz sentido junto com outra opção.
    marcadas = [indice];
  } else {
    // Marcou uma opção normal: tira o "Nenhuma destas", se estava marcado.
    marcadas = marcadas.filter((i) => !pergunta.alternativas[i].exclusiva);
    marcadas.push(indice);
  }

  respostas[perguntaAtual] = marcadas;
  desenharAlternativas();

  // Redesenhar a lista apaga o botão que tinha o foco. Devolve o foco
  // para a mesma alternativa, senão quem usa teclado "se perde" na tela.
  document.getElementById('listaAlternativas').children[indice].focus();
}

botaoProxima.addEventListener('click', function () {
  // Confere de novo: o botão desabilitado é só conveniência.
  if (!(respostas[perguntaAtual] || []).length) return;

  if (perguntaAtual < PERGUNTAS.length - 1) {
    perguntaAtual++;
    mostrarPergunta();
  } else {
    mostrarSelecao();
  }
});

document.getElementById('botaoVoltar').addEventListener('click', function () {
  if (perguntaAtual > 0) {
    perguntaAtual--;
    mostrarPergunta();
  } else {
    mostrarEtapa('etapaIntro');
  }
});

// ---- ETAPA 3: SELEÇÃO ----

// Junta os nomes no jeito brasileiro: "CLT", "CLT e Estudante",
// "CLT, Estudante e Autônomo".
function juntarNomes(chaves) {
  const nomes = chaves.map((chave) => PERFIS[chave].nome);
  if (nomes.length <= 1) return nomes.join('');
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

// Fim das perguntas: calcula a sugestão, guarda e abre a seleção.
function mostrarSelecao() {
  sugeridos = calcularSugestao(respostas);
  SugestaoSalva.salvar(sugeridos);
  abrirSelecao();
}

// "Pular perguntas": vai direto para a seleção, mostrando a sugestão da
// última pesquisa (só o selo, como sempre).
function pularPerguntas() {
  sugeridos = SugestaoSalva.ler().filter((chave) => PERFIS[chave]);
  abrirSelecao();
}

function abrirSelecao() {
  // A seleção sempre começa vazia (ver a REGRA lá em cima).
  selecionados = [];

  const texto = document.getElementById('textoSugestao');

  if (sugeridos.length === 0) {
    texto.textContent = 'Escolha de 1 a 3 perfis. ';
  } else {
    texto.textContent =
      sugeridos.length === 1
        ? `Pelas suas respostas, o perfil que mais combina com você agora é ${juntarNomes(sugeridos)}. `
        : `Pelas suas respostas, os perfis que mais combinam com você agora são ${juntarNomes(sugeridos)}. `;
    texto.textContent += 'É só uma sugestão: escolha de 1 a 3 perfis, sugeridos ou não. ';
  }

  // Quem está trocando de perfil vê quais tem hoje, mas só como
  // informação: para continuar com eles, basta clicar neles de novo.
  const atuais = PerfisSalvos.ler().filter((chave) => PERFIS[chave]);
  if (atuais.length > 0) {
    texto.textContent += `Seus perfis atuais: ${juntarNomes(atuais)}.`;
  }

  esconderMensagem();
  desenharCartoesSelecao();
  mostrarEtapa('etapaSelecao');
}

// Os dois botões "Pular perguntas" (na abertura e nas perguntas) só
// aparecem para quem já fez a pesquisa uma vez.
['botaoPularIntro', 'botaoPularPerguntas'].forEach((id) => {
  const botao = document.getElementById(id);
  botao.classList.toggle('hidden', !jaRespondeu);
  botao.addEventListener('click', pularPerguntas);
});

function desenharCartoesSelecao() {
  const lista = document.getElementById('listaPerfisSelecao');
  lista.innerHTML = '';

  // Sugeridos primeiro, na ordem da pontuação; depois os demais.
  const outros = Object.keys(PERFIS).filter((chave) => !sugeridos.includes(chave));
  const ordem = [...sugeridos, ...outros];

  const limiteAtingido = selecionados.length >= MAXIMO_PERFIS;

  ordem.forEach((chave) => {
    const perfil = PERFIS[chave];
    const sugerido = sugeridos.includes(chave);
    const selecionado = selecionados.includes(chave);

    const cartao = document.createElement('div');
    cartao.className =
      'relative bg-white rounded-2xl p-5 border transition flex flex-col ' +
      (selecionado ? 'border-brand bg-soft' : 'border-slate-200');

    cartao.innerHTML = `
      ${sugerido ? `<span class="absolute -top-3 left-5 px-3 py-1 rounded-full text-[11px] font-bold
                       bg-brand text-white">
                       <i class="fa-solid fa-star mr-1" aria-hidden="true"></i> Sugerido para você</span>` : ''}
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 shrink-0 rounded-full bg-soft text-brand
                    flex items-center justify-center text-lg" data-campo="icone"></div>
        <div>
          <h3 class="font-bold text-base" data-campo="nome"></h3>
          <p class="text-xs text-sub" data-campo="resumo"></p>
        </div>
      </div>
      <p class="text-sm text-sub mt-3 flex-1 leading-relaxed" data-campo="descricao"></p>
    `;
    cartao.querySelector('[data-campo="icone"]').appendChild(criarIcone(perfil.icone));
    cartao.querySelector('[data-campo="nome"]').textContent = 'Perfil ' + perfil.nome;
    cartao.querySelector('[data-campo="resumo"]').textContent = perfil.resumo;
    cartao.querySelector('[data-campo="descricao"]').textContent = perfil.descricao;

    // Botão "Me identifiquei", igual ao modelo de baixa fidelidade.
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.setAttribute('aria-pressed', selecionado);
    botao.setAttribute('aria-label', (selecionado ? 'Desmarcar perfil ' : 'Escolher perfil ') + perfil.nome);
    // Com 3 escolhidos, os outros cartões ficam travados até desmarcar um.
    botao.disabled = !selecionado && limiteAtingido;
    if (botao.disabled) botao.title = 'Você já escolheu 3 perfis. Desmarque um para trocar.';
    botao.className =
      'mt-4 w-full py-2.5 rounded-xl font-semibold text-sm transition ' +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ' +
      'disabled:opacity-40 disabled:cursor-not-allowed ' +
      (selecionado
        ? 'bg-brand text-white hover:bg-brandDark'
        : 'bg-white border border-brand text-brand hover:bg-soft');
    botao.innerHTML = selecionado
      ? '<i class="fa-solid fa-check mr-2" aria-hidden="true"></i> Selecionado'
      : 'Me identifiquei';
    botao.addEventListener('click', () => alternarPerfil(chave));

    cartao.appendChild(botao);
    lista.appendChild(cartao);
  });

  document.getElementById('contadorSelecionados').textContent = selecionados.length;
  document.getElementById('botaoConfirmar').disabled = selecionados.length < MINIMO_PERFIS;
}

function alternarPerfil(chave) {
  if (selecionados.includes(chave)) {
    selecionados = selecionados.filter((c) => c !== chave);
  } else if (selecionados.length < MAXIMO_PERFIS) {
    selecionados.push(chave);
  }
  esconderMensagem();
  desenharCartoesSelecao();
}

document.getElementById('botaoRefazer').addEventListener('click', function () {
  // Refazer é começar do zero: apaga as respostas E os perfis marcados.
  // O que está salvo só muda quando a pessoa confirmar a nova escolha —
  // se ela sair no meio, os perfis antigos continuam valendo.
  Object.keys(respostas).forEach((chave) => delete respostas[chave]);
  selecionados = [];
  perguntaAtual = 0;
  mostrarPergunta();
  mostrarEtapa('etapaPerguntas');
});

document.getElementById('botaoConfirmar').addEventListener('click', function () {
  // Confere a regra de novo: o botão desabilitado é só conveniência,
  // quem garante a regra é esta checagem.
  if (selecionados.length < MINIMO_PERFIS || selecionados.length > MAXIMO_PERFIS) {
    mostrarMensagem('Escolha de 1 a 3 perfis.', 'erro');
    return;
  }

  PerfisSalvos.salvar(selecionados);
  window.location.href = '/dashboard';
});

montarIntro();
