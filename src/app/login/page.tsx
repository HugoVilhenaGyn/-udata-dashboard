'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, RefreshCw, AlertCircle, Eye, EyeOff, Shield } from 'lucide-react';
import styles from './page.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Erro ao realizar login.');
      }

      // Sucesso: recarregar e redirecionar para a home
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Credenciais inválidas.');
    } finally {
      setLoading(false);
    }
  };

  // Preencher credenciais de teste rapidamente
  const preencherCredenciais = (testEmail: string, testPass: string) => {
    setEmail(testEmail);
    setPassword(testPass);
    setError('');
  };

  return (
    <div className={styles.container}>
      {/* Background radial glow */}
      <div className={styles.glow} />

      <div className={styles.loginBox}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#6366f1"/>
              <path d="M2 17l10 5 10-5" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
              <path d="M2 12l10 5 10-5" stroke="#818cf8" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className={styles.logoText}>UDATA</h1>
            <p className={styles.logoSub}>Inteligência Imobiliária</p>
          </div>
        </div>

        <h2 className={styles.title}>Acessar Plataforma</h2>
        <p className={styles.subtitle}>Digite suas credenciais corporativas</p>

        {error && (
          <div className={styles.errorAlert}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className={styles.form}>
          {/* Email */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>Email Corporativo</label>
            <div className={styles.inputWrapper}>
              <Mail size={15} className={styles.inputIcon} />
              <input
                type="email"
                placeholder="nome@udata.com"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Senha */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>Senha de Acesso</label>
            <div className={styles.inputWrapper}>
              <Lock size={15} className={styles.inputIcon} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className={styles.showPassBtn}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw size={15} className={styles.spin} /> Autenticando...
              </>
            ) : (
              'Entrar no Painel'
            )}
          </button>
        </form>

        {/* Demo Credentials Picker */}
        <div className={styles.demoSection}>
          <div className={styles.demoTitle}>
            <Shield size={12} />
            Escolha uma Persona de Teste:
          </div>
          <div className={styles.demoBtns}>
            <button
              onClick={() => preencherCredenciais('admin@udata.com', 'admin123')}
              className={styles.demoBtn}
            >
              👑 Admin (Total)
            </button>
            <button
              onClick={() => preencherCredenciais('corretor@udata.com', 'corretor123')}
              className={styles.demoBtn}
            >
              👤 Broker (Corretor)
            </button>
            <button
              onClick={() => preencherCredenciais('marketing@udata.com', 'marketing123')}
              className={styles.demoBtn}
            >
              📣 Growth (Marketing)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
