import { useState, useEffect } from 'react';
import { Loader2, FileText, Download, Eye, Bell, LogOut, Calendar, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { StoredReport } from '@/types/database';
import { exportToPDF } from '@/lib/exportUtils';
import { toast } from 'sonner';
import { format, isAfter, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MONTHS = [
  { value: '1', label: 'Janeiro' }, { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' }, { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' }, { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

const LAST_SEEN_KEY = 'cades_client_last_seen';

export default function ClientPortal() {
  const { client, signOut } = useAuth();
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [downloading, setDownloading] = useState<string | null>(null);

  const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
  const isNew = (date: string) =>
    isAfter(new Date(date), subDays(new Date(), 7)) &&
    (!lastSeen || isAfter(new Date(date), new Date(lastSeen)));

  useEffect(() => {
    loadReports();
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }, []);

  const loadReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('published_at', { ascending: false });
    if (error) toast.error('Erro ao carregar relatórios.');
    setReports((data as StoredReport[]) ?? []);
    setLoading(false);
  };

  const handleDownload = async (report: StoredReport) => {
    if (!report.parsed_data) {
      toast.error('Dados do relatório não disponíveis.');
      return;
    }
    setDownloading(report.id);
    try {
      await exportToPDF(report.parsed_data, report.parsed_data.cliente, report.parsed_data.periodo);
    } catch {
      toast.error('Erro ao gerar o PDF.');
    } finally {
      setDownloading(null);
    }
  };

  const availableYears = [...new Set(
    reports
      .filter(r => r.year)
      .map(r => String(r.year))
  )].sort((a, b) => Number(b) - Number(a));

  const filtered = reports.filter(r => {
    if (filterMonth !== 'all' && String(r.month) !== filterMonth) return false;
    if (filterYear !== 'all' && String(r.year) !== filterYear) return false;
    return true;
  });

  const newCount = reports.filter(r => isNew(r.published_at)).length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{
              background: '#0f2340',
              borderRadius: 10,
              padding: '7px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(15,35,64,.18)',
            }}>
              <img src="/logo_cades.png" alt="CADES" style={{ height: 34, width: 'auto', display: 'block' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#0f2340', letterSpacing: '-.01em' }}>
                CADES Analytics
              </span>
              {client && (
                <span style={{ fontSize: '.65rem', fontWeight: 400, color: '#8a9ab5' }}>
                  {client.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {newCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
                <Bell className="w-3 h-3" />
                {newCount} novo{newCount > 1 ? 's' : ''}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 flex-1 w-full">
        {/* Welcome + stats */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-foreground mb-1">
            Olá{client ? `, ${client.name}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            Aqui estão os relatórios publicados pela CADES para sua instituição.
          </p>
        </div>

        {/* Stats row */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Total de relatórios</p>
                <p className="text-2xl font-bold text-foreground mt-1">{reports.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {reports.filter(r => isAfter(new Date(r.published_at), subDays(new Date(), 30))).length}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Novos não vistos</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{newCount}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-5">
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os meses</SelectItem>
              {MONTHS.map(m => (
                <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os anos</SelectItem>
              {availableYears.map(y => (
                <SelectItem key={y} value={y} className="text-xs">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(filterMonth !== 'all' || filterYear !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setFilterMonth('all'); setFilterYear('all'); }}
              className="text-xs h-8"
            >
              Limpar filtros
            </Button>
          )}

          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} relatório{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Reports list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="text-center py-16 border-border/60">
            <CardContent>
              <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {reports.length === 0
                  ? 'Nenhum relatório disponível ainda.'
                  : 'Nenhum relatório para os filtros selecionados.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map(report => (
              <Card
                key={report.id}
                className={`border-border/60 hover:border-border transition-colors ${isNew(report.published_at) ? 'border-green-200 bg-green-50/30' : ''}`}
              >
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isNew(report.published_at) ? 'bg-green-100' : 'bg-primary/10'}`}>
                      <FileText className={`w-4 h-4 ${isNew(report.published_at) ? 'text-green-700' : 'text-primary'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{report.title}</p>
                        {isNew(report.published_at) && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-600 hover:bg-green-600">
                            NOVO
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {report.period && (
                          <span className="text-xs text-muted-foreground">Período: {report.period}</span>
                        )}
                        {report.report_date && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(report.report_date), "d MMM yyyy", { locale: ptBR })}
                          </span>
                        )}
                        {report.sector && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="w-3 h-3" />
                            {report.sector.length > 40 ? report.sector.slice(0, 40) + '…' : report.sector}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Publicado em {format(new Date(report.published_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {report.parsed_data && (
                      <Link to={`/relatorio/${report.id}`}>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                          <Eye className="w-3.5 h-3.5" /> Ver análise
                        </Button>
                      </Link>
                    )}
                    {report.parsed_data && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(report)}
                        disabled={downloading === report.id}
                        className="gap-1.5 text-xs"
                      >
                        {downloading === report.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Download className="w-3.5 h-3.5" />}
                        PDF
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-4 text-center">
        <p className="text-xs text-muted-foreground">
          CADES – Cooperativa Assistencial de Trabalho do Espírito Santo • Vitória/ES
        </p>
      </footer>
    </div>
  );
}
