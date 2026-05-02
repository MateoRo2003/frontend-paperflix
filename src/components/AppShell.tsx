'use client';
import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed]     = useState(true);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [isMobile, setIsMobile]       = useState(false);
  const [mounted, setMounted]         = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    setMounted(true);
    return () => window.removeEventListener('resize', check);
  }, []);

  const w = mounted && !isMobile ? (collapsed ? 68 : 268) : 0;

  return (
    <div className="flex min-h-screen">

      {/* Backdrop móvil */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[35]"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={isMobile ? false : (mounted && collapsed)}
        onToggle={isMobile ? () => setMobileOpen(p => !p) : () => setCollapsed(p => !p)}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
      />

      <main
        className="flex-1 min-h-screen overflow-y-auto flex flex-col"
        style={{
          marginLeft: w,
          transition: mounted ? 'margin-left 0.25s ease' : 'none',
          fontSize: '16px',
        }}
      >
        {/* Top bar móvil */}
        {mounted && isMobile && (
          <div
            className="sticky top-0 z-20 flex items-center gap-3 px-4 shrink-0"
            style={{ height: 56, background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}
          >
            <button
              onClick={() => setMobileOpen(p => !p)}
              className="flex items-center justify-center rounded-xl"
              style={{ width: 40, height: 40, color: 'var(--muted)' }}
            >
              <Menu size={22} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="PaperFlix" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
          </div>
        )}

        <div className="flex-1 flex flex-col">{children}</div>

        <footer
          className="px-6 py-4 text-sm text-center flex items-center justify-center gap-2 flex-wrap"
          style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}
        >
          <span>© {new Date().getFullYear()} PaperFlix. Todos los derechos reservados.</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <a
            href="/legal"
            className="underline underline-offset-2 transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            Legal
          </a>
        </footer>
      </main>
    </div>
  );
}
