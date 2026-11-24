// Pesquisa de perfil: três etapas numa tela só.
//
//   1. Intro      -> explica o que vem
//   2. Perguntas  -> uma por vez, com a barra de andamento
//   3. Escolha    -> a pessoa escolhe de 1 a 3 perfis (a sugestão é só sugestão)
//
// As perguntas, os perfis e a regra que transforma respostas em sugestão
// ficam em /js/perfil-perguntas.js, que só tem CONTEÚDO e tem teste próprio.
// Aqui fica só o andamento da tela.
//
// Os perfis escolhidos ficam no navegador (PerfisSalvos, em auth.js): o
// banco de dados não tem tabela de perfil.

if (!Sessao.token() || !Sessao.idUsuario()) {
  window.location.replace(RAIZ + '/entrar');
}

const el = (id) => document.getElementById(id);

let perguntaAtual = 0;
const respostas = {}; // número da pergunta -> lista das alternativas marcadas
let sugeridos = [];
let escolhidos = [];

// A última sugestão fica guardada, para quem volta poder pular as perguntas.
const SugestaoSalva = {
  chave: () => 'sugestao_perfis_' + Sessao.idUsuario(),
  salvar: (lista) => localStorage.setItem(SugestaoSalva.chave(), JSON.stringify(lista)),
  ler() {
    try {
      return JSON.parse(localStorage.getItem(this.chave())) || [];
    } catch (e) {
      return [];
    }
  },
};

const jaRespondeu = PerfisSalvos.ler().length > 0 || SugestaoSalva.ler().length > 0;

// ---- ETAPAS ----

function mostrarEtapa(id, focar) {
  ['etapaIntro', 'etapaPerguntas', 'etapaSelecao'].forEach((etapa) => (el(etapa).hidden = etapa !== id));
  window.scrollTo(0, 0);
  // O foco vai para o título da etapa: quem usa leitor de tela ouve onde está.
  if (focar) el(focar).focus();
}

// ---- PERGUNTAS ----

function mostrarPergunta() {
  const pergunta = PERGUNTAS[perguntaAtual];
  const total = PERGUNTAS.length;
  const porcento = Math.round(((perguntaAtual + 1) / total) * 100);

  el('contadorPergunta').textContent = `Pergunta ${perguntaAtual + 1} de ${total}`;
  el('barraProgresso').style.width = porcento + '%';
  el('trilhaProgresso').setAttribute('aria-valuenow', porcento);

  el('iconePergunta').innerHTML = `<i class="fa-solid ${pergunta.icone}"></i>`;
  el('textoPergunta').textContent = pergunta.texto;
  el('ajudaPergunta').textContent = pergunta.ajuda || 'Escolha a opção que mais combina com você.';

  el('botaoProxima').innerHTML =
    perguntaAtual === total - 1
      ? 'Ver meu resultado <i class="fa-solid fa-check" aria-hidden="true"></i>'
      : 'Próxima <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';

  desenharAlternativas();
}

function desenharAlternativas() {
  const pergunta = PERGUNTAS[perguntaAtual];
  const marcadas = respostas[perguntaAtual] || [];

  el('listaAlternativas').innerHTML = pergunta.alternativas
    .map((a, indice) => {
      const marcada = marcadas.includes(indice);
      // Bolinha = só uma resposta; quadradinho = pode marcar várias.
      return `
        <button type="button" class="alternativa" data-indice="${indice}" aria-pressed="${marcada}">
          <span class="icone" aria-hidden="true"><i class="fa-solid ${a.icone}"></i></span>
          <span><strong>${esc(a.texto)}</strong><small>${esc(a.sub || '')}</small></span>
          <span class="alternativa__marca ${pergunta.multipla ? 'alternativa__marca--caixa' : ''}" aria-hidden="true"><i class="fa-solid fa-check"></i></span>
        </button>`;
    })
    .join('');

  el('botaoProxima').disabled = marcadas.length === 0;
}

function marcar(indice) {
  const pergunta = PERGUNTAS[perguntaAtual];
  let marcadas = respostas[perguntaAtual] || [];

  if (!pergunta.multipla) {
    marcadas = [indice];
  } else if (marcadas.includes(indice)) {
    marcadas = marcadas.filter((i) => i !== indice);
  } else if (pergunta.alternativas[indice].exclusiva) {
    // "Nenhuma destas" desmarca todas as outras.
    marcadas = [indice];
  } else {
    marcadas = marcadas.filter((i) => !pergunta.alternativas[i].exclusiva);
    marcadas.push(indice);
  }

  respostas[perguntaAtual] = marcadas;
  desenharAlternativas();
  // A lista foi refeita: o foco volta para a alternativa clicada.
  el('listaAlternativas').children[indice].focus();
}

el('listaAlternativas').addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-indice]');
  if (botao) marcar(Number(botao.dataset.indice));
});

el('botaoComecar').addEventListener('click', () => {
  perguntaAtual = 0;
  mostrarPergunta();
  mostrarEtapa('etapaPerguntas', 'textoPergunta');
});

el('botaoProxima').addEventListener('click', () => {
  if (!(respostas[perguntaAtual] || []).length) return;

  if (perguntaAtual < PERGUNTAS.length - 1) {
    perguntaAtual++;
    mostrarPergunta();
    el('textoPergunta').focus();
    window.scrollTo(0, 0);
  } else {
    sugeridos = calcularSugestao(respostas);
    SugestaoSalva.salvar(sugeridos);
    abrirEscolha();
  }
});

