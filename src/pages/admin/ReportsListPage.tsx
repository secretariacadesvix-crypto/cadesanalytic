import { useState, useEffect } from 'react';
import { Loader2, FileText, Trash2, Eye, Building2, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdminNav } from '@/components/AdminNav';
import { supabase } from '@/lib/supabase';
import type { StoredReport, Client } from '@/types/database';
import { toast } from 'sonner';
import { format, isAfter, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MESES = [
  { v: '1',  l: 'Janeiro'   }, { v: '2',  l: 'Fevereiro' }, { v: '3',  l: 'Março'     },
  { v: '4',  l: 'Abril'     }, { v: '5',  l: 'Maio'      }, { v: '6',  l: 'Junho'     },
  { v: '7',  l: 'Julho'     }, { v: '8',  l: 'Agosto'    }, { v: '9',  l: 'Setembro'  },
  { v: '10', l: 'Outubro'   }, { v: '11', l: 'Novembro'  }, { v: '12', l: 'Dezembro'  },
];

export default function ReportsListPage() {
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filterClient, setFilterClient] = useState('all');
  const [filterMonth, setFilterMonth]   = useState('all');
  const [filterYear,  setFilterYear]    = useState('all');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<StoredReport | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [reportsRes, clientsRes] = await Promise.all([
      supabase
        .from('reports')
        .select('*, client:clients(id, name, email)')
        .order('published_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
    ]);
    if (reportsRes.error) toast.error('Erro ao carregar relatórios.');
    setReports((reportsRes.data as StoredReport[]) ?? []);
    setClients(clientsRes.data ?? []);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    // Delete file from storage if exists
    if (deleteTarget.file_path) {
      await supabase.storage.from('reports').remove([deleteTarget.file_path]);
    }
    const { error } = await supabase.from('reports').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('Erro ao excluir relatório.');
    } else {
      toast.success('Relatório excluído.');
      setReports(prev => prev.filter(r => r.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  // Anos disponíveis derivados dos próprios relatórios
  const availableYears = [...new Set(reports.map(r => r.year).filter(Boolean) as number[])]
    .sort((a, b) => b - a);

  const filtered = reports.filter(r => {
    if (filterClient !== 'all' && r.client_id !== filterClient) return false;
    if (filterMonth  !== 'all' && String(r.month) !== filterMonth) return false;
    if (filterYear   !== 'all' && String(r.year)  !== filterYear)  return false;
    return true;
  });

  const isNew = (date: string) => isAfter(new Date(date), subDays(new Date(), 7));

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">Relatórios publicados</h1>
            <p className="text-sm text-muted-foreground">
              {filtered.length} de {reports.length} relatório{reports.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro por mês */}
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os meses</SelectItem>
                {MESES.map(m => (
                  <SelectItem key={m.v} value={m.v} className="text-xs">{m.l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro por ano */}
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os anos</SelectItem>
                {availableYears.map(y => (
                  <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro por cliente */}
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-[190px] h-8 text-xs">
                <SelectValue placeholder="Filtrar por cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os clientes</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Limpar filtros (só aparece se algum ativo) */}
            {(filterMonth !== 'all' || filterYear !== 'all' || filterClient !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => { setFilterMonth('all'); setFilterYear('all'); setFilterClient('all'); }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum relatório publicado ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use "Novo Relatório" para fazer upload e publicar um relatório.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map(report => (
              <Card key={report.id} className="border-border/60 hover:border-border transition-colors">
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{report.title}</p>
                        {isNew(report.published_at) && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700 border-green-200">
                            NOVO
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {report.client && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="w-3 h-3" /> {report.client.name}
                          </span>
                        )}
                        {report.period && (
                          <span className="text-xs text-muted-foreground">
                            Período: {report.period}
                          </span>
                        )}
                        {report.report_date && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(report.report_date), "d MMM yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Publicado em {format(new Date(report.published_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Link to={`/relatorio/${report.id}`}>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <Eye className="w-3.5 h-3.5" /> Ver
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(report)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso excluirá <strong>"{deleteTarget?.title}"</strong> permanentemente. O cliente não terá mais acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
