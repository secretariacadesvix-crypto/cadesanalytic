import { Users, Clock, Calendar, Building2, DollarSign } from 'lucide-react';
import type { ReportData } from '@/types/report';
import { formatCurrency, formatNumber } from '@/lib/pdfParser';

interface SummaryCardsProps {
  data: ReportData;
}

const cards = [
  { key: 'profissionais', label: 'Profissionais', icon: Users, color: 'text-chart-1' },
  { key: 'plantoes', label: 'Plantões', icon: Calendar, color: 'text-chart-2' },
  { key: 'horas', label: 'Horas Trabalhadas', icon: Clock, color: 'text-chart-3' },
  { key: 'setores', label: 'Setores Atendidos', icon: Building2, color: 'text-chart-4' },
  { key: 'valor', label: 'Valor Total', icon: DollarSign, color: 'text-chart-2' },
] as const;

export function SummaryCards({ data }: SummaryCardsProps) {
  const values: Record<string, string> = {
    profissionais: formatNumber(data.totalProfissionais),
    plantoes: formatNumber(data.totalPlantoes),
    horas: formatNumber(data.totalHoras),
    setores: formatNumber(data.totalSetores),
    valor: data.totalOriginal ?? formatCurrency(data.valorTotal),
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map(({ key, label, icon: Icon, color }) => (
        <div key={key} className="stat-card group">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground tracking-tight">{values[key]}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      ))}
    </div>
  );
}
