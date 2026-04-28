import { Users, Clock, Calendar, Building2, DollarSign, Sun, Moon, Star } from 'lucide-react';
import type { ReportData } from '@/types/report';
import { formatCurrency, formatNumber } from '@/lib/pdfParser';

interface SummaryCardsProps {
  data: ReportData;
}

export function SummaryCards({ data }: SummaryCardsProps) {
  const diurnos = data.registros
    .filter((r) => r.turno === 'DIURNO')
    .reduce((sum, r) => sum + r.escalas, 0);

  const noturnos = data.registros
    .filter((r) => r.turno === 'NOTURNO')
    .reduce((sum, r) => sum + r.escalas, 0);

  const diaristas = data.registros
    .filter((r) => r.turno !== 'DIURNO' && r.turno !== 'NOTURNO')
    .reduce((sum, r) => sum + r.escalas, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {/* Profissionais */}
      <div className="stat-card group">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Users className="w-5 h-5 text-chart-1" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tracking-tight">
          {formatNumber(data.totalProfissionais)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Profissionais</p>
      </div>

      {/* Plantões com breakdown diurno/noturno/diarista */}
      <div className="stat-card group">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Calendar className="w-5 h-5 text-chart-2" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tracking-tight">
          {formatNumber(data.totalPlantoes)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Plantões</p>
        <div className="mt-3 pt-3 border-t border-border space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Sun className="w-3 h-3 text-amber-500" /> Diurnos
            </span>
            <span className="text-[11px] font-semibold text-foreground">{formatNumber(diurnos)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Moon className="w-3 h-3 text-indigo-400" /> Noturnos
            </span>
            <span className="text-[11px] font-semibold text-foreground">{formatNumber(noturnos)}</span>
          </div>
          {diaristas > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Star className="w-3 h-3 text-emerald-500" /> Diaristas
              </span>
              <span className="text-[11px] font-semibold text-foreground">{formatNumber(diaristas)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Horas Trabalhadas */}
      <div className="stat-card group">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Clock className="w-5 h-5 text-chart-3" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tracking-tight">
          {formatNumber(data.totalHoras)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Horas Trabalhadas</p>
      </div>

      {/* Setores */}
      <div className="stat-card group">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Building2 className="w-5 h-5 text-chart-4" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tracking-tight">
          {formatNumber(data.totalSetores)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Setores Atendidos</p>
      </div>

      {/* Valor Total */}
      <div className="stat-card group">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-chart-2" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground tracking-tight">
          {data.totalOriginal ?? formatCurrency(data.valorTotal)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Valor Total</p>
      </div>
    </div>
  );
}
