import type { ReportData, FilterState } from '@/types/report';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ReportFiltersProps {
  data: ReportData;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function ReportFilters({ data, filters, onFiltersChange }: ReportFiltersProps) {
  const setores = [...new Set(data.registros.map(r => r.setor))].sort();
  const profissionais = [...new Set(data.registros.map(r => r.nome))].sort();
  const turnos = [...new Set(data.registros.map(r => r.turno))].sort();
  const profissoes = [...new Set(data.registros.map(r => r.profissao))].sort();

  const hasFilters = Object.values(filters).some(v => v !== '');

  const clearFilters = () => onFiltersChange({ setor: '', profissional: '', turno: '', profissao: '' });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={filters.setor || 'all'} onValueChange={(v) => onFiltersChange({ ...filters, setor: v === 'all' ? '' : v })}>
        <SelectTrigger className="w-[180px] h-9 text-sm">
          <SelectValue placeholder="Setor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os setores</SelectItem>
          {setores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.profissional || 'all'} onValueChange={(v) => onFiltersChange({ ...filters, profissional: v === 'all' ? '' : v })}>
        <SelectTrigger className="w-[200px] h-9 text-sm">
          <SelectValue placeholder="Profissional" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os profissionais</SelectItem>
          {profissionais.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.turno || 'all'} onValueChange={(v) => onFiltersChange({ ...filters, turno: v === 'all' ? '' : v })}>
        <SelectTrigger className="w-[140px] h-9 text-sm">
          <SelectValue placeholder="Turno" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os turnos</SelectItem>
          {turnos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.profissao || 'all'} onValueChange={(v) => onFiltersChange({ ...filters, profissao: v === 'all' ? '' : v })}>
        <SelectTrigger className="w-[180px] h-9 text-sm">
          <SelectValue placeholder="Profissão" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as profissões</SelectItem>
          {profissoes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs gap-1">
          <X className="w-3 h-3" /> Limpar
        </Button>
      )}
    </div>
  );
}
