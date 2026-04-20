import { supabase } from '@/lib/supabase';
import type { ValoresHora, CategoriaValorHora } from '@/types/config';
import { CONFIG_SINGLETON_ID, VALORES_HORA_DEFAULT } from '@/types/config';

const LS_KEY = 'cades_config_valores_hora';

/**
 * Garante que nenhum campo numérico da tabela seja zero ou indefinido.
 * Campos zero → substituídos pelo valor default do cooperado.
 * Preserva valores maiores que zero configurados pelo usuário.
 */
function mergeComDefaults(v: ValoresHora): ValoresHora {
  const result = { ...v };
  for (const key of Object.keys(VALORES_HORA_DEFAULT) as CategoriaValorHora[]) {
    const current = result[key] as number | undefined;
    if (!current || current <= 0) {
      (result as Record<string, unknown>)[key] = VALORES_HORA_DEFAULT[key];
    }
  }
  return result;
}

// Detecta se o erro é de tabela inexistente no Supabase
function isTableMissingError(msg: string) {
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('relation') ||
    msg.includes('42P01')
  );
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function lsLoad(): ValoresHora {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...VALORES_HORA_DEFAULT, id: CONFIG_SINGLETON_ID };
    return mergeComDefaults(JSON.parse(raw) as ValoresHora);
  } catch {
    return { ...VALORES_HORA_DEFAULT, id: CONFIG_SINGLETON_ID };
  }
}

function lsSave(valores: Omit<ValoresHora, 'id' | 'updated_at'>) {
  const payload: ValoresHora = {
    id: CONFIG_SINGLETON_ID,
    ...valores,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(LS_KEY, JSON.stringify(payload));
}

// ── Verificar se a tabela existe no Supabase ──────────────────────────────────
// Retorna true se a tabela está disponível, false se não existe ainda
export async function checkTabelaExiste(): Promise<boolean> {
  const { error } = await supabase
    .from('config_valores_hora')
    .select('id')
    .limit(1);

  if (!error) return true;
  return !isTableMissingError(error.message);
}

// ── Buscar configuração ───────────────────────────────────────────────────────
// Tenta Supabase → se tabela não existir, usa localStorage
export async function fetchValoresHora(): Promise<ValoresHora> {
  const { data, error } = await supabase
    .from('config_valores_hora')
    .select('*')
    .eq('id', CONFIG_SINGLETON_ID)
    .single();

  if (!error && data) return mergeComDefaults(data as ValoresHora);

  // Fallback: localStorage (tabela ainda não criada ou erro de rede)
  return lsLoad();
}

// ── Salvar configuração ───────────────────────────────────────────────────────
// Tenta Supabase → se tabela não existir, salva em localStorage
export async function saveValoresHora(
  valores: Omit<ValoresHora, 'id' | 'updated_at'>
): Promise<{ error: string | null; storedIn: 'supabase' | 'local' }> {
  const { error } = await supabase
    .from('config_valores_hora')
    .upsert({
      id: CONFIG_SINGLETON_ID,
      ...valores,
      updated_at: new Date().toISOString(),
    });

  if (!error) {
    // Supabase funcionou → limpa localStorage para não ter dados desatualizados
    localStorage.removeItem(LS_KEY);
    return { error: null, storedIn: 'supabase' };
  }

  if (isTableMissingError(error.message)) {
    // Tabela não existe ainda → salva localmente
    lsSave(valores);
    return { error: null, storedIn: 'local' };
  }

  return { error: error.message, storedIn: 'local' };
}

// ── Migrar dados do localStorage para Supabase (após criar a tabela) ──────────
export async function migrarLocalParaSupabase(): Promise<{ error: string | null }> {
  const local = lsLoad();
  const { id: _id, updated_at: _ua, ...valores } = local;

  const { error } = await supabase
    .from('config_valores_hora')
    .upsert({ id: CONFIG_SINGLETON_ID, ...valores, updated_at: new Date().toISOString() });

  if (!error) {
    localStorage.removeItem(LS_KEY);
    return { error: null };
  }
  return { error: error.message };
}

// ── Verificar se há dados pendentes no localStorage ───────────────────────────
export function temDadosLocais(): boolean {
  return !!localStorage.getItem(LS_KEY);
}

// ── Mapear profissão + turno para categoria ───────────────────────────────────
export function matchCategoria(
  profissao: string,
  turno: string
): CategoriaValorHora | null {
  const p = (profissao ?? '').toLowerCase().trim();
  const t = (turno     ?? '').toUpperCase().trim();
  const isNoturno  = t.includes('NOTURNO');
  const isDiarista = t.includes('DIARISTA');

  // ── Técnico de Enfermagem (verificar antes de Enfermeiro para evitar false match) ──
  if (
    p.includes('técnico') || p.includes('tecnico') ||
    p.includes('aux. enfermagem') || p.includes('auxiliar de enfermagem')
  ) {
    if (isDiarista) return 'tecnico_enfermagem_diarista';
    return isNoturno ? 'tecnico_enfermagem_noturno' : 'tecnico_enfermagem_diurno';
  }

  // ── Enfermeiro ────────────────────────────────────────────────────────────────
  if (p.includes('enfermeiro') || p.includes('enfermeira')) {
    return isNoturno ? 'enfermeiro_noturno' : 'enfermeiro_diurno';
  }

  // ── Fonoaudióloga / Fonoaudiólogo ─────────────────────────────────────────────
  if (p.includes('fono')) return 'fonoaudiologo';

  // ── Assistente Social ─────────────────────────────────────────────────────────
  if (p.includes('assistente social') || p.includes('assist. social') || p.includes('assist social')) {
    return 'assistente_social';
  }

  return null;
}

// ── Calcular valor bruto: horas × valor/hora da categoria ────────────────────
// Retorna null apenas se a profissão não for mapeável a nenhuma categoria.
export function calcularValorBruto(
  totalHoras: number,
  profissao: string,
  turno: string,
  valoresHora: ValoresHora
): number | null {
  const categoria = matchCategoria(profissao, turno);
  if (!categoria) return null;

  // Taxa configurada pelo usuário; se zero, usa o default do cooperado como segurança
  const taxaConfigurada = valoresHora[categoria] as number | undefined;
  const taxaHora = (taxaConfigurada && taxaConfigurada > 0)
    ? taxaConfigurada
    : VALORES_HORA_DEFAULT[categoria];

  if (!taxaHora || taxaHora <= 0) return null;
  return Math.round(totalHoras * taxaHora * 100) / 100;
}
