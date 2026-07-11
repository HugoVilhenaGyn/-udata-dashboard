'use client';

import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import styles from './KpiCard.module.css';

interface KpiCardProps {
  title: string;
  value: string;
  change?: number;        // % change vs previous period
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  accent?: boolean;
  subtitle?: string;
}

export default function KpiCard({
  title, value, change, changeLabel = 'vs. mês anterior', icon: Icon, iconColor = '#6366f1', accent = false, subtitle,
}: KpiCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className={`${styles.card} ${accent ? styles.cardAccent : ''}`}>
      <div className={styles.top}>
        <span className={styles.title}>{title}</span>
        <div className={styles.iconWrap} style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}30` }}>
          <Icon size={16} color={iconColor} />
        </div>
      </div>

      <div className={styles.value}>{value}</div>

      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}

      {change !== undefined && (
        <div className={`${styles.change} ${isPositive ? styles.changePos : isNegative ? styles.changeNeg : styles.changeNeutral}`}>
          {isPositive ? <TrendingUp size={12} /> : isNegative ? <TrendingDown size={12} /> : <Minus size={12} />}
          <span>{isPositive ? '+' : ''}{change.toFixed(1)}%</span>
          <span className={styles.changeLabel}>{changeLabel}</span>
        </div>
      )}
    </div>
  );
}
