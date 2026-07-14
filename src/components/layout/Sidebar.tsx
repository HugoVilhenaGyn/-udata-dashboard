'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Lightbulb,
  Building2,
  Star,
  BarChart3,
  FileCode2,
  Settings,
  Zap,
  ChevronRight,
  ChevronLeft,
  Brain,
  Calculator,
  ClipboardList,
  LineChart,
} from 'lucide-react';
import { ROLE_PERMISSIONS } from '@/lib/permissions';
import styles from './Sidebar.module.css';

const navItems = [
  { href: '/', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/copiloto', label: 'Orquestrador IA', icon: Brain },
  { href: '/relatorios', label: 'Relatórios', icon: ClipboardList },
  { href: '/farol', label: 'Farol de Oportunidade', icon: Lightbulb },
  { href: '/inventario', label: 'Inventário', icon: Building2 },
  { href: '/qualidade', label: 'Qualidade de Anúncios', icon: Star },
  { href: '/receita', label: 'Dashboard de Receita', icon: BarChart3 },
  { href: '/destaques', label: 'Gestão de Destaques', icon: Zap },
  { href: '/xml', label: 'Motor de XML', icon: FileCode2 },
  { href: '/avaliacao-admin', label: 'Avaliação Online', icon: Calculator },
  { href: '/informativo-imovel', label: 'Informativo do Imóvel', icon: LineChart },
];

export default function Sidebar({
  collapsed = false,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const [cargo, setCargo] = useState<string | null>(null);

  // Busca só o cargo do usuário logado, pra esconder itens de menu que ele
  // não acessa (evita link que dá em "acesso negado"). O bloqueio de
  // verdade continua no middleware — isso aqui é só apresentação.
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => setCargo(data?.data?.cargo || null))
      .catch(() => setCargo(null));
  }, []);

  const permitidos = cargo ? ROLE_PERMISSIONS[cargo] || [] : null;
  const itensVisiveis = permitidos ? navItems.filter(item => permitidos.includes(item.href)) : navItems;

  const principal = itensVisiveis.filter(i => i.href === '/');
  const analise = itensVisiveis.filter(i => ['/copiloto', '/relatorios', '/farol', '/inventario'].includes(i.href));
  const operacoes = itensVisiveis.filter(i => !principal.includes(i) && !analise.includes(i));

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
      {/* Botão de recolher/expandir menu */}
      {onToggleCollapsed && (
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={onToggleCollapsed}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      )}

      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#6366f1"/>
            <path d="M2 17l10 5 10-5" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
            <path d="M2 12l10 5 10-5" stroke="#818cf8" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className={styles.logoTextWrap}>
          <span className={styles.logoText}>BrokerImobAI</span>
          <span className={styles.logoSub}>Inteligência Imobiliária</span>
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {principal.length > 0 && (
          <div className={styles.navSection}>
            <span className={styles.navSectionLabel}>Principal</span>
            {principal.map(({ href, label, icon: Icon }) => (
              <NavItem key={href} href={href} label={label} icon={Icon} active={pathname === href} collapsed={collapsed} />
            ))}
          </div>
        )}

        {analise.length > 0 && (
          <div className={styles.navSection}>
            <span className={styles.navSectionLabel}>Análise</span>
            {analise.map(({ href, label, icon: Icon }) => (
              <NavItem key={href} href={href} label={label} icon={Icon} active={pathname === href} collapsed={collapsed} />
            ))}
          </div>
        )}

        {operacoes.length > 0 && (
          <div className={styles.navSection}>
            <span className={styles.navSectionLabel}>Operações</span>
            {operacoes.map(({ href, label, icon: Icon }) => (
              <NavItem key={href} href={href} label={label} icon={Icon} active={pathname === href} collapsed={collapsed} />
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className={styles.sidebarFooter}>
        <Link href="/configuracoes/geral" className={styles.settingsLink} title="Configurações">
          <Settings size={16} />
          <span className={styles.settingsLabel}>Configurações</span>
        </Link>
        <div className={styles.planBadge}>
          <div className={styles.planDot} />
          <span className={styles.planLabel}>Enterprise</span>
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  href, label, icon: Icon, active, collapsed,
}: { href: string; label: string; icon: any; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={href}
      className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
      title={collapsed ? label : undefined}
    >
      <Icon size={18} className={styles.navIcon} />
      <span className={styles.navLabel}>{label}</span>
      {active && <ChevronRight size={14} className={styles.navChevron} />}
    </Link>
  );
}
