import { useState, useEffect } from 'react';
import {
  Loader2, FileDown, Plus, Trash2, ChevronDown, ChevronUp,
  Receipt, Users, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminNav } from '@/components/AdminNav';
import { supabase } from '@/lib/supabase';
import type { StoredReport, Client } from '@/types/database';
import type { PlantaoRecord } from '@/types/report';
import { fetchValoresHora, calcularValorBruto } from '@/lib/valoresHora';
import type { ValoresHora } from '@/types/config';
import {
  consolidarPorCooperado,
  recalcularCooperado,
  INSS_PERCENTUAL,
  COTA_PARTE_VALOR,
} from '@/lib/consolidacaoFolha';
import type { CooperadoConsolidado, DescontoExtra } from '@/lib/consolidacaoFolha';
import {
  exportContraChequeConsolidadoIndividual,
  exportContraChequeConsolidadoBatch,
} from '@/lib/contraChequePDF';
import { toast } from 'sonner';

// ── Meses / Anos ──────────────────────────────────────────────────────────────
const MESES = [
  { v: '1', l: 'Janeiro' }, { v: '2', l: 'Fevereiro' }, { v: '3', l: 'Março' },
  { v: '4', l: 'Abril' }, { v: '5', l: 'Maio' }, { v: '6', l: 'Junho' },
  { v: '7', l: 'Julho' }, { v: '8', l: 'Agosto' }, { v: '9', l: 'Setembro' },
  { v: '10', l: 'Outubro' }, { v: '11', l: 'Novembro' }, { v: '12', l: 'Dezembro' },
];
const ANOS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

function genId() { return Math.random().toString(36).slice(2); }

