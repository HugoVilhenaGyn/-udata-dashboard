import { redirect } from 'next/navigation';

// Essa tela mudou de lugar — o treinamento da Lisa agora vive dentro de
// Configurações, junto com o resto da conta/imobiliária, em vez de ser um
// item solto no menu principal. Isso aqui só existe pra não quebrar link
// antigo/favorito.
export default function OrquestradorTreinamentoRedirectPage() {
  redirect('/configuracoes/lisa');
}
