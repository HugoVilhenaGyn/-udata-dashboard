'use client';

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
  Brain,
} from 'lucide-react';
import styles from './Sidebar.module.css';

const navItems = [
  { href: '/', label: 'Visão Geral', icon: LayoutDashboard },
  { href: '/copiloto', label: 'Orquestrador IA', icon: Brain },
  { href: '/farol', label: 'Farol de Oportunidade', icon: Lightbulb },
  { href: '/inventario', label: 'Inventário', icon: Building2 },
  { href: '/qualidade', label: 'Qualidade de Anúncios', icon: Star },
  { href: '/receita', label: 'Dashboard de Receita', icon: BarChart3 },
  { href: '/destaques', label: 'Gestão de Destaques', icon: Zap },
  { href: '/xml', label: 'Motor de XML', icon: FileCode2 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#6366f1"/>
            <path d="M2 17l10 5 10-5" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
            <path d="M2 12l10 5 10-5" stroke="#818cf8" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <span className={styles.logoText}>UDATA</span>
          <span className={styles.logoSub}>Inteligência Imobiliária</span>
        </div>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navSection}>
          <span className={styles.navSectionLabel}>Principal</span>
          {navItems.slice(0, 1).map(({ href, label, icon: Icon }) => (
            <NavItem key={href} href={href} label={label} icon={Icon} active={pathname === href} />
          ))}
        </div>

        <div className={styles.navSection}>
          <span className={styles.navSectionLabel}>Análise</span>
          {navItems.slice(1, 4).map(({ href, label, icon: Icon }) => (
            <NavItem key={href} href={href} label={label} icon={Icon} active={pathname === href} />
          ))}
        </div>

        <div className={styles.navSection}>
          <span className={styles.navSectionLabel}>Operações</span>
          {navItems.slice(4).map(({ href, label, icon: Icon }) => (
            <NavItem key={href} href={href} label={label} icon={Icon} active={pathname === href} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className={styles.sidebarFooter}>
        <Link href="/configuracoes" className={styles.settingsLink}>
          <Settings size={16} />
          <span>Configurações</span>
        </Link>
        <div className={styles.planBadge}>
          <div className={styles.planDot} />
          <span>Enterprise</span>
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  href, label, icon: Icon, active,
}: { href: string; label: string; icon: any; active: boolean }) {
  return (
    <Link href={href} className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}>
      <Icon size={18} className={styles.navIcon} />
      <span className={styles.navLabel}>{label}</span>
      {active && <ChevronRight size={14} className={styles.navChevron} />}
    </Link>
  );
}
