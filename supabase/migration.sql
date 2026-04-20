-- ============================================================
-- CADES Analytics – Supabase Migration
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Tabela de clientes (hospitais/clínicas)
CREATE TABLE IF NOT EXISTS public.clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  phone      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  client_id  UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de relatórios
CREATE TABLE IF NOT EXISTS public.reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  sector       TEXT,
  period       TEXT,
  report_date  DATE,
  week_number  INTEGER,
  month        INTEGER,
  year         INTEGER,
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_path    TEXT,
  file_name    TEXT,
  parsed_data  JSONB,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS UUID
LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- TRIGGER: criar perfil automaticamente ao criar usuário
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  matching_client_id UUID;
BEGIN
  -- Verifica se o e-mail do novo usuário corresponde a algum cliente
  SELECT id INTO matching_client_id
  FROM public.clients
  WHERE email = NEW.email;

  INSERT INTO public.profiles (id, role, client_id)
  VALUES (
    NEW.id,
    'client',              -- padrão: cliente
    matching_client_id     -- null se não houver cliente com esse e-mail
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS – Ativar Row Level Security
-- ============================================================

ALTER TABLE public.clients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports  ENABLE ROW LEVEL SECURITY;

-- profiles: cada usuário lê apenas o próprio perfil
DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- clients: admins gerenciam todos; clientes veem apenas o próprio
DROP POLICY IF EXISTS "admins_manage_clients" ON public.clients;
CREATE POLICY "admins_manage_clients" ON public.clients
  FOR ALL USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "clients_read_own" ON public.clients;
CREATE POLICY "clients_read_own" ON public.clients
  FOR SELECT USING (id = public.get_user_client_id());

-- reports: admins gerenciam todos; clientes veem apenas os seus
DROP POLICY IF EXISTS "admins_manage_reports" ON public.reports;
CREATE POLICY "admins_manage_reports" ON public.reports
  FOR ALL USING (public.get_user_role() = 'admin');

DROP POLICY IF EXISTS "clients_read_own_reports" ON public.reports;
CREATE POLICY "clients_read_own_reports" ON public.reports
  FOR SELECT USING (client_id = public.get_user_client_id());

-- ============================================================
-- STORAGE: bucket "reports" para PDFs
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- Admins podem fazer upload e leitura
DROP POLICY IF EXISTS "admins_storage_all" ON storage.objects;
CREATE POLICY "admins_storage_all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'reports'
    AND public.get_user_role() = 'admin'
  );

-- Clientes podem baixar apenas arquivos da pasta do seu client_id
DROP POLICY IF EXISTS "clients_storage_read" ON storage.objects;
CREATE POLICY "clients_storage_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = public.get_user_client_id()::text
  );

-- ============================================================
-- CRIAR PRIMEIRO ADMINISTRADOR
-- Após criar sua conta no Supabase, execute:
--
--   UPDATE public.profiles
--   SET role = 'admin'
--   WHERE id = '<seu-user-id>';
--
-- O user ID está em: Supabase → Authentication → Users
-- ============================================================
