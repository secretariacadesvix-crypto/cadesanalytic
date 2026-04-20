import * as pdfjsLib from 'pdfjs-dist';
import type { PlantaoRecord, ReportData, SectorData } from '@/types/report';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parseNumber(text: string): number {
  if (!text) return 0;
  const cleaned = text.replace(/[^\d.,\-]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

function isNumericValue(text: string): boolean {
  const cleaned = text.replace(/[R$\s]/g, '').trim();
  return /^[\d.,\-]+$/.test(cleaned) && cleaned.length > 0;
}

function normalizeTurno(turno: string): string {
  const upper = turno.toUpperCase().trim();
  if (upper.includes('DIARISTA')) return 'DIARISTA';
  if (upper.includes('DIURNO') || upper.includes('DIA') || upper === 'D') return 'DIURNO';
  if (upper.includes('NOTURNO') || upper.includes('NOITE') || upper === 'N') return 'NOTURNO';
  return upper || 'DIURNO';
}

function isTurno(text: string): boolean {
  const upper = text.toUpperCase().trim();
  return upper === 'DIURNO' || upper === 'NOTURNO' || upper === 'DIARISTA' || upper === 'D' || upper === 'N';
}

// Lista oficial de setores — ordenada do mais longo para o mais curto
// para evitar matches parciais (ex: "UTI GERAL" antes de "UTI")
const KNOWN_SECTORS: string[] = [
  'UTI CARDIOLÓGICA', 'UTI CARDIOLOGICA',
  'UTI NEUROLÓGICA',  'UTI NEUROLOGICA',
  'UTI GERAL',
  'BLOCO CIRÚRGICO',  'BLOCO CIRURGICO',
  'INTERNAÇÃO 1° ANDAR', 'INTERNACAO 1° ANDAR',
  'INTERNAÇÃO 2° ANDAR', 'INTERNACAO 2° ANDAR',
  'INTERNAÇÃO ANEXO',    'INTERNACAO ANEXO',
  'INTERNAÇÃO TÉRREO',   'INTERNACAO TERREO',
  'HEMODINÂMICA', 'HEMODINAMICA',
  'SETORES DIVERSOS',
  'PRONTO SOCORRO',
  'CIHDOTT',
  'CCIH',
  'CME',
].sort((a, b) => b.length - a.length);

/**
 * Detecta se um setor oficial está colado ao final do nome (sem separador)
 * e os separa corretamente.
 *
 * Ex: "ANDRESSA BARBARA TAVARES DO NASCIMENTOINTERNAÇÃO 2° ANDAR"
 *   → { nome: "ANDRESSA BARBARA TAVARES DO NASCIMENTO",
 *       sectorSuffix: "INTERNAÇÃO 2° ANDAR" }
 */
function splitNameFromSector(rawNome: string): { nome: string; sectorSuffix?: string } {
  const upper = rawNome.toUpperCase();
  for (const sector of KNOWN_SECTORS) {
    const idx = upper.indexOf(sector);
    // idx > 0 garante que há nome antes do setor
    if (idx > 0) {
      return {
        nome: rawNome.substring(0, idx).trim(),
        sectorSuffix: rawNome.substring(idx).trim(),
      };
    }
  }
  return { nome: rawNome };
}

const KNOWN_PROFESSIONS = [
  'TECNICO DE ENFERMAGEM',
  'TÉCNICO DE ENFERMAGEM',
  'ENFERMEIRO',
  'ENFERMEIRA',
  'FISIOTERAPEUTA',
  'ASSISTENTE SOCIAL',
  'NUTRICIONISTA',
  'FARMACEUTICO',
  'FARMACÊUTICO',
  'FONOAUDIOLOGA',
  'FONOAUDIÓLOGO',
  'FONOAUDIOLOGO',
  'PSICOLOGO',
  'PSICÓLOGO',
  'MÉDICO',
  'MEDICO',
];

function extractProfessionFromText(textParts: string[]): { setor: string; profissao: string } {
  const joined = textParts.map(p => p.trim()).join(' ').toUpperCase();

  for (const prof of KNOWN_PROFESSIONS) {
    const idx = joined.indexOf(prof);
    if (idx >= 0) {
      const setorPart = joined.substring(0, idx).trim();
      return {
        setor: setorPart || 'GERAL',
        profissao: prof,
      };
    }
  }

  // Fallback: first part is setor, rest is profissao
  if (textParts.length >= 2) {
    return {
      setor: textParts[0].toUpperCase().trim(),
      profissao: textParts.slice(1).join(' ').trim(),
    };
  }
  return {
    setor: textParts.join(' ').toUpperCase().trim() || 'GERAL',
    profissao: '',
  };
}

// Valores conhecidos de vlrHora no formato BR (vírgula decimal) e como float.
// Inclui todos os valores observados nos relatórios CADES/WebCoop para uso como âncora.
const KNOWN_VLR_HORA_BR = [
  // ── Taxas HOSPITAL DE ÁVILA ─────────────────────────────────────────────
  '11,50',  // TECNICO DE ENFERMAGEM DIURNO
  '12,33',  // TECNICO DE ENFERMAGEM NOTURNO
  '19,16',  // ENFERMEIRO DIURNO / ASSISTENTE SOCIAL / variantes
  '20,83',  // ENFERMEIRO NOTURNO
  '13,83',  // TECNICO HEMODIÁLISE
  '11,48',  // TECNICO HEMODINÂMICA
  '12,27',  // variante técnico
  '12,78',  // variante técnico
  '14,06',  // variante técnico
  '16,10',  // variante técnico especial
  '17,88',  // variante técnico especial
  // ── Taxas legadas / outros contratos ────────────────────────────────────
  '12,80', '14,50', '21,40', '25,68', '13,89',
  // ── Outras taxas comuns em contratos CADES ──────────────────────────────
  '10,00', '10,50', '11,00', '12,00', '13,00', '15,00', '18,00', '22,00', '25,00',
];
const KNOWN_VLR_HORA_VALUES = KNOWN_VLR_HORA_BR.map(s => parseNumber(s));

/**
 * Localiza o índice do token vlrHora nos numericRawParts.
 * 1ª tentativa: correspondência exata com a lista de valores conhecidos.
 * 2ª tentativa: heurística estrutural — token decimal em faixa [5, 300]
 *               com 2 casas decimais, precedido por inteiro ≤ 31 (escalas).
 */
function findVlrHoraIndex(parts: string[]): number {
  // Tentativa 1: valor exato conhecido
  for (let i = 0; i < parts.length; i++) {
    const val = parseNumber(parts[i]);
    if (KNOWN_VLR_HORA_VALUES.some((v) => Math.abs(v - val) < 0.005)) return i;
  }
  // Tentativa 2: detecção estrutural
  // Padrão esperado: [escalas(int≤31)] [vlrHora(dec,2casas,faixa5-300)] [totalHoras] [valorFinal]
  for (let i = 1; i < parts.length - 2; i++) {
    const prev = parseNumber(parts[i - 1]);
    const curr = parseNumber(parts[i]);
    const isEscalasValid = Number.isInteger(prev) && prev >= 1 && prev <= 31;
    const isVlrHoraRange = curr >= 5 && curr <= 300;
    const hasTwoDecimals  = /^\d+,\d{2}$/.test(parts[i].trim());
    if (isEscalasValid && isVlrHoraRange && hasTwoDecimals) return i;
  }
  return -1;
}

function splitMergedNumericToken(token: string): string[] {
  const normalized = token.replace(/\s+/g, '');

  // Estratégia primária: usar os prefixos conhecidos de vlrHora para separar
  // KNOWN_VLR_HORA_BR agora inclui todas as taxas observadas nos relatórios CADES
  for (const vlr of KNOWN_VLR_HORA_BR) {
    if (normalized.startsWith(vlr) && normalized.length > vlr.length) {
      const rest = normalized.substring(vlr.length);
      // rest deve ser um número válido (inteiro ou decimal com vírgula/ponto)
      if (/^\d+([,.]\d+)?$/.test(rest)) {
        return [vlr, rest];
      }
    }
  }

  // Fallback regex: dois decimais BR colados (XX,XX)(qualquer decimal BR)
  // Ex: "19,16132,183333" → ["19,16", "132,183333"]
  const mergedMatch = normalized.match(/^(\d+(?:\.\d{3})*,\d{2})(\d+(?:[,.]\d+)?)$/);
  if (mergedMatch) {
    return [mergedMatch[1], mergedMatch[2]];
  }

  return [token];
}

function normalizeColumnParts(parts: string[]): string[] {
  return parts.flatMap((part) => splitMergedNumericToken(part.trim())).filter(Boolean);
}

function extractMetadata(fullText: string): { cliente?: string; periodo?: string } {
  const result: { cliente?: string; periodo?: string } = {};

  const clienteMatch = fullText.match(/Cliente\s*:\s*(.+?)(?:\s*Contrato|\n|$)/i);
  if (clienteMatch) {
    result.cliente = cleanText(clienteMatch[1]);
  }

  const periodoMatch = fullText.match(/Per[ií]odo\s*:\s*([^\s]+)/i);
  if (periodoMatch) {
    result.periodo = cleanText(periodoMatch[1]);
  }

  return result;
}

function extractReportTotals(fullText: string): {
  subtotalOriginal?: string;
  totalOriginal?: string;
  totalRegistrosOriginal?: number;
} {
  const lines = fullText.split('\n').map((line) => line.trim());
  let subtotalOriginal: string | undefined;
  let totalOriginal: string | undefined;
  let totalRegistrosOriginal: number | undefined;

  for (const line of lines) {
    const subTotalMatch = line.match(/^Sub-Total->\s*([\d.,]+)/i);
    if (subTotalMatch) subtotalOriginal = subTotalMatch[1];

    const totalMatch = line.match(/^Total->\s*([\d.,]+)/i);
    if (totalMatch) totalOriginal = totalMatch[1];

    const registrosMatch = line.match(/N[uú]mero\s+de\s+Registros\s*:\s*(\d+)/i);
    if (registrosMatch) totalRegistrosOriginal = parseInt(registrosMatch[1], 10);
  }

  return { subtotalOriginal, totalOriginal, totalRegistrosOriginal };
}

function extractRecordsFromText(fullText: string): PlantaoRecord[] {
  const records: PlantaoRecord[] = [];
  const lines = fullText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  for (const line of lines) {
    const parts = normalizeColumnParts(
      line.split(/\s{2,}|\t/).map((part) => part.trim()).filter((part) => part.length > 0),
    );

    if (parts.length < 6) continue;

    let matricula = '';
    let nome = '';
    let remainderStartIndex = 2;

    if (/^\d+$/.test(parts[0])) {
      matricula = parts[0].trim();
      nome = cleanText(parts[1] || '');
    } else {
      const firstPartMatch = parts[0].match(/^(\d{8})(.+)$/);
      if (!firstPartMatch) continue;
      matricula = firstPartMatch[1];
      nome = cleanText(firstPartMatch[2]);
      remainderStartIndex = 1;
    }

    if (!nome || nome.length < 2) continue;

    // Detecta setor colado ao final do nome (sem separador) e separa
    const nameSplit = splitNameFromSector(nome);
    nome = nameSplit.nome;

    try {
      const remainingParts = parts.slice(remainderStartIndex);
      if (nameSplit.sectorSuffix) {
        remainingParts.unshift(nameSplit.sectorSuffix);
      }

      // Pre-processar: separar tokens onde TURNO e ESCALAS foram colados.
      // Causa: "NOTURNO" (w≈30px) deixa gap de apenas 10px com a coluna de escalas,
      // abaixo do limiar de 10px para inserção de espaço duplo no pdfjs.
      // Exemplos: "NOTURNO13" → ["NOTURNO","13"], "NOTURNO 5" → ["NOTURNO","5"]
      const splitParts: string[] = [];
      for (const part of remainingParts) {
        const turnoMerge = part.match(/^(DIURNO|NOTURNO)\s*(\d{1,2})$/i);
        if (turnoMerge) {
          splitParts.push(turnoMerge[1].toUpperCase());
          splitParts.push(turnoMerge[2]);
        } else {
          splitParts.push(part);
        }
      }

      const textParts: string[] = [];
      const numericRawParts: string[] = [];

      let firstNumericIndex = splitParts.length;
      for (let i = 0; i < splitParts.length; i++) {
        if (!isNumericValue(splitParts[i])) continue;

        const allNumericTail = splitParts.slice(i).every((part) => isNumericValue(part));
        if (allNumericTail) {
          firstNumericIndex = i;
          break;
        }
      }

      for (let i = 0; i < firstNumericIndex; i++) {
        textParts.push(splitParts[i]);
      }
      for (let i = firstNumericIndex; i < splitParts.length; i++) {
        numericRawParts.push(splitParts[i]);
      }

      if (numericRawParts.length < 3) continue;

      let escalasOriginal = '1';
      let totalHorasOriginal = '';
      let valorFinalOriginal = '';
      let valorHora = 0;

      // Usar vlrHora como âncora: evita deslocamento causado por dígitos separados pelo pdfjs
      // (ex: "13" extraído como "1" + "3" → tokens extras deslocam campos em posição fixa)
      const vlrHoraIdx = findVlrHoraIndex(numericRawParts);

      if (vlrHoraIdx >= 0 && numericRawParts.length >= vlrHoraIdx + 3) {
        // Caso normal e caso dígitos separados: âncora encontrada com campos suficientes
        valorHora          = parseNumber(numericRawParts[vlrHoraIdx]);
        totalHorasOriginal = numericRawParts[vlrHoraIdx + 1];
        valorFinalOriginal = numericRawParts[numericRawParts.length - 1];

        // Escalas: tokens antes do vlrHora (podem ser dígitos fragmentados, ex: "1","3" → "13")
        const escTokens = numericRawParts.slice(0, vlrHoraIdx);
        if (escTokens.length > 0) {
          const joined = escTokens.join('');
          const candidate = parseInt(joined, 10);
          escalasOriginal = (Number.isInteger(candidate) && candidate >= 1 && candidate <= 31)
            ? String(candidate)
            : '1';
        }
      } else if (numericRawParts.length >= 4) {
        // Fallback posicional: vlrHora não reconhecido (valor fora da lista conhecida)
        const candidato = parseNumber(numericRawParts[0]);
        escalasOriginal    = Number.isInteger(candidato) && candidato > 0 ? numericRawParts[0] : '1';
        valorHora          = parseNumber(numericRawParts[1]);
        totalHorasOriginal = numericRawParts[2];
        valorFinalOriginal = numericRawParts[3];
      } else {
        // 3 partes: escalas perdida, vlrHora não reconhecido
        totalHorasOriginal = numericRawParts[1];
        valorFinalOriginal = numericRawParts[2];
      }

      if (!totalHorasOriginal || !valorFinalOriginal) continue;

      const escalas = parseNumber(escalasOriginal);
      // Arredondar totalHoras para 2 casas decimais (valores como 132,183333 → 132.18)
      const totalHoras = Math.round(parseNumber(totalHorasOriginal) * 100) / 100;
      const valorFinal = parseNumber(valorFinalOriginal);

      let setor = 'GERAL';
      let turno = 'DIURNO';
      let profissao = '';

      const turnoIndex = textParts.findIndex((part) => isTurno(part));
      if (turnoIndex >= 0) {
        turno = normalizeTurno(textParts[turnoIndex]);
        const beforeTurno = textParts.slice(0, turnoIndex);

        if (beforeTurno.length > 0) {
          const extracted = extractProfessionFromText(beforeTurno);
          setor = extracted.setor;
          profissao = extracted.profissao;
        }

        const afterTurno = textParts.slice(turnoIndex + 1);
        if (afterTurno.length > 0 && !profissao) {
          profissao = cleanText(afterTurno[0]);
        }
      } else {
        if (textParts.length > 0) {
          const extracted = extractProfessionFromText(textParts);
          setor = extracted.setor;
          profissao = extracted.profissao;
        }
      }

      records.push({
        matricula,
        nome,
        escalas,
        escalasOriginal,
        valorHora,
        totalHoras,
        totalHorasOriginal,
        valorFinal,
        valorFinalOriginal,
        setor,
        turno,
        profissao: profissao || 'NÃO INFORMADO',
      });
    } catch {
      continue;
    }
  }

  return records;
}

function groupBySector(records: PlantaoRecord[]): SectorData[] {
  const sectorMap = new Map<string, PlantaoRecord[]>();

  for (const record of records) {
    if (!sectorMap.has(record.setor)) {
      sectorMap.set(record.setor, []);
    }
    sectorMap.get(record.setor)!.push(record);
  }

  return Array.from(sectorMap.entries())
    .map(([setor, registros]) => ({
      setor,
      registros,
      totalPlantoes: registros.reduce((sum, record) => sum + record.escalas, 0),
      totalHoras: registros.reduce((sum, record) => sum + record.totalHoras, 0),
      valorTotal: registros.reduce((sum, record) => sum + record.valorFinal, 0),
    }))
    .sort((a, b) => b.valorTotal - a.valorTotal);
}

export async function parsePDF(file: File): Promise<ReportData> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    const items = textContent.items as Array<{ str: string; transform: number[]; width?: number }>;
    const lineMap = new Map<number, Array<{ x: number; text: string; width: number }>>();

    for (const item of items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({
        x: item.transform[4],
        text: item.str,
        width: item.width ?? item.str.length * 5,
      });
    }

    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const lineItems = lineMap.get(y)!.sort((a, b) => a.x - b.x);
      let prevEnd = -1;
      let lineText = '';

      for (const item of lineItems) {
        if (prevEnd >= 0 && item.x - prevEnd > 10) {
          lineText += '  ';
        }
        lineText += item.text;
        prevEnd = item.x + item.width;
      }

      fullText += lineText + '\n';
    }
  }

  const metadata = extractMetadata(fullText);
  const reportTotals = extractReportTotals(fullText);
  const registros = extractRecordsFromText(fullText);

  if (registros.length === 0) {
    throw new Error('Não foi possível extrair registros do PDF. Verifique se o formato é compatível.');
  }

  // --- Validação pós-extração ---
  const { totalRegistrosOriginal } = reportTotals;
  if (totalRegistrosOriginal !== undefined && totalRegistrosOriginal !== registros.length) {
    console.warn(
      `[pdfParser] Divergência na contagem de registros: PDF indica ${totalRegistrosOriginal}, extraídos ${registros.length}.`,
    );
  }

  const somaValorFinal = registros.reduce((sum, r) => sum + r.valorFinal, 0);
  if (reportTotals.totalOriginal) {
    const totalEsperado = parseNumber(reportTotals.totalOriginal);
    const diferenca = Math.abs(somaValorFinal - totalEsperado);
    if (diferenca > 0.10) {
      console.warn(
        `[pdfParser] Divergência no total financeiro: PDF indica R$ ${totalEsperado.toFixed(2)}, soma extraída R$ ${somaValorFinal.toFixed(2)} (diferença R$ ${diferenca.toFixed(2)}).`,
      );
    }
  }

  // Validação por linha: valorFinal ≈ totalHoras × vlrHora (tolerância ±0.05)
  for (const r of registros) {
    if (r.valorHora > 0 && r.totalHoras > 0) {
      const esperado = Math.round(r.totalHoras * r.valorHora * 100) / 100;
      const diff = Math.abs(r.valorFinal - esperado);
      if (diff > 0.05) {
        console.warn(
          `[pdfParser] Inconsistência em ${r.nome} (${r.setor}/${r.turno}): ` +
          `${r.totalHoras}h × R$${r.valorHora} = R$${esperado}, mas valorFinal = R$${r.valorFinal}.`,
        );
      }
    }
  }
  // --- Fim da validação ---

  const setores = groupBySector(registros);
  const uniqueProfissionais = new Set(registros.map((record) => record.nome));
  const uniqueProfissoes = [...new Set(registros.map((record) => record.profissao))];

  return {
    registros,
    setores,
    totalProfissionais: uniqueProfissionais.size,
    totalPlantoes: registros.reduce((sum, record) => sum + record.escalas, 0),
    totalHoras: registros.reduce((sum, record) => sum + record.totalHoras, 0),
    totalSetores: setores.length,
    valorTotal: reportTotals.totalOriginal ? parseNumber(reportTotals.totalOriginal) : somaValorFinal,
    profissoes: uniqueProfissoes,
    cliente: metadata.cliente,
    periodo: metadata.periodo,
    subtotalOriginal: reportTotals.subtotalOriginal,
    totalOriginal: reportTotals.totalOriginal,
  };
}

