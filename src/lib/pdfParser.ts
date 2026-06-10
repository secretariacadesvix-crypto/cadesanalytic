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
  'HEMODIÁLISE', 'HEMODIALISE',
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
  // ── Taxas HOSPITAL DE ÁVILA (relatório de fechamento) ───────────────────
  '12,80',  // TECNICO DE ENFERMAGEM DIURNO
  '14,50',  // TECNICO DE ENFERMAGEM NOTURNO
  '21,40',  // ENFERMEIRO DIURNO / ASSISTENTE SOCIAL
  '25,68',  // ENFERMEIRO NOTURNO
  '13,89',  // CCIH / HEMODINÂMICA
  '15,90',  // HEMODIÁLISE
  // ── Outras taxas observadas em contratos CADES ──────────────────────────
  '11,50', '12,33', '19,16', '20,83', '13,83', '11,48',
  '12,27', '12,78', '14,06', '16,10', '17,88',
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
  // Tentativa 1: valor exato conhecido — o token DEVE conter vírgula decimal.
  // Isso evita que números inteiros de escalas (ex: 15) sejam confundidos
  // com taxas de hora redondas (ex: 15,00) da lista conhecida.
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i].includes(',')) continue;
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

// ─── NOVO FORMATO: CADES Financeiro "Relatório de Faturamento" ───────────────
//
// Este formato tem colunas: Cooperado | Função | Setor | Diurnos | Noturnos | Total | Horas | Valor Faturado
// Um único registro por pessoa/setor já agrega diurno+noturno numa mesma linha.
// A conversão para PlantaoRecord[] divide proporcionalmente horas e valor por turno.

const FUNCOES_NEW_FORMAT: string[] = [
  'Técnico(a) de Enfermagem',
  'Enfermeiro(a)',
  'Assistente Social',
  'Fonoaudiólogo(a)',
  'Fisioterapeuta',
  'Nutricionista',
  'Psicólogo(a)',
  'Médico(a)',
].sort((a, b) => b.length - a.length);

// Fallback genérico para funções não mapeadas explicitamente acima, no padrão
// "Técnico(a) de <Especialidade>" (ex: "Técnico de Hemodiálise", "Técnica de Radiologia").
// Permite reconhecer novas especialidades/setores sem precisar atualizar FUNCOES_NEW_FORMAT.
const FUNCAO_GENERICA_REGEX = /T[ée]cnic[oa]\(?a?\)?\s+de\s+[A-Za-zÀ-ÖØ-öø-ÿ]+/;

function mapFuncaoProfissao(funcao: string): string {
  const u = funcao.toUpperCase();
  if (u.includes('ENFERMEIRO')) return 'ENFERMEIRO';
  if (u.includes('ASSISTENTE SOCIAL')) return 'ASSISTENTE SOCIAL';
  if (u.includes('FONOAUDIÓLOGO') || u.includes('FONOAUDIOLOGO')) return 'FONOAUDIÓLOGO';
  if (u.includes('FISIOTERAPEUTA')) return 'FISIOTERAPEUTA';
  if (u.includes('NUTRICIONISTA')) return 'NUTRICIONISTA';
  if (u.includes('PSICÓLOGO') || u.includes('PSICOLOGO')) return 'PSICOLOGO';
  if (u.includes('MÉDICO') || u.includes('MEDICO')) return 'MÉDICO';
  if (u.includes('TÉCNICO') || u.includes('TECNICO')) {
    if (u.includes('ENFERMAGEM')) return 'TECNICO DE ENFERMAGEM';
    // Generaliza "TÉCNICO(A) DE X" → "TÉCNICO DE X" para especialidades novas
    return u.replace(/\(A\)/g, '').replace(/\s+/g, ' ').trim();
  }
  return u.trim() || 'NÃO INFORMADO';
}

