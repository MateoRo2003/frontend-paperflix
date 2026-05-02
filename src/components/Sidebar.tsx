'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSubjects, getStats } from '@/lib/api';
import { Subject } from '@/types';
import { useDataSync } from '@/hooks/useDataSync';
import { Home, ChevronLeft, ChevronRight } from 'lucide-react';
import { SubjectIcon } from '@/components/SubjectIcon';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  isMobile?: boolean;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen = false, isMobile = false }: SidebarProps) {
  const path = usePathname();
  const [subjects, setSubjects]       = useState<Subject[]>([]);
  const [statsMap, setStatsMap]       = useState<Record<string, number>>({});
  const [statsLoaded, setStatsLoaded] = useState(false);

  const fetchAll = useCallback(() => {
    getSubjects()
      .then(setSubjects)
      .catch(() => {});

    getStats()
      .then((raw) => {
        const list: { slug: string; count: string | number }[] =
          raw?.bySubject ?? (Array.isArray(raw) ? raw : []);
        const map: Record<string, number> = {};
        list.forEach((s) => {
          if (s.slug) map[s.slug] = typeof s.count === 'string' ? parseInt(s.count, 10) : s.count;
        });
        setStatsMap(map);
        setStatsLoaded(true);
      })
      .catch(() => setStatsLoaded(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useDataSync(fetchAll);

  const w = isMobile ? 280 : (collapsed ? 68 : 268);

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col"
      style={{
        width: w,
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--border)',
        transition: isMobile ? 'transform 0.25s ease' : 'width 0.25s ease',
        transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        overflow: 'hidden',
        zIndex: isMobile ? 40 : 30,
      }}
    >
      {/* Logo + toggle */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: 76,
          padding: collapsed ? '0' : '0 20px',
          justifyContent: 'center',
          transition: 'padding 0.25s ease',
        }}
      >
        {!collapsed && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src="/logo.png"
            alt="PaperFlix"
            style={{ height: 48, width: 'auto', maxWidth: 180, objectFit: 'contain' }}
          />
        )}
        {collapsed && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src="/image.png" alt="PaperFlix" style={{ width: 46, height: 46, objectFit: 'contain' }} />
        )}
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav flex-1 overflow-y-auto overflow-x-hidden py-3" style={{ padding: collapsed ? '10px 8px' : '10px 10px' }}>
        <NavItem
          label="Principal"
          href="/"
          icon={Home}
          active={path === '/'}
          enabled
          collapsed={collapsed}
        />

        {subjects.length === 0 ? (
          <div className="space-y-1 pt-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="skeleton mx-1 rounded-xl"
                style={{ height: 50, width: collapsed ? 52 : undefined }}
              />
            ))}
          </div>
        ) : (
          subjects.map((s) => {
            const count = statsMap[s.slug] ?? 0;
            const enabled = !statsLoaded || count > 0;
            const active  = path === `/${s.slug}` || path.startsWith(`/${s.slug}/`);
            return (
              <NavItem
                key={s.id}
                label={s.name}
                href={`/${s.slug}`}
                iconString={s.icon}
                active={active}
                enabled={enabled}
                color={s.color}
                collapsed={collapsed}
              />
            );
          })
        )}
      </nav>

      {/* Toggle button — siempre abajo */}
      <div className="shrink-0 flex justify-center pb-3">
        <button
          onClick={onToggle}
          title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          className="rounded-xl flex items-center justify-center transition-all hover:brightness-110 active:scale-95"
          style={{
            width: 60,
            height: 40,
            background: 'rgba(124,58,237,0.18)',
            border: '1px solid rgba(124,58,237,0.35)',
            color: '#c4b5fd',
          }}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
    </aside>
  );
}

interface NavItemProps {
  label: string;
  href: string;
  icon?: React.ElementType;
  iconString?: string;
  active: boolean;
  enabled: boolean;
  color?: string;
  collapsed: boolean;
}

function NavItem({ label, href, icon: Icon, iconString, active, enabled, color, collapsed }: NavItemProps) {
  const [hovered, setHovered] = useState(false);
  const showColor = color && (active || hovered);

  const iconColor = showColor ? color! : 'var(--muted)';

  const renderIcon = (size: number, sw: number) => {
    if (iconString) {
      return <SubjectIcon icon={iconString} color={iconColor} size={size} fallback={label.charAt(0)} />;
    }
    if (Icon) return <Icon size={size} strokeWidth={sw} color={iconColor} />;
    return null;
  };

  if (collapsed) {
    const style: React.CSSProperties = {
      width: 52,
      height: 50,
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      transition: 'background 0.15s, border-color 0.15s',
      ...(showColor ? { borderLeft: `3px solid ${color}`, background: `${color}28` } : {}),
      ...(!showColor && active ? { background: 'rgba(124,58,237,0.2)' } : {}),
    };

    if (!enabled) {
      return (
        <div title={label} style={{ ...style, opacity: 0.3, cursor: 'not-allowed', marginBottom: 2 }}>
          {renderIcon(24, 2)}
        </div>
      );
    }

    return (
      <Link
        href={href}
        title={label}
        className="block mb-0.5"
        style={{ ...style, color: showColor ? color : undefined }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {renderIcon(24, active || hovered ? 2.5 : 2)}
      </Link>
    );
  }

  const base = 'flex items-center gap-3 px-4 rounded-xl text-[0.8125rem] font-medium';

  if (!enabled) {
    return (
      <div
        className={`${base} subject-disabled`}
        style={{ minHeight: 50, cursor: 'not-allowed', paddingTop: 9, paddingBottom: 9 }}
        title="Sin recursos disponibles"
      >
        <span className="shrink-0" style={{ opacity: 0.5 }}>{renderIcon(22, 2)}</span>
        <span className="flex-1 truncate min-w-0">{label}</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`nav-item ${base} ${active ? 'active text-white' : 'text-[var(--muted)]'}`}
      style={{
        minHeight: 50,
        paddingTop: 9,
        paddingBottom: 9,
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        borderLeft: showColor ? `3px solid ${color}` : undefined,
        background: hovered && !active && color ? `${color}18` : undefined,
        color: hovered && !active ? (color || 'white') : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="shrink-0">{renderIcon(22, active || hovered ? 2.5 : 2)}</span>
      <span className="flex-1 truncate min-w-0">{label}</span>
    </Link>
  );
}
