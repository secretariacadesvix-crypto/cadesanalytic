import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ─── Estilos compartilhados (mesma linguagem visual do Login) ───────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '.75rem 1rem',
  border: '1.5px solid #dde3ee',
  borderRadius: 10,
  fontSize: '.95rem',
  fontFamily: 'inherit',
  color: '#0f1f3d',
  background: '#f9fafd',
  outline: 'none',
  transition: 'border-color .2s, box-shadow .2s',
};

const inputPasswordStyle: React.CSSProperties = {
  ...inputStyle,
  paddingRight: '3rem',
};

const btnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '.85rem',
  border: 'none',
  borderRadius: 10,
  background: '#0f2340',
  color: '#fff',
  fontSize: '1rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  letterSpacing: '.02em',
  cursor: 'pointer',
  marginTop: '1.6rem',
  boxShadow: '0 4px 14px rgba(15,35,64,.25)',
  transition: 'background .2s, transform .1s, box-shadow .2s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '.8rem',
  fontWeight: 600,
  letterSpacing: '.04em',
  textTransform: 'uppercase' as const,
  color: '#1a3560',
  marginBottom: '.45rem',
};

function focusInput(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = '#1e4d8c';
  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30,77,140,.12)';
  e.currentTarget.style.background = '#fff';
}

function blurInput(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = '#dde3ee';
  e.currentTarget.style.boxShadow = 'none';
  e.currentTarget.style.background = '#f9fafd';
}

// ─── Layout compartilhado (mesmo visual do Login) ──────────────────────────
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Grid background */}
      <div
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(#dde3ee 1px, transparent 1px), linear-gradient(90deg, #dde3ee 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.35,
          zIndex: 0,
        }}
      />
      {/* Left accent bar */}
      <div
        style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, width: 5,
          background: 'linear-gradient(180deg, #0f2340 0%, #c0607e 100%)',
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: 'relative', zIndex: 2,
          minHeight: '100vh',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '2rem 1rem',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              background: '#0f2340',
              border: '1px solid #0f2340',
              borderRadius: 18,
              padding: '20px 32px',
              boxShadow: '0 1px 2px rgba(15,35,64,.04), 0 8px 32px rgba(15,35,64,.08)',
              marginBottom: '1.1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <img
              src="/logo_cades.png"
              alt="CADES – Cooperativa Assistencial de Trabalho do Espírito Santo"
              style={{ width: 180, height: 'auto', display: 'block' }}
            />
          </div>
          <span
            style={{
              fontSize: '.78rem', fontWeight: 500,
              letterSpacing: '.08em', textTransform: 'uppercase',
              color: '#6b7a99',
            }}
          >
            CADES Analytics · Análise de Relatórios
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #dde3ee',
            borderRadius: 18,
            padding: '2.4rem 2.6rem 2.6rem',
            width: '100%',
            maxWidth: 420,
            boxShadow: '0 1px 2px rgba(15,35,64,.04), 0 8px 32px rgba(15,35,64,.08)',
          }}
        >
          {children}
        </div>

        {/* Footer */}
        <p
          style={{
            marginTop: '2.2rem',
            fontSize: '.78rem',
            color: '#a0abbe',
            letterSpacing: '.02em',
            textAlign: 'center',
          }}
        >
          CADES – Cooperativa Assistencial de Trabalho do Espírito Santo
        </p>
      </div>

      <style>{`input::placeholder { color: #aab3c8; }`}</style>
    </>
  );
}

