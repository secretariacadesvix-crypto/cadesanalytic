-- ============================================================
-- CADES Analytics – Migração: Login por Usuário
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Tabela de mapeamento username → email (leitura pública para login)
CREATE TABLE IF NOT EXISTS public.user_logins (
  username TEXT PRIMARY KEY,
  email    TEXT NOT NULL UNIQUE
);

ALTER TABLE public.user_logins ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa (inclusive não autenticada) pode buscar o email pelo username
DROP POLICY IF EXISTS "anyone_can_read_userlogins" ON public.user_logins;
CREATE POLICY "anyone_can_read_userlogins" ON public.user_logins
  FOR SELECT USING (true);

-- Apenas admins podem inserir/alterar/excluir
DROP POLICY IF EXISTS "admins_manage_userlogins" ON public.user_logins;
CREATE POLICY "admins_manage_userlogins" ON public.user_logins
  FOR ALL USING (public.get_user_role() = 'admin');

-- Garantir acesso de leitura ao role anon (usuário não autenticado)
GRANT SELECT ON public.user_logins TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_logins TO authenticated;

-- 2. Adicionar coluna username na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- ============================================================
-- APÓS RODAR ESTE SCRIPT:
-- Cadastre o username do administrador substituindo os valores:
--
--   INSERT INTO public.user_logins (username, email)
--   VALUES ('admin', 'seu-email@exemplo.com');
--
-- Onde 'admin' é o username que você quer usar para login
-- e 'seu-email@exemplo.com' é o e-mail que você cadastrou no Supabase.
-- ============================================================
