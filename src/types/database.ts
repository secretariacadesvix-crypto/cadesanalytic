import type { ReportData } from './report';

export interface FolhaFechamento {
  id: string;
  client_id: string;
  mes: string;
  ano: string;
  data_pagamento: string | null;
  cooperado_nome: string;
  cooperado_matricula: string | null;
  cota_parte: number;
  valor_bruto: number | null;
  criado_em: string;
}

export interface Profile {
  id: string;
  role: 'admin' | 'client';
  client_id: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  created_by: string | null;
}

export interface StoredReport {
  id: string;
  title: string;
  sector: string | null;
  period: string | null;
  report_date: string | null;
  week_number: number | null;
  month: number | null;
  year: number | null;
  client_id: string;
  file_path: string | null;
  file_name: string | null;
  parsed_data: ReportData | null;
  published_at: string;
  created_at: string;
  client?: Client;
}
