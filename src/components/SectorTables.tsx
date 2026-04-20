import type { ReportData, FilterState } from '@/types/report';
import { formatCurrency, formatNumber } from '@/lib/pdfParser';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';

interface SectorTablesProps {
  data: ReportData;
  filters: FilterState;
}

export function SectorTables({ data, filters }: SectorTablesProps) {
  const hasActiveFilters = Boolean(filters.setor || filters.profissional || filters.turno || filters.profissao);

  const filteredSetores = data.setores
    .filter(s => !filters.setor || s.setor === filters.setor)
    .map(s => ({
      ...s,
      registros: s.registros.filter(r => {
        if (filters.profissional && r.nome !== filters.profissional) return false;
        if (filters.turno && r.turno !== filters.turno) return false;
        if (filters.profissao && r.profissao !== filters.profissao) return false;
        return true;
      }),
    }))
    .filter(s => s.registros.length > 0)
    .map(s => ({
      ...s,
      totalPlantoes: s.registros.reduce((sum, r) => sum + r.escalas, 0),
      totalHoras: s.registros.reduce((sum, r) => sum + r.totalHoras, 0),
      valorTotal: s.registros.reduce((sum, r) => sum + r.valorFinal, 0),
    }));

  const totalGeral = filteredSetores.reduce((sum, s) => sum + s.valorTotal, 0);
  const totalGeralExibicao = !hasActiveFilters && data.totalOriginal ? data.totalOriginal : formatCurrency(totalGeral);

  return (
    <div className="space-y-8">
      {filteredSetores.map(setor => (
        <div key={setor.setor} className="stat-card overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-border bg-primary/[0.03]">
            <h3 className="section-title">{setor.setor}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {setor.registros.length} registros • {formatNumber(setor.totalPlantoes)} plantões • {formatNumber(setor.totalHoras)}h
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="table-header">
                <TableHead>Nome</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead className="text-right">Escalas</TableHead>
                <TableHead className="text-right">Total de Horas</TableHead>
                <TableHead className="text-right">Valor Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {setor.registros.map((r, i) => (
                <TableRow key={`${r.matricula}-${i}`} className="hover:bg-muted/30">
                  <TableCell className="font-medium text-sm">{r.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.profissao}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.turno === 'DIURNO'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {r.turno}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm">{r.escalas}</TableCell>
                  <TableCell className="text-right text-sm">{formatNumber(r.totalHoras)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatCurrency(r.valorFinal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-primary/5 font-semibold">
                <TableCell colSpan={3}>Total do Setor</TableCell>
                <TableCell className="text-right">{formatNumber(setor.totalPlantoes)}</TableCell>
                <TableCell className="text-right">{formatNumber(setor.totalHoras)}</TableCell>
                <TableCell className="text-right">{formatCurrency(setor.valorTotal)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ))}

      <div className="stat-card overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-border bg-accent/5">
          <h3 className="section-title">Resumo Financeiro por Setor</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="table-header">
              <TableHead>Setor</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSetores.map(s => (
              <TableRow key={s.setor} className="hover:bg-muted/30">
                <TableCell className="font-medium text-sm">{s.setor}</TableCell>
                <TableCell className="text-right text-sm font-medium">{formatCurrency(s.valorTotal)}</TableCell>
              </TableRow>
            ))}
            {!hasActiveFilters && data.subtotalOriginal && (
              <TableRow>
                <TableCell className="font-medium">Sub-Total (PDF)</TableCell>
                <TableCell className="text-right font-medium">{data.subtotalOriginal}</TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-primary font-bold text-primary-foreground">
              <TableCell className="text-base">TOTAL GERAL</TableCell>
              <TableCell className="text-right text-base">{totalGeralExibicao}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div className="bg-primary rounded-2xl p-8 text-center">
        <p className="text-sm text-primary-foreground/70 uppercase tracking-widest mb-2">Valor Total do Período</p>
        <p className="text-4xl md:text-5xl font-bold text-primary-foreground">{totalGeralExibicao}</p>
      </div>
    </div>
  );
}

