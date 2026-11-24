// Ferramentas pequenas usadas por TODAS as telas.
//
// Este arquivo vem depois do /js/auth.js, que continua sendo o lugar único
// da sessão (Sessao), das chamadas à API (chamarApi) e das regras de data e
// de situação de uma transação (statusTransacao, ehGasto...). Aqui ficam só
// as coisas de TELA: avisos, janelas, leitura de campos.

// ---- TEXTO ----

// Troca < > & por códigos antes de pôr um texto dentro do HTML. Sem isso,
// uma descrição como "<b>mercado</b>" seria lida como HTML pelo navegador.
function esc(texto) {
  const div = document.createElement('div');
  div.textContent = texto == null ? '' : String(texto);
  return div.innerHTML;
}

// plural(1, 'conta', 'contas') -> "1 conta";  plural(3, ...) -> "3 contas"
function plural(quantidade, um, varios) {
  return `${quantidade} ${quantidade === 1 ? um : varios}`;
}

// "Maria Aparecida Santos" -> "MS"
function iniciaisDe(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

// ---- DATAS POR EXTENSO ----

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// "2026-11" -> "novembro de 2026"
function nomeDoMes(chave) {
  const [ano, mes] = String(chave).split('-').map(Number);
  return `${MESES[mes - 1]} de ${ano}`;
}

// "2026-11-14" -> "14 de novembro"
function diaPorExtenso(iso) {
  const [, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]}`;
}

// "vence em 3 dias", "venceu ontem"... a partir da data do gasto.
function textoPrazo(iso) {
  const dias = diasAte(iso);
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias > 1) return `vence em ${dias} dias`;
  if (dias === -1) return 'venceu ontem';
  return `venceu há ${-dias} dias`;
}

// ---- DINHEIRO DIGITADO ----
//
// No Brasil a pessoa digita "1.500,50". O campo type="number" do navegador
// não entende vírgula em todo lugar, então os campos de dinheiro são de
// texto e a conversão é feita aqui. Devolve 0 quando não dá para entender.
function lerValor(origem) {
  const bruto = typeof origem === 'string' ? origem : origem.value;
  const texto = String(bruto).trim().replace(/^R\$\s*/, '');
  if (!texto) return 0;

  // "1.500" (ponto de milhar, sem centavos) e tudo que tem vírgula seguem o
  // padrão brasileiro. "1500.50" segue o padrão do teclado numérico.
  const soMilhar = /^\d{1,3}(\.\d{3})+$/.test(texto);
  const normalizado = texto.includes(',') || soMilhar ? texto.replace(/\./g, '').replace(',', '.') : texto;

  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero * 100) / 100 : 0;
}

// Campo de dinheiro só aceita o que forma um valor: números, ponto e
// vírgula. Uma letra digitada (ou colada) some na hora, em vez de virar um
// erro só depois. O sinal de menos só vale nos campos com data-negativo
// (o saldo de uma conta, que pode estar no negativo), e só no começo.
//
// Vale para todo campo com inputmode="decimal", em qualquer tela, porque o
// ouvinte fica no documento inteiro (inclusive nos campos criados depois).
// Os campos inputmode="numeric" (como o CPF) ficam de fora de propósito.
document.addEventListener('input', (evento) => {
  const campo = evento.target;
  if (!(campo instanceof HTMLInputElement) || campo.inputMode !== 'decimal') return;

  const original = campo.value;
  let limpo = original.replace(/[^\d.,\-−]/g, '');

  if (campo.hasAttribute('data-negativo')) {
    const negativo = /^\s*[-−]/.test(original);
    limpo = (negativo ? '-' : '') + limpo.replace(/[-−]/g, '');
  } else {
    limpo = limpo.replace(/[-−]/g, '');
  }

  if (limpo === original) return;

  // Devolve o cursor para onde ele estava, descontando o que foi tirado.
  const cursor = campo.selectionStart - (original.length - limpo.length);
  campo.value = limpo;
  campo.setSelectionRange(Math.max(0, cursor), Math.max(0, cursor));
  // "true" = fase de captura: a limpeza acontece ANTES dos ouvintes da
  // própria tela, que assim já recebem o valor limpo.
}, true);

// 1500.5 -> "1.500,50" (para preencher um campo de dinheiro)
function valorNoCampo(numero) {
  return Number(numero || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- CATEGORIAS: ÍCONE E COR ----
//
// Cada categoria do sistema tem um ícone próprio, para ser reconhecida
// antes de ser lida. As categorias que a pessoa cria usam a etiqueta.
const VISUAL_DAS_CATEGORIAS = {
  'Alimentação': { icone: 'fa-utensils', cor: 'sol' },
  'Compras': { icone: 'fa-bag-shopping', cor: 'lilas' },
  'Educação': { icone: 'fa-book-open', cor: 'ceu' },
  'Lazer': { icone: 'fa-masks-theater', cor: 'lilas' },
  'Metas': { icone: 'fa-flag', cor: 'folha' },
  'Moradia': { icone: 'fa-house', cor: 'ceu' },
  'Outras despesas': { icone: 'fa-ellipsis', cor: '' },
  'Saúde': { icone: 'fa-heart-pulse', cor: 'coral' },
  'Transporte': { icone: 'fa-bus', cor: 'sol' },
  'Freelance': { icone: 'fa-laptop', cor: 'folha' },
  'Investimentos': { icone: 'fa-chart-line', cor: 'folha' },
  'Outras receitas': { icone: 'fa-ellipsis', cor: 'folha' },
  'Salário': { icone: 'fa-money-bill-wave', cor: 'folha' },
  'Transferência enviada': { icone: 'fa-right-left', cor: 'ceu' },
  'Transferência recebida': { icone: 'fa-right-left', cor: 'ceu' },
};

function visualDaCategoria(categoria) {
  const doSistema = !categoria.id_usuario && !categoria.personalizada;
  const conhecido = doSistema && VISUAL_DAS_CATEGORIAS[categoria.nome_categoria];
  if (conhecido) return conhecido;
  return { icone: 'fa-tag', cor: categoria.tipo === 'receita' ? 'folha' : '' };
}

function iconeDaCategoria(categoria, extra = '') {
  const v = visualDaCategoria(categoria);
  return `<span class="icone ${v.cor ? 'icone--' + v.cor : ''} ${extra}" aria-hidden="true"><i class="fa-solid ${v.icone}"></i></span>`;
}

// ---- SITUAÇÃO DE UMA TRANSAÇÃO ----
//
// A regra de qual é a situação fica em statusTransacao (auth.js). Aqui só
// se decide a cor e o texto da etiqueta. "Pago" e "Recebido" não ganham
// etiqueta: são o caso normal, e etiqueta em tudo deixa de chamar atenção.
const ETIQUETA_DA_SITUACAO = {
  pendente: { texto: 'Pendente', cor: 'sol', icone: 'fa-regular fa-clock' },
  atrasado: { texto: 'Atrasado', cor: 'coral', icone: 'fa-solid fa-triangle-exclamation' },
  previsto: { texto: 'Previsto', cor: 'ceu', icone: 'fa-regular fa-calendar' },
};

function etiquetaDaSituacao(situacao) {
  const e = ETIQUETA_DA_SITUACAO[situacao];
  if (!e) return '';
  return `<span class="capsula capsula--${e.cor}"><i class="${e.icone}" aria-hidden="true"></i> ${e.texto}</span>`;
}

// ---- AVISOS RÁPIDOS ----
//
// Aparecem no pé da tela e somem sozinhos. role="status" faz o leitor de
// tela ler o aviso sem tirar a pessoa de onde ela está.
function avisar(texto, tipo = 'ok') {
  let caixa = document.querySelector('.torradas');
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.className = 'torradas';
    caixa.setAttribute('role', 'status');
    caixa.setAttribute('aria-live', 'polite');
    document.body.appendChild(caixa);
  }

  const aviso = document.createElement('div');
  aviso.className = 'torrada' + (tipo === 'erro' ? ' torrada--erro' : '');
  aviso.innerHTML = `<i class="fa-solid ${tipo === 'erro' ? 'fa-circle-exclamation' : 'fa-circle-check'}" aria-hidden="true"></i><span>${esc(texto)}</span>`;
  caixa.appendChild(aviso);

  // Erro fica mais tempo: precisa ser lido com calma.
  setTimeout(() => aviso.remove(), tipo === 'erro' ? 9000 : 6000);
}

// Recado fixo dentro da tela (não some): explicações e alertas.
function recado(tipo, html) {
  const icones = { info: 'fa-circle-info', ok: 'fa-circle-check', atencao: 'fa-triangle-exclamation', perigo: 'fa-triangle-exclamation' };
  return `<div class="recado ${tipo === 'info' ? '' : 'recado--' + tipo}"><i class="fa-solid ${icones[tipo]}" aria-hidden="true"></i><div>${html}</div></div>`;
}

// ---- JANELAS ----
//
// Usam a tag <dialog> do próprio navegador. Com showModal() ela já escurece
// o fundo, prende a tecla Tab dentro da janela e fecha com Esc.

// Liga o comportamento comum de uma janela: botões [data-fechar] e o
// clique no fundo escuro fecham.
function prepararJanela(janela) {
  janela.addEventListener('click', (evento) => {
    // Clique direto no <dialog> = clique no fundo escuro (o conteúdo fica
    // dentro de um filho, que ocupa a janela inteira).
    if (evento.target === janela || evento.target.closest('[data-fechar]')) janela.close();
  });
}

function abrirJanela(janela) {
  if (!janela.dataset.pronta) {
    prepararJanela(janela);
    janela.dataset.pronta = 'sim';
  }
  janela.showModal();
}

// Pergunta de sim ou não. Devolve uma Promise: true se confirmou.
//
//   const sim = await confirmar({ titulo: 'Excluir?', mensagem: '...' });
//
// "aviso" é o destaque do que não tem volta. "perigo: false" deixa o botão
// de confirmar verde (para perguntas que não apagam nada).
function confirmar({ titulo, mensagem = '', aviso = '', textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar', perigo = true }) {
  return new Promise((resolver) => {
    const janela = document.createElement('dialog');
    janela.className = 'janela';
    janela.innerHTML = `
      <div class="janela__corpo">
        <h2>${esc(titulo)}</h2>
        ${mensagem ? `<p class="suave">${esc(mensagem)}</p>` : ''}
        ${aviso ? recado(perigo ? 'perigo' : 'atencao', esc(aviso)) : ''}
        <div class="fila fila--fim">
          ${textoCancelar ? `<button type="button" class="botao botao--linha" value="nao">${esc(textoCancelar)}</button>` : ''}
          <button type="button" class="botao ${perigo ? 'botao--perigo' : ''}" value="sim">${esc(textoConfirmar)}</button>
        </div>
      </div>`;

    document.body.appendChild(janela);

    janela.addEventListener('click', (evento) => {
      const botao = evento.target.closest('button');
      if (botao) janela.close(botao.value);
      else if (evento.target === janela) janela.close('nao');
    });

    // 'close' acontece em todos os casos: botão, Esc ou clique no fundo.
    janela.addEventListener('close', () => {
      janela.remove();
      resolver(janela.returnValue === 'sim');
    });

    janela.showModal();
  });
}

// Só um aviso com "Entendi".
function informar({ titulo, mensagem }) {
  return confirmar({ titulo, mensagem, textoConfirmar: 'Entendi', textoCancelar: '', perigo: false });
}

// ---- CAMPOS ----

// Mostra ou limpa o erro embaixo de um campo. O campo precisa ter, logo
// depois dele, um <p class="erro" id="IDdoCampoErro" hidden>.
function erroNoCampo(campo, mensagem) {
  const erro = document.getElementById(campo.id + 'Erro');
  campo.setAttribute('aria-invalid', mensagem ? 'true' : 'false');
  if (!erro) return;
  erro.textContent = mensagem || '';
  erro.hidden = !mensagem;
}

// Trava o botão enquanto a API responde, para um clique duplo não gravar
// duas vezes. Devolve a função que destrava.
function ocupar(botao, textoEnquanto) {
  const original = botao.innerHTML;
  botao.disabled = true;
  if (textoEnquanto) botao.textContent = textoEnquanto;
  return () => {
    botao.disabled = false;
    botao.innerHTML = original;
  };
}

// Avisa as telas de que algo mudou no servidor (um gasto novo, uma conta
// paga...). Cada tela escuta 'verdanz:mudou' e busca os dados de novo.
function anunciarMudanca() {
  document.dispatchEvent(new CustomEvent('verdanz:mudou'));
}

// Saldo digitado: igual ao lerValor, mas aceita zero e valor negativo
// (o saldo de uma conta pode estar negativo). Devolve null se não der
// para entender o que foi digitado.
function lerSaldo(campo) {
  const texto = String(campo.value).trim().replace(/^R\$\s*/, '');
  if (!texto) return 0;

  const negativo = /^[-−]/.test(texto);
  const semSinal = texto.replace(/^[-−+]\s*/, '');
  if (/^[0.,\s]+$/.test(semSinal)) return 0;

  const valor = lerValor(semSinal);
  if (!valor) return null;
  return negativo ? -valor : valor;
}
