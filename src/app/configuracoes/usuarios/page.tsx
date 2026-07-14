'use client';

import { useState, useEffect } from 'react';
import { Plus, Loader2, KeyRound, UserX, UserCheck, Trash2, X, Save } from 'lucide-react';
import styles from './page.module.css';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  cargo: 'ADMIN' | 'CORRETOR' | 'MARKETING';
  ativo: boolean;
  criado_em?: string;
}

const CARGO_LABEL: Record<Usuario['cargo'], string> = {
  ADMIN: 'Administrador',
  CORRETOR: 'Corretor',
  MARKETING: 'Marketing',
};

function gerarSenhaAleatoria(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function ConfiguracoesUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const [modalNovo, setModalNovo] = useState(false);
  const [modalSenhaId, setModalSenhaId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formCargo, setFormCargo] = useState<Usuario['cargo']>('CORRETOR');
  const [formSenha, setFormSenha] = useState(gerarSenhaAleatoria());

  const carregar = () => {
    setCarregando(true);
    Promise.all([
      fetch('/api/usuarios').then(r => r.json()),
      fetch('/api/auth/me').then(r => r.json()),
    ])
      .then(([usuariosJson, meJson]) => {
        if (usuariosJson.success) setUsuarios(usuariosJson.data);
        if (meJson?.data?.id) setMeuId(meJson.data.id);
      })
      .finally(() => setCarregando(false));
  };

  useEffect(carregar, []);

  const mostrarAviso = (tipo: 'ok' | 'erro', texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4500);
  };

  const abrirModalNovo = () => {
    setFormNome('');
    setFormEmail('');
    setFormCargo('CORRETOR');
    setFormSenha(gerarSenhaAleatoria());
    setModalNovo(true);
  };

  const criarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: formNome, email: formEmail, cargo: formCargo, senha: formSenha }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setModalNovo(false);
      carregar();
      mostrarAviso('ok', `Usuário ${formNome} criado. Anote a senha "${formSenha}" e repasse pra pessoa com segurança — ela não vai aparecer de novo.`);
    } catch (err: any) {
      mostrarAviso('erro', err.message || 'Erro ao criar usuário.');
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (u: Usuario) => {
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !u.ativo }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      carregar();
      mostrarAviso('ok', u.ativo ? `${u.nome} desativado.` : `${u.nome} reativado.`);
    } catch (err: any) {
      mostrarAviso('erro', err.message || 'Erro ao atualizar usuário.');
    }
  };

  const excluirUsuario = async (u: Usuario) => {
    if (!confirm(`Excluir o usuário ${u.nome} (${u.email}) permanentemente?`)) return;
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      carregar();
      mostrarAviso('ok', `${u.nome} excluído.`);
    } catch (err: any) {
      mostrarAviso('erro', err.message || 'Erro ao excluir usuário.');
    }
  };

  const alterarCargo = async (u: Usuario, cargo: Usuario['cargo']) => {
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cargo }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      carregar();
    } catch (err: any) {
      mostrarAviso('erro', err.message || 'Erro ao alterar cargo.');
      carregar();
    }
  };

  const [novaSenha, setNovaSenha] = useState('');
  const abrirModalSenha = (id: string) => {
    setNovaSenha(gerarSenhaAleatoria());
    setModalSenhaId(id);
  };

  const redefinirSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSenhaId) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/usuarios/${modalSenhaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha: novaSenha }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      const u = usuarios.find(x => x.id === modalSenhaId);
      setModalSenhaId(null);
      mostrarAviso('ok', `Senha de ${u?.nome || 'usuário'} redefinida para "${novaSenha}". Repasse com segurança — não vai aparecer de novo.`);
    } catch (err: any) {
      mostrarAviso('erro', err.message || 'Erro ao redefinir senha.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      {aviso && (
        <div className={aviso.tipo === 'ok' ? styles.avisoOk : styles.avisoErro}>{aviso.texto}</div>
      )}

      <div className="card">
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionTitle}>Usuários com acesso à plataforma</div>
            <div className={styles.sectionSub}>
              Crie um acesso individual pra cada pessoa da equipe — evite compartilhar login. Cada usuário tem sua própria senha e cargo.
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={abrirModalNovo} style={{ gap: 6 }}>
            <Plus size={14} /> Novo usuário
          </button>
        </div>

        {carregando ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={16} className={styles.spin} /> Carregando...
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Cargo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {u.nome} {u.id === meuId && <span className={styles.voceTag}>você</span>}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</td>
                    <td>
                      <select
                        className="input"
                        style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                        value={u.cargo}
                        onChange={e => alterarCargo(u, e.target.value as Usuario['cargo'])}
                      >
                        {Object.entries(CARGO_LABEL).map(([valor, label]) => (
                          <option key={valor} value={valor}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={u.ativo ? styles.statusAtivo : styles.statusInativo}>
                        {u.ativo ? 'Ativo' : 'Desativado'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className={styles.iconBtn} title="Redefinir senha" onClick={() => abrirModalSenha(u.id)}>
                          <KeyRound size={14} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title={u.ativo ? 'Desativar acesso' : 'Reativar acesso'}
                          onClick={() => alternarAtivo(u)}
                          disabled={u.id === meuId}
                        >
                          {u.ativo ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtnDanger}
                          title="Excluir usuário"
                          onClick={() => excluirUsuario(u)}
                          disabled={u.id === meuId}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalNovo && (
        <div className={styles.modalOverlay} onClick={() => setModalNovo(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>Novo usuário</span>
              <button type="button" onClick={() => setModalNovo(false)}><X size={16} /></button>
            </div>
            <form onSubmit={criarUsuario} className={styles.modalForm}>
              <label>Nome completo</label>
              <input className="input" required value={formNome} onChange={e => setFormNome(e.target.value)} />

              <label>Email de acesso</label>
              <input className="input" type="email" required value={formEmail} onChange={e => setFormEmail(e.target.value)} />

              <label>Cargo</label>
              <select className="input" value={formCargo} onChange={e => setFormCargo(e.target.value as Usuario['cargo'])}>
                {Object.entries(CARGO_LABEL).map(([valor, label]) => (
                  <option key={valor} value={valor}>{label}</option>
                ))}
              </select>

              <label>Senha inicial</label>
              <div className={styles.senhaRow}>
                <input className="input" required minLength={8} value={formSenha} onChange={e => setFormSenha(e.target.value)} />
                <button type="button" className="btn btn-secondary" onClick={() => setFormSenha(gerarSenhaAleatoria())}>Gerar</button>
              </div>
              <div className={styles.dica}>Anote essa senha agora — depois de criar, ela não aparece mais. Repasse pra pessoa por um canal seguro.</div>

              <button type="submit" className="btn btn-primary" disabled={salvando} style={{ marginTop: 8, gap: 6 }}>
                {salvando ? <Loader2 size={14} className={styles.spin} /> : <Save size={14} />}
                {salvando ? 'Criando...' : 'Criar usuário'}
              </button>
            </form>
          </div>
        </div>
      )}

      {modalSenhaId && (
        <div className={styles.modalOverlay} onClick={() => setModalSenhaId(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span>Redefinir senha</span>
              <button type="button" onClick={() => setModalSenhaId(null)}><X size={16} /></button>
            </div>
            <form onSubmit={redefinirSenha} className={styles.modalForm}>
              <label>Nova senha</label>
              <div className={styles.senhaRow}>
                <input className="input" required minLength={8} value={novaSenha} onChange={e => setNovaSenha(e.target.value)} />
                <button type="button" className="btn btn-secondary" onClick={() => setNovaSenha(gerarSenhaAleatoria())}>Gerar</button>
              </div>
              <div className={styles.dica}>Anote essa senha agora — depois de salvar, ela não aparece mais.</div>

              <button type="submit" className="btn btn-primary" disabled={salvando} style={{ marginTop: 8, gap: 6 }}>
                {salvando ? <Loader2 size={14} className={styles.spin} /> : <Save size={14} />}
                {salvando ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
