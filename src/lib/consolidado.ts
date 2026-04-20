import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StoredReport, Client } from '@/types/database';

// ─── Ponto Fixo (centavos) ─────────────────────────────────────────────────
export const toFixed = (v: number) => Math.round(v * 100);
export const fromFixed = (v: number) => v / 100;

export function fmtMoeda(centavos: number): string {
  return fromFixed(centavos).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

export function fmtHoras(centesimos: number): string {
  // totalHoras vem como horas decimais (ex: 12.5 = 12h30)
  const total = fromFixed(centesimos);
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

// ─── Tipos ─────────────────────────────────────────────────────────────────
export interface ConsolidadoRow {
  nome: string;
  setor: string;
  atividade: string; // = profissao
  turno: string;
  escalas: number;          // inteiro
  horasFixed: number;       // ponto fixo ×100
  valorFixed: number;       // ponto fixo ×100
}

export interface SubTotal {
  setor: string;
  escalas: number;
  horasFixed: number;
  valorFixed: number;
}

export interface ConsolidadoResult {
  rows: ConsolidadoRow[];
  subTotals: SubTotal[];
  grandEscalas: number;
  grandHorasFixed: number;
  grandValorFixed: number;
  expectedValorFixed: number; // soma dos valorTotal de cada relatório
  isValid: boolean;
  validationError?: string;
}

// ─── Lógica principal ──────────────────────────────────────────────────────
export function consolidarRelatorios(reports: StoredReport[]): ConsolidadoResult {
  const rowMap = new Map<string, ConsolidadoRow>();
  let expectedValorFixed = 0;

  for (const report of reports) {
    if (!report.parsed_data) continue;

    // Soma esperada = soma dos valorTotal pré-calculados de cada relatório
    expectedValorFixed += toFixed(report.parsed_data.valorTotal);

    for (const rec of report.parsed_data.registros) {
      const key = `${rec.nome}||${rec.setor}||${rec.turno}||${rec.profissao}`;

      const existing = rowMap.get(key);
      if (existing) {
        existing.escalas    += rec.escalas;
        existing.horasFixed += toFixed(rec.totalHoras);
        existing.valorFixed += toFixed(rec.valorFinal);
      } else {
        rowMap.set(key, {
          nome:      rec.nome,
          setor:     rec.setor,
          atividade: rec.profissao,
          turno:     rec.turno,
          escalas:    rec.escalas,
          horasFixed: toFixed(rec.totalHoras),
          valorFixed: toFixed(rec.valorFinal),
        });
      }
    }
  }

  // Ordenar por setor → nome
  const rows = [...rowMap.values()].sort((a, b) =>
    a.setor !== b.setor ? a.setor.localeCompare(b.setor) : a.nome.localeCompare(b.nome)
  );

  // Sub-totais por setor
  const setorMap = new Map<string, SubTotal>();
  for (const row of rows) {
    const s = setorMap.get(row.setor) ?? { setor: row.setor, escalas: 0, horasFixed: 0, valorFixed: 0 };
    s.escalas    += row.escalas;
    s.horasFixed += row.horasFixed;
    s.valorFixed += row.valorFixed;
    setorMap.set(row.setor, s);
  }
  const subTotals = [...setorMap.values()];

  // Total geral
  const grandEscalas    = subTotals.reduce((s, t) => s + t.escalas, 0);
  const grandHorasFixed = subTotals.reduce((s, t) => s + t.horasFixed, 0);
  const grandValorFixed = subTotals.reduce((s, t) => s + t.valorFixed, 0);

  // Validação de ponto fixo
  const isValid = grandValorFixed === expectedValorFixed;
  const validationError = isValid
    ? undefined
    : `Total consolidado ${fmtMoeda(grandValorFixed)} ≠ soma dos relatórios ${fmtMoeda(expectedValorFixed)}. Verifique os dados e tente novamente.`;

  return { rows, subTotals, grandEscalas, grandHorasFixed, grandValorFixed, expectedValorFixed, isValid, validationError };
}

// ─── Exportação PDF Analítico (por setor, a partir de ConsolidadoRow[]) ────
export function exportAnaliticoPDF(
  rows: ConsolidadoRow[],
  nomeCliente: string,
  mesLabel: string,
) {
  const doc = new jsPDF('l', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mL = 14, mR = 14;
  const navy: [number, number, number]      = [30, 58, 95];
  const navyDark: [number, number, number]  = [20, 40, 68];
  const white: [number, number, number]     = [255, 255, 255];
  const rowAlt: [number, number, number]    = [248, 250, 253];
  const border: [number, number, number]    = [213, 219, 230];
  const textBody: [number, number, number]  = [50, 60, 75];
  const textMuted: [number, number, number] = [120, 130, 150];

  const emitDate = new Date().toLocaleDateString('pt-BR');

  // Cabeçalho
  const drawHeader = () => {
    doc.setFillColor(...navy);
    doc.rect(0, 0, pw, 22, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text('CADES — RELATÓRIO ANALÍTICO', mL, 13);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 210, 240);
    doc.text(`Cliente: ${nomeCliente}   |   Período: ${mesLabel}   |   Emissão: ${emitDate}`, mL, 19);
  };

  // Rodapé
  const drawFooter = () => {
    doc.setDrawColor(...border);
    doc.setLineWidth(0.25);
    doc.line(mL, ph - 10, pw - mR, ph - 10);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text(
      'CADES — Cooperativa Assistencial de Trabalho do Espírito Santo | Vitória/ES',
      pw / 2, ph - 5, { align: 'center' },
    );
  };

  drawHeader();
  drawFooter();
  let y = 28;

  // Agrupar por setor
  const setorMap = new Map<string, ConsolidadoRow[]>();
  for (const row of rows) {
    const list = setorMap.get(row.setor) ?? [];
    list.push(row);
    setorMap.set(row.setor, list);
  }

  // Totais gerais
  const grandEscalas    = rows.reduce((s, r) => s + r.escalas, 0);
  const grandHorasFixed = rows.reduce((s, r) => s + r.horasFixed, 0);
  const grandValorFixed = rows.reduce((s, r) => s + r.valorFixed, 0);

  for (const [setor, sRows] of setorMap) {
    if (y + 35 > ph - 16) {
      doc.addPage();
      drawHeader();
      drawFooter();
      y = 28;
    }

    // Barra do setor
    doc.setFillColor(...navy);
    doc.rect(mL, y, pw - mL - mR, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text(setor, mL + 3, y + 5.5);
    y += 8;

    const subEscalas    = sRows.reduce((s, r) => s + r.escalas, 0);
    const subHorasFixed = sRows.reduce((s, r) => s + r.horasFixed, 0);
    const subValorFixed = sRows.reduce((s, r) => s + r.valorFixed, 0);

    autoTable(doc, {
      startY: y,
      head: [['NOME', 'ATIVIDADE', 'TURNO', 'ESCALAS', 'TOTAL DE HORAS', 'VALOR FINAL']],
      body: sRows.map(r => [
        r.nome,
        r.atividade,
        r.turno,
        String(r.escalas),
        fmtHoras(r.horasFixed),
        fmtMoeda(r.valorFixed),
      ]),
      foot: [['SUBTOTAL', '', '', String(subEscalas), fmtHoras(subHorasFixed), fmtMoeda(subValorFixed)]],
      theme: 'plain',
      showFoot: 'lastPage',
      headStyles: { fillColor: navyDark, textColor: white, fontSize: 7, fontStyle: 'bold', cellPadding: 2.5 },
      bodyStyles: { fontSize: 7, cellPadding: 2.5, textColor: textBody, lineColor: border, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: rowAlt },
      footStyles: { fillColor: navy, textColor: white, fontStyle: 'bold', fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 40 },
        2: { cellWidth: 22, halign: 'center' as const },
        3: { cellWidth: 20, halign: 'center' as const },
        4: { cellWidth: 28, halign: 'right' as const },
        5: { cellWidth: 38, halign: 'right' as const },
      },
      margin: { left: mL, right: mR },
      tableLineColor: border,
      tableLineWidth: 0.2,
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Total geral
  if (y + 14 > ph - 16) {
    doc.addPage();
    drawHeader();
    drawFooter();
    y = 28;
  }
  autoTable(doc, {
    startY: y,
    body: [['TOTAL GERAL', '', '', String(grandEscalas), fmtHoras(grandHorasFixed), fmtMoeda(grandValorFixed)]],
    theme: 'plain',
    bodyStyles: { fillColor: [13, 148, 136], textColor: white, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 40 },
      2: { cellWidth: 22, halign: 'center' as const },
      3: { cellWidth: 20, halign: 'center' as const },
      4: { cellWidth: 28, halign: 'right' as const },
      5: { cellWidth: 38, halign: 'right' as const },
    },
    margin: { left: mL, right: mR },
  });

  const slug = `${nomeCliente.replace(/\s+/g, '-')}-${mesLabel.replace(/\s+/g, '-')}`;
  doc.save(`analitico-${slug}.pdf`);
}

// ─── Exportação PDF Consolidado (mesmo layout do Relatório de Produção) ─────
export async function exportConsolidadoPDF(
  result: ConsolidadoResult,
  client: Client,
  mesLabel: string,
  reportTitles: string[],
): Promise<void> {
  // ── Paleta (idêntica ao Relatório de Produção) ────────────────────────────
  const navy:      [number, number, number] = [30,  58,  95];
  const navyDark:  [number, number, number] = [20,  40,  68];
  const teal:      [number, number, number] = [13, 148, 136];
  const white:     [number, number, number] = [255, 255, 255];
  const grayBg:    [number, number, number] = [245, 247, 250];
  const rowAlt:    [number, number, number] = [248, 250, 253];
  const border:    [number, number, number] = [213, 219, 230];
  const textBody:  [number, number, number] = [50,  60,  75];
  const textMuted: [number, number, number] = [120, 130, 150];
  const blueLight: [number, number, number] = [219, 234, 254]; // subtotal

  // Cores de turno
  const diurnoBg:   [number, number, number] = [239, 246, 255]; // blue-50
  const noturnoBg:  [number, number, number] = [245, 243, 255]; // violet-50
  const diurnoText: [number, number, number] = [29,  78, 216];  // blue-700
  const noturnoText:[number, number, number] = [109,  40, 217]; // violet-700

  // ── Logo ──────────────────────────────────────────────────────────────────
  let logoDataUrl: string | null = null;
  try {
    const resp = await fetch('/logo_cades.png');
    const blob = await resp.blob();
    logoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { /* texto como fallback */ }

  // ── Documento A4 retrato ──────────────────────────────────────────────────
  const doc = new jsPDF('p', 'mm', 'a4');
  const W   = doc.internal.pageSize.getWidth();   // 210
  const H   = doc.internal.pageSize.getHeight();  // 297
  const mL  = 15, mR = 15;
  const cW  = W - mL - mR;                        // 180

  const emitDate = new Date().toLocaleDateString('pt-BR');

  // Logo: 220×96px → ratio 2.29:1, altura=18mm → largura≈41mm
  const LOGO_H    = 18;
  const LOGO_W    = Math.round(LOGO_H * (220 / 96)); // 41
  const HEADER_H  = 38;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const drawHeader = () => {
    doc.setFillColor(...navy);
    doc.rect(0, 0, W, HEADER_H, 'F');

    const logoY = (HEADER_H - LOGO_H) / 2;
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', mL, logoY, LOGO_W, LOGO_H);
    } else {
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...white);
      doc.text('CADES', mL, HEADER_H / 2 + 3);
    }

    const sepX = mL + LOGO_W + 4;
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.2);
    doc.line(sepX, 10, sepX, HEADER_H - 10);

    const textX = sepX + 5;
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text('CONSOLIDADO MENSAL DE PRODUÇÃO', textX, 20);

    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 210, 240);
    doc.text('CADES — Cooperativa Assistencial de Trabalho do Espírito Santo', textX, 28);

    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 210, 240);
    doc.text('DATA DE EMISSÃO', W - mR, 16, { align: 'right' });
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text(emitDate, W - mR, 26, { align: 'right' });
  };

  const drawSummaryCards = (startY: number): number => {
    const cardH = 22;
    doc.setFillColor(...grayBg);
    doc.rect(mL, startY, cW, cardH, 'F');

    const cards = [
      { label: 'CLIENTE',       value: client.name.length > 14 ? client.name.slice(0, 13) + '…' : client.name },
      { label: 'PERÍODO',       value: mesLabel },
      { label: 'TOTAL ESCALAS', value: String(result.grandEscalas) },
      { label: 'TOTAL HORAS',   value: fmtHoras(result.grandHorasFixed) },
      { label: 'VALOR TOTAL',   value: fmtMoeda(result.grandValorFixed) },
    ];

    const cardW = cW / cards.length;
    cards.forEach((card, i) => {
      const cx = mL + i * cardW + cardW / 2;
      if (i > 0) {
        doc.setDrawColor(...border); doc.setLineWidth(0.25);
        doc.line(mL + i * cardW, startY + 4, mL + i * cardW, startY + cardH - 4);
      }
      doc.setFontSize(6); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textMuted);
      doc.text(card.label, cx, startY + 7, { align: 'center' });

      const fs = card.value.length > 11 ? 8 : 11;
      doc.setFontSize(fs); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...navy);
      doc.text(card.value, cx, startY + 17, { align: 'center' });
    });

    // Linha teal abaixo dos cards
    const lineY = startY + cardH + 3;
    doc.setDrawColor(...teal);
    doc.setLineWidth(0.8);
    doc.line(mL, lineY, W - mR, lineY);
    return lineY + 5;
  };

  const drawFooter = () => {
    const fy = H - 10;
    doc.setDrawColor(...border); doc.setLineWidth(0.25);
    doc.line(mL, fy - 4, W - mR, fy - 4);
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text(
      'CADES — Cooperativa Assistencial de Trabalho do Espírito Santo | R. Mario Aguirre, 45, Jucutuquara, Vitória – ES | +55 27 99713-8453',
      W / 2, fy, { align: 'center' },
    );
  };

  // ── Página 1 ──────────────────────────────────────────────────────────────
  drawHeader();
  let y = drawSummaryCards(HEADER_H + 2);

  // Relatórios incluídos (texto pequeno abaixo dos cards)
  if (reportTitles.length > 0) {
    const titlesText = `Relatórios: ${reportTitles.join(' | ')}`;
    const lines = doc.splitTextToSize(titlesText, cW) as string[];
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text(lines, mL, y);
    y += lines.length * 3.5 + 3;
  }

  drawFooter();

  // ── Tabelas por setor ────────────────────────────────────────────────────
  // Agrupar linhas por setor (mantendo a ordem de result.rows)
  const setorRowsMap = new Map<string, ConsolidadoRow[]>();
  for (const row of result.rows) {
    const list = setorRowsMap.get(row.setor) ?? [];
    list.push(row);
    setorRowsMap.set(row.setor, list);
  }

  const colStyles = {
    0: { cellWidth: 55 },
    1: { cellWidth: 38 },
    2: { cellWidth: 20, halign: 'center' as const },
    3: { cellWidth: 17, halign: 'center' as const },
    4: { cellWidth: 22, halign: 'right'  as const },
    5: { cellWidth: 28, halign: 'right'  as const },
  };

  for (const sub of result.subTotals) {
    const sRows = setorRowsMap.get(sub.setor) ?? [];

    if (y + 35 > H - 20) {
      doc.addPage(); y = 18; drawFooter();
    }

    // Barra de setor (navy) + linha teal
    doc.setFillColor(...navy);
    doc.rect(mL, y, cW, 9, 'F');
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text(sub.setor, mL + 4, y + 6.2);
    doc.setDrawColor(...teal); doc.setLineWidth(0.6);
    doc.line(mL, y + 9, W - mR, y + 9);
    y += 9;

    autoTable(doc, {
      startY: y,
      head: [['NOME', 'ATIVIDADE', 'TURNO', 'ESCALAS', 'HORAS', 'VALOR FINAL']],
      body: sRows.map(r => [r.nome, r.atividade, r.turno, String(r.escalas), fmtHoras(r.horasFixed), fmtMoeda(r.valorFixed)]),
      foot: [['SUBTOTAL', '', '', String(sub.escalas), fmtHoras(sub.horasFixed), fmtMoeda(sub.valorFixed)]],
      theme: 'plain',
      showFoot: 'lastPage',
      headStyles: {
        fillColor: navyDark, textColor: white,
        fontSize: 7, fontStyle: 'bold', cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 7, cellPadding: 3,
        textColor: textBody, lineColor: border, lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: rowAlt },
      footStyles: {
        fillColor: blueLight, textColor: navy,
        fontStyle: 'bold', fontSize: 7.5, cellPadding: 3,
      },
      columnStyles: colStyles,
      margin: { left: mL, right: mR },
      tableLineColor: border,
      tableLineWidth: 0.2,
      willDrawCell: (data: any) => {
        if (data.section !== 'body' || data.column.index !== 2) return;
        const turno = String(data.cell.raw).toUpperCase();
        if (turno === 'DIURNO') {
          data.doc.setFillColor(...diurnoBg);
          data.doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          data.doc.setTextColor(...diurnoText);
        } else if (turno === 'NOTURNO') {
          data.doc.setFillColor(...noturnoBg);
          data.doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          data.doc.setTextColor(...noturnoText);
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 9;
  }

  // ══ Última página — Resumo Financeiro ════════════════════════════════════
  doc.addPage();
  drawFooter();

  const SUM_LOGO_H  = 13;
  const SUM_LOGO_W  = Math.round(SUM_LOGO_H * (220 / 96)); // 30
  const SUM_HEADER_H = 26;

  doc.setFillColor(...navy);
  doc.rect(0, 0, W, SUM_HEADER_H, 'F');

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', mL, (SUM_HEADER_H - SUM_LOGO_H) / 2, SUM_LOGO_W, SUM_LOGO_H);
  }

  doc.setFontSize(12); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...white);
  const sumX = logoDataUrl ? mL + SUM_LOGO_W + 6 : mL;
  doc.text('RESUMO FINANCEIRO POR SETOR', sumX, SUM_HEADER_H / 2 + 2);

  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 210, 240);
  doc.text(`${client.name} — ${mesLabel}`, W - mR, SUM_HEADER_H / 2 + 2, { align: 'right' });

  // Linha teal
  doc.setDrawColor(...teal); doc.setLineWidth(0.8);
  doc.line(mL, SUM_HEADER_H + 3, W - mR, SUM_HEADER_H + 3);

  autoTable(doc, {
    startY: SUM_HEADER_H + 8,
    head: [['SETOR', 'ESCALAS', 'TOTAL HORAS', 'VALOR TOTAL']],
    body: result.subTotals.map(s => [
      s.setor,
      String(s.escalas),
      fmtHoras(s.horasFixed),
      fmtMoeda(s.valorFixed),
    ]),
    foot: [['TOTAL GERAL', String(result.grandEscalas), fmtHoras(result.grandHorasFixed), fmtMoeda(result.grandValorFixed)]],
    theme: 'plain',
    headStyles: {
      fillColor: [235, 239, 246] as [number, number, number],
      textColor: navy, fontSize: 8, fontStyle: 'bold', cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 9, cellPadding: 5,
      textColor: textBody, lineColor: border, lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: rowAlt },
    footStyles: {
      fillColor: navy, textColor: white,
      fontStyle: 'bold', fontSize: 10, cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: 105 },
      1: { cellWidth: 20, halign: 'center' as const },
      2: { cellWidth: 28, halign: 'right'  as const },
      3: { cellWidth: 27, halign: 'right'  as const },
    },
    margin: { left: mL, right: mR },
    tableLineColor: border,
    tableLineWidth: 0.2,
  });

  doc.save(`consolidado-${client.name.replace(/\s+/g, '-')}-${mesLabel.replace(/\s+/g, '-')}.pdf`);
}
