-- ============================================================
-- CADES Analytics – Configuração: Valores Base do Contracheque
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Tabela singleton de configuração de valores hora por categoria
CREATE TABLE IF NOT EXISTS public.config_valores_hora (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enfermeiro_diurno           NUMERIC(10,2) NOT NULL DEFAULT 0,
  enfermeiro_noturno          NUMERIC(10,2) NOT NULL DEFAULT 0,
  tecnico_enfermagem_diurno   NUMERIC(10,2) NOT NULL DEFAULT 0,
  tecnico_enfermagem_noturno  NUMERIC(10,2) NOT NULL DEFAULT 0,
  fonoaudiologo               NUMERIC(10,2) NOT NULL DEFAULT 0,
  assistente_social           NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_by                  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Inserir linha singleton para garantir que sempre existe um registro
INSERT INTO public.config_valores_hora (
  id,
  enfermeiro_diurno, enfermeiro_noturno,
  tecnico_enfermagem_diurno, tecnico_enfermagem_noturno,
  fonoaudiologo, assistente_social
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  0, 0, 0, 0, 0, 0
)
ON CONFLICT (id) DO NOTHING;

-- ── Políticas de segurança (RLS) ─────────────────────────────────────────────
ALTER TABLE public.config_valores_hora ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler
CREATE POLICY "admin_read_config_valores_hora"
  ON public.config_valores_hora FOR SELECT
  USING (public.get_user_role() = 'admin');

-- Apenas admins podem atualizar
CREATE POLICY "admin_update_config_valores_hora"
  ON public.config_valores_hora FOR UPDATE
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
