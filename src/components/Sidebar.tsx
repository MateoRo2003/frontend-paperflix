'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSubjects, getStats } from '@/lib/api';
import { Subject } from '@/types';
import { useDataSync } from '@/hooks/useDataSync';
import {
  Home, Calculator, BookOpen, FlaskConical, Globe,
  Map, Music, Palette, Code2, Wrench, ShieldCheck, HelpCircle,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  matematicas:            Calculator,
  lenguaje:               BookOpen,
  ciencias:               FlaskConical,
  'ciencias-naturales':   FlaskConical,
  historia:               Map,
  'historia-y-geografia': Map,
  ingles:                 Globe,
  musica:                 Music,
  artes:                  Palette,
  tecnologia:             Code2,
  herramientas:           Wrench,
  'super-herramientas':   Wrench,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
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

  const w = collapsed ? 72 : 320;

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-30"
      style={{
        width: w,
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--border)',
        transition: 'width 0.25s ease',
        overflow: 'hidden',
      }}
    >
      {/* Logo + toggle */}
      <div
        className="flex items-center border-b shrink-0"
        style={{
          borderColor: 'var(--border)',
          height: 76,
          padding: collapsed ? '0 12px' : '0 20px',
          justifyContent: collapsed ? 'center' : 'space-between',
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
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg"
            style={{ background: 'rgba(124,58,237,0.25)', color: '#c4b5fd' }}
          >
            P
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onToggle}
            title="Colapsar sidebar"
            className="rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
            style={{ width: 36, height: 36, color: 'var(--muted)' }}
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3" style={{ padding: collapsed ? '12px 8px' : '12px 10px' }}>
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
                style={{ height: 60, width: collapsed ? 52 : undefined }}
              />
            ))}
          </div>
        ) : (
          subjects.map((s) => {
            const Icon = ICON_MAP[s.slug] || HelpCircle;
            const count = statsMap[s.slug] ?? 0;
            const enabled = !statsLoaded || count > 0;
            const active  = path === `/${s.slug}` || path.startsWith(`/${s.slug}/`);
            return (
              <NavItem
                key={s.id}
                label={s.name}
                href={`/${s.slug}`}
                icon={Icon}
                active={active}
                enabled={enabled}
                color={s.color}
                collapsed={collapsed}
              />
            );
          })
        )}
      </nav>

      {/* Admin link + expand button */}
      <div
        className="border-t shrink-0"
        style={{
          borderColor: 'var(--border)',
          padding: collapsed ? '12px 8px' : '12px 10px',
        }}
      >
        {collapsed ? (
          <div className="flex flex-col gap-2 items-center">
            <Link
              href="/admin"
              title="Admin"
              className="nav-item flex items-center justify-center rounded-xl transition-colors"
              style={{
                width: 52, height: 52,
                background: path.startsWith('/admin') ? 'rgba(124,58,237,0.25)' : 'transparent',
                color: path.startsWith('/admin') ? '#fff' : 'var(--muted)',
              }}
            >
              <ShieldCheck size={22} strokeWidth={path.startsWith('/admin') ? 2.5 : 2} />
            </Link>
            <button
              onClick={onToggle}
              title="Expandir sidebar"
              className="rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors"
              style={{ width: 52, height: 44, color: 'var(--muted)' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <Link
            href="/admin"
            className={`nav-item flex items-center gap-3 px-5 rounded-xl text-lg font-medium transition-colors ${
              path.startsWith('/admin') ? 'active text-white' : 'text-[var(--muted)] hover:text-white hover:bg-white/5'
            }`}
          >
            <ShieldCheck size={26} strokeWidth={path.startsWith('/admin') ? 2.5 : 2} />
            <span>Admin</span>
          </Link>
        )}
      </div>
    </aside>
  );
}

interface NavItemProps {
  label: string;
  href: string;
  icon: React.ElementType;
  active: boolean;
  enabled: boolean;
  color?: string;
  collapsed: boolean;
}

function NavItem({ label, href, icon: Icon, active, enabled, color, collapsed }: NavItemProps) {
  if (collapsed) {
    const style: React.CSSProperties = {
      width: 52,
      height: 52,
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      transition: 'background 0.15s',
      ...(active && color ? { borderLeft: `3px solid ${color}`, background: 'rgba(124,58,237,0.2)' } : {}),
      ...(active && !color ? { background: 'rgba(124,58,237,0.2)' } : {}),
    };

    if (!enabled) {
      return (
        <div title={label} style={{ ...style, opacity: 0.3, cursor: 'not-allowed', marginBottom: 4 }}>
          <Icon size={22} strokeWidth={2} />
        </div>
      );
    }

    return (
      <Link
        href={href}
        title={label}
        className={`block mb-1 hover:bg-white/8 ${active ? 'text-white' : 'text-[var(--muted)] hover:text-white'}`}
        style={style}
      >
        <Icon
          size={22}
          strokeWidth={active ? 2.5 : 2}
          style={active && color ? { color } : undefined}
        />
      </Link>
    );
  }

  const base = 'flex items-center gap-4 px-5 rounded-xl text-lg font-medium transition-colors';

  if (!enabled) {
    return (
      <div
        className={`${base} subject-disabled`}
        style={{ height: 64, cursor: 'not-allowed' }}
        title="Sin recursos disponibles"
      >
        <Icon size={24} strokeWidth={2} style={{ opacity: 0.5 }} />
        <span className="flex-1 truncate">{label}</span>
        <span
          className="text-sm px-2 py-0.5 rounded-full shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}
        >
          0
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`nav-item ${base} ${
        active ? 'active text-white' : 'text-[var(--muted)] hover:text-white hover:bg-white/5'
      }`}
      style={{
        height: 64,
        ...(active && color ? { borderLeft: `3px solid ${color}` } : {}),
      }}
    >
      <Icon
        size={24}
        strokeWidth={active ? 2.5 : 2}
        style={active && color ? { color } : undefined}
      />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}
