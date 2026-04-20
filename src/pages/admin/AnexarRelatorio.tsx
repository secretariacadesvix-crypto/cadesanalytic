import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Loader2, Upload, CheckCircle2, XCircle, FilePlus,
  RefreshCw, Eye, ChevronRight, AlertTriangle, Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AdminNav } from '@/components/AdminNav';
import { supabase } from '@/lib/supabase';
import { parsePDF } from '@/lib/pdfParser';
import { previewAnexo, confirmarAnexo, buscarHistorico } from '@/services/anexarRelatorio';
import type { AnexoPreview, VersaoHistorico } from '@/services/anexarRelatorio';
import { useAuth } from '@/contexts/AuthContext';
import type { StoredReport, Client } from '@/types/database';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type Etapa = 'upload' | 'preview' | 'resultado';

interface ResultadoState {
  ok: boolean;
  mensagem: string;
  count?: number;
  periodo?: string | null;
  novaVersao?: number;
  reportId?: string;
}

// ── Formatadores ──────────────────────────────────────────────────────────────

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AnexarRelatorio() {
  const { user } = useAuth();

  // Estado de etapa
  const [etapa, setEtapa] = useState<Etapa>('upload');

  // Dados do passo 1
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filterClient, setFilterClient] = useState('all');
  const [reportId, setReportId] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Preview (passo 2)
  const [preview, setPreview] = useState<AnexoPreview | null>(null);
  const [loadingConfirmar, setLoadingConfirmar] = useState(false);

  // Resultado (passo 3)
  const [resultado, setResultado] = useState<ResultadoState | null>(null);

  // Histórico
  const [historico, setHistorico] = useState<VersaoHistorico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // ── Carrega relatórios e clientes ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [rRes, cRes] = await Promise.all([
        supabase
          .from('reports')
          .select('id, title, period, client_id, published_at, version, client:clients(id, name)')
          .order('published_at', { ascending: false }),
        supabase.from('clients').select('id, name').order('name'),
      ]);
      setReports((rRes.data as StoredReport[]) ?? []);
      setClients((cRes.data as Client[]) ?? []);
    })();
  }, []);

  // ── Carrega histórico ao selecionar relatório ─────────────────────────────
  useEffect(() => {
    if (!reportId) { setHistorico([]); return; }
    setLoadingHistorico(true);
    buscarHistorico(reportId)
      .then(setHistorico)
      .catch(() => setHistorico([]))
      .finally(() => setLoadingHistorico(false));
  }, [reportId]);

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') { setArquivo(file); setErroUpload(null); }
    else setErroUpload('Apenas arquivos PDF são aceitos.');
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setArquivo(file); setErroUpload(null); }
  };

  // ── Passo 1 → 2: parsear PDF e gerar preview ──────────────────────────────
  const handleProcessar = async () => {
    if (!reportId) { toast.error('Selecione o relatório que deseja atualizar.'); return; }
    if (!arquivo)  { toast.error('Selecione o arquivo PDF atualizado.'); return; }

    setLoadingUpload(true);
    setErroUpload(null);

    try {
      const parsed = await parsePDF(arquivo);
      const prev   = await previewAnexo(reportId, parsed);
      setPreview(prev);
      setEtapa('preview');
    } catch (err: any) {
      setErroUpload(err.message ?? 'Erro ao processar o PDF.');
    } finally {
      setLoadingUpload(false);
    }
  };

  // ── Passo 2 → 3: confirmar anexo ──────────────────────────────────────────
  const handleConfirmar = async () => {
    if (!preview || !user) return;
    setLoadingConfirmar(true);
    try {
      await confirmarAnexo(preview, arquivo?.name ?? 'arquivo.pdf', user.id);
      setResultado({
        ok:          true,
        mensagem:    `${preview.cooperados_novos.length} cooperado${preview.cooperados_novos.length !== 1 ? 's' : ''} adicionado${preview.cooperados_novos.length !== 1 ? 's' : ''} ao relatório.`,
        count:       preview.cooperados_novos.length,
        periodo:     preview.periodo,
        novaVersao:  preview.versao_atual + 1,
        reportId:    preview.report_id,
      });
      setEtapa('resultado');
    } catch (err: any) {
      setResultado({ ok: false, mensagem: err.message ?? 'Erro ao confirmar o anexo.' });
      setEtapa('resultado');
    } finally {
      setLoadingConfirmar(false);
    }
  };

  // ── Reiniciar fluxo ───────────────────────────────────────────────────────
  const resetar = () => {
    setEtapa('upload');
    setArquivo(null);
    setReportId('');
    setPreview(null);
    setResultado(null);
    setErroUpload(null);
    setHistorico([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const filteredReports = filterClient === 'all'
    ? reports
    : reports.filter(r => r.client_id === filterClient);

  const reportSelecionado = reports.find(r => r.id === reportId);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <AdminNav />

      <main className="max-w-3xl mx-auto px-6 py-8">

        {/* Cabeçalho */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <FilePlus className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Anexar Atualização</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Envie um PDF atualizado para adicionar cooperados que ficaram de fora do relatório original.
            Os dados existentes não são alterados — apenas novos registros são acrescentados.
          </p>
        </div>

        {/* Indicador de etapas */}
        <div className="flex items-center gap-2 mb-8">
          {(['upload', 'preview', 'resultado'] as Etapa[]).map((e, i) => {
            const labels = ['1. Upload', '2. Confirmar', '3. Resultado'];
            const ativa  = etapa === e;
            const feita  = (etapa === 'preview' && e === 'upload') ||
                           (etapa === 'resultado' && e !== 'resultado');
            return (
              <div key={e} className="flex items-center gap-2">
                <span className={cn(
                  'text-xs font-medium px-2.5 py-1 rounded-full',
                  ativa && 'bg-primary text-primary-foreground',
                  feita && 'bg-muted text-muted-foreground line-through',
                  !ativa && !feita && 'text-muted-foreground',
                )}>
                  {labels[i]}
                </span>
                {i < 2 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        {/* ── ETAPA 1: Upload ── */}
        {etapa === 'upload' && (
          <div className="space-y-5">
            {/* Seleção do relatório */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Selecione o relatório a atualizar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Select value={filterClient} onValueChange={v => { setFilterClient(v); setReportId(''); }}>
                    <SelectTrigger className="w-[200px] h-8 text-xs">
                      <SelectValue placeholder="Filtrar por cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os clientes</SelectItem>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Select value={reportId} onValueChange={setReportId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione o relatório..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredReports.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Nenhum relatório encontrado.
                      </div>
                    ) : (
                      filteredReports.map(r => (
                        <SelectItem key={r.id} value={r.id} className="text-sm">
                          <span className="flex items-center gap-2">
                            <span>{r.title}</span>
                            {r.period && (
                              <span className="text-xs text-muted-foreground">· {r.period}</span>
                            )}
                            {(r as any).version > 1 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-400 text-amber-600">
                                v{(r as any).version}
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {/* Info do relatório selecionado */}
                {reportSelecionado && (
                  <div className="bg-muted/40 rounded-lg px-3 py-2.5 text-xs text-muted-foreground space-y-0.5">
                    <p><span className="font-medium text-foreground">{reportSelecionado.title}</span></p>
                    {reportSelecionado.period && <p>Período: {reportSelecionado.period}</p>}
                    {(reportSelecionado as any).version > 1 && (
                      <p className="text-amber-600">
                        Este relatório já foi atualizado {(reportSelecionado as any).version - 1} vez(es).
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Histórico de versões (se existir) */}
            {reportId && historico.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground">
                    Histórico de atualizações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingHistorico ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="text-[11px]">
                          <TableHead className="h-7 py-0">Versão</TableHead>
                          <TableHead className="h-7 py-0">Data</TableHead>
                          <TableHead className="h-7 py-0 text-right">Cooperados +</TableHead>
                          <TableHead className="h-7 py-0 text-right">Diferença</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historico.map(h => (
                          <TableRow key={h.id} className="text-xs">
                            <TableCell className="py-1.5">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-400 text-amber-600">
                                v{h.version_number}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-1.5 text-muted-foreground">
                              {format(new Date(h.created_at), "d MMM yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="py-1.5 text-right font-medium text-green-700">
                              +{h.cooperados_count}
                            </TableCell>
                            <TableCell className="py-1.5 text-right text-green-700">
                              +{fmtMoeda(h.diferenca_valor ?? 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Upload do PDF */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">PDF atualizado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Área drag-and-drop */}
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2',
                    'py-8 cursor-pointer transition-colors',
                    arquivo
                      ? 'border-green-400 bg-green-50'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30',
                  )}
                >
                  {arquivo ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                      <p className="text-sm font-medium text-green-700">{arquivo.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(arquivo.size / 1024).toFixed(0)} KB · clique para trocar
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-muted-foreground/60" />
                      <p className="text-sm text-muted-foreground">
                        Arraste o PDF aqui ou <span className="text-primary font-medium">clique para selecionar</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Apenas arquivos .pdf</p>
                    </>
                  )}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Aviso */}
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                  <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-700">
                    Envie o relatório completo e atualizado da CADES. O sistema identificará
                    automaticamente apenas os cooperados <strong>novos</strong> e os adicionará
                    ao relatório existente. Registros já salvos não serão alterados.
                  </p>
                </div>

                {erroUpload && (
                  <div className="flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <p className="text-xs">{erroUpload}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={handleProcessar}
              disabled={!reportId || !arquivo || loadingUpload}
              className="w-full gap-2"
            >
              {loadingUpload ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Lendo o PDF...</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Processar Relatório</>
              )}
            </Button>
          </div>
        )}

        {/* ── ETAPA 2: Preview ── */}
        {etapa === 'preview' && preview && (
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Resumo do Anexo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Info do relatório */}
                <div className="bg-muted/40 rounded-lg px-3 py-2.5 text-xs space-y-0.5">
                  <p className="font-semibold text-sm text-foreground">{preview.title}</p>
                  {preview.cliente && <p className="text-muted-foreground">{preview.cliente}</p>}
                  {preview.periodo && <p className="text-muted-foreground">Período: {preview.periodo}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                      v{preview.versao_atual} atual
                    </Badge>
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-400 text-amber-600">
                      v{preview.versao_atual + 1} nova
                    </Badge>
                  </div>
                </div>

                {/* Contadores */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-lg px-3 py-2.5 text-center">
                    <p className="text-2xl font-bold text-foreground">{preview.cooperados_existentes}</p>
                    <p className="text-xs text-muted-foreground">já no sistema</p>
                  </div>
                  <div className={cn(
                    'rounded-lg px-3 py-2.5 text-center',
                    preview.cooperados_novos.length > 0
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-amber-50 border border-amber-200',
                  )}>
                    <p className={cn(
                      'text-2xl font-bold',
                      preview.cooperados_novos.length > 0 ? 'text-green-700' : 'text-amber-700',
                    )}>
                      +{preview.cooperados_novos.length}
                    </p>
                    <p className={cn(
                      'text-xs',
                      preview.cooperados_novos.length > 0 ? 'text-green-600' : 'text-amber-600',
                    )}>
                      cooperados novos
                    </p>
                  </div>
                </div>

                {/* Valores */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor anterior:</span>
                    <span className="font-medium">{fmtMoeda(preview.valor_anterior)}</span>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>Valor adicional:</span>
                    <span className="font-semibold">+ {fmtMoeda(preview.diferenca_valor)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 font-bold">
                    <span>Novo total:</span>
                    <span>{fmtMoeda(preview.valor_novo)}</span>
                  </div>
                </div>

                {/* Lista dos cooperados novos */}
                {preview.cooperados_novos.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">
                      Cooperados que serão adicionados:
                    </p>
                    <div className="max-h-52 overflow-y-auto space-y-1">
                      {preview.cooperados_novos.map((c, i) => (
                        <div key={i} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-md px-3 py-1.5">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{c.nome}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {c.matricula} · {c.setor} · {c.turno} · {c.escalas} escalas
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-green-700 shrink-0 ml-2">
                            {fmtMoeda(c.valorFinal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      Nenhum cooperado novo encontrado. Todos os registros deste PDF já constam
                      no relatório processado. Nenhuma alteração será feita.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setEtapa('upload')} className="flex-1">
                Voltar
              </Button>
              <Button
                onClick={handleConfirmar}
                disabled={preview.cooperados_novos.length === 0 || loadingConfirmar}
                className="flex-1 gap-2"
              >
                {loadingConfirmar ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Confirmar e Adicionar</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── ETAPA 3: Resultado ── */}
        {etapa === 'resultado' && resultado && (
          <Card className={cn(
            'border-2',
            resultado.ok ? 'border-green-300 bg-green-50/30' : 'border-destructive/30 bg-destructive/5',
          )}>
            <CardContent className="py-10 flex flex-col items-center gap-4 text-center">
              {resultado.ok ? (
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              ) : (
                <XCircle className="w-12 h-12 text-destructive" />
              )}

              <div className="space-y-1">
                <p className={cn('text-base font-semibold', resultado.ok ? 'text-green-800' : 'text-destructive')}>
                  {resultado.ok ? 'Relatório atualizado com sucesso!' : 'Erro ao atualizar'}
                </p>
                <p className="text-sm text-muted-foreground">{resultado.mensagem}</p>
                {resultado.ok && resultado.periodo && (
                  <p className="text-xs text-muted-foreground">
                    Período {resultado.periodo} · Versão {resultado.novaVersao}
                  </p>
                )}
              </div>

              {resultado.ok && (
                <p className="text-xs text-muted-foreground">
                  O dashboard do cliente foi atualizado automaticamente.
                </p>
              )}

              <div className="flex gap-3 mt-2">
                <Button variant="outline" onClick={resetar} className="gap-2">
                  <FilePlus className="w-4 h-4" /> Anexar outro
                </Button>
                {resultado.ok && resultado.reportId && (
                  <Link to={`/relatorio/${resultado.reportId}`}>
                    <Button className="gap-2">
                      <Eye className="w-4 h-4" /> Ver relatório atualizado
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
