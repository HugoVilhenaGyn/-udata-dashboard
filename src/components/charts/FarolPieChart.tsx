'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DashboardKPIs } from '@/lib/types';

interface FarolPieChartProps {
  // Modo antigo (compatível): passa o kpis inteiro, sempre lê os campos de
  // VENDA (imoveis_venda_iminente etc). Continua funcionando sem mudanças.
  kpis?: DashboardKPIs;
  // Modo novo: valores explícitos — usado para renderizar o Farol de
  // Locação (que não tem campos próprios em DashboardKPIs) com o mesmo
  // componente, sem misturar contagem de venda com a de aluguel.
  iminente?: number;
  potencial?: number;
  baixo?: number;
  labels?: [string, string, string];
}

const COLORS = ['#22c55e', '#f59e0b', '#ef4444'];
const LABELS_VENDA: [string, string, string] = ['Venda Iminente', 'Venda Potencial', 'Baixo Potencial'];

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

export default function FarolPieChart({ kpis, iminente, potencial, baixo, labels }: FarolPieChartProps) {
  const valIminente = kpis ? kpis.imoveis_venda_iminente : (iminente ?? 0);
  const valPotencial = kpis ? kpis.imoveis_venda_potencial : (potencial ?? 0);
  const valBaixo = kpis ? kpis.imoveis_baixo_potencial : (baixo ?? 0);
  const total = valIminente + valPotencial + valBaixo;
  const lbls = labels || LABELS_VENDA;
  const data = [
    { name: lbls[0], value: valIminente, color: COLORS[0], total },
    { name: lbls[1], value: valPotencial, color: COLORS[1], total },
    { name: lbls[2], value: valBaixo, color: COLORS[2], total },
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
