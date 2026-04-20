import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Client } from '@/types/database';
import type { ReportData } from '@/types/report';
import { toast } from 'sonner';
import { getWeek, getMonth, getYear } from 'date-fns';

interface SaveReportModalProps {
  open: boolean;
  onClose: () => void;
  reportData: ReportData;
  file: File | null;
}

export function SaveReportModal({ open, onClose, reportData, file }: SaveReportModalProps) {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(reportData.cliente ? `Relatório – ${reportData.cliente}` : '');
      setReportDate(new Date().toISOString().split('T')[0]);
      loadClients();
    }
  }, [open]);

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('name');
    setClients(data ?? []);
  };

  const handleSave = async () => {
    if (!clientId) { toast.error('Selecione um cliente.'); return; }
    if (!title.trim()) { toast.error('Informe o título do relatório.'); return; }

    setLoading(true);
    try {
      const date = reportDate ? new Date(reportDate) : new Date();
      let filePath: string | null = null;
      let fileName: string | null = null;

      // Upload PDF to Storage if file is available
      if (file) {
        const ext = file.name.split('.').pop();
        filePath = `${clientId}/${crypto.randomUUID()}.${ext}`;
        fileName = file.name;

        const { error: uploadError } = await supabase.storage
          .from('reports')
          .upload(filePath, file, { contentType: 'application/pdf' });

        if (uploadError) throw uploadError;
      }

      // Insert report record
      const { error: insertError } = await supabase.from('reports').insert({
        title: title.trim(),
        sector: reportData.setores.map(s => s.setor).join(', ') || null,
        period: reportData.periodo ?? null,
        report_date: reportDate || null,
        week_number: getWeek(date),
        month: getMonth(date) + 1,
        year: getYear(date),
        client_id: clientId,
        file_path: filePath,
        file_name: fileName,
        parsed_data: reportData,
        created_by: user?.id,
      });

      if (insertError) throw insertError;

      toast.success('Relatório salvo e publicado para o cliente!');
      onClose();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar Relatório</DialogTitle>
          <DialogDescription className="text-xs">
            Publique este relatório para um cliente. Ele ficará disponível no portal do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Título do relatório</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Relatório de Plantões – Janeiro 2025"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Cliente (hospital/clínica)</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione o cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Nenhum cliente cadastrado.
                  </div>
                ) : (
                  clients.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-sm">
                      {c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data do relatório</Label>
              <Input
                type="date"
                value={reportDate}
                onChange={e => setReportDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Período (PDF)</Label>
              <Input
                value={reportData.periodo ?? ''}
                disabled
                className="h-9 text-sm bg-muted/50"
              />
            </div>
          </div>

          {!file && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Nenhum PDF original disponível. Os dados analisados serão salvos, mas sem o arquivo original.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Publicar para cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
