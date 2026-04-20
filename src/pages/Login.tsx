import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  const getEmailByUsername = async (u: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('user_logins')
      .select('email')
      .eq('username', u.trim().toLowerCase())
      .single();
    if (error || !data) return null;
    return data.email;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const email = await getEmailByUsername(username);
      if (!email) {
        toast.error('Usuário não encontrado.');
        return;
      }
      const data = await signIn(email, password);
      const role = data?.user?.user_metadata?.role;
      navigate(role === 'admin' ? '/admin' : '/portal', { replace: true });
    } catch (err: any) {
      toast.error(
        err.message === 'Invalid login credentials'
          ? 'Usuário ou senha incorretos.'
          : 'Erro ao entrar. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    const role = user.user_metadata?.role;
    navigate(role === 'admin' ? '/admin' : '/portal', { replace: true });
    return null;
  }

  return (
    <>
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#dde3ee 1px, transparent 1px), linear-gradient(90deg, #dde3ee 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.35,
          zIndex: 0,
        }}
      />
      {/* Left accent bar */}
      <div
        className="fixed left-0 top-0 bottom-0 w-[5px]"
        style={{
          background: 'linear-gradient(180deg, #0f2340 0%, #c0607e 100%)',
          zIndex: 1,
        }}
      />

      <div
        className="relative min-h-screen flex flex-col items-center justify-center px-4 py-8"
        style={{ zIndex: 2 }}
      >
        {/* Brand */}
        <div
          className="flex flex-col items-center mb-8"
          style={{ animation: 'fadeUp .5s ease both' }}
        >
          <div
            className="flex items-center justify-center mb-4 rounded-[18px] px-8 py-5"
            style={{
              background: '#0f2340',
              border: '1px solid #0f2340',
              boxShadow: '0 1px 2px rgba(15,35,64,.04), 0 8px 32px rgba(15,35,64,.08)',
            }}
          >
            <img
              src="/logo_cades.png"
              alt="CADES – Cooperativa Assistencial de Trabalho do Espírito Santo"
              className="block h-auto"
              style={{ width: 180 }}
            />
          </div>
          <span
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: '#6b7a99' }}
          >
            CADES Analytics · Análise de Relatórios
          </span>
        </div>

        {/* Card */}
        <div
          className="w-full"
          style={{
            maxWidth: 420,
            background: '#ffffff',
            border: '1px solid #dde3ee',
            borderRadius: 18,
            padding: '2.4rem 2.6rem 2.6rem',
            boxShadow: '0 1px 2px rgba(15,35,64,.04), 0 8px 32px rgba(15,35,64,.08)',
            animation: 'fadeUp .55s .08s ease both',
          }}
        >
          <p
            className="font-semibold mb-1"
            style={{ fontSize: '1.4rem', color: '#0f2340' }}
          >
            Entrar
          </p>
          <p className="mb-7 text-sm" style={{ color: '#6b7a99' }}>
            Acesse com seu usuário e senha.
          </p>

          <form onSubmit={handleLogin}>
            {/* Usuário */}
            <div className="mb-5">
              <label
                htmlFor="username"
                className="block text-xs font-semibold tracking-wide uppercase mb-[.45rem]"
                style={{ color: '#1a3560' }}
              >
                Usuário
              </label>
              <input
                id="username"
                type="text"
                placeholder="seu.usuario"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full rounded-[10px] text-[.95rem] outline-none transition-all"
                style={{
                  padding: '.75rem 1rem',
                  border: '1.5px solid #dde3ee',
                  background: '#f9fafd',
                  color: '#0f1f3d',
                  fontFamily: 'inherit',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = '#1e4d8c';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30,77,140,.12)';
                  e.currentTarget.style.background = '#fff';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = '#dde3ee';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = '#f9fafd';
                }}
              />
            </div>

            {/* Senha */}
            <div className="mb-5">
              <div className="flex justify-between items-baseline mb-[.45rem]">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold tracking-wide uppercase"
                  style={{ color: '#1a3560' }}
                >
                  Senha
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium"
                  style={{ color: '#1e4d8c', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-[10px] text-[.95rem] outline-none transition-all"
                  style={{
                    padding: '.75rem 3rem .75rem 1rem',
                    border: '1.5px solid #dde3ee',
                    background: '#f9fafd',
                    color: '#0f1f3d',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#1e4d8c';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30,77,140,.12)';
                    e.currentTarget.style.background = '#fff';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#dde3ee';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.background = '#f9fafd';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center p-0 border-none bg-transparent cursor-pointer"
                  style={{ color: '#6b7a99' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#0f2340')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6b7a99')}
                  aria-label="Mostrar senha"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center w-full rounded-[10px] text-white font-semibold text-base tracking-wide cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                padding: '.85rem',
                background: '#0f2340',
                border: 'none',
                fontFamily: 'inherit',
                marginTop: '1.6rem',
                boxShadow: '0 4px 14px rgba(15,35,64,.25)',
                letterSpacing: '.02em',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.background = '#1e4d8c';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(30,77,140,.30)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#0f2340';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,35,64,.25)';
              }}
              onMouseDown={e => {
                e.currentTarget.style.transform = 'scale(.98)';
              }}
              onMouseUp={e => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Entrar
            </button>
          </form>
        </div>

        {/* Footer */}
        <p
          className="mt-9 text-xs text-center tracking-wide"
          style={{ color: '#a0abbe', animation: 'fadeUp .6s .16s ease both' }}
        >
          CADES – Cooperativa Assistencial de Trabalho do Espírito Santo
        </p>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input::placeholder { color: #aab3c8; }
      `}</style>
    </>
  );
}