// ─── Esqueci minha senha ────────────────────────────────────────────────────
export function ForgotPasswordPage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const getEmailByUsername = async (u: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('user_logins')
      .select('email')
      .eq('username', u.trim().toLowerCase())
      .single();
    if (error || !data) return null;
    return data.email;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    try {
      const email = await getEmailByUsername(username);
      if (!email) {
        toast.error('Usuário não encontrado.');
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch {
      toast.error('Erro ao enviar o e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {sent ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={24} style={{ color: '#16a34a' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '.95rem', fontWeight: 600, color: '#0f2340', marginBottom: '.35rem' }}>Link enviado!</p>
            <p style={{ fontSize: '.82rem', color: '#6b7a99', lineHeight: 1.6 }}>
              Verifique a caixa de entrada do e-mail cadastrado para o usuário <strong>{username}</strong>.
            </p>
          </div>
          <Link to="/login" style={{ fontSize: '.8rem', color: '#1e4d8c', textDecoration: 'none', marginTop: '.5rem' }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            ← Voltar ao login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <p style={{ fontSize: '1.4rem', fontWeight: 600, color: '#0f2340', marginBottom: '.3rem' }}>
            Recuperar senha
          </p>
          <p style={{ fontSize: '.875rem', color: '#6b7a99', marginBottom: '1.8rem' }}>
            Informe seu usuário e enviaremos um link de redefinição para o e-mail cadastrado.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="username" style={labelStyle}>Usuário</label>
            <input
              id="username"
              type="text"
              placeholder="seu.usuario"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoCapitalize="none"
              autoCorrect="off"
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...btnStyle, opacity: loading ? 0.7 : 1 }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = '#1e4d8c'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(30,77,140,.30)'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0f2340'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,35,64,.25)'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(.98)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {loading && <Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }} />}
            Enviar link de redefinição
          </button>

          <div style={{ textAlign: 'center', marginTop: '1.1rem' }}>
            <Link to="/login" style={{ fontSize: '.8rem', color: '#6b7a99', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#1e4d8c')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b7a99')}
            >
              ← Voltar ao login
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

// ─── Redefinir senha (a partir do link do e-mail) ───────────────────────────
export function ResetPasswordPage() {
  const navigate = useNavigate();

  const [status, setStatus] = useState<'loading' | 'ready' | 'invalid' | 'success'>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Aguarda o evento PASSWORD_RECOVERY disparado pelo Supabase ao processar
    // o token do link — NÃO consome o token antecipadamente com verifyOtp.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('ready');
      }
    });

    // Se após 6 segundos o evento não disparou, o link é inválido ou expirado.
    // Usa forma funcional do setter para evitar stale closure.
    const timer = setTimeout(() => {
      setStatus(prev => prev === 'loading' ? 'invalid' : prev);
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStatus('success');
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao redefinir senha. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout>
      {/* Loading */}
      {status === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem 0' }}>
          <Loader2 size={28} className="animate-spin" style={{ color: '#6b7a99' }} />
          <p style={{ fontSize: '.88rem', color: '#6b7a99' }}>Verificando link...</p>
        </div>
      )}

      {/* Invalid / expired */}
      {status === 'invalid' && (
        <>
          <p style={{ fontSize: '1.4rem', fontWeight: 600, color: '#0f2340', marginBottom: '.3rem' }}>
            Link inválido ou expirado
          </p>
          <p style={{ fontSize: '.875rem', color: '#6b7a99', marginBottom: '1.8rem' }}>
            O link de redefinição não é válido ou já foi utilizado.
          </p>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '.75rem',
            padding: '.85rem 1rem', borderRadius: 10,
            background: '#fef2f2', border: '1px solid #fecaca',
            marginBottom: '1.4rem',
          }}>
            <AlertCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
            <p style={{ fontSize: '.8rem', color: '#ef4444', lineHeight: 1.5 }}>
              Links de redefinição expiram em 1 hora e só podem ser usados uma vez.
            </p>
          </div>
          <Link to="/forgot-password" style={{ display: 'block', textDecoration: 'none' }}>
            <button
              style={btnStyle}
              onMouseEnter={e => { e.currentTarget.style.background = '#1e4d8c'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#0f2340'; }}
            >
              Solicitar novo link
            </button>
          </Link>
          <div style={{ textAlign: 'center', marginTop: '1.1rem' }}>
            <Link to="/login" style={{ fontSize: '.8rem', color: '#6b7a99', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#1e4d8c')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b7a99')}
            >
              ← Voltar ao login
            </Link>
          </div>
        </>
      )}

      {/* Ready — form */}
      {status === 'ready' && (
        <form onSubmit={handleSubmit}>
          <p style={{ fontSize: '1.4rem', fontWeight: 600, color: '#0f2340', marginBottom: '.3rem' }}>
            Definir nova senha
          </p>
          <p style={{ fontSize: '.875rem', color: '#6b7a99', marginBottom: '1.8rem' }}>
            Escolha uma senha segura com pelo menos 6 caracteres.
          </p>

          {/* Nova senha */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="password" style={labelStyle}>Nova senha</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                style={inputPasswordStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: '.85rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6b7a99', padding: 0, display: 'flex', alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirmar senha */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="confirm" style={labelStyle}>Confirmar nova senha</label>
            <div style={{ position: 'relative' }}>
              <input
                id="confirm"
                type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                style={inputPasswordStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                style={{
                  position: 'absolute', right: '.85rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6b7a99', padding: 0, display: 'flex', alignItems: 'center',
                }}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{ ...btnStyle, opacity: saving ? 0.7 : 1 }}
            onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = '#1e4d8c'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(30,77,140,.30)'; } }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0f2340'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,35,64,.25)'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(.98)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {saving && <Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }} />}
            Salvar nova senha
          </button>
        </form>
      )}

      {/* Success */}
      {status === 'success' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={24} style={{ color: '#16a34a' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '.95rem', fontWeight: 600, color: '#0f2340', marginBottom: '.35rem' }}>
              Senha redefinida!
            </p>
            <p style={{ fontSize: '.82rem', color: '#6b7a99', lineHeight: 1.6 }}>
              Sua senha foi alterada com sucesso. Redirecionando para o login...
            </p>
          </div>
          <Loader2 size={16} className="animate-spin" style={{ color: '#6b7a99' }} />
        </div>
      )}
    </AuthLayout>
  );
}
