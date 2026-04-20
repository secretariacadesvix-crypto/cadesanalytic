import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import type { ReportData } from '@/types/report';
import { formatCurrency } from '@/lib/pdfParser';

interface ReportChartsProps {
  data: ReportData;
}

const CHART_COLORS = [
  'hsl(212, 55%, 25%)',
  'hsl(174, 60%, 38%)',
  'hsl(38, 92%, 50%)',
  'hsl(262, 50%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(195, 70%, 45%)',
];

export function ReportCharts({ data }: ReportChartsProps) {
  const sectorValueData = data.setores.map(s => ({
    name: s.setor.length > 18 ? s.setor.substring(0, 18) + '…' : s.setor,
    valor: Math.round(s.valorTotal * 100) / 100,
  }));

  const sectorShiftData = data.setores.map(s => ({
    name: s.setor.length > 18 ? s.setor.substring(0, 18) + '…' : s.setor,
    plantoes: s.totalPlantoes,
  }));

  const turnoData = (() => {
    const diurno = data.registros.filter(r => r.turno === 'DIURNO');
    const noturno = data.registros.filter(r => r.turno === 'NOTURNO');
    return [
      { name: 'Diurno', value: diurno.reduce((s, r) => s + r.escalas, 0) },
      { name: 'Noturno', value: noturno.reduce((s, r) => s + r.escalas, 0) },
    ];
  })();

  const profissaoData = (() => {
    const map = new Map<string, number>();
    data.registros.forEach(r => {
      map.set(r.profissao, (map.get(r.profissao) || 0) + r.escalas);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  })();

  const CustomTooltipBar = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
          <p className="text-xs font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            {payload[0].name === 'valor' ? formatCurrency(payload[0].value) : payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Valor por setor */}
      <div className="stat-card">
        <h3 className="section-title mb-4">Valor Total por Setor</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={sectorValueData} margin={{ left: 10, right: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltipBar />} />
            <Bar dataKey="valor" fill="hsl(212, 55%, 25%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Plantões por setor */}
      <div className="stat-card">
        <h3 className="section-title mb-4">Plantões por Setor</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={sectorShiftData} margin={{ left: 10, right: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 9 }} />
            <Tooltip content={<CustomTooltipBar />} />
            <Bar dataKey="plantoes" fill="hsl(174, 60%, 38%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Distribuição por turno */}
      <div className="stat-card">
        <h3 className="section-title mb-4">Distribuição por Turno</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={turnoData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {turnoData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Distribuição por profissão */}
      <div className="stat-card">
        <h3 className="section-title mb-4">Distribuição por Profissão</h3>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={profissaoData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="value"
              label={({ name, percent }) => `${name.substring(0, 15)} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {profissaoData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
