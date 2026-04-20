'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSubjects, getStats } from '@/lib/api';
import { Subject } from '@/types';
import { useDataSync } from '@/hooks/useDataSync';
import {
  Home, Calculator, BookOpen, FlaskConical, Globe,
  Map, Music, Palette, Code2, Wrench, ShieldCheck, HelpCircle
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

export default function Sidebar() {
  const path = usePathname();
  const [subjects, setSubjects]     = useState<Subject[]>([]);
  const [statsMap, setStatsMap]     = useState<Record<string, number>>({});
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
      .catch(() => {
        setStatsLoaded(false);
      });
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useDataSync(fetchAll);

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-[280px] flex flex-col z-30"
      style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 flex items-center border-b" style={{ borderColor: 'var(--border)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="PaperFlix"
          style={{ height: 44, width: 'auto', maxWidth: 200, objectFit: 'contain' }}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <NavItem
          label="Principal"
          href="/"
          icon={Home}
          active={path === '/'}
          enabled
        />

        {subjects.length === 0 ? (
          <div className="space-y-1 pt-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton mx-1 rounded-xl" style={{ height: 60 }} />
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
              />
            );
          })
        )}
      </nav>

      {/* Admin link */}
      <div className="px-3 pb-6 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <Link
          href="/admin"
          className={`nav-item flex items-center gap-3 px-5 py-4 rounded-xl text-base font-medium transition-colors ${
            path.startsWith('/admin') ? 'active text-white' : 'text-[var(--muted)] hover:text-white hover:bg-white/5'
          }`}
        >
          <ShieldCheck size={22} strokeWidth={path.startsWith('/admin') ? 2.5 : 2} />
          <span>Admin</span>
        </Link>
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
}

function NavItem({ label, href, icon: Icon, active, enabled, color }: NavItemProps) {
  const base = 'flex items-center gap-3 px-5 rounded-xl text-base font-medium transition-colors';

  if (!enabled) {
    return (
      <div
        className={`${base} subject-disabled`}
        style={{ height: 60, cursor: 'not-allowed' }}
        title="Sin recursos disponibles"
      >
        <Icon size={22} strokeWidth={2} style={{ opacity: 0.5 }} />
        <span className="flex-1 truncate">{label}</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full shrink-0"
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
        height: 60,
        ...(active && color ? { borderLeft: `3px solid ${color}` } : {}),
      }}
    >
      <Icon
        size={22}
        strokeWidth={active ? 2.5 : 2}
        style={active && color ? { color } : undefined}
      />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}