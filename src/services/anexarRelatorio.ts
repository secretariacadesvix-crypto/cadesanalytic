/**
 * Serviço de "Anexar Atualização" de relatório.
 *
 * Fluxo:
 *  1. Admin faz upload de novo PDF
 *  2. parsePDF() extrai os registros
 *  3. previewAnexo() compara com o parsed_data já salvo no banco
 *     → identifica cooperados NOVOS (não presentes no relatório original)
 *  4. confirmarAnexo() mescla os registros, recalcula totais e salva
 */

import { supabase } from '@/lib/supabase';
import type { PlantaoRecord, ReportData, SectorData } from '@/types/report';

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface AnexoPreview {
  report_id: string;
  title: string;
  periodo: string | null;
  cliente: string | null;
  versao_atual: number;
  cooperados_novos: PlantaoRecord[];
  cooperados_existentes: number;
  valor_anterior: number;
  valor_novo: number;
  diferenca_valor: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Chave de unicidade: matrícula + turno (mesmo cooperado pode ter diurno e noturno) */
function chaveCooperado(r: PlantaoRecord): string {
  return `${r.matricula.trim()}|${r.turno.toUpperCase()}`;
}

/** Reconstrói SectorData[] a partir de PlantaoRecord[] */
function recalcularSetores(registros: PlantaoRecord[]): SectorData[] {
  const mapa = new Map<string, PlantaoRecord[]>();
  for (const r of registros) {
    if (!mapa.has(r.setor)) mapa.set(r.setor, []);
    mapa.get(r.setor)!.push(r);
  }
  return Array.from(mapa.entries())
    .map(([setor, regs]) => ({
      setor,
      registros: regs,
      totalPlantoes: regs.reduce((s, r) => s + r.escalas, 0),
      totalHoras:    regs.reduce((s, r) => s + r.totalHoras, 0),
      valorTotal:    regs.reduce((s, r) => s + r.valorFinal, 0),
    }))
    .sort((a, b) => b.valorTotal - a.valorTotal);
}

// ── previewAnexo ──────────────────────────────────────────────────────────────

/**
 * Compara o parsed_data do banco com o novo PDF parseado.
 * Retorna quais cooperados são novos (ainda não existem no relatório salvo).
 * NÃO faz nenhuma escrita — apenas leitura.
 */
export async function previewAnexo(
  reportId: string,
  novoParsed: ReportData,
): Promise<AnexoPreview> {
  const { data: report, error } = await supabase
    .from('reports')
    .select('id, title, period, parsed_data, version')
    .eq('id', reportId)
    .single();

  if (error || !report) {
    throw new Error('Relatório não encontrado no sistema.');
  }

  const dadosAtuais = report.parsed_data as ReportData | null;
  const registrosAtuais: PlantaoRecord[] = dadosAtuais?.registros ?? [];

  const chavesExistentes = new Set(registrosAtuais.map(chaveCooperado));

  const cooperados_novos = novoParsed.registros.filter(
    (r) => !chavesExistentes.has(chaveCooperado(r)),
  );

  const valorAdicional = cooperados_novos.reduce((s, r) => s + r.valorFinal, 0);
  const valorAnterior  = dadosAtuais?.valorTotal ?? 0;
  const valorNovo      = valorAnterior + valorAdicional;

  return {
    report_id:             report.id,
    title:                 report.title,
    periodo:               report.period ?? novoParsed.periodo ?? null,
    cliente:               dadosAtuais?.cliente ?? novoParsed.cliente ?? null,
    versao_atual:          report.version ?? 1,
    cooperados_novos,
    cooperados_existentes: registrosAtuais.length,
    valor_anterior:        valorAnterior,
    valor_novo:            valorNovo,
    diferenca_valor:       valorAdicional,
  };
}

// ── confirmarAnexo ────────────────────────────────────────────────────────────

/**
 * Executa o anexo após confirmação do admin:
 *  1. Mescla os novos registros ao parsed_data existente
 *  2. Recalcula totais e setores
 *  3. Atualiza `reports` (parsed_data, valorTotal, version)
 *  4. Registra histórico em `report_versions`
 */
export async function confirmarAnexo(
  preview: AnexoPreview,
  arquivoNome: string,
  userId: string,
): Promise<void> {
  if (preview.cooperados_novos.length === 0) {
    throw new Error(
      'Nenhum cooperado novo encontrado. O PDF enviado não contém registros diferentes do já processado.',
    );
  }

  // Lê estado atual novamente (evita race condition)
  const { data: report, error } = await supabase
    .from('reports')
    .select('parsed_data, version')
    .eq('id', preview.report_id)
    .single();

  if (error || !report) throw new Error('Relatório não encontrado.');

  const dadosAtuais = report.parsed_data as ReportData;
  const novaVersao  = (report.version ?? 1) + 1;

  // Mescla registros: existentes + novos
  const registrosMesclados = [
    ...(dadosAtuais.registros ?? []),
    ...preview.cooperados_novos,
  ];

  const setoresRecalculados  = recalcularSetores(registrosMesclados);
  const profissoes           = [...new Set(registrosMesclados.map((r) => r.profissao))];
  const uniqueProfissionais  = new Set(registrosMesclados.map((r) => r.nome));

  const dadosAtualizados: ReportData = {
    ...dadosAtuais,
    registros:          registrosMesclados,
    setores:            setoresRecalculados,
    totalProfissionais: uniqueProfissionais.size,
    totalPlantoes:      registrosMesclados.reduce((s, r) => s + r.escalas, 0),
    totalHoras:         registrosMesclados.reduce((s, r) => s + r.totalHoras, 0),
    totalSetores:       setoresRecalculados.length,
    valorTotal:         preview.valor_novo,
    profissoes,
  };

  // 1. Atualiza o relatório
  const { error: updErr } = await supabase
    .from('reports')
    .update({
      parsed_data: dadosAtualizados,
      version:     novaVersao,
      updated_by:  userId,
    })
    .eq('id', preview.report_id);

  if (updErr) throw updErr;

  // 2. Registra no histórico
  const { error: histErr } = await supabase
    .from('report_versions')
    .insert({
      report_id:             preview.report_id,
      version_number:        novaVersao,
      cooperados_adicionados: preview.cooperados_novos.map((r) => ({
        matricula:   r.matricula,
        nome:        r.nome,
        setor:       r.setor,
        turno:       r.turno,
        escalas:     r.escalas,
        valor_final: r.valorFinal,
      })),
      cooperados_count: preview.cooperados_novos.length,
      valor_anterior:   preview.valor_anterior,
      valor_novo:       preview.valor_novo,
      diferenca_valor:  preview.diferenca_valor,
      arquivo_nome:     arquivoNome,
      enviado_por:      userId,
    });

  if (histErr) throw histErr;
}

// ── buscarHistorico ───────────────────────────────────────────────────────────

export interface VersaoHistorico {
  id: string;
  version_number: number;
  cooperados_count: number;
  valor_anterior: number;
  valor_novo: number;
  diferenca_valor: number;
  arquivo_nome: string | null;
  created_at: string;
}

export async function buscarHistorico(reportId: string): Promise<VersaoHistorico[]> {
  const { data, error } = await supabase
    .from('report_versions')
    .select('id, version_number, cooperados_count, valor_anterior, valor_novo, diferenca_valor, arquivo_nome, created_at')
    .eq('report_id', reportId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return (data ?? []) as VersaoHistorico[];
}
