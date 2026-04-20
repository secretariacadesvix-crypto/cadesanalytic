export interface ValoresHora {
  id?: string;
  enfermeiro_diurno: number;
  enfermeiro_noturno: number;
  tecnico_enfermagem_diurno: number;
  tecnico_enfermagem_noturno: number;
  tecnico_enfermagem_diarista: number;
  fonoaudiologo: number;
  assistente_social: number;
  updated_at?: string;
}

export type CategoriaValorHora = keyof Omit<ValoresHora, 'id' | 'updated_at'>;

export const CATEGORIAS_LABEL: Record<CategoriaValorHora, string> = {
  enfermeiro_diurno:            'Enfermeiro Diurno',
  enfermeiro_noturno:           'Enfermeiro Noturno',
  tecnico_enfermagem_diurno:    'Técnico de Enfermagem Diurno',
  tecnico_enfermagem_noturno:   'Técnico de Enfermagem Noturno',
  tecnico_enfermagem_diarista:  'Técnico de Enfermagem Diarista',
  fonoaudiologo:                'Fonoaudiólogo',
  assistente_social:            'Assistente Social',
};

// Valores padrão do cooperado — usados quando não há configuração no banco
export const VALORES_HORA_DEFAULT: Omit<ValoresHora, 'id' | 'updated_at'> = {
  enfermeiro_diurno:           19.16,
  enfermeiro_noturno:          20.83,
  tecnico_enfermagem_diurno:   11.50,
  tecnico_enfermagem_noturno:  12.33,
  tecnico_enfermagem_diarista: 11.50,
  fonoaudiologo:               19.16,
  assistente_social:           19.16,
};

// ID singleton fixo — única linha na tabela
export const CONFIG_SINGLETON_ID = '00000000-0000-0000-0000-000000000001';