el('botaoVoltar').addEventListener('click', () => {
  if (perguntaAtual > 0) {
    perguntaAtual--;
    mostrarPergunta();
    el('textoPergunta').focus();
  } else {
    mostrarEtapa('etapaIntro', null);
  }
});

// ---- ESCOLHA ----

// ["clt", "autonomo"] -> "CLT e Autônomo"
function juntarNomes(chaves) {
  const nomes = chaves.map((chave) => PERFIS[chave].nome);
  if (nomes.length <= 1) return nomes.join('');
  return nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
}

function abrirEscolha() {
  const atuais = PerfisSalvos.ler().filter((chave) => PERFIS[chave]);
  // Quem volta para trocar já começa com os perfis atuais marcados.
  escolhidos = atuais.slice(0, MAXIMO_PERFIS);

  let texto;
  if (sugeridos.length === 0) texto = 'Escolha de 1 a 3 perfis.';
  else if (sugeridos.length === 1) texto = `Pelas suas respostas, o perfil que mais combina com você agora é ${juntarNomes(sugeridos)}. É só uma sugestão: escolha de 1 a 3 perfis, sugeridos ou não.`;
  else texto = `Pelas suas respostas, os perfis que mais combinam com você agora são ${juntarNomes(sugeridos)}. É só uma sugestão: escolha de 1 a 3 perfis, sugeridos ou não.`;
  if (atuais.length > 0) texto += ` Seus perfis de hoje: ${juntarNomes(atuais)}.`;

  el('textoSugestao').textContent = texto;
  desenharPerfis();
  mostrarEtapa('etapaSelecao', 'tituloSelecao');
}

function desenharPerfis() {
  // Os sugeridos vêm primeiro.
  const ordem = [...sugeridos, ...Object.keys(PERFIS).filter((chave) => !sugeridos.includes(chave))];
  const cheio = escolhidos.length >= MAXIMO_PERFIS;

  el('listaPerfis').innerHTML = ordem
    .map((chave) => {
      const perfil = PERFIS[chave];
      const escolhido = escolhidos.includes(chave);
      const travado = !escolhido && cheio;

      return `
        <article class="cartao meta" style="${escolhido ? 'border-color: var(--verde-texto); background: var(--folha-clara)' : ''}">
          <div class="meta__topo">
            <span class="icone" ${escolhido ? 'style="background: var(--folha); color: var(--sobre-cor)"' : ''} aria-hidden="true"><i class="fa-solid ${perfil.icone}"></i></span>
            ${sugeridos.includes(chave) ? '<span class="capsula capsula--sol">Sugerido para você</span>' : ''}
          </div>
          <h2 style="font-size:1.25rem">${esc(perfil.nome)}</h2>
          <p class="suave pequeno"><strong>${esc(perfil.resumo)}</strong></p>
          <p class="suave pequeno">${esc(perfil.descricao)}</p>
          <button type="button" class="botao ${escolhido ? 'botao--escuro' : 'botao--linha'}" data-perfil="${chave}" aria-pressed="${escolhido}"
                  ${travado ? 'disabled title="Você já escolheu 3 perfis. Desmarque um para trocar."' : ''}>
            ${escolhido ? '<i class="fa-solid fa-check" aria-hidden="true"></i> Escolhido' : 'Sou eu'}<span class="so-leitor">: perfil ${esc(perfil.nome)}</span>
          </button>
        </article>`;
    })
    .join('');

  el('contadorEscolhidos').textContent = escolhidos.length;
  el('botaoConfirmar').disabled = escolhidos.length < MINIMO_PERFIS;
}

el('listaPerfis').addEventListener('click', (evento) => {
  const botao = evento.target.closest('[data-perfil]');
  if (!botao) return;

  const chave = botao.dataset.perfil;
  if (escolhidos.includes(chave)) escolhidos = escolhidos.filter((c) => c !== chave);
  else if (escolhidos.length < MAXIMO_PERFIS) escolhidos.push(chave);

  desenharPerfis();
  document.querySelector(`#listaPerfis [data-perfil="${chave}"]`).focus();
});

el('botaoRefazer').addEventListener('click', () => {
  Object.keys(respostas).forEach((chave) => delete respostas[chave]);
  perguntaAtual = 0;
  mostrarPergunta();
  mostrarEtapa('etapaPerguntas', 'textoPergunta');
});

el('botaoConfirmar').addEventListener('click', () => {
  if (escolhidos.length < MINIMO_PERFIS || escolhidos.length > MAXIMO_PERFIS) return;
  PerfisSalvos.salvar(escolhidos);
  // Direto para as ferramentas que acabaram de ser liberadas.
  window.location.href = RAIZ + '/meu-perfil';
});

el('quantasPerguntas').textContent = PERGUNTAS.length;

// Quem já respondeu antes pode pular as perguntas.
el('botaoPularIntro').hidden = !jaRespondeu;
el('botaoPularIntro').addEventListener('click', () => {
  sugeridos = SugestaoSalva.ler().filter((chave) => PERFIS[chave]);
  abrirEscolha();
});
