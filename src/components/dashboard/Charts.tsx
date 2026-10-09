import React, { memo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export interface ChartDataItem {
  name: string;
  value: number;
}

export interface ChartsColors {
  textPrimary?: string;
  textSecondary?: string;
  accent?: string;
}

export interface ChartsProps {
  incomeData?: ChartDataItem[];
  investmentData?: ChartDataItem[];
  expenseData?: ChartDataItem[];
  getCategoryStyle?: (categoryName: string) => { color: string };
  onSliceClick?: (data: any, chartType: 'income' | 'investment' | 'expense', chartTitle: string) => void;
  onChartClick?: (chartType: 'income' | 'investment' | 'expense', chartTitle: string) => void;
  colors?: ChartsColors;
}

const defaultColors: Required<ChartsColors> = {
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  accent: '#10b981',
};

const categoryPalette = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#a855f7', // Purple
  '#14b8a6', // Teal
];

const defaultGetCategoryStyle = (categoryName: string) => {
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % categoryPalette.length;
  return { color: categoryPalette[index] };
};

const formatCurrency = (val: number) => {
  return `R$ ${Number(val || 0).toFixed(2).replace('.', ',')}`;
};

const CustomTooltip = ({ active, payload, total }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const pct = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0.0';
    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-2xl text-xs space-y-1 ring-1 ring-white/10">
        <p className="font-semibold text-slate-900 dark:text-slate-100">{data.name}</p>
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold" style={{ color: data.fill }}>
            {formatCurrency(data.value)}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">({pct}%)</span>
        </div>
      </div>
    );
  }
  return null;
};

const Charts = ({
  incomeData = [],
  investmentData = [],
  expenseData = [],
  getCategoryStyle = defaultGetCategoryStyle,
  onSliceClick = () => {},
  onChartClick = () => {},
  colors = defaultColors,
}: ChartsProps) => {
  const chartData = [
    { type: 'income' as const, title: 'Distribuição de Receitas', data: incomeData, accentColor: '#10b981' },
    { type: 'investment' as const, title: 'Distribuição de Investimentos', data: investmentData, accentColor: '#3b82f6' },
    { type: 'expense' as const, title: 'Distribuição de Despesas', data: expenseData, accentColor: '#f43f5e' },
  ];

  const activeCharts = chartData.filter((chart) => chart.data && chart.data.length > 0);

  if (activeCharts.length === 0) {
    return null;
  }

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
      {activeCharts.map((chart, index) => {
        const total = chart.data.reduce((acc, curr) => acc + (curr.value || 0), 0);

        return (
          <div
            key={index}
            onClick={() => onChartClick(chart.type, chart.title)}
            className="bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer group hover:bg-white dark:hover:bg-slate-900 focus:outline-none focus:ring-0 select-none outline-none"
            title={`Filtrar ${chart.title}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{chart.title}</h3>
              <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                {formatCurrency(total)}
              </span>
            </div>

            <div className="relative w-full h-[260px] flex items-center justify-center outline-none focus:outline-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }} style={{ outline: 'none' }}>
                  <Pie
                    data={chart.data}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    cornerRadius={4}
                    dataKey="value"
                    nameKey="name"
                    onClick={(data, _index, e) => {
                      if (e && typeof e.stopPropagation === 'function') {
                        e.stopPropagation();
                      }
                      onSliceClick(data, chart.type, chart.title);
                    }}
                    className="cursor-pointer outline-none focus:outline-none"
                    style={{ outline: 'none' }}
                  >
                    {chart.data.map((entry, i) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={getCategoryStyle(entry.name)?.color || categoryPalette[i % categoryPalette.length]}
                        strokeWidth={2}
                        style={{ outline: 'none', stroke: 'var(--chart-cell-stroke)' }}
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    content={<CustomTooltip total={total} />}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Donut Label */}
              <div className="absolute top-[41%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Total</p>
                <p className="text-xs font-bold font-mono text-slate-800 dark:text-slate-200">
                  {formatCurrency(total)}
                </p>
              </div>
            </div>

            {/* Legenda em HTML normal (fora do SVG/container de altura fixa),
                pra quebrar linha certinho e nunca estourar o card, mesmo com
                muitas categorias. */}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-3 px-1">
              {chart.data.map((entry, i) => (
                <div key={`legend-${i}`} className="flex items-center gap-1.5 max-w-full">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: getCategoryStyle(entry.name)?.color || categoryPalette[i % categoryPalette.length] }}
                  />
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate max-w-[140px]">
                    {entry.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default memo(Charts);
