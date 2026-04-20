import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const NAV_TABS = [
  {
    to: '/admin/relatorios',
    label: 'Relatórios',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
  },
  {
    to: '/admin/consolidado',
    label: 'Consolidado',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    to: '/admin/clientes',
    label: 'Clientes',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    to: '/admin/anexar-relatorio',
    label: 'Anexar Atualização',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
      </svg>
    ),
  },
  {
    to: '/admin/fechamento-folha',
    label: 'Fechamento de Folha',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="9" y1="13" x2="15" y2="13"/>
        <line x1="9" y1="17" x2="12" y2="17"/>
      </svg>
    ),
  },
  {
    to: '/admin/configuracoes',
    label: 'Configurações',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

export function AdminNav() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const email = user?.email ?? '';
  const initials = email
    .split('@')[0]
    .split('.')
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <>
      <style>{`
        .an-tab {
          display: flex; align-items: center; gap: .4rem;
          padding: 0 1rem; height: 100%;
          font-size: .78rem; font-weight: 500;
          color: #8a9ab5; text-decoration: none;
          white-space: nowrap; position: relative;
          letter-spacing: -.01em; box-sizing: border-box;
          border: none; background: none; cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: color .18s, border-color .18s;
        }
        .an-tab:hover { color: #0f2340; border-bottom-color: #0f2340; }
        .an-tab.an-active { color: #0f2340; font-weight: 600; border-bottom-color: #0f2340; }
        .an-sair {
          display: flex; align-items: center; gap: .3rem;
          font-size: .72rem; font-weight: 500; color: #8a9ab5;
          padding: .35rem .6rem; border-radius: 6px;
          border: none; background: none; cursor: pointer;
          font-family: inherit;
          transition: background .15s, color .15s;
        }
        .an-sair:hover { background: #f7f9fc; color: #0f2340; }
        .an-cta {
          display: flex; align-items: center; gap: .45rem;
          padding: .5rem 1.1rem; border-radius: 8px;
          background: #0f2340; color: #fff;
          font-size: .78rem; font-weight: 600;
          font-family: inherit; letter-spacing: -.01em;
          border: none; cursor: pointer; white-space: nowrap;
          box-shadow: 0 1px 4px rgba(15,35,64,.20), 0 4px 14px rgba(15,35,64,.12);
          transition: background .18s, transform .1s, box-shadow .18s;
        }
        .an-cta:hover {
          background: #1e4d8c;
          box-shadow: 0 2px 8px rgba(30,77,140,.25), 0 6px 20px rgba(30,77,140,.15);
        }
        .an-cta:active { transform: scale(.98); }
      `}</style>

      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center',
        padding: '0 2rem', height: 60,
      }}>

        {/* Logo */}
        <Link
          to="/admin"
          style={{
            display: 'flex', alignItems: 'center', gap: '.75rem',
            textDecoration: 'none', flexShrink: 0, marginRight: '2rem',
          }}
        >
          <div style={{
            background: '#0f2340', borderRadius: 10,
            padding: '7px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(15,35,64,.18)',
          }}>
            <img src="/logo_cades.png" alt="CADES" style={{ height: 34, width: 'auto', display: 'block' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#0f2340', letterSpacing: '-.01em' }}>
              CADES Analytics
            </span>
            <span style={{ fontSize: '.65rem', fontWeight: 400, color: '#8a9ab5', letterSpacing: '.01em' }}>
              Cooperativa Assistencial · ES
            </span>
          </div>
        </Link>

        {/* Tab strip */}
        <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, height: '100%' }}>
          {NAV_TABS.map(({ to, label, icon }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + '/');
            return (
              <Link key={to} to={to} className={`an-tab${active ? ' an-active' : ''}`}>
                {icon}
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginLeft: 'auto', flexShrink: 0 }}>
          {/* User pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '.5rem',
            padding: '.35rem .75rem', borderRadius: 20,
            background: '#f7f9fc', border: '1px solid #e2e8f0',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: '#e8eef7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '.65rem', fontWeight: 600, color: '#0f2340', flexShrink: 0,
            }}>
              {initials}
            </div>
            <span style={{
              fontSize: '.72rem', color: '#4a5568',
              maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {email}
            </span>
          </div>

          {/* Sair */}
          <button className="an-sair" onClick={signOut}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair
          </button>

          {/* Novo Relatório */}
          <button className="an-cta" onClick={() => navigate('/admin')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Novo Relatório
          </button>
        </div>
      </nav>
    </>
  );
}
