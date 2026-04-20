import type { PlantaoRecord } from '@/types/report';
import type { ValoresHora } from '@/types/config';
import { calcularValorBruto, matchCategoria } from '@/lib/valoresHora';

// ── Constantes do negócio ─────────────────────────────────────────────────────
export const INSS_PERCENTUAL  = 20;   // 20% sobre bruto total
export const COTA_PARTE_VALOR = 80;   // R$ 80,00 fixo

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TurnoConsolidado {
  turno: string;
  escalas: number;
  totalHoras: number;
  valor: number;
  registros: PlantaoRecord[];
}

export interface DescontoExtra {
  id: string;
  descricao: string;
  tipo: 'percentual' | 'fixo';
  valor: number;
}

export interface CooperadoConsolidado {
  // Identificação
  nome: string;
  matricula: string;
  profissoes: string[];
  setores: string[];

  // Turnos
  diurno:  TurnoConsolidado | null;
  noturno: TurnoConsolidado | null;
  outros:  TurnoConsolidado | null; // turnos não classificados

  // Totais brutos por turno
  totalDiurno:  number;
  totalNoturno: number;
  totalBruto:   number;

  // Descontos padrão (calculados automaticamente)
  inss:      number; // INSS_PERCENTUAL % do bruto
  cotaParte: number; // COTA_PARTE_VALOR fixo

  // Descontos adicionais configurados pelo usuário
  descontosExtras: DescontoExtra[];

  // Totais finais
  totalDescontos: number;
  totalLiquido:   number;

  // Avisos de configuração (ex: categoria não mapeada)
  avisos: string[];
}

// ── Helpers internos ──────────────────────────────────────────────────────────

/**
 * Retorna o valor bruto para um registro usando SOMENTE as taxas internas
 * do cooperado (tabela do sistema). Valores monetários do relatório são ignorados.
 *   - Taxa configurada → totalHoras × taxa
 *   - Categoria não mapeada ou taxas não carregadas → 0 (aviso gerado em coletarAvisos)
 */
function getValorEfetivo(r: PlantaoRecord, vh?: ValoresHora | null): number {
  if (vh) {
    const calc = calcularValorBruto(r.totalHoras, r.profissao, r.turno, vh);
    if (calc != null) return calc;
  }
  return 0;
}

/**
 * Retorna avisos para registros cuja combinação profissão+turno não tem
 * categoria mapeada nas taxas do sistema.
 */
function coletarAvisos(regs: PlantaoRecord[], vh?: ValoresHora | null): string[] {
  if (!vh) return [];
  const semCategoria = regs.filter(r => matchCategoria(r.profissao, r.turno) === null);
  if (semCategoria.length === 0) return [];

  // Agrupa por combinação única e soma horas sem valor para o aviso
  const mapa = new Map<string, number>();
  for (const r of semCategoria) {
    const k = `${r.profissao} / ${r.turno}`;
    mapa.set(k, (mapa.get(k) ?? 0) + (r.totalHoras ?? 0));
  }
  return Array.from(mapa.entries()).map(([combo, horas]) =>
    `Sem taxa: "${combo}" (${horas.toFixed(1)}h sem valor) — configure em Configurações → Valores Base`,
  );
}

function buildTurno(regs: PlantaoRecord[], vh?: ValoresHora | null): TurnoConsolidado | null {
  if (regs.length === 0) return null;
  const totalHoras = regs.reduce((s, r) => s + (r.totalHoras ?? 0), 0);
  const valor      = Math.round(regs.reduce((s, r) => s + getValorEfetivo(r, vh), 0) * 100) / 100;
  return {
    turno:  regs[0].turno,
    escalas: regs.reduce((s, r) => s + (r.escalas ?? 0), 0),
    totalHoras,
    valor,
    registros: regs,
  };
}

function r2(v: number) { return Math.round(v * 100) / 100; }

function calcTotais(c: Omit<CooperadoConsolidado, 'totalDescontos' | 'totalLiquido'>): CooperadoConsolidado {
  // Cada desconto extra é arredondado individualmente antes de somar
  const extrasTotal = r2(
    c.descontosExtras.reduce((s, d) => {
      const val = d.tipo === 'percentual' ? r2(c.totalBruto * d.valor / 100) : d.valor;
      return s + val;
    }, 0),
  );
  const totalDescontos = r2(c.inss + c.cotaParte + extrasTotal);
  const totalLiquido   = r2(c.totalBruto - totalDescontos);
  return { ...c, totalDescontos, totalLiquido };
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Agrupa todos os registros do relatório por cooperado e calcula os totais.
 * INSS (20%) e Cota Parte (R$80) são aplicados apenas uma vez sobre o bruto consolidado.
 */
export function consolidarPorCooperado(
  registros: PlantaoRecord[],
  valoresHora?: ValoresHora | null,
): CooperadoConsolidado[] {
  // Agrupar por matrícula (preferencial) ou nome normalizado
  const groups = new Map<string, PlantaoRecord[]>();
  for (const r of registros) {
    const key = r.matricula?.trim()
      ? r.matricula.trim()
      : r.nome.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return Array.from(groups.values()).map(regs => {
    const nome      = regs[0].nome;
    const matricula = regs[0].matricula ?? '';
    const profissoes = [...new Set(regs.map(r => r.profissao).filter(Boolean))];
    const setores    = [...new Set(regs.map(r => r.setor).filter(Boolean))];

    const diurnoRegs  = regs.filter(r => r.turno?.toUpperCase().includes('DIURNO'));
    const noturnoRegs = regs.filter(r => r.turno?.toUpperCase().includes('NOTURNO'));
    const outrosRegs  = regs.filter(r =>
      !r.turno?.toUpperCase().includes('DIURNO') &&
      !r.turno?.toUpperCase().includes('NOTURNO'),
    );

    const diurno  = buildTurno(diurnoRegs,  valoresHora);
    const noturno = buildTurno(noturnoRegs, valoresHora);
    const outros  = buildTurno(outrosRegs,  valoresHora);

    const totalDiurno  = diurno?.valor  ?? 0;
    const totalNoturno = noturno?.valor ?? 0;
    const totalOutros  = outros?.valor  ?? 0;
    const totalBruto   = Math.round((totalDiurno + totalNoturno + totalOutros) * 100) / 100;

    const inss      = Math.round(totalBruto * INSS_PERCENTUAL / 100 * 100) / 100;
    const cotaParte = COTA_PARTE_VALOR;

    const avisos = coletarAvisos(regs, valoresHora);

    return calcTotais({
      nome, matricula, profissoes, setores,
      diurno, noturno, outros,
      totalDiurno, totalNoturno, totalBruto,
      inss, cotaParte,
      descontosExtras: [],
      avisos,
    });
  });
}

/** Recalcula totais de um cooperado após alterar descontosExtras */
export function recalcularCooperado(c: CooperadoConsolidado): CooperadoConsolidado {
  return calcTotais(c);
}
