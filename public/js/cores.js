// Paleta de cores do Verdanz, num lugar só.
//
// Carregado em TODAS as telas logo depois do Tailwind (cdn.tailwindcss.com).
// Cada cor vira classe do Tailwind: 'brand' gera bg-brand, text-brand,
// border-brand... Para mudar uma cor no site inteiro, muda-se só aqui.
//
// A base veio da tela de perguntas (Perguntas.html do Victor):
//   brand / brandDark / soft / softBorder / ink / sub
//
// Em cima dela entram:
//   fundo  → o fundo claro das páginas, um verde acinzentado da mesma
//            família da barra lateral
//   mata   → o verde escuro da barra lateral; 'claro' é o hover e o quadro de baixo
//   menta  → verde claro, para destaques sobre o fundo escuro da barra
//   azul   → o azul do degradê da logo. Marca a página atual na barra
//            lateral e preenche o medidor de progresso; 'suave' é o trilho
//            do medidor e o sombreado dos botões da barra lateral
//   ceu, coral, sol, lavanda → cores de apoio, vivas mas suaves. Cada uma
//     tem a versão forte (DEFAULT, para ícone e texto) e a 'suave' (fundo).
//     São usadas para diferenciar coisas, nunca como enfeite:
//       ceu     = saldo e contas
//       brand   = ganhos (receitas)
//       coral   = gastos (despesas) e ações de excluir
//       sol     = metas
//       lavanda = dicas

tailwind.config = {
  theme: {
    extend: {
      colors: {
        brand: '#1f9d55',
        brandDark: '#15803d',
        soft: '#eafcf1',
        softBorder: '#d5f3e0',
        ink: '#0f2e1c',
        sub: '#6b8579',

        fundo: '#e9f0eb',
        mata: {
          DEFAULT: '#1e5a41',
          claro: '#287052',
        },
        menta: '#7ee2a8',
        azul: { DEFAULT: '#2b56a3', suave: '#9cbcf7' },

        ceu: { DEFAULT: '#2b8fc4', suave: '#e7f3fa' },
        coral: { DEFAULT: '#e0604a', suave: '#fdecea', escuro: '#c24a36' },
        sol: { DEFAULT: '#d98e1f', suave: '#fdf3e1' },
        lavanda: { DEFAULT: '#7467d4', suave: '#efedfb' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
};
