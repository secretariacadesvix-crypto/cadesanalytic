import { useState, useEffect } from 'react';
import {
  Settings, DollarSign, Loader2, Save, CheckCircle2,
  Info, AlertTriangle, Database, Copy, Check, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminNav } from '@/components/AdminNav';
import { toast } from 'sonner';
import {
  fetchValoresHora,
  saveValoresHora,
  checkTabelaExiste,
  migrarLocalParaSupabase,
  temDadosLocais,
} from '@/lib/valoresHora';
import type { ValoresHora, CategoriaValorHora } from '@/types/config';
import { CATEGORIAS_LABEL, VALORES_HORA_DEFAULT } from '@/types/config';

// ── SQL de criação da tabela ──────────────────────────────────────────────────
const SQL_SETUP = `-- Execute no SQL Editor do Supabase (painel → SQL Editor → New Query)
CREATE TABLE IF NOT EXISTS public.config_valores_hora (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enfermeiro_diurno            NUMERIC(10,2) NOT NULL DEFAULT 19.16,
  enfermeiro_noturno           NUMERIC(10,2) NOT NULL DEFAULT 20.83,
  tecnico_enfermagem_diurno    NUMERIC(10,2) NOT NULL DEFAULT 11.50,
  tecnico_enfermagem_noturno   NUMERIC(10,2) NOT NULL DEFAULT 12.33,
  tecnico_enfermagem_diarista  NUMERIC(10,2) NOT NULL DEFAULT 11.50,
  fonoaudiologo                NUMERIC(10,2) NOT NULL DEFAULT 19.16,
  assistente_social            NUMERIC(10,2) NOT NULL DEFAULT 19.16,
  updated_at                   TIMESTAMPTZ DEFAULT NOW(),
  updated_by                   UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Se a tabela já existir, adicionar a coluna diarista (executa sem erro se já existir)
ALTER TABLE public.config_valores_hora
  ADD COLUMN IF NOT EXISTS tecnico_enfermagem_diarista NUMERIC(10,2) NOT NULL DEFAULT 11.50;

INSERT INTO public.config_valores_hora (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.config_valores_hora ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_config_valores_hora"
  ON public.config_valores_hora FOR SELECT
  USING (public.get_user_role() = 'admin');

CREATE POLICY "admin_update_config_valores_hora"
  ON public.config_valores_hora FOR UPDATE
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "admin_insert_config_valores_hora"
  ON public.config_valores_hora FOR INSERT
  WITH CHECK (public.get_user_role() = 'admin');`;

// ── Layout dos campos agrupados ───────────────────────────────────────────────
const GRUPOS: { titulo: string; items: CategoriaValorHora[] }[] = [
  {
    titulo: 'Enfermeiro',
    items: ['enfermeiro_diurno', 'enfermeiro_noturno'],
  },
  {
    titulo: 'Técnico de Enfermagem',
    items: [
      'tecnico_enfermagem_diurno',
      'tecnico_enfermagem_noturno',
      'tecnico_enfermagem_diarista',
    ],
  },
  {
    titulo: 'Outros Profissionais',
    items: ['fonoaudiologo', 'assistente_social'],
  },
];

