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

export default function ResourceModal({ resource, onClose }: { resource: Resource; onClose: () => void }) {
  const { showViews } = useAppSettings();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const hasImage = !!resource.imageUrl;
  const useNextImg = hasImage && isProxiable(resource.imageUrl!);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex-1 pr-4">
            <h2 className="text-lg font-bold text-white leading-tight">{resource.title}</h2>
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

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 72px)' }}>
          {/* Hero image */}
          {hasImage && (
            <div className="relative w-full" style={{ paddingBottom: '42%', background: 'var(--sidebar)' }}>
              {useNextImg ? (
                <Image
                  src={resource.imageUrl!}
                  alt={resource.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                  priority
                />
              ) : (
                <img
                  src={resource.imageUrl!}
                  alt={resource.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 50%, var(--card) 100%)' }} />
            </div>
          )}

          <div className="p-5 space-y-5">
            {/* Description */}
            {resource.description && (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                {resource.description}
              </p>
            )}

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {resource.author && (
                <div className="flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                  <User size={15} />
                  <span>{resource.author}</span>
                </div>
              )}
              {resource.course && (
                <div className="flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                  <BookOpen size={15} />
                  <span>{resource.course.trim()}</span>
                </div>
              )}
              {showViews && resource.views > 0 && (
                <div className="flex items-center gap-2" style={{ color: 'var(--muted)' }}>
                  <Eye size={15} />
                  <span>{resource.views} visualizaciones</span>
                </div>
              )}
              {resource.activityType && (
                <div className="flex items-center gap-2 col-span-2" style={{ color: 'var(--muted)' }}>
                  <span className="font-medium text-white">Tipo:</span>
                  <span>{resource.activityType}</span>
                </div>
              )}
              {resource.oaCode && (
                <div className="flex items-center gap-2 col-span-2">
                  <span className="font-mono text-xs px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(245,197,24,0.15)', color: 'var(--accent)' }}>
                    {resource.oaCode}
                  </span>
                </div>
              )}
            </div>

            {/* OA Description */}
            {resource.oaDescription && (
              <details className="text-xs rounded-xl overflow-hidden">
                <summary
                  className="px-4 py-3 cursor-pointer font-semibold select-none"
                  style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', minHeight: 44, display: 'flex', alignItems: 'center' }}
                >
                  Ver Objetivo de Aprendizaje
                </summary>
                <div className="px-4 py-3 leading-relaxed" style={{ background: 'rgba(124,58,237,0.08)', color: 'var(--muted)' }}>
                  {resource.oaDescription}
                </div>
              </details>
            )}


            {/* CTA — grande para el lápiz */}
            {resource.linkUrl && (
              <a
                href={resource.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackView(resource.id).catch(() => {})}
                className="flex items-center justify-center gap-2 w-full rounded-xl font-bold text-base transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'var(--accent)', color: '#1e0d38', height: 56 }}
              >
                <ExternalLink size={18} />
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