const SECTOR_NORMALIZATION_MAP: Record<string, string> = {
  'bloco cirurgico': 'BLOCO CIRÚRGICO',
  'bloco cirúrgico': 'BLOCO CIRÚRGICO',
  'uti cardio': 'UTI CARDIOLÓGICA',
  'uti cardiológica': 'UTI CARDIOLÓGICA',
  'uti geral': 'UTI GERAL',
  'uti neuro': 'UTI NEUROLÓGICA',
  'uti neurológica': 'UTI NEUROLÓGICA',
  'internação 1°andar': 'INTERNAÇÃO 1° ANDAR',
  'internação 1° andar': 'INTERNAÇÃO 1° ANDAR',
  'internação 2°andar': 'INTERNAÇÃO 2° ANDAR',
  'internação 2° andar': 'INTERNAÇÃO 2° ANDAR',
  'internação anexo sus': 'INTERNAÇÃO ANEXO',
  'internação anexo': 'INTERNAÇÃO ANEXO',
  'internação terreo': 'INTERNAÇÃO TÉRREO',
  'internação térreo': 'INTERNAÇÃO TÉRREO',
  'pronto socorro': 'PRONTO SOCORRO',
  'hemodinâmica': 'HEMODINÂMICA',
  'hemodinamica': 'HEMODINÂMICA',
  'hemodiálise': 'HEMODIÁLISE',
  'hemodialise': 'HEMODIÁLISE',
  'hemodalise': 'HEMODIÁLISE',
  'setores diversos': 'SETORES DIVERSOS',
  'cme': 'CME',
  'ccih': 'CCIH',
  'cihdott': 'CIHDOTT',
};

function normalizeSectorNew(setor: string): string {
  const key = setor.toLowerCase().trim();
  return SECTOR_NORMALIZATION_MAP[key] ?? setor.toUpperCase().trim();
}

interface NewFormatRowRaw {
  nome: string;
  funcao: string;
  setor: string;
  diurnos: number;
  noturnos: number;
  total: number;
  horas: number;
  valor: number;
}

// Padrão de sufixo numérico: D  N  Total  Xh  R$ X,XX
const NEW_FORMAT_ROW_SUFFIX = /\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)h\s+R\$\s*([\d.]+,\d{2})\s*$/;

function parseLineNewFormat(line: string): NewFormatRowRaw | null {
  const match = line.match(NEW_FORMAT_ROW_SUFFIX);
  if (!match) return null;

  const [fullMatch, d, n, tot, h, v] = match;
  const diurnos = parseInt(d, 10);
  const noturnos = parseInt(n, 10);
  const total = parseInt(tot, 10);
  const horas = parseFloat(h);
  const valor = parseNumber(v);

  const prefix = line.substring(0, line.length - fullMatch.length).trim();
  if (!prefix) return null;

  let nome = '';
  let funcao = '';
  let setor = '';

  for (const func of FUNCOES_NEW_FORMAT) {
    const idx = prefix.indexOf(func);
    if (idx >= 0) {
      nome = prefix.substring(0, idx).trim();
      setor = prefix.substring(idx + func.length).trim();
      funcao = func;
      break;
    }
  }

  if (!funcao) {
    const generic = prefix.match(FUNCAO_GENERICA_REGEX);
    if (generic && generic.index !== undefined) {
      nome = prefix.substring(0, generic.index).trim();
      setor = prefix.substring(generic.index + generic[0].length).trim();
      funcao = generic[0];
    }
  }

  if (!funcao || !nome) return null;

  return {
    nome: cleanText(nome),
    funcao,
    setor: normalizeSectorNew(setor),
    diurnos,
    noturnos,
    total,
    horas,
    valor,
  };
}

