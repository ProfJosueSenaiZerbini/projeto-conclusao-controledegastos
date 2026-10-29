// Funções compartilhadas pelas telas de cadastro, login e dashboard.
// Carregado ANTES dos outros scripts em cada tela.

// ---- SESSÃO ----
// O token fica no localStorage: uma "gavetinha" do navegador que
// sobrevive ao fechar a aba. É o meio mais simples e o mais comum
// em projetos deste porte.
//
// Trade-off que vale saber: o localStorage é lido por JavaScript,
// então é vulnerável a XSS. A alternativa mais segura seria um
// cookie httpOnly, que o JavaScript não consegue ler.

const Sessao = {
  salvar(token, id_usuario) {
    localStorage.setItem('token', token);
    localStorage.setItem('id_usuario', id_usuario);
  },

  token() {
    return localStorage.getItem('token');
  },

  idUsuario() {
    return localStorage.getItem('id_usuario');
  },

  limpar() {
    localStorage.removeItem('token');
    localStorage.removeItem('id_usuario');
  },
};

// ---- PERFIS ESCOLHIDOS ----
// Por enquanto os perfis ficam só no navegador, porque o banco ainda não
// tem tabela de perfil (o escopo atual tem 5 entidades). A chave leva o id
// do usuário para que duas pessoas no mesmo computador não misturem perfis.
//
// Limitação conhecida: entrando por outro navegador, a pesquisa aparece de
// novo. Isso se resolve quando os perfis passarem a ser gravados no banco.
//
// Não é apagado no Sessao.limpar() de propósito: sair da conta não muda
// o perfil de ninguém.

const PerfisSalvos = {
  chave() {
    return 'perfis_' + Sessao.idUsuario();
  },

  salvar(listaDePerfis) {
    localStorage.setItem(this.chave(), JSON.stringify(listaDePerfis));
  },

  // Devolve a lista salva, ou [] se o usuário ainda não escolheu.
  ler() {
    try {
      return JSON.parse(localStorage.getItem(this.chave())) || [];
    } catch (e) {
      return [];
    }
  },

  // Apaga TUDO o que foi guardado no navegador sobre o perfil de um
  // usuário: os perfis escolhidos, a sugestão da pesquisa e o que ele
  // digitou nas ferramentas do Meu perfil.
  //
  // Recebe o id explicitamente (e não o da sessão) porque é chamada no
  // cadastro, quando ainda não existe sessão do usuário novo.
  //
  // Por que isso é necessário: as chaves usam o id do usuário
  // ("perfis_1"). Se o banco for zerado durante os testes, o próximo
  // cadastro ganha de novo o id 1 e "herdaria" os perfis de quem usou
  // esse número antes. Um usuário novo tem que começar sem nada.
  apagarTudo(idUsuario) {
    ['perfis_', 'sugestao_perfis_', 'perfil_ferramentas_'].forEach((prefixo) =>
      localStorage.removeItem(prefixo + idUsuario)
    );
  },
};

// ---- MENSAGENS NA TELA ----
// Mostra o aviso no <div id="mensagem"> em vez de usar alert(),
// que trava a página e tem aparência de site antigo.

function mostrarMensagem(texto, tipo) {
  const caixa = document.getElementById('mensagem');
  if (!caixa) return;

  const cores = {
    erro: 'bg-red-50 text-red-700 border border-red-200',
    sucesso: 'bg-green-50 text-green-700 border border-green-200',
  };

  caixa.className = 'mb-5 px-4 py-3 rounded-xl text-sm ' + (cores[tipo] || cores.erro);
  caixa.textContent = texto;
}

function esconderMensagem() {
  const caixa = document.getElementById('mensagem');
  if (caixa) caixa.className = 'hidden';
}

// ---- FORMATAÇÃO ----
// Usado pelas telas de contas, transações, metas e pelo dashboard.
// O Intl cuida do padrão brasileiro sozinho: R$, ponto de milhar,
// vírgula decimal e as duas casas obrigatórias.

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

