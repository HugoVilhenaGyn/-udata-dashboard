'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, ChevronDown, LogOut, Shield } from 'lucide-react';
import { mockImobiliaria } from '@/lib/mock-data';
import { UserSession } from '@/lib/auth-service';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Buscar sessão atual do usuário
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setUser(data.data);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados do usuário logado:', error);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (error) {
      console.error('Erro ao deslogar:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const translateCargo = (cargo: string) => {
    if (cargo === 'ADMIN') return 'Administrador';
    if (cargo === 'CORRETOR') return 'Corretor (Broker)';
    if (cargo === 'MARKETING') return 'Growth / Marketing';
    return cargo;
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>

      <div className={styles.right}>
        {/* Search */}
        <div className={styles.searchBox}>
          <Search size={15} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Buscar imóvel, bairro..."
            className={styles.searchInput}
          />
          <kbd className={styles.searchKbd}>⌘K</kbd>
        </div>

        {/* Period selector */}
        <button className={styles.periodBtn}>
          <span>Julho 2026</span>
          <ChevronDown size={14} />
        </button>

        {/* Notifications */}
        <button className={styles.iconBtn} data-tooltip="Notificações">
          <Bell size={18} />
          <span className={styles.notificationDot} />
        </button>

        {/* Avatar & Dropdown */}
        <div style={{ position: 'relative' }}>
          <button className={styles.avatar} onClick={() => setDropdownOpen(!dropdownOpen)}>
            <div className={styles.avatarInner}>
              {user ? getInitials(user.nome) : 'GI'}
            </div>
            <div className={styles.avatarInfo}>
              <span className={styles.avatarName}>{user ? user.nome : mockImobiliaria.nome}</span>
              <span className={styles.avatarPlan}>{user ? translateCargo(user.cargo) : mockImobiliaria.plano}</span>
            </div>
            <ChevronDown size={14} className={styles.avatarChevron} />
          </button>

          {dropdownOpen && (
            <div className={styles.dropdownMenu}>
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownUserEmail}>{user?.email}</span>
                <span className={styles.dropdownImob}>{user?.imobiliariaNome}</span>
              </div>
              <div className={styles.dropdownDivider} />
              <button onClick={handleLogout} className={styles.dropdownItem}>
                <LogOut size={14} />
                <span>Encerrar Sessão</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