function newFormatRowToRecords(row: NewFormatRowRaw): PlantaoRecord[] {
  const records: PlantaoRecord[] = [];
  const profissao = mapFuncaoProfissao(row.funcao);
  const diaristas = Math.max(0, row.total - row.diurnos - row.noturnos);
  const totalShifts = row.diurnos + row.noturnos + diaristas;

  if (totalShifts === 0) return records;

  // Divisão proporcional: horas e valor por turno com base na contagem de plantões.
  // Para trabalhadores com turnos mistos, o valorHora derivado reflete a taxa média —
  // a folha de pagamento recalcula usando as taxas configuradas de qualquer forma.
  const horasPerShift = row.horas / totalShifts;
  const valorPerShift = row.valor / totalShifts;

  const buildRecord = (escalas: number, turno: string): PlantaoRecord => {
    const totalHoras = Math.round(escalas * horasPerShift * 100) / 100;
    const valorFinal = Math.round(escalas * valorPerShift * 100) / 100;
    const valorHora = totalHoras > 0 ? Math.round((valorFinal / totalHoras) * 100) / 100 : 0;
    return {
      matricula: '',
      nome: row.nome,
      escalas,
      escalasOriginal: String(escalas),
      valorHora,
      totalHoras,
      totalHorasOriginal: String(totalHoras),
      valorFinal,
      valorFinalOriginal: valorFinal.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      setor: row.setor,
      turno,
      profissao,
    };
  };

  if (row.diurnos > 0) records.push(buildRecord(row.diurnos, 'DIURNO'));
  if (row.noturnos > 0) records.push(buildRecord(row.noturnos, 'NOTURNO'));
  if (diaristas > 0) records.push(buildRecord(diaristas, 'DIARISTA'));

  return records;
}

const SKIP_LINE_NEW_FORMAT = /^(Subtotal|Total\b|Setor[:\s]|Cooperado|Documento|Emitido|Cliente|CADES|Relatório|Página|DIURNOS|NOTURNOS|DIARISTAS|TOTAL|Resumo|Per[íi]odo|R\$|\d+\s+plant)/i;

function extractRecordsFromNewFormat(fullText: string): PlantaoRecord[] {
  const records: PlantaoRecord[] = [];
  const lines = fullText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  let pendingLine = '';

  for (const line of lines) {
    if (SKIP_LINE_NEW_FORMAT.test(line)) {
      pendingLine = '';
      continue;
    }

    const combined = pendingLine ? `${pendingLine} ${line}` : line;
    const row = parseLineNewFormat(combined);

    if (row) {
      records.push(...newFormatRowToRecords(row));
      pendingLine = '';
    } else if (!NEW_FORMAT_ROW_SUFFIX.test(line)) {
      // Linha sem sufixo numérico pode ser continuação de nome longo (ex: nomes em 2 linhas)
      pendingLine = combined.length < 120 ? combined : '';
    } else {
      pendingLine = '';
    }
  }

  return records;
}

// ─── FORMATO: CADES Financeiro "Cobrança ao Cliente" ─────────────────────────
//
// Estrutura: cooperado → summary ("N plantões | Xh | R$ Y") → linhas de plantão
// Colunas por plantão: Data | Setor | Tipo | Horas | Valor Cliente
// Sem Matrícula nem Profissão — profissão inferida pela taxa/hora.

function isCadesCobrancaFormat(fullText: string): boolean {
  return fullText.includes('Cobrança ao Cliente') && fullText.includes('TOTAL A COBRAR');
}

function inferProfissaoCobranca(valorHora: number): string {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.15;
  if (near(valorHora, 12.80)) return 'TECNICO DE ENFERMAGEM';
  if (near(valorHora, 14.50)) return 'TECNICO DE ENFERMAGEM';
  if (near(valorHora, 13.89)) return 'TECNICO DE ENFERMAGEM';
  if (near(valorHora, 15.90)) return 'TECNICO DE ENFERMAGEM';
  if (near(valorHora, 21.40)) return 'ENFERMEIRO';
  if (near(valorHora, 25.68)) return 'ENFERMEIRO';
  return 'COOPERADO';
}

function extractMetadataCobranca(fullText: string): { cliente?: string; periodo?: string } {
  const result: { cliente?: string; periodo?: string } = {};
  const periodoMatch = fullText.match(/Cobran[çc]a ao Cliente\s*[—\-]\s*([\d/]+\s*[–\-]\s*[\d/]+)/i);
  if (periodoMatch) result.periodo = cleanText(periodoMatch[1]);
  // Cliente: linha logo após a linha do período
  const clienteMatch = fullText.match(/Cobran[çc]a ao Cliente[^\n]*\n([^\n]+)/);
  if (clienteMatch) result.cliente = cleanText(clienteMatch[1]);
  return result;
}

function extractTotalCobranca(fullText: string): string | undefined {
  const m = fullText.match(/TOTAL A COBRAR\s*\n?\s*R\$\s*([\d.,]+)/i);
  return m ? m[1] : undefined;
}

