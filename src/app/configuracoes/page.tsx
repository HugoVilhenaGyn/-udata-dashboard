import { redirect } from 'next/navigation';

// A raiz de /configuracoes não tem conteúdo próprio — é sempre a aba
// "Geral". As sub-rotas (/configuracoes/geral, /configuracoes/lisa) são o
// que existe de fato; isso aqui só resolve o caso de alguém entrar direto
// em /configuracoes (bookmark antigo, digitação manual etc.).
export default function ConfiguracoesRedirectPage() {
  redirect('/configuracoes/geral');
}
