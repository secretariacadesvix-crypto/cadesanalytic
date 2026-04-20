-- ============================================================
-- Versionamento de relatórios (Anexar Atualização)
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1. Adiciona coluna de versão na tabela reports existente
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- 2. Histórico de versões (auditoria de cada anexo enviado)
CREATE TABLE IF NOT EXISTS report_versions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id              UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  version_number         INTEGER NOT NULL,
  cooperados_adicionados JSONB,          -- array dos novos registros adicionados
  cooperados_count       INTEGER DEFAULT 0,
  valor_anterior         NUMERIC(12,2),
  valor_novo             NUMERIC(12,2),
  diferenca_valor        NUMERIC(12,2),
  arquivo_nome           TEXT,
  enviado_por            UUID REFERENCES auth.users(id),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS na tabela de versões
ALTER TABLE report_versions ENABLE ROW LEVEL SECURITY;

-- Admins: acesso total
CREATE POLICY "admin_report_versions" ON report_versions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Índice para buscas rápidas por relatório
CREATE INDEX IF NOT EXISTS idx_report_versions_report_id
  ON report_versions(report_id);
