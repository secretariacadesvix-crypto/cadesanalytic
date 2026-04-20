import { createClient } from '@supabase/supabase-js';

// Cliente com service role — cria/edita usuários sem restrições
// Usado APENAS no painel admin para gerenciar logins de clientes
export const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_SERVICE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
