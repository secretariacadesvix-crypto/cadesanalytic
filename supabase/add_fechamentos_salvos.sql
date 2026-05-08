-- Tabela para salvar snapshots completos de fechamentos mensais
-- Permite reabrir qualquer fechamento anterior com todos os dados

CREATE TABLE IF NOT EXISTS fechamentos_salvos (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  client_nome     text NOT NULL DEFAULT '',
  mes             text NOT NULL,
  ano             text NOT NULL,
  competencia     text NOT NULL,
  data_pagamento  text,
  total_bruto     numeric DEFAULT 0,
  total_liquido   numeric DEFAULT 0,
  num_cooperados  integer DEFAULT 0,
  cooperados_json jsonb NOT NULL DEFAULT '[]',
  criado_em       timestamptz DEFAULT now(),
  atualizado_em   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fechamentos_salvos_client
  ON fechamentos_salvos (client_id, ano, mes);

ALTER TABLE fechamentos_salvos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam fechamentos salvos"
  ON fechamentos_salvos FOR ALL
  USING (true);