function fmtR$(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Banner de setup do banco ──────────────────────────────────────────────────
function SetupBanner({
  temLocal,
  onMigrar,
  onVerificar,
  verificando,
}: {
  temLocal: boolean;
  onMigrar: () => void;
  onVerificar: () => void;
  verificando: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SETUP).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div style={{
      background: '#fffbeb', border: '1.5px solid #fbbf24',
      borderRadius: 10, marginBottom: 20, overflow: 'hidden',
    }}>
      {/* Cabeçalho do banner */}
      <div style={{
        background: '#fef3c7', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid #fbbf24',
      }}>
        <AlertTriangle size={16} style={{ color: '#d97706', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: '.85rem', color: '#92400e', margin: 0 }}>
            Tabela não encontrada no banco de dados
          </p>
          <p style={{ fontSize: '.75rem', color: '#b45309', margin: '2px 0 0' }}>
            Os valores estão sendo salvos localmente neste navegador.
            Para persistir no banco e compartilhar entre usuários, execute o SQL abaixo no Supabase.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onVerificar}
          disabled={verificando}
          style={{ gap: 5, borderColor: '#fbbf24', color: '#92400e', background: 'transparent', whiteSpace: 'nowrap' }}
        >
          {verificando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Verificar novamente
        </Button>
      </div>

      {/* Bloco SQL */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={13} style={{ color: '#6b7280' }} />
            <span style={{ fontSize: '.78rem', fontWeight: 600, color: '#374151' }}>
              SQL para executar no Supabase → SQL Editor
            </span>
          </div>
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, padding: '4px 10px', borderRadius: 6,
              border: '1px solid #d1d5db', background: '#fff',
              cursor: 'pointer', color: '#374151', fontWeight: 500,
              transition: 'background .15s',
            }}
          >
            {copied ? <Check size={12} style={{ color: '#16a34a' }} /> : <Copy size={12} />}
            {copied ? 'Copiado!' : 'Copiar SQL'}
          </button>
        </div>

        <pre style={{
          background: '#1e293b', color: '#e2e8f0',
          borderRadius: 8, padding: '12px 14px',
          fontSize: 11, lineHeight: 1.6,
          overflowX: 'auto', margin: 0,
          fontFamily: 'Consolas, "Courier New", monospace',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {SQL_SETUP}
        </pre>

        {temLocal && (
          <div style={{
            marginTop: 12, padding: '10px 14px',
            background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 7, display: 'flex', alignItems: 'center',
            gap: 8, justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
              <span style={{ fontSize: '.78rem', color: '#166534' }}>
                Você tem valores salvos localmente. Após criar a tabela, clique em
                <strong> Migrar para o banco</strong> para enviá-los ao Supabase.
              </span>
            </div>
            <Button
              size="sm"
              onClick={onMigrar}
              style={{ background: '#16a34a', color: '#fff', gap: 5, whiteSpace: 'nowrap', fontSize: 12 }}
            >
              <Database size={12} /> Migrar para o banco
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Aba: Valores Base do Contracheque ─────────────────────────────────────────
function ValoresBaseTab() {
  const [valores, setValores] = useState<Omit<ValoresHora, 'id' | 'updated_at'>>(VALORES_HORA_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [savedIn, setSavedIn] = useState<'supabase' | 'local' | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tabelaOk, setTabelaOk] = useState<boolean | null>(null);
  const [verificando, setVerificando] = useState(false);

  const verificarTabela = async () => {
    setVerificando(true);
    const ok = await checkTabelaExiste();
    setTabelaOk(ok);
    setVerificando(false);
    if (ok) toast.success('Tabela encontrada no banco de dados!');
  };

  useEffect(() => {
    (async () => {
      const [v, ok] = await Promise.all([fetchValoresHora(), checkTabelaExiste()]);
      const { id: _id, updated_at, ...rest } = v;
      setValores(rest);
      if (updated_at) setLastSaved(new Date(updated_at).toLocaleString('pt-BR'));
      setTabelaOk(ok);
      setSavedIn(ok ? 'supabase' : (temDadosLocais() ? 'local' : null));
      setLoading(false);
    })();
  }, []);

  const handleChange = (campo: CategoriaValorHora, raw: string) => {
    const num = parseFloat(raw.replace(',', '.')) || 0;
    setValores(prev => ({ ...prev, [campo]: num }));
    setDirty(true);
  };

  const handleSalvar = async () => {
    setSaving(true);
    const { error, storedIn } = await saveValoresHora(valores);
    setSaving(false);

    if (error) {
      toast.error(`Erro ao salvar: ${error}`);
      return;
    }

    setLastSaved(new Date().toLocaleString('pt-BR'));
    setSavedIn(storedIn);
    setDirty(false);

    if (storedIn === 'supabase') {
      toast.success('Valores salvos no banco de dados!');
    } else {
      toast.warning('Tabela não encontrada — valores salvos localmente neste navegador.');
    }
  };

  const handleMigrar = async () => {
    const { error } = await migrarLocalParaSupabase();
    if (error) {
      toast.error(`Erro ao migrar: ${error}`);
    } else {
      setTabelaOk(true);
      setSavedIn('supabase');
      toast.success('Dados migrados para o banco com sucesso!');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Loader2 size={24} className="animate-spin" style={{ color: '#8a9ab5' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Banner de setup quando tabela não existe */}
      {tabelaOk === false && (
        <SetupBanner
          temLocal={temDadosLocais()}
          onMigrar={handleMigrar}
          onVerificar={verificarTabela}
          verificando={verificando}
        />
      )}

      {/* Badge de status de armazenamento (quando tabela está ok) */}
      {tabelaOk === true && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Database size={14} style={{ color: '#16a34a' }} />
          <span style={{ fontSize: '.78rem', color: '#166534', fontWeight: 500 }}>
            Tabela conectada ao Supabase — valores compartilhados entre todos os administradores.
          </span>
        </div>
      )}

      {/* Aviso informativo */}
      <div style={{
        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
        padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <Info size={16} style={{ color: '#3b82f6', flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: '.82rem', fontWeight: 600, color: '#1e40af', margin: '0 0 2px' }}>
            Como funciona
          </p>
          <p style={{ fontSize: '.78rem', color: '#3b82f6', margin: 0, lineHeight: 1.6 }}>
            Esses valores são usados automaticamente no <strong>Fechamento de Folha</strong>.
            O sistema detecta a categoria de cada cooperado (pelo nome da profissão + turno)
            e calcula: <strong>Valor Bruto = Horas Trabalhadas × Valor/Hora da Categoria</strong>.
            Se a categoria não for identificada, o sistema usa o valor do PDF como fallback.
          </p>
        </div>
      </div>

      {/* Grupos de campos */}
      {GRUPOS.map(grupo => (
        <Card key={grupo.titulo} style={{ border: '1.5px solid #e2e8f0' }}>
          <CardHeader style={{ paddingBottom: 8 }}>
            <CardTitle style={{
              fontSize: '.88rem', color: '#0f2340',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <DollarSign size={15} style={{ color: '#0d9488' }} />
              {grupo.titulo}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: 16,
            }}>
              {grupo.items.map(campo => (
                <div key={campo}>
                  <Label style={{
                    fontSize: 11, color: '#8a9ab5', fontWeight: 600,
                    letterSpacing: '.02em', display: 'block', marginBottom: 5,
                  }}>
                    {CATEGORIAS_LABEL[campo].toUpperCase()}
                  </Label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 10, top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 12, color: '#8a9ab5', fontWeight: 500,
                      pointerEvents: 'none',
                    }}>
                      R$
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={valores[campo] === 0 ? '' : valores[campo]}
                      placeholder="0,00"
                      onChange={e => handleChange(campo, e.target.value)}
                      style={{ paddingLeft: 30, fontSize: 13, fontWeight: 500 }}
                    />
                  </div>
                  {valores[campo] > 0 && (
                    <p style={{ fontSize: 10, color: '#0d9488', margin: '3px 0 0', fontWeight: 500 }}>
                      Ex: 12h × {fmtR$(valores[campo])} = {fmtR$(12 * valores[campo])}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Rodapé com status + botão salvar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 18px', background: '#fff',
        border: '1.5px solid #e2e8f0', borderRadius: 8,
      }}>
        <div>
          {lastSaved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {savedIn === 'supabase'
                ? <Database size={13} style={{ color: '#16a34a' }} />
                : <CheckCircle2 size={13} style={{ color: '#d97706' }} />}
              <span style={{ fontSize: '.78rem', color: '#4a5568' }}>
                Última atualização: <strong>{lastSaved}</strong>
                {savedIn === 'local' && (
                  <span style={{ color: '#d97706', marginLeft: 6 }}>
                    (salvo localmente — execute o SQL para persistir no banco)
                  </span>
                )}
              </span>
            </div>
          )}
          {dirty && (
            <p style={{ fontSize: '.72rem', color: '#d97706', margin: '2px 0 0', fontWeight: 500 }}>
              Alterações pendentes — clique em Salvar para confirmar
            </p>
          )}
        </div>

        <Button
          onClick={handleSalvar}
          disabled={saving || !dirty}
          style={{
            background: dirty ? '#0f2340' : '#e2e8f0',
            color: dirty ? '#fff' : '#8a9ab5',
            gap: 7, transition: 'background .2s',
          }}
        >
          {saving
            ? <Loader2 size={14} className="animate-spin" />
            : <Save size={14} />}
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function ConfiguracoesPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f7f9fc' }}>
      <AdminNav />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* Título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: '#0f2340', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(15,35,64,.18)',
          }}>
            <Settings size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f2340', margin: 0, lineHeight: 1.2 }}>
              Configurações
            </h1>
            <p style={{ fontSize: '.8rem', color: '#8a9ab5', margin: 0 }}>
              Parâmetros globais do sistema CADES Analytics
            </p>
          </div>
        </div>

        <Tabs defaultValue="valores-base">
          <TabsList style={{ marginBottom: 20 }}>
            <TabsTrigger value="valores-base" style={{ gap: 6 }}>
              <DollarSign size={14} />
              Valores Base do Contracheque
            </TabsTrigger>
          </TabsList>

          <TabsContent value="valores-base">
            <ValoresBaseTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
