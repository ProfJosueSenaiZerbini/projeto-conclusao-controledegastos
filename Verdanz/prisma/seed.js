const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // ---- PERFIS ----
    const perfis = [
        {
            nome_perfil: 'CLT',
            descricao: 'Trabalhador registrado em carteira',
            regra_economica_sugerida: 'Renda fixa mensal — ideal para orçamento 50/30/20',
        },
        {
            nome_perfil: 'Autônomo',
            descricao: 'Freelancer, prestador de serviço ou MEI',
            regra_economica_sugerida: 'Renda variável — priorizar reserva e provisão de impostos',
        },
        {
            nome_perfil: 'Desempregado',
            descricao: 'Pessoa em transição profissional',
            regra_economica_sugerida: 'Foco em controle de despesas essenciais',
        },
        {
            nome_perfil: 'Doméstico',
            descricao: 'Responsável pela administração das despesas da casa',
            regra_economica_sugerida: 'Controle de repasses e contas fixas da residência',
        },
        {
            nome_perfil: 'Estudante',
            descricao: 'Estudante com ou sem renda própria',
            regra_economica_sugerida: 'Foco em gastos com educação e transporte',
        },
        {
            nome_perfil: 'Aposentado',
            descricao: 'Beneficiário de aposentadoria ou pensão',
            regra_economica_sugerida: 'Renda fixa — atenção a gastos recorrentes com saúde',
        },
    ];

    for (const perfil of perfis) {
        await prisma.perfil.upsert({
            where: { nome_perfil: perfil.nome_perfil },
            update: {},
            create: perfil,
        });
    }

    console.log('Perfis criados.');

    // ---- PERGUNTAS ----
    const perguntasPorPerfil = {
        'CLT': [
            'Você recebe benefícios como vale-alimentação/refeição?',
            'Você costuma receber 13º salário e férias?',
            'Sua empresa desconta algum valor fixo (ex: plano de saúde, previdência privada) direto do salário?',
        ],
        'Autônomo': [
            'Sua renda varia muito entre os meses (alta sazonalidade)?',
            'Você já reserva dinheiro para impostos (MEI, IR)?',
            'Você tem despesas fixas relacionadas ao seu trabalho (ex: ferramentas, material, transporte)?',
        ],
        'Desempregado': [
            'Você está recebendo seguro-desemprego atualmente?',
            'Você tem uma reserva de emergência?',
            'Você tem alguma fonte de renda temporária enquanto busca emprego?',
        ],
        'Doméstico': [
            'Você recebe algum tipo de repasse/mesada para as despesas da casa?',
            'Você administra as contas de outra pessoa (ex: cônjuge)?',
            'Você tem alguma fonte de renda própria, além do repasse recebido?',
        ],
        'Estudante': [
            'Você recebe mesada, bolsa ou trabalha meio período?',
            'Você tem gastos fixos com material escolar/transporte?',
            'Você paga mensalidade (curso/faculdade) ou possui bolsa integral?',
        ],
        'Aposentado': [
            'Sua aposentadoria é sua única fonte de renda?',
            'Você tem gastos recorrentes com saúde/medicamentos?',
            'Você ainda realiza algum trabalho remunerado paralelo à aposentadoria?',
        ],
    };

    for (const [nomePerfil, perguntas] of Object.entries(perguntasPorPerfil)) {
        const perfil = await prisma.perfil.findUnique({
            where: { nome_perfil: nomePerfil },
        });

        for (const texto of perguntas) {
            const existente = await prisma.perguntaFormulario.findFirst({
                where: { texto_pergunta: texto, id_perfil: perfil.id_perfil },
            });

            if (!existente) {
                await prisma.perguntaFormulario.create({
                    data: { texto_pergunta: texto, id_perfil: perfil.id_perfil },
                });
            }
        }
    }

    console.log('Perguntas criadas.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });