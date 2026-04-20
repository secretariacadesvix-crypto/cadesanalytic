import { useState, useEffect, useMemo } from 'react';
import { Loader2, FileDown } from 'lucide-react';
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
  consolidarRelatorios, exportAnaliticoPDF, fmtMoeda, fmtHoras,
  type ConsolidadoResult, type ConsolidadoRow,
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

export default function AnaliticoPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [mes, setMes] = useState(String(new Date().getMonth() + 1));
  const [ano, setAno] = useState(String(new Date().getFullYear()));

  const [reports, setReports] = useState<StoredReport[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingReports, setLoadingReports] = useState(false);

  const [result, setResult] = useState<ConsolidadoResult | null>(null);

  // Filters
  const [filterSetor, setFilterSetor] = useState('all');
  const [filterCooperado, setFilterCooperado] = useState('all');
  const [filterAtividade, setFilterAtividade] = useState('all');

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
    setFilterSetor('all');
    setFilterCooperado('all');
    setFilterAtividade('all');
  };

  // ── Opções de filtro derivadas dos dados ──────────────────────────────────
  const setorOptions = useMemo(() => {
    if (!result) return [];
    return [...new Set(result.rows.map(r => r.setor))].sort();
  }, [result]);

  const cooperadoOptions = useMemo(() => {
    if (!result) return [];
    const base = filterSetor === 'all'
      ? result.rows
      : result.rows.filter(r => r.setor === filterSetor);
    return [...new Set(base.map(r => r.nome))].sort();
  }, [result, filterSetor]);

  const atividadeOptions = useMemo(() => {
    if (!result) return [];
    let base = result.rows;
    if (filterSetor !== 'all') base = base.filter(r => r.setor === filterSetor);
    if (filterCooperado !== 'all') base = base.filter(r => r.nome === filterCooperado);
    return [...new Set(base.map(r => r.atividade))].sort();
  }, [result, filterSetor, filterCooperado]);

  // Resetar cooperado/atividade quando setor muda
  const handleSetorChange = (v: string) => {
    setFilterSetor(v);
    setFilterCooperado('all');
    setFilterAtividade('all');
  };

  // Resetar atividade quando cooperado muda
  const handleCooperadoChange = (v: string) => {
    setFilterCooperado(v);
    setFilterAtividade('all');
  };

  const hasFilter = filterSetor !== 'all' || filterCooperado !== 'all' || filterAtividade !== 'all';

  // ── Linhas filtradas ──────────────────────────────────────────────────────
  const filteredRows = useMemo((): ConsolidadoRow[] => {
    if (!result) return [];
    return result.rows.filter(r => {
      if (filterSetor !== 'all' && r.setor !== filterSetor) return false;
      if (filterCooperado !== 'all' && r.nome !== filterCooperado) return false;
      if (filterAtividade !== 'all' && r.atividade !== filterAtividade) return false;
      return true;
    });
  }, [result, filterSetor, filterCooperado, filterAtividade]);

  // ── Totais das linhas filtradas ───────────────────────────────────────────
  const totais = useMemo(() => ({
    escalas: filteredRows.reduce((s, r) => s + r.escalas, 0),
    horasFixed: filteredRows.reduce((s, r) => s + r.horasFixed, 0),
    valorFixed: filteredRows.reduce((s, r) => s + r.valorFixed, 0),
  }), [filteredRows]);

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Título */}
        <div>
          <h1 className="text-xl font-bold text-foreground">Analítico</h1>
          <p className="text-sm text-muted-foreground">
            Visualize e filtre os dados analíticos de cooperados por setor, atividade e período.
          </p>
        </div>

        {/* Filtros de busca */}
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
        ) : clientId && !loadingReports && reports.length === 0 ? (
          <Card className="border-border/60 text-center py-10">
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nenhum relatório encontrado para este cliente em{' '}
                {MESES.find(m => m.v === mes)?.l} {ano}.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Botão Gerar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3">
            <Button onClick={handleGerar} className="gap-2">
              Gerar Análise ({selected.size} relatório{selected.size !== 1 ? 's' : ''})
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
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-sm font-semibold">
                    Dados Analíticos — {MESES.find(m => m.v === mes)?.l} {ano}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const clientObj = clients.find(c => c.id === clientId);
                      const mesLabel = `${MESES.find(m => m.v === mes)?.l ?? mes} ${ano}`;
                      exportAnaliticoPDF(filteredRows, clientObj?.name ?? 'Cliente', mesLabel);
                    }}
                    disabled={filteredRows.length === 0}
                    className="gap-1.5 text-xs h-8"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Exportar PDF
                  </Button>
                </div>

                {/* Filtros analíticos */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Setor */}
                  <Select value={filterSetor} onValueChange={handleSetorChange}>
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue placeholder="Setor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os setores</SelectItem>
                      {setorOptions.map(s => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Cooperado */}
                  <Select value={filterCooperado} onValueChange={handleCooperadoChange}>
                    <SelectTrigger className="h-8 w-[180px] text-xs">
                      <SelectValue placeholder="Cooperado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os cooperados</SelectItem>
                      {cooperadoOptions.map(n => (
                        <SelectItem key={n} value={n} className="text-xs">{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Atividade */}
                  <Select value={filterAtividade} onValueChange={setFilterAtividade}>
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue placeholder="Atividade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todas as atividades</SelectItem>
                      {atividadeOptions.map(a => (
                        <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {hasFilter && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setFilterSetor('all'); setFilterCooperado('all'); setFilterAtividade('all'); }}
                      className="h-8 text-xs px-2"
                    >
                      Limpar
                    </Button>
                  )}
                </div>
              </div>

              {hasFilter && (
                <p className="text-xs text-muted-foreground">
                  {filteredRows.length} de {result.rows.length} registros
                </p>
              )}
            </CardHeader>

            <CardContent className="pt-0 overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[680px]">
                <thead>
                  <tr className="bg-[#1e3a5f] text-white">
                    {['Nome', 'Setor', 'Atividade', 'Turno', 'Escalas', 'Total de Horas', 'Valor Final'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-[11px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        Nenhum registro para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-3 py-1.5 text-foreground">{row.nome}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.setor}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.atividade}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.turno}</td>
                        <td className="px-3 py-1.5 text-center font-medium">{row.escalas}</td>
                        <td className="px-3 py-1.5 text-right">{fmtHoras(row.horasFixed)}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{fmtMoeda(row.valorFixed)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#0d9488] text-white">
                      <td colSpan={4} className="px-3 py-2 font-bold text-right">TOTAL</td>
                      <td className="px-3 py-2 text-center font-bold">{totais.escalas}</td>
                      <td className="px-3 py-2 text-right font-bold">{fmtHoras(totais.horasFixed)}</td>
                      <td className="px-3 py-2 text-right font-bold">{fmtMoeda(totais.valorFixed)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
