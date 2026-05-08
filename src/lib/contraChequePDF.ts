import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PlantaoRecord } from '@/types/report';
import type { CooperadoConsolidado, DescontoExtra } from '@/lib/consolidacaoFolha';
import { INSS_PERCENTUAL, COTA_PARTE_VALOR } from '@/lib/consolidacaoFolha';

// ── Tipos públicos ────────────────────────────────────────────────────────────
export interface Desconto {
  id: string;
  descricao: string;
  tipo: 'percentual' | 'fixo';
  valor: number;
}

export interface ProfissionalFolha {
  registro: PlantaoRecord;
  descontosExtras: Desconto[];
  valorBrutoOverride?: number;
  categoriaDetectada?: string;
}

export interface FolhaConfig {
  descontosGlobais: Desconto[];
  competencia: string;
  cliente: string;
}

export interface FolhaConfigConsolidado {
  competencia: string;
  cliente: string;
  dataPagto?: string;
  docPagto?: string;
  modalidadePagto?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtR$(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNum(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadLogo(): Promise<string | null> {
  try {
    const resp = await fetch('/logo_cades.png');
    const blob = await resp.blob();
    return await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

const MESES_NUM: Record<string, string> = {
  'Janeiro':'01','Fevereiro':'02','Março':'03','Abril':'04',
  'Maio':'05','Junho':'06','Julho':'07','Agosto':'08',
  'Setembro':'09','Outubro':'10','Novembro':'11','Dezembro':'12',
};

/** "Março / 2025" → "03/2025-1" */
function competenciaToRef(comp: string): string {
  const [mesStr, anoStr] = comp.split('/').map(s => s.trim());
  const mesNum = MESES_NUM[mesStr] ?? mesStr;
  return `${mesNum}/${anoStr}-1`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  DEMONSTRATIVO DE PRODUTIVIDADE — layout fiel ao modelo CADES/WebCoop
// ═══════════════════════════════════════════════════════════════════════════
function gerarDemonstrativoDoc(
  doc: jsPDF,
  c: CooperadoConsolidado,
  cfg: FolhaConfigConsolidado,
  logo: string | null,
  isFirstPage: boolean,
): void {
  if (!isFirstPage) doc.addPage();

  const PW  = doc.internal.pageSize.getWidth();   // 210 mm
  const ML  = 10, MR = 10;
  const CW  = PW - ML - MR;                       // 190 mm

  type RGB = [number, number, number];
  const BLK:  RGB = [0,   0,   0];
  const NAVY: RGB = [15,  35,  64];
  const LGRY: RGB = [240, 240, 240];
  const MGRY: RGB = [200, 208, 218];
  const WHT:  RGB = [255, 255, 255];
  const TBLU: RGB = [30,  58,  95];   // azul-escuro para texto de destaque

  const lw = (w: number) => { doc.setLineWidth(w); };
  const col = (c: RGB) => { doc.setDrawColor(...c); };
  const fill = (c: RGB) => { doc.setFillColor(...c); };
  const txt = (c: RGB) => { doc.setTextColor(...c); };

  // ── CABEÇALHO ──────────────────────────────────────────────────────────
  const HDR_H  = 24;
  const HDR_Y  = 10;
  const LOGO_W = 46; // largura da caixa do logo

  // Borda externa do cabeçalho
  col(MGRY); lw(0.5);
  doc.rect(ML, HDR_Y, CW, HDR_H, 'D');

  // Fundo azul CADES no container da logo
  fill(NAVY);
  doc.rect(ML, HDR_Y, LOGO_W, HDR_H, 'F');

  // Separador vertical após logo
  col(MGRY); lw(0.5);
  doc.line(ML + LOGO_W, HDR_Y, ML + LOGO_W, HDR_Y + HDR_H);

  // Logo
  if (logo) {
    doc.addImage(logo, 'PNG', ML + 3, HDR_Y + 4, 38, 15);
  } else {
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); txt(WHT);
    doc.text('CADES', ML + 5, HDR_Y + 14);
  }

  // Título
  const TX = ML + LOGO_W + 6;
  doc.setFontSize(15); doc.setFont('helvetica', 'bold'); txt(NAVY);
  doc.text('DEMONSTRATIVO DE PRODUTIVIDADE', TX, HDR_Y + 15);

  let y = HDR_Y + HDR_H + 3;

  // ── IDENTIFICAÇÃO ───────────────────────────────────────────────────────
  const ID_H = 20;
  col(MGRY); lw(0.5);
  doc.rect(ML, y, CW, ID_H, 'D');

  const cooperadoLabel = `${c.matricula ? c.matricula + '-' : ''}${c.nome}`;
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); txt(BLK);
  doc.text(`Cooperado: ${cooperadoLabel}`, ML + 3, y + 6);

  doc.text(`Cliente: ${cfg.cliente || 'N/D'}`, ML + 3, y + 13);

  const contrato = cfg.cliente || 'N/D';
  doc.text(`Contrato: ${contrato}`, ML + CW / 2, y + 13);

  doc.text(`Mês Ref.-ID : ${competenciaToRef(cfg.competencia)}`, ML + 3, y + 19);

  y += ID_H + 1;

  // ── TABELA PRINCIPAL ────────────────────────────────────────────────────
  // Monta linhas da tabela
  let seq = 1;
  type TRow = (string | { content: string; styles?: object })[];
  const rows: TRow[] = [];

  // Encontra IRRF nos descontos extras
  // Valor calculado igual ao calcTotais: percentual → % do bruto; fixo → valor direto
  const irrfExtra = c.descontosExtras.find(d =>
    d.descricao.toUpperCase().includes('IRRF'));
  const irrfVal = irrfExtra
    ? (irrfExtra.tipo === 'percentual'
        ? Math.round(c.totalBruto * irrfExtra.valor / 100 * 100) / 100
        : irrfExtra.valor)
    : 0;
  // Base do IRRF = a mesma base usada no cálculo (evita inconsistência entre base exibida e valor)
  const baseIRRF = irrfExtra?.tipo === 'percentual' ? c.totalBruto : 0;

  // CRÉDITO — linha única de produtividade total
  // Horas calculadas proporcionalmente ao bruto atual (inclusive após edição manual)
  const totalHorasOriginal  = (c.diurno?.totalHoras ?? 0) + (c.noturno?.totalHoras ?? 0) + (c.outros?.totalHoras ?? 0);
  const totalBrutoOriginal  = (c.diurno?.valor ?? 0) + (c.noturno?.valor ?? 0) + (c.outros?.valor ?? 0);
  const horasEfetivas = totalBrutoOriginal > 0
    ? Math.round(c.totalBruto / totalBrutoOriginal * totalHorasOriginal * 100) / 100
    : totalHorasOriginal;
  rows.push([
    String(seq++), '101', 'PRODUTIVIDADE TOTAL',
    fmtNum(horasEfetivas),
    fmtNum(c.totalBruto), fmtNum(c.totalBruto),
    '', '',
  ]);

  // DÉBITOS fixos
  rows.push([
    String(seq++), '200', 'INSS',
    '0,00', '', '',
    fmtNum(c.inss), fmtNum(c.inss),
  ]);

  if (irrfVal > 0) {
    rows.push([
      String(seq++), '201', 'IRRF',
      '0,00', '', '',
      fmtNum(irrfVal), fmtNum(irrfVal),
    ]);
  }

  rows.push([
    String(seq++), '202', 'QUOTAS PARTE - 001/010',
    '', '', '',
    fmtNum(c.cotaParte), fmtNum(c.cotaParteAcumulada ?? c.cotaParte),
  ]);

  // Outros descontos extras (exceto IRRF já tratado)
  c.descontosExtras
    .filter(d => !d.descricao.toUpperCase().includes('IRRF'))
    .forEach(d => {
      // Arredondamento igual ao calcTotais para que o valor no corpo bata com os totais
      const val = d.tipo === 'percentual'
        ? Math.round(c.totalBruto * d.valor / 100 * 100) / 100
        : d.valor;
      rows.push([
        String(seq++), '203', (d.descricao || 'DEDUÇÃO').toUpperCase(),
        '0,00', '', '',
        fmtNum(val), fmtNum(val),
      ]);
    });

  // Widths: 10+14+58+20+22+22+22+22 = 190
  autoTable(doc, {
    startY: y,
    head: [
      [
        { content: 'Item',       rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Código',     rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Descrição',  rowSpan: 2, styles: { halign: 'left',   valign: 'middle' } },
        { content: 'Referência', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Crédito', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Débito',  colSpan: 2, styles: { halign: 'center' } },
      ],
      [
        { content: 'Atual',     styles: { halign: 'right' } },
        { content: 'Acumulado', styles: { halign: 'right' } },
        { content: 'Atual',     styles: { halign: 'right' } },
        { content: 'Acumulado', styles: { halign: 'right' } },
      ],
    ],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: LGRY,
      textColor: BLK,
      fontSize: 7,
      fontStyle: 'bold',
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      lineColor: MGRY,
      lineWidth: 0.3,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      textColor: BLK,
      lineColor: MGRY,
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 10,  halign: 'center' },
      1: { cellWidth: 14,  halign: 'center' },
      2: { cellWidth: 58 },
      3: { cellWidth: 20,  halign: 'right' },
      4: { cellWidth: 22,  halign: 'right' },
      5: { cellWidth: 22,  halign: 'right' },
      6: { cellWidth: 22,  halign: 'right' },
      7: { cellWidth: 22,  halign: 'right' },
    },
    margin: { left: ML, right: MR },
    tableLineColor: MGRY,
    tableLineWidth: 0.3,
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ── TOTAIS ──────────────────────────────────────────────────────────────
  const ROW_H  = 7.5;
  const HALF   = CW / 2;

  const drawTotalRow = (
    left: string, right: string, bold: boolean,
    fullWidth = false, highlight = false,
  ) => {
    col(MGRY); lw(0.3);
    if (highlight) { fill(LGRY); doc.rect(ML, y, CW, ROW_H, 'FD'); }
    else doc.rect(ML, y, CW, ROW_H, 'D');

    doc.setFontSize(8);
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); txt(BLK);
    doc.text(left, ML + 3, y + 5.2);

    if (!fullWidth) {
      col(MGRY); lw(0.3);
      doc.line(ML + HALF, y, ML + HALF, y + ROW_H);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(right, ML + HALF + 3, y + 5.2);
    }
    y += ROW_H;
  };

  // Cabeçalho TOTAIS
  fill(LGRY); col(MGRY); lw(0.3);
  doc.rect(ML, y, CW, ROW_H, 'FD');
  doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); txt(NAVY);
  doc.text('TOTAIS', PW / 2, y + 5.2, { align: 'center' });
  y += ROW_H;

  // Usa c.totalBruto diretamente (já arredondado) para evitar deriva de ponto flutuante
  // Garante: totalCreditos − totalDescontos === totalLiquido (invariante do documento)
  const totalCreditos = c.totalBruto;

  drawTotalRow(
    `Total de Créditos:   ${fmtR$(totalCreditos)}`,
    `Total de Débitos:   ${fmtR$(c.totalDescontos)}`,
    true,
  );
  drawTotalRow(
    `Total Líquido:   ${fmtR$(c.totalLiquido)}`,
    '', true, true, true,
  );

  // baseIRRF já declarada acima junto ao irrfExtra — mesma base usada no cálculo
  drawTotalRow(
    `Base de Cálculo IRRF:   ${fmtR$(irrfVal > 0 ? baseIRRF : 0)}`,
    `Valor de IRRF:   ${fmtR$(irrfVal)}`,
    false,
  );
  drawTotalRow(
    `Base de Cálculo INSS:   ${fmtR$(totalCreditos)}`,
    `Valor de INSS:   ${fmtR$(c.inss)}`,
    false,
  );
  drawTotalRow(
    `Banco:   ${cfg.banco ?? ''}`,
    `Modalidade Pagto.:   ${cfg.modalidadePagto ?? 'PIX'}`,
    false,
  );
  drawTotalRow(
    `Agência:   ${cfg.agencia ?? ''}`,
    `Conta:   ${cfg.conta ?? ''}`,
    false,
  );
  drawTotalRow(
    `Data Pagto.:   ${cfg.dataPagto ?? ''}`,
    `Docto. Pagto.:   ${cfg.docPagto ?? ''}`,
    false,
  );

  // ── RODAPÉ ──────────────────────────────────────────────────────────────
  doc.setFontSize(6); doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(
    `${window?.location?.origin ?? 'https://cades.com.br'}/FolhaPagamento — gerado em ${new Date().toLocaleString('pt-BR')}`,
    PW / 2, y + 6, { align: 'center' },
  );
}

// ── Exportar demonstrativo individual ─────────────────────────────────────────
export async function exportContraChequeConsolidadoIndividual(
  c: CooperadoConsolidado,
  config: FolhaConfigConsolidado,
): Promise<void> {
  const doc  = new jsPDF('p', 'mm', 'a4');
  const logo = await loadLogo();
  gerarDemonstrativoDoc(doc, c, config, logo, true);
  const nome = c.nome.replace(/\s+/g, '_').toUpperCase();
  // "/" é inválido em nomes de arquivo — substitui por "-"
  const ref  = competenciaToRef(config.competencia).replace(/\//g, '-');
  doc.save(`demonstrativo_${nome}_${ref}.pdf`);
}

// ── Exportar demonstrativos em lote ──────────────────────────────────────────
export async function exportContraChequeConsolidadoBatch(
  cooperados: CooperadoConsolidado[],
  config: FolhaConfigConsolidado,
): Promise<void> {
  if (cooperados.length === 0) return;
  const doc  = new jsPDF('p', 'mm', 'a4');
  const logo = await loadLogo();
  cooperados.forEach((c, i) => gerarDemonstrativoDoc(doc, c, config, logo, i === 0));
  const ref = competenciaToRef(config.competencia).replace(/\//g, '-');
  doc.save(`folha_demonstrativos_${ref}.pdf`);
}

// ── Funções legadas ───────────────────────────────────────────────────────────
function pfToConsolidado(pf: ProfissionalFolha): CooperadoConsolidado {
  const bruto      = Math.round((pf.valorBrutoOverride ?? pf.registro.valorFinal) * 100) / 100;
  const inss       = Math.round(bruto * INSS_PERCENTUAL / 100 * 100) / 100;
  const cotaParte  = COTA_PARTE_VALOR;
  const extras     = pf.descontosExtras as unknown as DescontoExtra[];
  // Mesmo algoritmo de arredondamento do calcTotais
  const extTotal   = Math.round(
    extras.reduce((s, d) => {
      const val = d.tipo === 'percentual'
        ? Math.round(bruto * d.valor / 100 * 100) / 100
        : d.valor;
      return s + val;
    }, 0) * 100) / 100;
  const totalDescontos = Math.round((inss + cotaParte + extTotal) * 100) / 100;
  const totalLiquido   = Math.round((bruto - totalDescontos) * 100) / 100;
  const isNoturno  = pf.registro.turno?.toUpperCase().includes('NOTURNO') ?? false;
  const turnoData  = {
    turno: pf.registro.turno, escalas: pf.registro.escalas,
    totalHoras: pf.registro.totalHoras, valor: bruto, registros: [pf.registro],
  };
  return {
    nome: pf.registro.nome, matricula: pf.registro.matricula ?? '',
    profissoes: [pf.registro.profissao], setores: [pf.registro.setor],
    diurno:  isNoturno ? null : turnoData,
    noturno: isNoturno ? turnoData : null,
    outros:  null,
    totalDiurno:  isNoturno ? 0 : bruto,
    totalNoturno: isNoturno ? bruto : 0,
    totalBruto: bruto, inss, cotaParte,
    descontosExtras: extras,
    totalDescontos,
    totalLiquido,
    avisos: [],
  };
}

export async function exportContraChequeIndividual(
  pf: ProfissionalFolha, config: FolhaConfig,
): Promise<void> {
  const doc  = new jsPDF('p', 'mm', 'a4');
  const logo = await loadLogo();
  gerarDemonstrativoDoc(doc, pfToConsolidado(pf),
    { competencia: config.competencia, cliente: config.cliente }, logo, true);
  const nome = pf.registro.nome.replace(/\s+/g, '_').toUpperCase();
  doc.save(`demonstrativo_${nome}_${config.competencia.replace(/\s*\/\s*/g, '-')}.pdf`);
}

export async function exportContraChequesBatch(
  profissionais: ProfissionalFolha[], config: FolhaConfig,
): Promise<void> {
  if (profissionais.length === 0) return;
  const doc  = new jsPDF('p', 'mm', 'a4');
  const logo = await loadLogo();
  profissionais.forEach((pf, i) =>
    gerarDemonstrativoDoc(doc, pfToConsolidado(pf),
      { competencia: config.competencia, cliente: config.cliente }, logo, i === 0));
  doc.save(`folha_demonstrativos_${config.competencia.replace(/\s*\/\s*/g, '-')}.pdf`);
}
