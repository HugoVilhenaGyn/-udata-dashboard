'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

// Contexto automático de tela para a Lisa (widget flutuante, disponível em
// todas as seções do painel). Cada página registra aqui uma descrição
// curta de onde o usuário está e, se fizer sentido, qual dado específico
// está em foco (ex: um imóvel selecionado) — isso é injetado no prompt da
// Lisa (ver /api/copiloto) como "contexto da tela atual", pra ela responder
// sem o usuário precisar re-explicar onde está ou copiar dados.
//
// Uso numa página:
//   useLisaScreenContext({
//     secao: 'Qualidade de Anúncios',
//     detalhe: `Olhando o imóvel ${imovel.codigo} — nota ${imovel.nota_qualidade}`,
//   });
//
// O contexto é local à página (some quando ela desmonta) — a última página
// visitada é sempre a que vale.

export interface LisaScreenContext {
  secao: string;
  detalhe?: string;
}

interface LisaContextValue {
  contexto: LisaScreenContext | null;
  setContexto: (ctx: LisaScreenContext | null) => void;
}

const LisaContext = createContext<LisaContextValue | null>(null);

export function LisaContextProvider({ children }: { children: React.ReactNode }) {
  const [contexto, setContexto] = useState<LisaScreenContext | null>(null);
  const value = useMemo(() => ({ contexto, setContexto }), [contexto]);
  return <LisaContext.Provider value={value}>{children}</LisaContext.Provider>;
}

// Hook interno usado pelo LisaWidget para ler o contexto atual.
export function useLisaContextValue(): LisaContextValue {
  const ctx = useContext(LisaContext);
  if (!ctx) {
    // Provider ausente (ex: tela chromeless) — devolve um valor inerte em
    // vez de quebrar a página.
    return { contexto: null, setContexto: () => {} };
  }
  return ctx;
}

// Hook que cada página chama para registrar seu contexto atual. Registra
// no mount/atualização das dependências e limpa no unmount.
export function useLisaScreenContext(ctx: LisaScreenContext | null) {
  const { setContexto } = useLisaContextValue();
  const secao = ctx?.secao;
  const detalhe = ctx?.detalhe;

  useEffect(() => {
    if (!secao) return;
    setContexto({ secao, detalhe });
    return () => setContexto(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secao, detalhe]);
}
