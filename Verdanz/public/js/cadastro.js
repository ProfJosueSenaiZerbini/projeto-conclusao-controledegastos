// Tela de cadastro: envia os dados para POST /api/usuario
// e, dando certo, leva o usuário para a tela de login.

const formCadastro = document.getElementById('formCadastro');
const botaoCadastrar = document.getElementById('botaoCadastrar');
const campoCpfCnpj = document.getElementById('cpf_cnpj');

// ---- MÁSCARA DE CPF / CNPJ ----
//
// Só os DÍGITOS importam para o sistema. Os pontos, barra e traço
// existem apenas para o olho humano — por isso são adicionados aqui
// na tela e removidos de novo antes de enviar para a API.
//
// A regra de qual formato usar é o tamanho:
//   até 11 dígitos  -> CPF   000.000.000-00
//   acima de 11     -> CNPJ  00.000.000/0000-00

function somenteDigitos(valor) {
  // \D significa "qualquer coisa que NÃO é dígito"
  return valor.replace(/\D/g, '');
}

function formatarCpfCnpj(valor) {
  // Corta em 14: é o maior documento possível (CNPJ).
  const digitos = somenteDigitos(valor).slice(0, 14);

  if (digitos.length <= 11) {
    // CPF: 000.000.000-00
    return digitos
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  // CNPJ: 00.000.000/0000-00
  return digitos
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

// O evento 'input' dispara a cada tecla E também ao colar texto.
// Como reescrevemos o valor a cada digitação, letras e símbolos
// simplesmente nunca chegam a aparecer no campo.
campoCpfCnpj.addEventListener('input', function () {
  campoCpfCnpj.value = formatarCpfCnpj(campoCpfCnpj.value);
});

formCadastro.addEventListener('submit', async function (event) {
  // Sem isso o navegador recarrega a página e o fetch nunca acontece.
  event.preventDefault();
  esconderMensagem();

  const dados = {
    nome_usuario: document.getElementById('nome_usuario').value.trim(),
    // Manda SÓ os dígitos, sem a máscara. Se gravássemos formatado,
    // "123.456.789-00" e "12345678900" seriam considerados documentos
    // diferentes pelo banco, furando a regra de campo único.
    cpf_cnpj: somenteDigitos(campoCpfCnpj.value),
    email: document.getElementById('email').value.trim(),
    senha: document.getElementById('senha').value,
  };

  // Validação no navegador é só conveniência — dá resposta imediata
  // sem ir até o servidor. A validação que VALE é a do controller,
  // porque o cliente pode ser burlado.
  if (!dados.nome_usuario || !dados.cpf_cnpj || !dados.email || !dados.senha) {
    mostrarMensagem('Preencha todos os campos.', 'erro');
    return;
  }

  // CPF tem 11 dígitos, CNPJ tem 14. Qualquer outro tamanho está incompleto.
  if (dados.cpf_cnpj.length !== 11 && dados.cpf_cnpj.length !== 14) {
    mostrarMensagem('Documento incompleto: CPF tem 11 dígitos e CNPJ tem 14.', 'erro');
    return;
  }

  // Trava o botão para não criar dois usuários com duplo clique.
  botaoCadastrar.disabled = true;
  botaoCadastrar.textContent = 'Criando conta...';

  try {
    const { ok, dados: resposta } = await chamarApi('/api/usuario', {
      method: 'POST',
      body: JSON.stringify(dados),
    });

    if (!ok) {
      // O controller já devolve mensagens prontas e legíveis
      // ("Email já cadastrado", "A senha deve ter no mínimo 6 caracteres").
      mostrarMensagem(resposta.erro || 'Não foi possível criar a conta.', 'erro');
      return;
    }

    mostrarMensagem('Conta criada com sucesso! Redirecionando...', 'sucesso');
    setTimeout(() => (window.location.href = '/login'), 1200);
  } catch (erro) {
    mostrarMensagem('Erro de conexão com o servidor.', 'erro');
  } finally {
    botaoCadastrar.disabled = false;
    botaoCadastrar.textContent = 'Criar conta';
  }
});
