'use client';

import { useEffect, useState } from 'react';
import { mockImoveis } from './mock-data';
import { Imovel } from './types';

// Hook compartilhado pelas telas que antes liam mockImoveis (snapshot
// estático, compilado no build) direto. Agora busca o portfólio real do
// Postgres via /api/imoveis assim que a página monta, e cai de volta pro
// snapshot estático em caso de falha de rede (a tela nunca fica vazia).
// Enquanto o fetch não volta, usa o snapshot como estado inicial — a UI
// aparece imediatamente e é substituída pelo dado real quando chega,
// evitando uma tela em branco/loading longo.
export function useImoveis() {
  const [imoveis, setImoveis] = useState<Imovel[]>(mockImoveis);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch('/api/imoveis')
      .then(res => res.json())
      .then(json => {
        if (cancelado) return;
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setImoveis(json.data);
        } else {
          setErro(true);
        }
      })
      .catch(() => {
        if (!cancelado) setErro(true);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => { cancelado = true; };
  }, []);

  return { imoveis, loading, erro };
}
