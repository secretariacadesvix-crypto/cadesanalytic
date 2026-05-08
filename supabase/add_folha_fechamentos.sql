-- Tabela para rastrear fechamentos mensais de folha por cooperado
-- Permite acumular Cota Parte ao longo dos meses

CREATE TABLE IF NOT EXISTS folha_fechamentos (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id            uuid REFERENCES clients(id) ON DELETE CASCADE,
  mes                  text NOT NULL,
  ano                  text NOT NULL,
  data_pagamento       text,
  cooperado_nome       text NOT NULL,
  cooperado_matricula  text,
  cota_parte           numeric NOT NULL DEFAULT 80,
  valor_bruto          numeric,
  criado_em            timestamptz DEFAULT now()
);

-- Índice para busca rápida por cooperado + cliente
CREATE INDEX IF NOT EXISTS idx_folha_fechamentos_cooperado
  ON folha_fechamentos (client_id, cooperado_matricula, cooperado_nome);

ALTER TABLE folha_fechamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam fechamentos"
  ON folha_fechamentos FOR ALL
  USING (true);