function fmtR$(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Linha de desconto extra individual ───────────────────────────────────────
function DescontoExtraRow({
  desconto, onChange, onRemove,
}: {
  desconto: DescontoExtra;
  onChange: (d: DescontoExtra) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 130px 120px 36px',
      gap: 6, alignItems: 'end', marginBottom: 6,
    }}>
      <div>
        <Label style={{ fontSize: 10, color: '#8a9ab5', display: 'block', marginBottom: 3 }}>
          Descrição
        </Label>
        <Input
          value={desconto.descricao}
          onChange={e => onChange({ ...desconto, descricao: e.target.value })}
          placeholder="Ex: Vale transporte…"
          style={{ fontSize: 12 }}
        />
      </div>
      <div>
        <Label style={{ fontSize: 10, color: '#8a9ab5', display: 'block', marginBottom: 3 }}>Tipo</Label>
        <Select
          value={desconto.tipo}
          onValueChange={v => onChange({ ...desconto, tipo: v as DescontoExtra['tipo'] })}
        >
          <SelectTrigger style={{ fontSize: 12 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="percentual">% Percentual</SelectItem>
            <SelectItem value="fixo">R$ Fixo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label style={{ fontSize: 10, color: '#8a9ab5', display: 'block', marginBottom: 3 }}>
          {desconto.tipo === 'percentual' ? 'Percentual (%)' : 'Valor (R$)'}
        </Label>
        <Input
          type="number" min={0} step={desconto.tipo === 'percentual' ? 0.01 : 0.5}
          value={desconto.valor}
          onChange={e => onChange({ ...desconto, valor: parseFloat(e.target.value) || 0 })}
          style={{ fontSize: 12 }}
        />
      </div>
      <button
        onClick={onRemove}
        style={{
          height: 36, width: 36, border: 'none', borderRadius: 6,
          background: '#fef2f2', color: '#b91c1c', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function FechamentoFolhaPage() {
  // ── Filtros ────────────────────────────────────────────────────────────────
  const [clients,        setClients]        = useState<Client[]>([]);
  const [clientId,       setClientId]       = useState('');
  const [mes,            setMes]            = useState(String(new Date().getMonth() + 1));
  const [ano,            setAno]            = useState(String(new Date().getFullYear()));
  const [reports,        setReports]        = useState<StoredReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReport, setSelectedReport] = useState<StoredReport | null>(null);

  // ── Descontos globais (aplicados a todos ao carregar o relatório) ──────────
  const [descontosGlobais, setDescontosGlobais] = useState<DescontoExtra[]>([]);

  // ── Cooperados consolidados ────────────────────────────────────────────────
  const [cooperados,   setCooperados]   = useState<CooperadoConsolidado[]>([]);
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [valoresHora,  setValoresHora]  = useState<ValoresHora | null>(null);

  // ── Exportação ─────────────────────────────────────────────────────────────
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('relatorio');

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => setClients(data ?? []));
    fetchValoresHora().then(v => setValoresHora(v));
  }, []);

  // ── Buscar relatórios ──────────────────────────────────────────────────────
  const handleBuscar = async () => {
    if (!clientId) return;
    setLoadingReports(true);
    setSelectedReport(null);
    setCooperados([]);
    setSelectedIds(new Set());
    const { data } = await supabase
      .from('reports').select('*')
      .eq('client_id', clientId).eq('month', mes).eq('year', ano)
      .order('report_date', { ascending: false });
    setReports((data as StoredReport[]) ?? []);
    setLoadingReports(false);
  };

  // ── Aplicar descontos globais em uma lista de cooperados ──────────────────
  const applyDescontosGlobais = (lista: CooperadoConsolidado[], globals: DescontoExtra[]): CooperadoConsolidado[] => {
    if (globals.length === 0) return lista;
    return lista.map(c => {
      const updated = {
        ...c,
        descontosExtras: globals.map(d => ({ ...d, id: genId() })),
      };
      return recalcularCooperado(updated);
    });
  };

  // ── Selecionar relatório → consolidar ─────────────────────────────────────
  const handleSelectReport = (report: StoredReport) => {
    setSelectedReport(report);
    const registros: PlantaoRecord[] = (report.parsed_data as any)?.registros ?? [];
    const consolidados = applyDescontosGlobais(
      consolidarPorCooperado(registros, valoresHora),
      descontosGlobais,
    );
    setCooperados(consolidados);
    setSelectedIds(new Set(consolidados.map(c => c.matricula || c.nome)));
    setTab('folha');
  };

  // ── Re-consolidar quando valoresHora carrega após seleção do relatório ─────
  // Corrige corrida: relatório selecionado antes do fetch async de valoresHora
  useEffect(() => {
    if (!selectedReport) return;
    const registros: PlantaoRecord[] = (selectedReport.parsed_data as any)?.registros ?? [];
    const consolidados = applyDescontosGlobais(
      consolidarPorCooperado(registros, valoresHora),
      descontosGlobais,
    );
    setCooperados(consolidados);
    setSelectedIds(prev => {
      const keys = new Set(consolidados.map(c => c.matricula || c.nome));
      const kept = new Set([...prev].filter(k => keys.has(k)));
      return kept.size > 0 ? kept : keys;
    });
  }, [valoresHora]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers para descontos globais ─────────────────────────────────────────
  const addDescontoGlobal = () => {
    setDescontosGlobais(prev => [
      ...prev,
      { id: genId(), descricao: '', tipo: 'fixo' as const, valor: 0 },
    ]);
  };

  const updateDescontoGlobal = (d: DescontoExtra) => {
    setDescontosGlobais(prev => prev.map(x => x.id === d.id ? d : x));
  };

  const removeDescontoGlobal = (id: string) => {
    setDescontosGlobais(prev => prev.filter(x => x.id !== id));
  };

  // Reaplicar descontos globais na folha atual sem precisar reselecionar
  const reaplicarDescontosGlobais = () => {
    if (!selectedReport) return;
    const registros: PlantaoRecord[] = (selectedReport.parsed_data as any)?.registros ?? [];
    const consolidados = applyDescontosGlobais(
      consolidarPorCooperado(registros, valoresHora),
      descontosGlobais,
    );
    setCooperados(consolidados);
    setSelectedIds(new Set(consolidados.map(c => c.matricula || c.nome)));
    toast.success('Descontos globais reaplicados a todos os cooperados.');
  };

  // ── Helpers de desconto extra ──────────────────────────────────────────────
  const addDescontoExtra = (key: string) => {
    setCooperados(prev => prev.map(c => {
      if ((c.matricula || c.nome) !== key) return c;
      const updated = {
        ...c,
        descontosExtras: [
          ...c.descontosExtras,
          { id: genId(), descricao: '', tipo: 'percentual' as const, valor: 0 },
        ],
      };
      return recalcularCooperado(updated);
    }));
  };

  const updateDescontoExtra = (key: string, d: DescontoExtra) => {
    setCooperados(prev => prev.map(c => {
      if ((c.matricula || c.nome) !== key) return c;
      const updated = { ...c, descontosExtras: c.descontosExtras.map(x => x.id === d.id ? d : x) };
      return recalcularCooperado(updated);
    }));
  };

  const removeDescontoExtra = (key: string, dId: string) => {
    setCooperados(prev => prev.map(c => {
      if ((c.matricula || c.nome) !== key) return c;
      const updated = { ...c, descontosExtras: c.descontosExtras.filter(x => x.id !== dId) };
      return recalcularCooperado(updated);
    }));
  };

  // ── Seleção ────────────────────────────────────────────────────────────────
  const toggleCooperado = (key: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === cooperados.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cooperados.map(c => c.matricula || c.nome)));
    }
  };

  // ── Config da folha para o PDF ─────────────────────────────────────────────
  const mesLabel = MESES.find(m => m.v === mes)?.l ?? mes;
  const competencia = `${mesLabel} / ${ano}`;
  const clienteNome = clients.find(c => c.id === clientId)?.name ?? '';

  // ── Exportar individual ────────────────────────────────────────────────────
  const handleExportIndividual = async (c: CooperadoConsolidado) => {
    const key = c.matricula || c.nome;
    setExportingKey(key);
    try {
      await exportContraChequeConsolidadoIndividual(c, { competencia, cliente: clienteNome });
      toast.success(`RPA de ${c.nome} gerado!`);
    } catch {
      toast.error('Erro ao gerar RPA.');
    } finally {
      setExportingKey(null);
    }
  };

  // ── Exportar lote ──────────────────────────────────────────────────────────
  const handleExportAll = async () => {
    const selecionados = cooperados.filter(c => selectedIds.has(c.matricula || c.nome));
    if (selecionados.length === 0) { toast.warning('Selecione ao menos um cooperado.'); return; }
    setExportingAll(true);
    try {
      await exportContraChequeConsolidadoBatch(selecionados, { competencia, cliente: clienteNome });
      toast.success(`${selecionados.length} RPAs gerados!`);
    } catch {
      toast.error('Erro ao gerar RPAs.');
    } finally {
      setExportingAll(false);
    }
  };

  // ── Totais dos selecionados ────────────────────────────────────────────────
  const selecionados   = cooperados.filter(c => selectedIds.has(c.matricula || c.nome));
  const totBruto       = selecionados.reduce((s, c) => s + c.totalBruto,      0);
  const totDescontos   = selecionados.reduce((s, c) => s + c.totalDescontos,  0);
  const totLiq         = selecionados.reduce((s, c) => s + c.totalLiquido,    0);
  // Subtotais para informação (não usados nos cards principais para manter a equação Bruto−Descontos=Líquido)
  const totInss        = selecionados.reduce((s, c) => s + c.inss,            0);
  const totCota        = selecionados.reduce((s, c) => s + c.cotaParte,       0);

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f7f9fc' }}>
      <AdminNav />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* Título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: '#0f2340',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(15,35,64,.18)',
          }}>
            <Receipt size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f2340', margin: 0, lineHeight: 1.2 }}>
              Fechamento de Folha
            </h1>
            <p style={{ fontSize: '.8rem', color: '#8a9ab5', margin: 0 }}>
              Consolidação por cooperado · emissão de RPA (Recibo de Pagamento Autônomo)
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList style={{ marginBottom: 20 }}>
            <TabsTrigger value="relatorio" style={{ gap: 6 }}>
              <Receipt size={14} /> 1. Selecionar Relatório
            </TabsTrigger>
            <TabsTrigger value="folha" disabled={cooperados.length === 0} style={{ gap: 6 }}>
              <Users size={14} /> 2. Gerar RPAs
              {cooperados.length > 0 && (
                <span style={{
                  marginLeft: 4, background: '#0f2340', color: '#fff',
                  borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700,
                }}>
                  {cooperados.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ════════════════════════════════════════════════════════════════
              TAB 1 — Selecionar Relatório
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="relatorio">
            <Card>
              <CardHeader>
                <CardTitle style={{ fontSize: '.95rem', color: '#0f2340' }}>
                  Buscar Relatório da Organização
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 130px auto',
                  gap: 12, alignItems: 'end', marginBottom: 20,
                }}>
                  <div>
                    <Label style={{ fontSize: 12, color: '#8a9ab5', marginBottom: 4, display: 'block' }}>
                      Cliente / Organização
                    </Label>
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                      <SelectContent>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label style={{ fontSize: 12, color: '#8a9ab5', marginBottom: 4, display: 'block' }}>Mês</Label>
                    <Select value={mes} onValueChange={setMes}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MESES.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label style={{ fontSize: 12, color: '#8a9ab5', marginBottom: 4, display: 'block' }}>Ano</Label>
                    <Select value={ano} onValueChange={setAno}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ANOS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleBuscar} disabled={!clientId || loadingReports}
                    style={{ background: '#0f2340' }}>
                    {loadingReports && <Loader2 size={14} className="animate-spin mr-1" />}
                    Buscar
                  </Button>
                </div>

                {/* ── Descontos Globais ── */}
                <div style={{
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '14px 16px',
                  marginBottom: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: '.85rem', fontWeight: 700, color: '#0f2340', margin: 0 }}>
                        Descontos Padrão
                      </p>
                      <p style={{ fontSize: '.72rem', color: '#8a9ab5', margin: '2px 0 0' }}>
                        Aplicados automaticamente a <strong>todos</strong> os cooperados ao carregar o relatório
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {selectedReport && descontosGlobais.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={reaplicarDescontosGlobais}
                          style={{ fontSize: 11, gap: 5, height: 30 }}
                        >
                          Reaplicar na folha atual
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addDescontoGlobal}
                        style={{ fontSize: 11, gap: 5, height: 30 }}
                      >
                        <Plus size={12} /> Adicionar Desconto
                      </Button>
                    </div>
                  </div>

                  {descontosGlobais.length === 0 ? (
                    <p style={{ fontSize: '.75rem', color: '#b0bec5', textAlign: 'center', padding: '8px 0', margin: 0 }}>
                      Nenhum desconto padrão configurado. Clique em "Adicionar Desconto" para lançar descontos que serão aplicados a todos.
                    </p>
                  ) : (
                    <div style={{ marginTop: 4 }}>
                      {descontosGlobais.map(d => (
                        <DescontoExtraRow
                          key={d.id}
                          desconto={d}
                          onChange={updateDescontoGlobal}
                          onRemove={() => removeDescontoGlobal(d.id)}
                        />
                      ))}
                      <p style={{ fontSize: '.7rem', color: '#8a9ab5', margin: '6px 0 0' }}>
                        {descontosGlobais.length} desconto(s) configurado(s) · Serão lançados para cada cooperado ao selecionar o relatório abaixo
                      </p>
                    </div>
                  )}
                </div>

                {reports.length === 0 && !loadingReports && clientId && (
                  <p style={{ fontSize: '.83rem', color: '#8a9ab5', textAlign: 'center', padding: '24px 0' }}>
                    Nenhum relatório encontrado.
                  </p>
                )}

                {reports.map(r => {
                  const isSel = selectedReport?.id === r.id;
                  const nCoops = ((r.parsed_data as any)?.registros as PlantaoRecord[] ?? []).length;
                  return (
                    <div key={r.id}
                      onClick={() => handleSelectReport(r)}
                      style={{
                        border: `1.5px solid ${isSel ? '#0f2340' : '#e2e8f0'}`,
                        borderRadius: 8, padding: '12px 16px', marginBottom: 8,
                        cursor: 'pointer', background: isSel ? '#f0f4fa' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'border-color .15s, background .15s',
                      }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '.88rem', color: '#0f2340', margin: 0 }}>
                          {r.title}
                        </p>
                        <p style={{ fontSize: '.75rem', color: '#8a9ab5', margin: '2px 0 0' }}>
                          {r.period} · Semana {r.week_number} · {nCoops} registro(s)
                        </p>
                      </div>
                      <Badge variant={isSel ? 'default' : 'outline'}
                        style={{ background: isSel ? '#0f2340' : undefined, fontSize: 11 }}>
                        {isSel ? 'Selecionado' : 'Usar este relatório'}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════
              TAB 2 — Gerar RPAs
          ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="folha">

            {/* Legenda das regras */}
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
              padding: '10px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8, fontSize: '.78rem', color: '#1e40af',
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>
                Valores consolidados por cooperado (diurno + noturno).&nbsp;
                <strong>INSS {INSS_PERCENTUAL}%</strong> e&nbsp;
                <strong>Cota Parte {fmtR$(COTA_PARTE_VALOR)}</strong> aplicados automaticamente
                sobre o total bruto de cada cooperado.
              </span>
            </div>

            {/* ── Painel de diagnóstico ── */}
            {(() => {
              const regsRaw: any[] = (selectedReport?.parsed_data as any)?.registros ?? [];
              const somaHorasPDF = regsRaw.reduce((s: number, r: any) => s + (r.totalHoras ?? 0), 0);
              const somaValorPDF = regsRaw.reduce((s: number, r: any) => s + (r.valorFinal ?? 0), 0);

              // Breakdown por profissão+turno
              type GrpKey = string;
              const grp = new Map<GrpKey, { regs: number; horas: number; pdfVal: number; sysVal: number; taxa: number }>();
              for (const r of regsRaw) {
                const k = `${r.profissao} / ${r.turno}`;
                if (!grp.has(k)) grp.set(k, { regs: 0, horas: 0, pdfVal: 0, sysVal: 0, taxa: 0 });
                const g = grp.get(k)!;
                g.regs++;
                g.horas += r.totalHoras ?? 0;
                g.pdfVal += r.valorFinal ?? 0;
                if (valoresHora) {
                  const sv = calcularValorBruto(r.totalHoras, r.profissao, r.turno, valoresHora);
                  g.sysVal += sv ?? 0;
                  if (g.taxa === 0 && sv != null && r.totalHoras > 0) g.taxa = sv / r.totalHoras;
                }
              }

              return (
                <div style={{
                  background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: 8,
                  padding: '10px 16px', marginBottom: 16, fontSize: '.72rem', color: '#4a5568', lineHeight: 1.7,
                }}>
                  <div><strong>Valores hora configurados:</strong> enf.diurno={valoresHora?.enfermeiro_diurno} | enf.noturno={valoresHora?.enfermeiro_noturno} | tec.diurno={valoresHora?.tecnico_enfermagem_diurno} | tec.noturno={valoresHora?.tecnico_enfermagem_noturno} | fono={valoresHora?.fonoaudiologo} | assist.social={valoresHora?.assistente_social}</div>
                  <div><strong>Registros:</strong> {regsRaw.length} | <strong>Cooperados:</strong> {cooperados.length} | <strong>Sem taxa:</strong> {cooperados.filter(c => c.avisos.length > 0).length} | <strong>Σ horas:</strong> {somaHorasPDF.toFixed(1)}h | <strong>Valor PDF:</strong> {fmtR$(somaValorPDF)} | <strong>Sistema:</strong> {fmtR$(totBruto)}</div>
                  <table style={{ borderCollapse: 'collapse', marginTop: 6, width: '100%' }}>
                    <thead>
                      <tr style={{ color: '#8a9ab5', textAlign: 'left' }}>
                        <th style={{ paddingRight: 16 }}>Profissão / Turno</th>
                        <th style={{ paddingRight: 12, textAlign: 'right' }}>Regs</th>
                        <th style={{ paddingRight: 12, textAlign: 'right' }}>Horas</th>
                        <th style={{ paddingRight: 12, textAlign: 'right' }}>Valor/h sistema</th>
                        <th style={{ paddingRight: 12, textAlign: 'right' }}>Valor PDF orig.</th>
                        <th style={{ textAlign: 'right' }}>Valor sistema</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(grp.entries()).map(([k, g]) => (
                        <tr key={k}>
                          <td style={{ paddingRight: 16 }}>{k}</td>
                          <td style={{ paddingRight: 12, textAlign: 'right' }}>{g.regs}</td>
                          <td style={{ paddingRight: 12, textAlign: 'right' }}>{g.horas.toFixed(1)}</td>
                          <td style={{ paddingRight: 12, textAlign: 'right', color: '#0f2340' }}>{g.taxa > 0 ? `R$${g.taxa.toFixed(2)}/h` : '—'}</td>
                          <td style={{ paddingRight: 12, textAlign: 'right' }}>{fmtR$(g.pdfVal)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f2340' }}>{fmtR$(g.sysVal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Cards de resumo — equação: Bruto − Descontos = Líquido sempre fecha */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12,
            }}>
              <Card style={{ border: '1.5px solid #e2e8f0' }}>
                <CardContent style={{ padding: '12px 16px' }}>
                  <p style={{ fontSize: '.68rem', color: '#8a9ab5', fontWeight: 600, letterSpacing: '.04em', margin: '0 0 3px' }}>TOTAL BRUTO</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f2340', margin: 0 }}>{fmtR$(totBruto)}</p>
                  <p style={{ fontSize: '.68rem', color: '#8a9ab5', margin: '2px 0 0' }}>{selecionados.length} cooperado(s)</p>
                </CardContent>
              </Card>
              <Card style={{ border: '1.5px solid #e2e8f0' }}>
                <CardContent style={{ padding: '12px 16px' }}>
                  <p style={{ fontSize: '.68rem', color: '#8a9ab5', fontWeight: 600, letterSpacing: '.04em', margin: '0 0 3px' }}>TOTAL DESCONTOS</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#b91c1c', margin: 0 }}>-{fmtR$(totDescontos)}</p>
                  <p style={{ fontSize: '.68rem', color: '#8a9ab5', margin: '2px 0 0' }}>
                    INSS {fmtR$(totInss)} · Cota {fmtR$(totCota)}
                  </p>
                </CardContent>
              </Card>
              <Card style={{ border: '1.5px solid #e2e8f0' }}>
                <CardContent style={{ padding: '12px 16px' }}>
                  <p style={{ fontSize: '.68rem', color: '#8a9ab5', fontWeight: 600, letterSpacing: '.04em', margin: '0 0 3px' }}>TOTAL LÍQUIDO</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#16a34a', margin: 0 }}>{fmtR$(totLiq)}</p>
                  <p style={{ fontSize: '.68rem', color: '#8a9ab5', margin: '2px 0 0' }}>Bruto − Descontos</p>
                </CardContent>
              </Card>
              <Card style={{ border: '1.5px solid #e2e8f0' }}>
                <CardContent style={{ padding: '12px 16px' }}>
                  <p style={{ fontSize: '.68rem', color: '#8a9ab5', fontWeight: 600, letterSpacing: '.04em', margin: '0 0 3px' }}>CONFERÊNCIA</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: Math.abs(totBruto - totDescontos - totLiq) < 0.01 ? '#16a34a' : '#b91c1c', margin: 0 }}>
                    {Math.abs(totBruto - totDescontos - totLiq) < 0.01 ? 'OK ✓' : 'DIVERGÊNCIA'}
                  </p>
                  <p style={{ fontSize: '.68rem', color: '#8a9ab5', margin: '2px 0 0' }}>Bruto − Descontos = Líquido</p>
                </CardContent>
              </Card>
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 12 }}>
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selectedIds.size === cooperados.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
              <Button
                onClick={handleExportAll}
                disabled={exportingAll || selecionados.length === 0}
                style={{ background: '#0f2340', gap: 6 }}
              >
                {exportingAll ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                Gerar RPAs ({selecionados.length})
              </Button>
            </div>

            {/* Lista de cooperados */}
            {cooperados.map(c => {
              const key       = c.matricula || c.nome;
              const isSel     = selectedIds.has(key);
              const isExpanded = expandedId === key;
              const isExporting = exportingKey === key;

              return (
                <Card key={key} style={{
                  marginBottom: 10,
                  border: `1.5px solid ${isSel ? '#0f2340' : '#e2e8f0'}`,
                  transition: 'border-color .15s',
                }}>
                  <CardContent style={{ padding: '14px 16px' }}>

                    {/* ── Linha principal ── */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '36px 1fr 100px 100px 100px 100px 110px auto',
                      gap: 8, alignItems: 'center',
                    }}>
                      <Checkbox checked={isSel} onCheckedChange={() => toggleCooperado(key)} />

                      {/* Nome + info */}
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '.88rem', color: '#0f2340', margin: 0 }}>
                          {c.nome}
                        </p>
                        <p style={{ fontSize: '.72rem', color: '#8a9ab5', margin: '1px 0 0' }}>
                          {c.matricula && <span style={{ marginRight: 8 }}>Mat. {c.matricula}</span>}
                          {c.profissoes.join(' · ')}
                        </p>
                        {/* Avisos de categoria não mapeada */}
                        {c.avisos.length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            {c.avisos.map((av, i) => (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                fontSize: 10, color: '#b45309', background: '#fffbeb',
                                border: '1px solid #fde68a', borderRadius: 4,
                                padding: '2px 6px', marginBottom: 2,
                              }}>
                                <AlertCircle size={10} style={{ flexShrink: 0 }} />
                                {av}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Badges de turno */}
                        <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                          {c.diurno && (
                            <span style={{
                              fontSize: 9, padding: '1px 6px', borderRadius: 4,
                              background: '#fef3c7', color: '#92400e', fontWeight: 600,
                            }}>
                              Diurno {fmtR$(c.totalDiurno)}
                            </span>
                          )}
                          {c.noturno && (
                            <span style={{
                              fontSize: 9, padding: '1px 6px', borderRadius: 4,
                              background: '#ede9fe', color: '#4c1d95', fontWeight: 600,
                            }}>
                              Noturno {fmtR$(c.totalNoturno)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bruto */}
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '.65rem', color: '#8a9ab5', margin: '0 0 2px', fontWeight: 600 }}>BRUTO</p>
                        <p style={{ fontSize: '.88rem', fontWeight: 700, color: '#0f2340', margin: 0 }}>{fmtR$(c.totalBruto)}</p>
                      </div>

                      {/* INSS */}
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '.65rem', color: '#8a9ab5', margin: '0 0 2px', fontWeight: 600 }}>
                          INSS {INSS_PERCENTUAL}%
                        </p>
                        <p style={{ fontSize: '.88rem', fontWeight: 700, color: '#b91c1c', margin: 0 }}>-{fmtR$(c.inss)}</p>
                      </div>

                      {/* Cota Parte */}
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '.65rem', color: '#8a9ab5', margin: '0 0 2px', fontWeight: 600 }}>COTA PARTE</p>
                        <p style={{ fontSize: '.88rem', fontWeight: 700, color: '#b91c1c', margin: 0 }}>-{fmtR$(c.cotaParte)}</p>
                      </div>

                      {/* Total descontos */}
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '.65rem', color: '#8a9ab5', margin: '0 0 2px', fontWeight: 600 }}>DESCONTOS</p>
                        <p style={{ fontSize: '.88rem', fontWeight: 700, color: '#b91c1c', margin: 0 }}>-{fmtR$(c.totalDescontos)}</p>
                      </div>

                      {/* Líquido */}
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '.65rem', color: '#8a9ab5', margin: '0 0 2px', fontWeight: 600 }}>LÍQUIDO</p>
                        <p style={{ fontSize: '.92rem', fontWeight: 700, color: '#16a34a', margin: 0 }}>{fmtR$(c.totalLiquido)}</p>
                      </div>

                      {/* Ações */}
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : key)}
                          style={{
                            height: 32, padding: '0 8px', borderRadius: 6,
                            border: '1px solid #e2e8f0', background: '#f7f9fc',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: 11, color: '#4a5568',
                          }}
                          title="Descontos extras / detalhes"
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        <Button size="sm" variant="outline"
                          onClick={() => handleExportIndividual(c)}
                          disabled={isExporting}
                          style={{ height: 32, gap: 4, fontSize: 11, padding: '0 10px' }}
                        >
                          {isExporting
                            ? <Loader2 size={11} className="animate-spin" />
                            : <FileDown size={11} />}
                          Emitir RPA
                        </Button>
                      </div>
                    </div>

                    {/* ── Painel expandido ── */}
                    {isExpanded && (
                      <div style={{
                        marginTop: 14, paddingTop: 14,
                        borderTop: '1px solid #e8eef7',
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
                      }}>
                        {/* Detalhamento por turno */}
                        <div>
                          <p style={{ fontSize: '.78rem', fontWeight: 700, color: '#0f2340', marginBottom: 8 }}>
                            Detalhamento por Turno
                          </p>
                          {[c.diurno, c.noturno, c.outros].filter(Boolean).map(t => (
                            <div key={t!.turno} style={{
                              display: 'flex', justifyContent: 'space-between',
                              fontSize: '.78rem', padding: '5px 0',
                              borderBottom: '1px solid #f0f4fa', color: '#4a5568',
                            }}>
                              <span style={{ fontWeight: 500 }}>{t!.turno}</span>
                              <span style={{ color: '#8a9ab5', marginLeft: 8 }}>
                                {t!.escalas} esc. · {t!.totalHoras}h
                              </span>
                              <span style={{ fontWeight: 600, color: '#0f2340' }}>{fmtR$(t!.valor)}</span>
                            </div>
                          ))}
                          <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            fontSize: '.8rem', padding: '6px 0', color: '#0f2340', fontWeight: 700,
                          }}>
                            <span>Total Bruto</span>
                            <span>{fmtR$(c.totalBruto)}</span>
                          </div>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            fontSize: '.78rem', padding: '4px 0', color: '#b91c1c',
                          }}>
                            <span>INSS ({INSS_PERCENTUAL}%)</span>
                            <span>-{fmtR$(c.inss)}</span>
                          </div>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            fontSize: '.78rem', padding: '4px 0', color: '#b91c1c',
                          }}>
                            <span>Cota Parte</span>
                            <span>-{fmtR$(c.cotaParte)}</span>
                          </div>
                        </div>

                        {/* Descontos extras individuais */}
                        <div>
                          <p style={{ fontSize: '.78rem', fontWeight: 700, color: '#0f2340', marginBottom: 8 }}>
                            Descontos Extras Individuais
                          </p>
                          {c.descontosExtras.length === 0 && (
                            <p style={{ fontSize: '.73rem', color: '#8a9ab5', marginBottom: 8 }}>
                              Nenhum desconto extra adicionado.
                            </p>
                          )}
                          {c.descontosExtras.map(d => (
                            <DescontoExtraRow
                              key={d.id}
                              desconto={d}
                              onChange={nd => updateDescontoExtra(key, nd)}
                              onRemove={() => removeDescontoExtra(key, d.id)}
                            />
                          ))}
                          <Button variant="outline" size="sm"
                            onClick={() => addDescontoExtra(key)}
                            style={{ gap: 5, fontSize: 11, marginTop: 4 }}>
                            <Plus size={11} /> Adicionar Desconto Extra
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
