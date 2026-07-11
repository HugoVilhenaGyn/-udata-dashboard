'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { RevenueData } from '@/lib/types';

interface RevenueChartProps {
  data: RevenueData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    return (
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.75rem',
        fontSize: '0.8rem',
        minWidth: 200,
      }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>{label}</div>
        {payload.map((entry: any) => (
          <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
            <span style={{ color: entry.fill }}>{entry.name}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{fmt(entry.value)}</span>
          </div>
        ))}
        {payload.length === 2 && (
          <div style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Realizado</span>
            <span style={{ color: payload[1].value >= payload[0].value ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>
              {((payload[1].value / payload[0].value) * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: 20, bottom: 5 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `R$${(v / 1000000).toFixed(1)}M`}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{value}</span>}
          />
          <Bar dataKey="receita_projetada" name="Projetada" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.6} />
          <Bar dataKey="receita_inferida" name="Inferida" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
