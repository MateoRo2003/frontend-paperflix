'use client';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useEffect } from 'react';
import { Resource } from '@/types';
import { X, ExternalLink, BookOpen, User, Eye } from 'lucide-react';
import { trackView } from '@/lib/api';
import { useAppSettings } from '@/contexts/SettingsContext';

function isProxiable(url: string): boolean {
  try { return new URL(url).protocol === 'https:'; }
  catch { return false; }
}

const IMG_BASE = process.env.NEXT_PUBLIC_IMG_BASE || '';

function resolveImg(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return IMG_BASE + url;
}

export default function ResourceModal({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const { showViews } = useAppSettings();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const imgSrc = resolveImg(resource.imageUrl);
  const hasImage = !!imgSrc;
  const useNextImg = hasImage && isProxiable(imgSrc!);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex-1 pr-4">
            <h2 className="text-base font-bold text-white leading-tight">{resource.title}</h2>
            {resource.subject && (
              <span className="text-xs mt-1 inline-block" style={{ color: 'var(--muted)' }}>
                {resource.subject.name}
                {resource.unit && ` › ${resource.unit.name}`}
              </span>
            )}
          </div>
          {/* Botón cerrar: target grande para el lápiz */}
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-xl transition-colors hover:bg-white/10 shrink-0"
            style={{ color: 'var(--muted)', width: 44, height: 44 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content — sin scroll, todo visible de un vistazo */}
        <div>
          {/* Hero image — compacta */}
          {hasImage && (
            <div className="relative w-full" style={{ paddingBottom: '18%', background: 'var(--sidebar)' }}>
              {useNextImg ? (
                <Image src={imgSrc!} alt={resource.title} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" priority />
              ) : (
                <img src={imgSrc!} alt={resource.title} className="absolute inset-0 w-full h-full object-cover" />
              )}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 50%, var(--card) 100%)' }} />
            </div>
          )}

          <div className="px-4 py-3 space-y-2">
            {/* Description */}
            {resource.description && (
              <p className="text-xs leading-snug" style={{ color: 'var(--text)' }}>
                {resource.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--muted)' }}>
              {resource.author && (
                <div className="flex items-center gap-1.5">
                  <User size={14} />
                  <span>{resource.author}</span>
                </div>
              )}
              {resource.course && (
                <div className="flex items-center gap-1.5">
                  <BookOpen size={14} />
                  <span>{resource.course.trim()}</span>
                </div>
              )}
              {showViews && resource.views > 0 && (
                <div className="flex items-center gap-1.5">
                  <Eye size={14} />
                  <span>{resource.views} vistas</span>
                </div>
              )}
              {resource.activityType && (
                <span>Tipo: <span className="text-white">{resource.activityType}</span></span>
              )}
              {resource.oaCode && (
                <span className="font-mono text-xs px-2 py-0.5 rounded-lg" style={{ background: 'rgba(245,197,24,0.15)', color: 'var(--accent)' }}>
                  {resource.oaCode}
                </span>
              )}
            </div>

            {/* OA — siempre visible */}
            {resource.oaDescription && (
              <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(124,58,237,0.12)' }}>
                <p className="text-xs font-semibold mb-0.5" style={{ color: '#c4b5fd' }}>Objetivo de Aprendizaje</p>
                <p className="text-xs leading-snug" style={{ color: 'var(--muted)' }}>{resource.oaDescription}</p>
              </div>
            )}

            {/* CTA */}
            {resource.linkUrl && (
              <a
                href={resource.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackView(resource.id).catch(() => {})}
                className="flex items-center justify-center gap-2 w-full rounded-xl font-bold text-xl transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'var(--accent)', color: '#1e0d38', height: 64, marginBottom: 4 }}
              >
                <ExternalLink size={20} />
                Abrir Recurso
              </a>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
