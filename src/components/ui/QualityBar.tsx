'use client';

import { qualidadeColor } from '@/lib/mock-data';
import styles from './QualityBar.module.css';

interface QualityBarProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function QualityBar({ score, showLabel = true, size = 'md' }: QualityBarProps) {
  const color = qualidadeColor(score);
  const pct = (score / 10) * 100;

  const heights: Record<string, number> = { sm: 4, md: 6, lg: 8 };
  const height = heights[size];

  const label =
    score >= 8.5 ? 'Excelente' :
    score >= 7 ? 'Bom' :
    score >= 5 ? 'Regular' :
    'Baixo';

  return (
    <div className={styles.wrapper}>
      <div className={styles.track} style={{ height }}>
        <div
          className={styles.fill}
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {showLabel && (
        <div className={styles.labels}>
          <span style={{ color }} className={styles.score}>{score.toFixed(1)}</span>
          <span className={styles.label}>{label}</span>
        </div>
      )}
    </div>
  );
}
