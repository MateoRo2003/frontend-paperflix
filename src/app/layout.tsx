import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import { SettingsProvider } from '@/contexts/SettingsContext';
import Sidebar from '@/components/Sidebar';

// next/font downloads Inter at BUILD TIME and self-hosts it.
// At runtime the browser requests the font from the same origin (/api/_next/static/...),
// never from fonts.googleapis.com or fonts.gstatic.com.
// This is critical for school networks that block Google's CDN.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'PaperFlix - Plataforma Educativa',
  description: 'Recursos educativos digitales para docentes y alumnos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className={inter.className}>
        <AuthProvider>
          <SettingsProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 ml-[320px] min-h-screen overflow-y-auto text-[18px] flex flex-col">
                <div className="flex-1">{children}</div>
                <footer className="px-8 py-5 text-sm text-center" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                  © {new Date().getFullYear()} Paperlux. Todos los derechos reservados.
                </footer>
              </main>
            </div>
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
