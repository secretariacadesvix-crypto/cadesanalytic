import { useState, useEffect } from 'react';
import {
  Loader2, FileDown, CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { AdminNav } from '@/components/AdminNav';
import { supabase } from '@/lib/supabase';
import type { StoredReport, Client } from '@/types/database';
import {
  consolidarRelatorios, exportConsolidadoPDF,
  fmtMoeda, fmtHoras,
  type ConsolidadoResult,
} from '@/lib/consolidado';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MESES = [
  { v: '1', l: 'Janeiro' }, { v: '2', l: 'Fevereiro' }, { v: '3', l: 'Março' },
  { v: '4', l: 'Abril' }, { v: '5', l: 'Maio' }, { v: '6', l: 'Junho' },
  { v: '7', l: 'Julho' }, { v: '8', l: 'Agosto' }, { v: '9', l: 'Setembro' },
  { v: '10', l: 'Outubro' }, { v: '11', l: 'Novembro' }, { v: '12', l: 'Dezembro' },
];

const ANOS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

export default function ConsolidadoPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [ano, setAno] = useState(String(new Date().getFullYear()));

  const [reports, setReports] = useState<StoredReport[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingReports, setLoadingReports] = useState(false);

  const [result, setResult] = useState<ConsolidadoResult | null>(null);
  const [showTable, setShowTable] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data ?? []));
  }, []);

  const handleBuscar = async () => {
    if (!clientId) return;
    setLoadingReports(true);
    setResult(null);
    setSelected(new Set());

    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', clientId)
      .eq('month', mes)
      .eq('year', ano)
      .order('report_date', { ascending: true });

    setReports((data as StoredReport[]) ?? []);
    setLoadingReports(false);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setResult(null);
  };

  const toggleAll = () => {
    if (selected.size === reports.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(reports.map(r => r.id)));
    }
    setResult(null);
  };

  const handleGerar = () => {
    const sel = reports.filter(r => selected.has(r.id));
    if (sel.length === 0) return;
    const res = consolidarRelatorios(sel);
    setResult(res);
    setShowTable(true);
  };

  const handleExportPDF = async () => {
    if (!result || !result.isValid) return;
    setExporting(true);
    try {
      const client = clients.find(c => c.id === clientId)!;
      const mesLabel = `${MESES.find(m => m.v === mes)?.l} ${ano}`;
      const sel = reports.filter(r => selected.has(r.id));
      await exportConsolidadoPDF(result, client, mesLabel, sel.map(r => r.title));
    } finally {
      setExporting(false);
    }
  };

  const selectedReports = reports.filter(r => selected.has(r.id));
  const clientObj = clients.find(c => c.id === clientId);

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Título */}
        <div>
          <h1 className="text-xl font-bold text-foreground">Consolidado Mensal</h1>
          <p className="text-sm text-muted-foreground">
            Selecione os relatórios semanais de um cliente para gerar o consolidado do mês.
          </p>
        </div>

        {/* Filtros */}
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5 flex-1 min-w-[180px]">
                <p className="text-xs font-medium text-foreground">Cliente</p>
                <Select value={clientId} onValueChange={v => { setClientId(v); setReports([]); setResult(null); setSelected(new Set()); }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione o cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-sm">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 w-36">
                <p className="text-xs font-medium text-foreground">Mês</p>
                <Select value={mes} onValueChange={v => { setMes(v); setReports([]); setResult(null); }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map(m => (
                      <SelectItem key={m.v} value={m.v} className="text-sm">{m.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 w-28">
                <p className="text-xs font-medium text-foreground">Ano</p>
                <Select value={ano} onValueChange={v => { setAno(v); setReports([]); setResult(null); }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANOS.map(a => (
                      <SelectItem key={a} value={a} className="text-sm">{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleBuscar}
                disabled={!clientId || loadingReports}
                size="sm"
                className="h-9"
              >
                {loadingReports && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                Buscar relatórios
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de relatórios */}
        {loadingReports ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length > 0 ? (
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {reports.length} relatório{reports.length !== 1 ? 's' : ''} encontrado{reports.length !== 1 ? 's' : ''}
                </CardTitle>
                <button
                  onClick={toggleAll}
                  className="text-xs text-primary hover:underline"
                >
                  {selected.size === reports.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {reports.map(report => (
                <label
                  key={report.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selected.has(report.id)
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border/60 hover:border-border'
                  }`}
                >
                  <Checkbox
                    checked={selected.has(report.id)}
                    onCheckedChange={() => toggleSelect(report.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{report.title}</p>
                    <div className="flex gap-3 mt-0.5 flex-wrap">
                      {report.period && (
                        <span className="text-xs text-muted-foreground">Período: {report.period}</span>
                      )}
                      {report.report_date && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(report.report_date), "d MMM yyyy", { locale: ptBR })}
                        </span>
                      )}
                      {report.parsed_data && (
                        <span className="text-xs text-muted-foreground">
                          {report.parsed_data.totalProfissionais} profissionais •{' '}
                          {fmtMoeda(Math.round(report.parsed_data.valorTotal * 100))}
                        </span>
                      )}
                    </div>
                  </div>
                  {selected.has(report.id) && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">Selecionado</Badge>
                  )}
                </label>
              ))}
            </CardContent>
          </Card>
        ) : clientId && !loadingReports && reports.length === 0 && (
          <Card className="border-border/60 text-center py-10">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nenhum relatório encontrado para este cliente em{' '}
                {MESES.find(m => m.v === mes)?.l} {ano}.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Botão Gerar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3">
            <Button onClick={handleGerar} className="gap-2">
              Gerar Consolidado ({selected.size} relatório{selected.size !== 1 ? 's' : ''})
            </Button>
            {result && (
              <p className="text-xs text-muted-foreground">
                Clique novamente para recalcular após alterar a seleção.
              </p>
            )}
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="space-y-4">
            {/* Status da validação */}
            {result.isValid ? (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-green-200 bg-green-50">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800">Consolidado validado com sucesso</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    Total consolidado {fmtMoeda(result.grandValorFixed)} = soma exata dos {selectedReports.length} relatórios.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Divergência detectada — exportação bloqueada</p>
                  <p className="text-xs text-red-700 mt-0.5">{result.validationError}</p>
                </div>
              </div>
            )}

            {/* Tabela consolidada */}
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    Consolidado — {clientObj?.name} •{' '}
                    {MESES.find(m => m.v === mes)?.l} {ano}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTable(v => !v)}
                      className="gap-1.5 text-xs"
                    >
                      {showTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {showTable ? 'Recolher' : 'Expandir'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleExportPDF}
                      disabled={!result.isValid || exporting}
                      className="gap-1.5 text-xs"
                    >
                      {exporting
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <FileDown className="w-3.5 h-3.5" />}
                      Exportar PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {showTable && (
                <CardContent className="pt-0 overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-[680px]">
                    <thead>
                      <tr className="bg-[#1e3a5f] text-white">
                        {['Nome', 'Setor', 'Atividade', 'Turno', 'Escalas', 'Tot. Horas', 'Valor Final'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-[11px]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="px-3 py-1.5 text-foreground">{row.nome}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{row.setor}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{row.atividade}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{row.turno}</td>
                          <td className="px-3 py-1.5 text-center font-medium">{row.escalas}</td>
                          <td className="px-3 py-1.5 text-right">{fmtHoras(row.horasFixed)}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{fmtMoeda(row.valorFixed)}</td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Sub-totais por setor */}
                    {result.subTotals.map(sub => (
                      <tbody key={`sub-${sub.setor}`}>
                        <tr className="bg-slate-100 border-t border-slate-200">
                          <td colSpan={4} className="px-3 py-1.5 font-semibold text-[#1e3a5f]">
                            Sub-Total: {sub.setor}
                          </td>
                          <td className="px-3 py-1.5 text-center font-semibold text-[#1e3a5f]">{sub.escalas}</td>
                          <td className="px-3 py-1.5 text-right font-semibold text-[#1e3a5f]">{fmtHoras(sub.horasFixed)}</td>
                          <td className="px-3 py-1.5 text-right font-semibold text-[#1e3a5f]">{fmtMoeda(sub.valorFixed)}</td>
                        </tr>
                      </tbody>
                    ))}

                    {/* Total geral */}
                    <tfoot>
                      <tr className="bg-[#0d9488] text-white">
                        <td colSpan={4} className="px-3 py-2 font-bold text-right">TOTAL GERAL</td>
                        <td className="px-3 py-2 text-center font-bold">{result.grandEscalas}</td>
                        <td className="px-3 py-2 text-right font-bold">{fmtHoras(result.grandHorasFixed)}</td>
                        <td className="px-3 py-2 text-right font-bold">{fmtMoeda(result.grandValorFixed)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
