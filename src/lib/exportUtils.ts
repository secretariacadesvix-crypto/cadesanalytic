import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { ReportData } from '@/types/report';
import { formatCurrency, formatNumber } from '@/lib/pdfParser';

export async function exportToPDF(data: ReportData, _cliente?: string, periodo?: string, setorFiltro?: string) {
  // Filtrar por setor específico quando solicitado
  if (setorFiltro) {
    const setorData = data.setores.find(s => s.setor === setorFiltro);
    if (setorData) {
      data = {
        ...data,
        registros: setorData.registros,
        setores: [setorData],
        totalProfissionais: setorData.registros.length,
        totalPlantoes: setorData.totalPlantoes,
        totalHoras: setorData.totalHoras,
        valorTotal: setorData.valorTotal,
        totalSetores: 1,
        totalOriginal: undefined,
      };
    }
  }
  // ── Paleta de cores ────────────────────────────────────────────────────────
  const navy: [number, number, number]      = [30, 58, 95];
  const navyDark: [number, number, number]  = [20, 40, 68];
  const white: [number, number, number]     = [255, 255, 255];
  const grayBg: [number, number, number]    = [245, 247, 250];
  const rowAlt: [number, number, number]    = [248, 250, 253];
  const border: [number, number, number]    = [213, 219, 230];
  const textBody: [number, number, number]  = [50, 60, 75];
  const textMuted: [number, number, number] = [120, 130, 150];

  // ── Dimensões A4 ───────────────────────────────────────────────────────────
  const doc = new jsPDF('p', 'mm', 'a4');
  const W  = doc.internal.pageSize.getWidth();   // 210
  const H  = doc.internal.pageSize.getHeight();  // 297
  const mL = 15, mR = 15;
  const cW = W - mL - mR; // 180

  const emitDate  = new Date().toLocaleDateString('pt-BR');
  const totalStr  = data.totalOriginal ?? formatCurrency(data.valorTotal);
  const periodoTx = periodo ?? '';

  // ── Carregar logo PNG do projeto ──────────────────────────────────────────
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
  } catch { /* usa texto como fallback */ }

  // ── Helper: rodapé em todas as páginas ────────────────────────────────────
  const drawFooter = () => {
    const fy = H - 10;
    doc.setDrawColor(...border);
    doc.setLineWidth(0.25);
    doc.line(mL, fy - 4, W - mR, fy - 4);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text(
      'CADES — Cooperativa Assistencial de Trabalho do Espírito Santo | R. Mario Aguirre, 45, Jucutuquara, Vitória – ES | +55 27 99713-8453',
      W / 2, fy, { align: 'center' }
    );
  };

  // ── Proporção real do logo: 220×96px → ratio 2.29:1 (horizontal) ─────────
  // altura escolhida = 18mm → largura = 18 × (220/96) = 41.25mm ≈ 41mm
  const LOGO_H = 18;
  const LOGO_W = Math.round(LOGO_H * (220 / 96)); // 41mm
  const HEADER_H = 38; // altura do cabeçalho principal

  // ── Helper: cabeçalho principal (página 1+) ───────────────────────────────
  const drawMainHeader = () => {
    // Barra azul full-width
    doc.setFillColor(...navy);
    doc.rect(0, 0, W, HEADER_H, 'F');

    // Logo com proporção correta, verticalmente centralizada
    const logoY = (HEADER_H - LOGO_H) / 2; // = 10mm
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', mL, logoY, LOGO_W, LOGO_H);
    } else {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...white);
      doc.text('CADES', mL, HEADER_H / 2 + 3);
    }

    // Separador vertical fino após a logo
    const sepX = mL + LOGO_W + 4;
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.2);
    doc.line(sepX, 10, sepX, HEADER_H - 10);

    // Título principal
    const textX = sepX + 5;
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text('RELATÓRIO DE PRODUÇÃO', textX, 20);

    // Subtítulo
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 210, 240);
    doc.text('CADES — Cooperativa Assistencial de Trabalho do Espírito Santo', textX, 28);

    // Data de emissão (canto direito)
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 210, 240);
    doc.text('DATA DE EMISSÃO', W - mR, 16, { align: 'right' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text(emitDate, W - mR, 26, { align: 'right' });
  };

  // ── Helper: cards de resumo ───────────────────────────────────────────────
  const drawSummaryCards = (startY: number): number => {
    const cardH = 22;
    doc.setFillColor(...grayBg);
    doc.rect(mL, startY, cW, cardH, 'F');

    const cards = [
      { label: 'SETORES',       value: String(data.totalSetores) },
      { label: 'TOTAL ESCALAS', value: formatNumber(data.totalPlantoes) },
      { label: 'TOTAL HORAS',   value: formatNumber(data.totalHoras) },
      { label: 'VALOR TOTAL',   value: totalStr },
      { label: 'PERÍODO',       value: periodoTx || 'N/D' },
    ];

    const cardW = cW / cards.length;
    cards.forEach((card, i) => {
      const cx = mL + i * cardW + cardW / 2;

      if (i > 0) {
        doc.setDrawColor(...border);
        doc.setLineWidth(0.25);
        doc.line(mL + i * cardW, startY + 4, mL + i * cardW, startY + cardH - 4);
      }

      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textMuted);
      doc.text(card.label, cx, startY + 7, { align: 'center' });

      const fs = card.value.length > 11 ? 9 : 11;
      doc.setFontSize(fs);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...navy);
      doc.text(card.value, cx, startY + 17, { align: 'center' });
    });

    return startY + cardH + 6;
  };

  // ── Estilo de coluna das tabelas de setor ─────────────────────────────────
  const sectorColStyles = {
    0: { cellWidth: 50 },
    1: { cellWidth: 38 },
    2: { cellWidth: 22, halign: 'center' as const },
    3: { cellWidth: 17, halign: 'center' as const },
    4: { cellWidth: 17, halign: 'center' as const },
    5: { cellWidth: 36, halign: 'right'  as const },
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — Cabeçalho + Cards + Tabelas de setores
  // ══════════════════════════════════════════════════════════════════════════
  drawMainHeader();
  let y = drawSummaryCards(HEADER_H + 2); // começa 2mm após o fim do header (38+2=40)
  drawFooter();

  for (const setor of data.setores) {
    // Quebra de página apenas quando não há espaço mínimo para cabeçalho + ao menos 2 linhas
    if (y + 35 > H - 20) {
      doc.addPage();
      y = 18;
      drawFooter();
    }

    // Barra de seção com nome do setor
    doc.setFillColor(...navy);
    doc.rect(mL, y, cW, 9, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...white);
    doc.text(setor.setor, mL + 4, y + 6.2);
    y += 9;

    autoTable(doc, {
      startY: y,
      head: [['NOME', 'ATIVIDADE', 'TURNO', 'ESCALAS', 'HORAS', 'VALOR FINAL']],
      body: setor.registros.map(r => [
        r.nome,
        r.profissao,
        r.turno,
        String(r.escalas),
        String(r.totalHoras),
        formatCurrency(r.valorFinal),
      ]),
      foot: [['SUBTOTAL', '', '', String(setor.totalPlantoes), String(setor.totalHoras), formatCurrency(setor.valorTotal)]],
      theme: 'plain',
      showFoot: 'lastPage',
      headStyles: {
        fillColor: navyDark,
        textColor: white,
        fontSize: 7,
        fontStyle: 'bold',
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 3,
        textColor: textBody,
        lineColor: border,
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: rowAlt },
      footStyles: {
        fillColor: navy,
        textColor: white,
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 3,
      },
      columnStyles: sectorColStyles,
      margin: { left: mL, right: mR },
      tableLineColor: border,
      tableLineWidth: 0.2,
    });

    y = (doc as any).lastAutoTable.finalY + 9;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ÚLTIMA PÁGINA — Resumo financeiro por setor
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  drawFooter();

  // Cabeçalho da página de resumo
  // Logo: altura=13mm → largura=13×(220/96)=29.8≈30mm
  const SUM_LOGO_H = 13;
  const SUM_LOGO_W = Math.round(SUM_LOGO_H * (220 / 96)); // 30mm
  const SUM_HEADER_H = 26;

  doc.setFillColor(...navy);
  doc.rect(0, 0, W, SUM_HEADER_H, 'F');

  if (logoDataUrl) {
    const sumLogoY = (SUM_HEADER_H - SUM_LOGO_H) / 2; // centralizado verticalmente
    doc.addImage(logoDataUrl, 'PNG', mL, sumLogoY, SUM_LOGO_W, SUM_LOGO_H);
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...white);
  const sumTitleX = logoDataUrl ? mL + SUM_LOGO_W + 6 : mL;
  doc.text('RESUMO FINANCEIRO POR SETOR', sumTitleX, SUM_HEADER_H / 2 + 2);

  y = SUM_HEADER_H + 6;

  autoTable(doc, {
    startY: y,
    head: [['SETOR', 'VALOR TOTAL']],
    body: data.setores.map(s => [s.setor, formatCurrency(s.valorTotal)]),
    foot: [['TOTAL GERAL', data.totalOriginal ?? formatCurrency(data.valorTotal)]],
    theme: 'plain',
    headStyles: {
      fillColor: [235, 239, 246],
      textColor: navy,
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: textBody,
      lineColor: border,
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: rowAlt },
    footStyles: {
      fillColor: navy,
      textColor: white,
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 50, halign: 'right' as const },
    },
    margin: { left: mL, right: mR },
    tableLineColor: border,
    tableLineWidth: 0.2,
  });

  doc.save('relatorio-producao-cades.pdf');
}