function extractRecordsFromCobrancaFormat(fullText: string): PlantaoRecord[] {
  const records: PlantaoRecord[] = [];
  const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // DD/MM/YYYY  setor  Tipo  N.NNh  R$ N,NN
  const DATA_ROW  = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(Diurno|Noturno|Diarista)\s+([\d.]+)h\s+R\$\s*([\d.,]+)/i;
  const SUMMARY   = /^\d+\s+plant[õo]es?\s*\|/i;
  const SUBTOTAL  = /^Subtotal\s+/i;
  // Linhas que pertencem à seção do cooperado — apenas pular, NÃO limpar pendingName
  const SKIP_ONLY = /^(Data\s+Setor|Confidencial|Página\s+\d)/i;
  // Linhas de cabeçalho global — pular E limpar pendingName (nova seção de relatório)
  const IGNORE    = /^(CADES Financeiro|Cobran[çc]a|PLANT[ÕO]ES$|TOTAL HORAS$|TOTAL A COBRAR|\d+$|[\d.,]+h$)/i;

  type Shift = { setor: string; tipo: string; horas: number; valor: number };
  let pendingName = '';
  let currentName = '';
  let shifts: Shift[] = [];
  let collecting = false;

  const flush = () => {
    if (!currentName || shifts.length === 0) { currentName = ''; shifts = []; collecting = false; return; }

    const map = new Map<string, Shift & { count: number }>();
    for (const s of shifts) {
      const k = `${s.setor}|||${s.tipo}`;
      if (!map.has(k)) map.set(k, { setor: s.setor, tipo: s.tipo, horas: 0, valor: 0, count: 0 });
      const e = map.get(k)!;
      e.horas  = Math.round((e.horas  + s.horas)  * 100) / 100;
      e.valor  = Math.round((e.valor  + s.valor)  * 100) / 100;
      e.count++;
    }

    for (const e of map.values()) {
      const valorHora = e.horas > 0 ? Math.round(e.valor / e.horas * 100) / 100 : 0;
      const turno     = normalizeTurno(e.tipo);
      records.push({
        matricula: '',
        nome: currentName,
        escalas: e.count,
        escalasOriginal: String(e.count),
        valorHora,
        totalHoras: e.horas,
        totalHorasOriginal: String(e.horas),
        valorFinal: e.valor,
        valorFinalOriginal: String(e.valor),
        setor: normalizeSectorNew(e.setor),
        turno,
        profissao: inferProfissaoCobranca(valorHora),
      });
    }

    currentName = ''; shifts = []; collecting = false;
  };

  for (const line of lines) {
    // Data row — highest priority
    const dm = line.match(DATA_ROW);
    if (dm) {
      if (!collecting && pendingName) { currentName = pendingName; pendingName = ''; collecting = true; }
      const [,, setor, tipo, horasStr, valorStr] = dm;
      shifts.push({ setor: setor.trim(), tipo: tipo.trim(), horas: parseFloat(horasStr), valor: parseNumber(valorStr) });
      continue;
    }

    // Subtotal → end of cooperado
    if (SUBTOTAL.test(line)) { flush(); pendingName = ''; continue; }

    // Summary line ("N plantões | ...") → just metadata
    if (SUMMARY.test(line)) continue;

    // Cabeçalho de coluna ou rodapé da seção → pular sem limpar nome
    if (SKIP_ONLY.test(line)) continue;

    // Cabeçalho global → pular e limpar pendingName
    if (IGNORE.test(line)) {
      if (!collecting) pendingName = '';
      continue;
    }

    // Standalone date without shift data → ignore
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(line)) continue;

    // Any remaining line while not collecting → candidate for cooperado name
    if (!collecting) {
      if (!line.includes('|') && !line.includes('R$') && !line.match(/^\d/) && line.length < 80) {
        pendingName = pendingName ? `${pendingName} ${line}` : line;
      }
    }
  }

  flush();
  return records;
}

function isNewCadesFinanceiroFormat(fullText: string): boolean {
  return (
    fullText.includes('CADES Financeiro') ||
    (fullText.includes('Relatório de Faturamento') &&
      fullText.includes('Valor Faturado') &&
      fullText.includes('Diurnos'))
  );
}

