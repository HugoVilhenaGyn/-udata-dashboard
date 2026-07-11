'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DashboardKPIs } from '@/lib/types';

interface FarolPieChartProps {
  kpis: DashboardKPIs;
}

const COLORS = ['#22c55e', '#f59e0b', '#ef4444'];
const LABELS = ['Venda Iminente', 'Venda Potencial', 'Baixo Potencial'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.625rem 0.875rem',
        fontSize: '0.8rem',
      }}>
        <div style={{ color: entry.payload.color, fontWeight: 600 }}>{entry.name}</div>
        <div style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>{entry.value} imóveis</div>
        <div style={{ color: 'var(--text-muted)' }}>{((entry.value / entry.payload.total) * 100).toFixed(1)}% do portfólio</div>
      </div>
    );
  }
  return null;
};

export default function FarolPieChart({ kpis }: FarolPieChartProps) {
  const total = kpis.total_imoveis;
  const data = [
    { name: LABELS[0], value: kpis.imoveis_venda_iminente, color: COLORS[0], total },
    { name: LABELS[1], value: kpis.imoveis_venda_potencial, color: COLORS[1], total },
    { name: LABELS[2], value: kpis.imoveis_baixo_potencial, color: COLORS[2], total },
  ];

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={4}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