export function exportToExcel(data: ReportData) {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['CADES Analytics - Relatório de Produção'],
    [],
    ['Indicador', 'Valor'],
    ['Total de Profissionais', data.totalProfissionais],
    ['Total de Plantões', data.totalPlantoes],
    ['Total de Horas', data.totalHoras],
    ['Total de Setores', data.totalSetores],
    ['Valor Total', data.totalOriginal ?? data.valorTotal],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo');

  // Detail sheet
  const detailHeaders = ['Setor', 'Nome', 'Atividade', 'Turno', 'Escalas', 'Total de Horas', 'Valor Final'];
  const detailRows = data.registros.map(r => [
    r.setor, r.nome, r.profissao, r.turno, r.escalas, r.totalHoras, r.valorFinal
  ]);
  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalhado');

  // Sector summary
  const sectorHeaders = ['Setor', 'Plantões', 'Horas', 'Valor Total'];
  const sectorRows = data.setores.map(s => [s.setor, s.totalPlantoes, s.totalHoras, s.valorTotal]);
  sectorRows.push(['TOTAL', data.totalPlantoes, data.totalHoras, data.valorTotal]);
  const wsSector = XLSX.utils.aoa_to_sheet([sectorHeaders, ...sectorRows]);
  XLSX.utils.book_append_sheet(wb, wsSector, 'Por Setor');

  XLSX.writeFile(wb, 'relatorio-cades-analytics.xlsx');
}

export function exportToCSV(data: ReportData) {
  const headers = ['Setor', 'Nome', 'Atividade', 'Turno', 'Escalas', 'Total de Horas', 'Valor Final'];
  const rows = data.registros.map(r =>
    [r.setor, r.nome, r.profissao, r.turno, r.escalas, r.totalHoras, r.valorFinal].join(';')
  );
  const csv = [headers.join(';'), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'relatorio-cades-analytics.csv';
  a.click();
  URL.revokeObjectURL(url);
}
