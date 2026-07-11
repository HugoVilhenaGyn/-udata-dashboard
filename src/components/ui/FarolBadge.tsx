'use client';

import { FarolStatus } from '@/lib/types';
import { farolLabel } from '@/lib/mock-data';

interface FarolBadgeProps {
  status: FarolStatus;
  finalidade?: 'venda' | 'aluguel';
  size?: 'sm' | 'md';
  showDot?: boolean;
}

const config: Record<FarolStatus, { cls: string; dot: string }> = {
  venda_iminente: { cls: 'badge badge-iminente', dot: 'dot dot-iminente' },
  venda_potencial: { cls: 'badge badge-potencial', dot: 'dot dot-potencial' },
  baixo_potencial: { cls: 'badge badge-baixo', dot: 'dot dot-baixo' },
};

export default function FarolBadge({ status, finalidade, size = 'md', showDot = true }: FarolBadgeProps) {
  const { cls, dot } = config[status];
  return (
    <span className={cls} style={size === 'sm' ? { fontSize: '0.7rem', padding: '0.2rem 0.5rem' } : {}}>
      {showDot && <span className={dot} style={{ width: 6, height: 6 }} />