import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SummaryCards } from '@/components/SummaryCards';
import { ReportCharts } from '@/components/ReportCharts';
import { SectorTables } from '@/components/SectorTables';
import { ReportFilters } from '@/components/ReportFilters';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { StoredReport } from '@/types/database';
import type { FilterState, ReportData } from '@/types/report';
import { exportToPDF } from '@/lib/exportUtils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Garante que todos os valores de `escalas` no parsed_data sejam inteiros positivos.
 * Relatórios salvos antes da correção do parser podem ter `escalas = 25,68`
 * (valorHora que vazou para o campo errado). Nesses casos usamos 1 por registro.
 */
function normalizarEscalas(data: ReportData): ReportData {
  const registros = data.registros.map(r => {
    const escalas = Number.isInteger(r.escalas) && r.escalas > 0 ? r.escalas : 1;
    return { ...r, escalas, escalasOriginal: String(escalas) };
  });

  const setores = data.setores.map(s => {
    const regs = s.registros.map(r => {
      const escalas = Number.isInteger(r.escalas) && r.escalas > 0 ? r.escalas : 1;
      return { ...r, escalas, escalasOriginal: String(escalas) };
    });
    return {
      ...s,
      registros: regs,
      totalPlantoes: regs.reduce((acc, r) => acc + r.escalas, 0),
    };
  });

  return {
    ...data,
    registros,
    setores,
    totalPlantoes: registros.reduce((acc, r) => acc + r.escalas, 0),
  };
}

export default function ReportView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [report, setReport] = useState<StoredReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({ setor: '', profissional: '', turno: '', profissao: '' });
  const [downloading, setDownloading] = useState(false);
  const [selectedSetor, setSelectedSetor] = useState('all');

  useEffect(() => {
    if (!id) return;
    loadReport();
  }, [id]);

  const loadReport = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reports')
      .select('*, client:clients(id, name, email)')
      .eq('id', id)
      .single();

    if (error || !data) {
      toast.error('Relatório não encontrado.');
      navigate(profile?.role === 'admin' ? '/admin/relatorios' : '/portal');
      return;
    }
    const stored = data as StoredReport;
    if (stored.parsed_data) {
      stored.parsed_data = normalizarEscalas(stored.parsed_data);
    }
    setReport(stored);
    setLoading(false);
  };

  const handleDownload = async () => {
    if (!report?.parsed_data) return;
    setDownloading(true);
    try {
      await exportToPDF(report.parsed_data, report.parsed_data.cliente, report.parsed_data.periodo, selectedSetor !== 'all' ? selectedSetor : undefined);
    } catch {
      toast.error('Erro ao gerar o PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const backTo = profile?.role === 'admin' ? '/admin/relatorios' : '/portal';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report?.parsed_data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Dados do relatório não disponíveis.</p>
        <Button variant="outline" size="sm" onClick={() => navigate(backTo)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(backTo)} className="gap-1.5 text-xs -ml-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{report.title}</p>
              {report.client && (
                <p className="text-[10px] text-muted-foreground leading-none">{report.client.name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {report.report_date && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                {format(new Date(report.report_date), "d 'de' MMMM yyyy", { locale: ptBR })}
              </span>
            )}
            <Select value={selectedSetor} onValueChange={setSelectedSetor}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Todos os setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os setores</SelectItem>
                {report.parsed_data.setores.map(s => (
                  <SelectItem key={s.setor} value={s.setor} className="text-xs">{s.setor}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              className="gap-1.5 text-xs"
            >
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Exportar PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h2 className="section-title mb-4">Resumo Executivo</h2>
          <SummaryCards data={report.parsed_data} />
        </section>
        <section>
          <h2 className="section-title mb-4">Análise Gráfica</h2>
          <ReportCharts data={report.parsed_data} />
        </section>
        <section>
          <h2 className="section-title mb-4">Relatório Detalhado por Setor</h2>
          <ReportFilters data={report.parsed_data} filters={filters} onFiltersChange={setFilters} />
        </section>
        <section>
          <SectorTables data={report.parsed_data} filters={filters} />
        </section>
      </main>

      <footer className="border-t border-border mt-12 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          CADES – Cooperativa Assistencial de Trabalho do Espírito Santo • Vitória/ES
        </p>
      </footer>
    </div>
  );
}
