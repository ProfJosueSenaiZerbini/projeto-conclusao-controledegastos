const { emCentavos } = require('./saldo');

// Regras dos avisos do sininho.
//
// Nenhum aviso é gravado no banco: cada um sai dos dados que já existem
// (transações, metas, contas e limites) e do dia de hoje. Pagou a conta, o
// aviso some sozinho, sem nada para apagar.
//
// Só tem regra aqui: quem busca os dados é o notificacaoController. Isso
// permite testar pelo Node, sem banco:
//
//     node Docs/Testes/teste-notificacoes.js

// Com quantos dias de antecedência avisar.
const DIAS_AVISO_CONTA = 3;
const DIAS_AVISO_META = 30;

const UM_DIA = 24 * 60 * 60 * 1000;

// As duas datas são "puras" (sem horário), então a conta dá um número inteiro.
function diasAte(data, hoje) {
  return Math.round((new Date(data).getTime() - hoje.getTime()) / UM_DIA);
}

// A data que marca o fim do período de aviso, para a consulta ao banco.
function diasDepois(hoje, dias) {
  return new Date(hoje.getTime() + dias * UM_DIA);
}

// O sinal de menos vai junto do número, depois do "R$": "R$ -12,00", e
// não "-R$ 12,00" (o padrão do toLocaleString). Igual a formatarMoeda, em
// public/js/auth.js.
function moeda(valor) {
  const centavos = Math.round(Number(valor || 0) * 100);
  const texto = (Math.abs(centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return centavos < 0 ? texto.replace(/^R\$\s*/, 'R$\u00a0-') : texto;
}

// 'vence' + 0 -> "vence hoje"; 'vence' + 1 -> "vence amanhã"; 'vence' + 5 -> "vence em 5 dias".
function textoPrazo(verbo, dias) {
  if (dias === 0) return `${verbo} hoje`;
  if (dias === 1) return `${verbo} amanhã`;
  return `${verbo} em ${dias} dias`;
}

function avisoConta(transacao, hoje) {
  const dias = diasAte(transacao.data_transacao, hoje);
  const atrasada = dias < 0;
  const nome = transacao.descricao || transacao.categoria.nome_categoria;
  const valor = moeda(transacao.valor_transacao);

  let prazo = textoPrazo('vence', dias);
  if (dias === -1) prazo = 'venceu ontem';
  if (dias < -1) prazo = `venceu há ${-dias} dias`;

  return {
    // A chave muda quando o aviso piora: a conta que atrasa avisa de novo.
    chave: `conta:${transacao.id_transacao}:${atrasada ? 'atrasada' : 'vence'}`,
    tipo: 'conta',
    gravidade: atrasada ? 'alerta' : 'atencao',
    titulo: atrasada ? 'Conta atrasada' : 'Conta a pagar',
    mensagem: `${nome} · ${valor} · ${prazo}`,
    link: '/transacoes',
  };
}

function avisoMeta(meta, hoje) {
  const dias = diasAte(meta.data_limite, hoje);
  const vencida = dias < 0;
  const falta = moeda((emCentavos(meta.valor_alvo) - emCentavos(meta.valor_atual)) / 100);

  return {
    chave: `meta:${meta.id_meta}:${vencida ? 'vencida' : 'perto'}`,
    tipo: 'meta',
    gravidade: vencida ? 'alerta' : 'atencao',
    titulo: vencida ? 'Meta com prazo vencido' : 'Meta perto do prazo',
    mensagem: vencida
      ? `${meta.titulo} · faltam ${falta}`
      : `${meta.titulo} · faltam ${falta} · ${textoPrazo('termina', dias)}`,
    link: '/metas',
  };
}

function avisoSaldo(conta) {
  return {
    chave: `saldo:${conta.id_conta}`,
    tipo: 'saldo',
    gravidade: 'alerta',
    titulo: 'Saldo negativo',
    mensagem: `${conta.nome} · ${moeda(conta.saldo)}`,
    link: '/contas',
  };
}

function avisoLimite(limite, hoje) {
  const estourado = limite.situacao === 'estourado';
  const mes = hoje.toISOString().slice(0, 7);
  const gasto = `${moeda(limite.gasto_mes)} de ${moeda(limite.valor_limite)} este mês`;

  return {
    // O mês na chave: o limite renova no dia 1, e o aviso de outubro não
    // pode esconder o de novembro.
    chave: `limite:${limite.id_limite}:${mes}:${limite.situacao}`,
    tipo: 'limite',
    gravidade: estourado ? 'alerta' : 'atencao',
    titulo: estourado ? 'Limite de gasto ultrapassado' : 'Limite de gasto quase no fim',
    mensagem: `${limite.nome_categoria} · ${gasto}`,
    link: '/metas',
  };
}

// Recebe os dados já filtrados pelo dono e devolve a lista de avisos,
// com os mais graves primeiro.
function montarNotificacoes({ hoje, contasAPagar, metas, contas, limites }) {
  const avisos = [
    ...contasAPagar.map((t) => avisoConta(t, hoje)),
    ...metas.map((m) => avisoMeta(m, hoje)),
    ...contas.filter((c) => c.saldo < 0).map(avisoSaldo),
    ...limites.filter((l) => l.situacao !== 'ok').map((l) => avisoLimite(l, hoje)),
  ];

  // O sort mantém a ordem original dentro de cada gravidade.
  return avisos.sort((a, b) => (a.gravidade === b.gravidade ? 0 : a.gravidade === 'alerta' ? -1 : 1));
}

module.exports = { DIAS_AVISO_CONTA, DIAS_AVISO_META, diasDepois, montarNotificacoes };