// ---- VALORES GRANDES CABENDO NO CARD ----
//
// Um valor como "R$ 10.000.000.000,00" não cabe num card estreito, e não
// pode quebrar linha no meio do número. Esta função diminui a letra, de
// 1 em 1 pixel, até o texto caber na largura do elemento.
//
// Para funcionar, o elemento precisa de "whitespace-nowrap" (uma linha só)
// e o card de "min-w-0" (senão o card cresce junto com o texto e nunca
// "falta espaço"). Se nem no tamanho mínimo couber, o "text-ellipsis" do
// elemento corta com "...", e o valor completo aparece ao passar o mouse.
function caberNaLargura(elemento, minimoPx = 14) {
  // Volta ao tamanho original da classe (text-2xl) antes de medir: o valor
  // pode ter diminuído, ou a tela pode ter ficado mais larga.
  elemento.style.fontSize = '';
  elemento.title = elemento.textContent;

  let tamanho = parseFloat(getComputedStyle(elemento).fontSize);

  // scrollWidth = largura que o texto precisa; clientWidth = largura que tem.
  while (elemento.scrollWidth > elemento.clientWidth && tamanho > minimoPx) {
    tamanho -= 1;
    elemento.style.fontSize = tamanho + 'px';
  }
}

// "2026-09-06T00:00:00.000Z" -> "06/09/2026"
// Fatiamos a string em vez de usar new Date() de propósito: o construtor
// converteria para o fuso local e a data poderia "voltar" um dia.
function formatarData(iso) {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

// ---- DATAS E STATUS DE PAGAMENTO ----
// Usado pelas telas de transações e pelo dashboard.

// A data de hoje no formato "2026-10-22", no fuso do navegador.
// Não usamos toISOString() de propósito: ele converte para UTC, e
// depois das 21h no Brasil já devolveria o dia seguinte.
function hojeTexto() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${hoje.getFullYear()}-${mes}-${dia}`;
}

// Quantos dias faltam até a data (negativo = já passou). Date.UTC nos
// dois lados deixa a conta livre de fuso e de horário de verão.
function diasAte(iso) {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
  const [anoHoje, mesHoje, diaHoje] = hojeTexto().split('-').map(Number);
  const umDia = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(ano, mes - 1, dia) - Date.UTC(anoHoje, mesHoje - 1, diaHoje)) / umDia);
}

// A situação de uma transação, calculada na hora (não fica no banco):
//
//   gasto: 'pago'      → tem data de pagamento
//          'atrasado'  → não pago e a data já passou
//          'pendente'  → não pago, vence hoje ou depois
//   ganho: 'previsto'  → data futura (ainda não entrou no saldo)
//          'recebido'  → data de hoje ou de antes
//
// Datas no formato "AAAA-MM-DD" podem ser comparadas como texto:
// "2026-10-30" > "2026-10-22" dá o mesmo resultado que comparar datas.
function statusTransacao(t) {
  const data = String(t.data_transacao).slice(0, 10);
  const hoje = hojeTexto();

  if (t.categoria.tipo === 'receita') {
    return data > hoje ? 'previsto' : 'recebido';
  }

  if (t.data_pagamento) return 'pago';
  return data < hoje ? 'atrasado' : 'pendente';
}

// Guardar dinheiro numa meta gera uma transação de despesa na categoria
// "Metas" (ver metaController.js): o dinheiro sai da conta, então o saldo
// precisa dessa transação. Mas ele NÃO foi gasto — continua da pessoa,
// guardado. Por isso fica de fora de toda soma de GASTOS (despesas do mês,
// gastos por categoria, médias das ferramentas de perfil). Sem isso, quanto
// mais a pessoa guarda, mais "gastadora" o Verdanz acha que ela é.
//
// O nome basta para reconhecer: "Metas" é categoria do sistema e nenhum
// usuário consegue criar outra com esse nome (categoriaController.js).
function ehDinheiroGuardado(t) {
  return t.categoria.nome_categoria === 'Metas' && !t.categoria.id_usuario;
}

// Gasto de verdade: despesa que não é dinheiro guardado numa meta.
function ehGasto(t) {
  return t.categoria.tipo === 'despesa' && !ehDinheiroGuardado(t);
}

// ---- CHAMADAS À API ----
// Centraliza o fetch para não repetir cabeçalhos e tratamento de erro.
// Devolve sempre { ok, status, dados } para quem chamou decidir o que fazer.

async function chamarApi(url, opcoes = {}) {
  const cabecalhos = { 'Content-Type': 'application/json' };

  // Se houver token guardado, manda junto. É assim que o servidor
  // sabe quem está pedindo: Authorization: Bearer <token>
  const token = Sessao.token();
  if (token) {
    cabecalhos['Authorization'] = 'Bearer ' + token;
  }

  const resposta = await fetch(url, {
    ...opcoes,
    headers: { ...cabecalhos, ...(opcoes.headers || {}) },
  });

  let dados = {};
  try {
    dados = await resposta.json();
  } catch (e) {
    // Resposta sem corpo JSON — segue com objeto vazio.
  }

  return { ok: resposta.ok, status: resposta.status, dados };
}