export function generateDemoData(): ReportData {
  const setores = ['UTI NEUROLÓGICA', 'UTI CARDIOLÓGICA', 'BLOCO CIRÚRGICO', 'INTERNAÇÃO TÉRREO', 'PRONTO SOCORRO', 'CME'];
  const profissoes = ['ENFERMEIRO', 'TECNICO DE ENFERMAGEM', 'FISIOTERAPEUTA', 'ASSISTENTE SOCIAL'];
  const nomes = [
    'Maria Silva Santos',
    'João Pedro Oliveira',
    'Ana Carolina Lima',
    'Carlos Eduardo Souza',
    'Fernanda Rodrigues',
    'Lucas Martins Costa',
    'Patrícia Almeida',
    'Roberto Ferreira',
    'Camila Nascimento',
    'Diego Pereira Lima',
    'Juliana Barbosa',
    'Marcos Vinícius Ramos',
    'Aline Gomes Ribeiro',
    'Thiago Santos Cruz',
    'Bruna Carvalho',
    'Rafael Moreira',
    'Larissa Mendes',
    'Felipe Araújo',
    'Vanessa Dias',
    'André Nogueira',
  ];
  const turnos: Array<'DIURNO' | 'NOTURNO'> = ['DIURNO', 'NOTURNO'];

  const registros: PlantaoRecord[] = [];
  let id = 1000;

  for (const setor of setores) {
    const numProfissionais = 3 + Math.floor(Math.random() * 5);
    const selectedNames = [...nomes].sort(() => Math.random() - 0.5).slice(0, numProfissionais);

    for (const nome of selectedNames) {
      const numRegistros = 1 + Math.floor(Math.random() * 3);
      for (let r = 0; r < numRegistros; r++) {
        const turno = turnos[Math.floor(Math.random() * 2)];
        const escalas = 1 + Math.floor(Math.random() * 8);
        const totalHoras = escalas * 12;
        const valorHora = turno === 'DIURNO' ? 12.8 : 14.5;
        const valorFinal = totalHoras * valorHora;

        registros.push({
          matricula: String(id++).padStart(8, '0'),
          nome,
          escalas,
          escalasOriginal: String(escalas),
          valorHora: Math.round(valorHora * 100) / 100,
          totalHoras,
          totalHorasOriginal: String(totalHoras),
          valorFinal: Math.round(valorFinal * 100) / 100,
          valorFinalOriginal: (Math.round(valorFinal * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          setor,
          turno,
          profissao: profissoes[Math.floor(Math.random() * profissoes.length)],
        });
      }
    }
  }

  const sectorData = groupBySector(registros);
  const uniqueProfs = new Set(registros.map((record) => record.nome));

  return {
    registros,
    setores: sectorData,
    totalProfissionais: uniqueProfs.size,
    totalPlantoes: registros.reduce((sum, record) => sum + record.escalas, 0),
    totalHoras: registros.reduce((sum, record) => sum + record.totalHoras, 0),
    totalSetores: sectorData.length,
    valorTotal: registros.reduce((sum, record) => sum + record.valorFinal, 0),
    profissoes: [...new Set(registros.map((record) => record.profissao))],
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}
