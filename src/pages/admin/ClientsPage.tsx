import { useState, useEffect } from 'react';
import { Plus, Trash2, Send, Loader2, Phone, Mail, Building2, KeyRound, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdminNav } from '@/components/AdminNav';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { useAuth } from '@/contexts/AuthContext';
import type { Client } from '@/types/database';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  // Dialog: novo cliente
  const [newOpen, setNewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', username: '', email: '', phone: '', password: '', confirm: '' });

  // Dialog: definir acesso (cliente existente)
  const [accessTarget, setAccessTarget] = useState<Client | null>(null);
  const [accessForm, setAccessForm] = useState({ username: '', password: '', confirm: '' });
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessDone, setAccessDone] = useState(false);

  const [inviting, setInviting] = useState<string | null>(null);

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('clients').select('*').order('name');
    if (error) toast.error('Erro ao carregar clientes.');
    setClients(data ?? []);
    setLoading(false);
  };

  // ── Criar novo cliente com login ──────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, username, email, phone, password, confirm } = newForm;
    if (!name.trim() || !username.trim() || !email.trim()) return;

    if (password && password !== confirm) {
      toast.error('As senhas não coincidem.');
      return;
    }
    if (password && password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setSaving(true);
    try {
      // 1. Criar registro do cliente
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .insert({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || null, created_by: user?.id })
        .select().single();
      if (clientError) throw clientError;

      // 2. Salvar username → email
      const { error: loginError } = await supabase
        .from('user_logins')
        .insert({ username: username.trim().toLowerCase(), email: email.trim().toLowerCase() });
      if (loginError) {
        await supabase.from('clients').delete().eq('id', clientData.id);
        throw new Error(loginError.code === '23505' ? 'Este usuário já está em uso.' : loginError.message);
      }

      // 3. Criar conta Supabase Auth se senha foi informada
      if (password) {
        const emailLower = email.trim().toLowerCase();

        // Verificar se o usuário já existe
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === emailLower);

        if (existingUser) {
          // Atualizar senha do usuário existente
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            existingUser.id,
            { password, email_confirm: true }
          );
          if (updateError) toast.error(`Conta criada, mas erro ao definir senha: ${updateError.message}`);
        } else {
          // Criar novo usuário com e-mail já confirmado
          const { error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: emailLower,
            password,
            email_confirm: true,
          });
          if (createError) toast.error(`Conta criada, mas erro ao definir senha: ${createError.message}`);
        }
      }

      toast.success('Cliente cadastrado com sucesso!');
      setNewForm({ name: '', username: '', email: '', phone: '', password: '', confirm: '' });
      setNewOpen(false);
      loadClients();
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao cadastrar cliente.');
    } finally {
      setSaving(false);
    }
  };

  // ── Definir acesso para cliente existente ─────────────────────────────────
  const handleSetAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessTarget) return;
    const { username, password, confirm } = accessForm;

    if (!username.trim()) { toast.error('Informe o usuário.'); return; }
    if (!password) { toast.error('Informe a senha.'); return; }
    if (password.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (password !== confirm) { toast.error('As senhas não coincidem.'); return; }

    setAccessSaving(true);
    try {
      const emailLower = accessTarget.email.toLowerCase();

      // 1. Verificar se usuário já existe no Auth
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === emailLower);

      if (existingUser) {
        // Atualizar senha + confirmar e-mail
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          { password, email_confirm: true }
        );
        if (error) throw error;
      } else {
        // Criar novo usuário com e-mail já confirmado
        const { error } = await supabaseAdmin.auth.admin.createUser({
          email: emailLower,
          password,
          email_confirm: true,
        });
        if (error) throw error;
      }

      // 2. Inserir ou atualizar user_logins
      const { error: upsertError } = await supabase
        .from('user_logins')
        .upsert(
          { username: username.trim().toLowerCase(), email: emailLower },
          { onConflict: 'email' }
        );
      if (upsertError) throw upsertError;

      setAccessDone(true);
    } catch (err: any) {
      toast.error(err.message ?? 'Erro ao definir acesso.');
    } finally {
      setAccessSaving(false);
    }
  };

  const openAccessDialog = (client: Client) => {
    setAccessTarget(client);
    setAccessForm({ username: '', password: '', confirm: '' });
    setAccessDone(false);
  };

  // ── Excluir cliente ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from('user_logins').delete().eq('email', deleteTarget.email);
    const { error } = await supabase.from('clients').delete().eq('id', deleteTarget.id);
    if (error) toast.error('Erro ao excluir cliente.');
    else { toast.success('Cliente excluído.'); loadClients(); }
    setDeleteTarget(null);
  };

  // ── Enviar magic link ─────────────────────────────────────────────────────
  const handleSendInvite = async (client: Client) => {
    setInviting(client.id);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: client.email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      toast.success(`Link de acesso enviado para ${client.email}`);
    } catch (err: any) {
      toast.error(`Erro ao enviar: ${err.message}`);
    } finally {
      setInviting(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground">Hospitais e clínicas cadastrados</p>
          </div>

          {/* Botão + Dialog: Novo cliente */}
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> Novo cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Cadastrar cliente</DialogTitle>
                <DialogDescription className="text-xs">
                  Preencha os dados do cliente. A senha é opcional — se não informar, envie o link de acesso depois.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Nome da instituição</Label>
                  <Input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Hospital São Lucas" required className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Usuário (para login)</Label>
                  <Input value={newForm.username} onChange={e => setNewForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="hospital.saolucas" required autoCapitalize="none" autoCorrect="off" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">E-mail</Label>
                  <Input type="email" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="contato@hospital.com" required className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Telefone (opcional)</Label>
                  <Input value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(27) 99999-9999" className="h-9 text-sm" />
                </div>
                <div className="border-t border-border/60 pt-3 space-y-3">
                  <p className="text-xs font-medium text-foreground">Senha de acesso (opcional)</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Senha</Label>
                    <Input type="password" value={newForm.password} onChange={e => setNewForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="mínimo 6 caracteres" autoComplete="new-password" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Confirmar senha</Label>
                    <Input type="password" value={newForm.confirm} onChange={e => setNewForm(f => ({ ...f, confirm: e.target.value }))}
                      placeholder="repita a senha" autoComplete="new-password" className="h-9 text-sm" />
                  </div>
                </div>
                <DialogFooter className="pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setNewOpen(false)}>Cancelar</Button>
                  <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Cadastrar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de clientes */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : clients.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Building2 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {clients.map(client => (
              <Card key={client.id} className="border-border/60">
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" /> {client.email}
                        </span>
                        {client.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" /> {client.phone}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Cadastrado em {format(new Date(client.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-4 flex-wrap justify-end">
                    <Button variant="outline" size="sm" onClick={() => openAccessDialog(client)}
                      className="gap-1.5 text-xs">
                      <KeyRound className="w-3.5 h-3.5" /> Definir acesso
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleSendInvite(client)}
                      disabled={inviting === client.id} className="gap-1.5 text-xs">
                      {inviting === client.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Enviar link
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(client)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Dialog: Definir acesso para cliente existente */}
      <Dialog open={!!accessTarget} onOpenChange={v => !v && setAccessTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Definir acesso</DialogTitle>
            <DialogDescription className="text-xs">
              {accessTarget?.name} — defina o usuário e senha para acesso ao portal.
            </DialogDescription>
          </DialogHeader>

          {accessDone ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-foreground">Acesso criado!</p>
                <p className="text-xs text-muted-foreground">
                  O cliente pode fazer login com o usuário <strong>{accessForm.username}</strong> e a senha definida.
                </p>
              </div>
              <Button size="sm" onClick={() => setAccessTarget(null)} className="mt-2">Fechar</Button>
            </div>
          ) : (
            <form onSubmit={handleSetAccess} className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Usuário (para login)</Label>
                <Input value={accessForm.username}
                  onChange={e => setAccessForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="hospital.saolucas" required autoCapitalize="none" autoCorrect="off"
                  className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Senha</Label>
                <Input type="password" value={accessForm.password}
                  onChange={e => setAccessForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="mínimo 6 caracteres" required autoComplete="new-password"
                  className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Confirmar senha</Label>
                <Input type="password" value={accessForm.confirm}
                  onChange={e => setAccessForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="repita a senha" required autoComplete="new-password"
                  className="h-9 text-sm" />
              </div>
              <DialogFooter className="pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setAccessTarget(null)}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={accessSaving} className="gap-1.5">
                  {accessSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Salvar acesso
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso excluirá <strong>{deleteTarget?.name}</strong>, todos os relatórios e o acesso de login. Ação irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