function extractMetadataNewFormat(fullText: string): { cliente?: string; periodo?: string } {
  const result: { cliente?: string; periodo?: string } = {};

  const clienteMatch = fullText.match(/Cliente\s*:\s*(.+?)(?:\n|$)/i);
  if (clienteMatch) result.cliente = cleanText(clienteMatch[1]);

  // "Período: 20/04/2026 – 26/04/2026"
  const periodoMatch = fullText.match(/Per[ií]odo\s*:\s*([\d/]+\s*[–\-]\s*[\d/]+)/i);
  if (periodoMatch) result.periodo = cleanText(periodoMatch[1]);

  return result;
}

function extractTotalNewFormat(fullText: string): string | undefined {
  // Header card: "TOTAL FATURADO\nR$ 112.798,80"
  const headerMatch = fullText.match(/TOTAL FATURADO\s*\n?\s*R\$\s*([\d.,]+)/i);
  if (headerMatch) return headerMatch[1];

  // Linha de total da tabela resumo: "Total  626  7467.0h  R$ 112.798,80"
  const rowMatch = fullText.match(/\bTotal\b\s+\d+\s+[\d.]+h\s+R\$\s*([\d.,]+)/i);
  if (rowMatch) return rowMatch[1];

  return undefined;
}
// ─── FIM DO NOVO FORMATO ─────────────────────────────────────────────────────

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

  let registros: PlantaoRecord[];
  let metadata: { cliente?: string; periodo?: string };
  let totalOriginal: string | undefined;
  let subtotalOriginal: string | undefined;

  if (isCadesCobrancaFormat(fullText)) {
    console.log('[pdfParser] Formato detectado: CADES Financeiro (Cobrança ao Cliente)');
    registros = extractRecordsFromCobrancaFormat(fullText);
    metadata = extractMetadataCobranca(fullText);
    totalOriginal = extractTotalCobranca(fullText);
  } else if (isNewCadesFinanceiroFormat(fullText)) {
    console.log('[pdfParser] Formato detectado: CADES Financeiro (Relatório de Faturamento)');
    registros = extractRecordsFromNewFormat(fullText);
    metadata = extractMetadataNewFormat(fullText);
    totalOriginal = extractTotalNewFormat(fullText);
  } else {
    console.log('[pdfParser] Formato detectado: WebCoop/CADES legado');
    metadata = extractMetadata(fullText);
    const reportTotals = extractReportTotals(fullText);
    registros = extractRecordsFromText(fullText);
    totalOriginal = reportTotals.totalOriginal;
    subtotalOriginal = reportTotals.subtotalOriginal;

    // --- Validações do formato legado ---
    const { totalRegistrosOriginal } = reportTotals;
    if (totalRegistrosOriginal !== undefined && totalRegistrosOriginal !== registros.length) {
      console.warn(
        `[pdfParser] Divergência na contagem de registros: PDF indica ${totalRegistrosOriginal}, extraídos ${registros.length}.`,
      );
    }

    const somaLegado = registros.reduce((sum, r) => sum + r.valorFinal, 0);
    if (totalOriginal) {
      const totalEsperado = parseNumber(totalOriginal);
      const diferenca = Math.abs(somaLegado - totalEsperado);
      if (diferenca > 0.10) {
        console.warn(
          `[pdfParser] Divergência no total financeiro: PDF indica R$ ${totalEsperado.toFixed(2)}, soma extraída R$ ${somaLegado.toFixed(2)} (diferença R$ ${diferenca.toFixed(2)}).`,
        );
      }
    }

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
  }

  if (registros.length === 0) {
    throw new Error('Não foi possível extrair registros do PDF. Verifique se o formato é compatível.');
  }

  const somaValorFinal = registros.reduce((sum, r) => sum + r.valorFinal, 0);
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
    valorTotal: totalOriginal ? parseNumber(totalOriginal) : somaValorFinal,
    profissoes: uniqueProfissoes,
    cliente: metadata.cliente,
    periodo: metadata.periodo,
    subtotalOriginal,
    totalOriginal,
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
