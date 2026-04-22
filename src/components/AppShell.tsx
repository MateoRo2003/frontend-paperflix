'use client';
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  function toggle() { setCollapsed(prev => !prev); }

  const w = mounted ? (collapsed ? 72 : 320) : 72;

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={mounted && collapsed} onToggle={toggle} />
      <main
        className="flex-1 min-h-screen overflow-y-auto text-[18px] flex flex-col"
        style={{ marginLeft: w, transition: mounted ? 'margin-left 0.25s ease' : 'none' }}
      >
        <div className="flex-1">{children}</div>
        <footer
          className="px-8 py-5 text-sm text-center"
          style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}
        >
          © {new Date().getFullYear()} PaperFlix. Todos los derechos reservados.
        </footer>
      </main>
    </div>
  );
}
