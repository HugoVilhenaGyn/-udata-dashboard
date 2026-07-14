// Permissões de rota por cargo — fonte única de verdade, usada tanto pelo
// middleware (bloqueio real de navegação) quanto pelo Sidebar (esconder
// itens de menu que o cargo não acessa, pra não mostrar link que dá em
// "acesso negado"). Se um item for adicionado aqui, ele passa a valer nos
// dois lugares automaticamente.
//
// Nota sobre "/configuracoes/lisa": ele é ADMIN-only de propósito (é onde
// ficam as instruções de treinamento e os documentos de pesquisa da Lisa —
// não é operacional, é configuração sensível). "/configuracoes/geral" é
// liberado pros três cargos. Cada sub-rota é listada explicitamente (em vez
// de só "/configuracoes") justamente pra não abrir a aba Lisa por tabela
// via prefixo.
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    '/', '/copiloto', '/relatorios', '/farol', '/inventario', '/qualidade',
    '/receita', '/destaques', '/xml', '/avaliacao-admin', '/informativo-imovel',
    '/configuracoes', '/configuracoes/geral', '/configuracoes/lisa',
    '/orquestrador-treinamento', // rota antiga — só existe pra redirecionar pra /configuracoes/lisa
  ],
  MARKETING: [
    '/', '/copiloto', '/relatorios', '/farol', '/inventario', '/qualidade',
    '/destaques', '/avaliacao-admin', '/informativo-imovel', '/configuracoes/geral',
  ],
  CORRETOR: [
    '/', '/copiloto', '/relatorios', '/farol', '/inventario', '/qualidade',
    '/informativo-imovel', '/configuracoes/geral',
  ],
};
