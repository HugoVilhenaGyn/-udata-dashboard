// Rate limiter simples em memória para proteger endpoints sensíveis (hoje,
// só o login) contra força bruta — sem isso, nada impedia um script de
// tentar milhares de senhas seguidas contra /api/auth/login.
//
// Por que em memória (um Map) e não Redis/banco: o BrokerImobAI roda com
// `instances: 1` no PM2 (ver ecosystem.config.js) — um único processo Node,
// então um Map em memória do processo já é compartilhado por todas as
// requisições sem precisar de infraestrutura extra. Isso é suficiente pro
// tamanho atual da operação (poucos usuários, um servidor). Se um dia o
// app passar a rodar em múltiplas instâncias/processos (cluster com mais
// de 1 worker, ou múltiplos servidores atrás de um load balancer), esse
// contador para de ser compartilhado entre processos e precisa migrar pra
// um store externo (Redis é o padrão de mercado). Deixamos esse ponto
// registrado aqui de propósito para não se perder na próxima mudança de
// infraestrutura.
//
// Reinicia a cada `pm2 restart` — aceitável: um restart de deploy não deve
// ser a única defesa contra um ataque em andamento, mas zerar o contador
// ocasionalmente não é um risco real pra esse caso de uso.

interface Tentativas {
  falhas: number;
  primeiraFalhaEm: number;
  bloqueadoAte?: number;
}

const registro = new Map<string, Tentativas>();

// Configuração do limite de tentativas de login:
// 5 tentativas erradas em 15 minutos -> bloqueia por mais 15 minutos.
const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000;
const BLOQUEIO_MS = 15 * 60 * 1000;

// Limpeza oportunista pra não deixar o Map crescer pra sempre em memória —
// roda a cada checagem, custo desprezível (Map pequeno: poucos IPs/emails
// tentando login por vez num sistema desse porte).
function limparExpirados(agora: number) {
  for (const [chave, dado] of registro) {
    const expirouBloqueio = dado.bloqueadoAte && agora > dado.bloqueadoAte;
    const expirouJanela = !dado.bloqueadoAte && agora - dado.primeiraFalhaEm > JANELA_MS;
    if (expirouBloqueio || expirouJanela) {
      registro.delete(chave);
    }
  }
}

export interface StatusLimite {
  bloqueado: boolean;
  tentativasRestantes: number;
  retryAfterSegundos?: number;
}

// Chama antes de validar a senha — só para checar se essa chave (IP ou
// email) já está bloqueada por excesso de tentativas anteriores.
export function checarLimite(chave: string): StatusLimite {
  const agora = Date.now();
  limparExpirados(agora);

  const dado = registro.get(chave);
  if (!dado) {
    return { bloqueado: false, tentativasRestantes: MAX_TENTATIVAS };
  }

  if (dado.bloqueadoAte) {
    if (agora < dado.bloqueadoAte) {
      return {
        bloqueado: true,
        tentativasRestantes: 0,
        retryAfterSegundos: Math.ceil((dado.bloqueadoAte - agora) / 1000),
      };
    }
    // Bloqueio expirou — libera.
    registro.delete(chave);
    return { bloqueado: false, tentativasRestantes: MAX_TENTATIVAS };
  }

  return { bloqueado: false, tentativasRestantes: Math.max(0, MAX_TENTATIVAS - dado.falhas) };
}

// Chama depois de uma tentativa de login com senha errada (ou email
// inexistente) — soma uma falha e bloqueia se estourou o limite.
export function registrarFalha(chave: string): void {
  const agora = Date.now();
  const dado = registro.get(chave);

  if (!dado || agora - dado.primeiraFalhaEm > JANELA_MS) {
    registro.set(chave, { falhas: 1, primeiraFalhaEm: agora });
    return;
  }

  dado.falhas += 1;
  if (dado.falhas >= MAX_TENTATIVAS) {
    dado.bloqueadoAte = agora + BLOQUEIO_MS;
  }
}

// Chama depois de um login bem-sucedido — zera o contador dessa chave,
// pra um usuário legítimo que errou a senha algumas vezes não continuar
// penalizado depois de acertar.
export function limparTentativas(chave: string): void {
  registro.delete(chave);
}
