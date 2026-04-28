'use client';
import { Resource } from '@/types';
import { ExternalLink, Eye, ImageOff } from 'lucide-react';
import { useAppSettings } from '@/contexts/SettingsContext';

const ACTIVITY_COLORS: Record<string, string> = {
  'Introductoria':   '#3b82f6',
  'De desarrollo':   '#10b981',
  'De cierre':       '#f59e0b',
  'Herramienta':     '#8b5cf6',
};

const IMG_BASE = process.env.NEXT_PUBLIC_IMG_BASE || '';

function resolveImg(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return IMG_BASE + url;
}

export default function ResourceCard({ resource, onClick }: { resource: Resource; onClick?: () => void }) {
  const { showViews } = useAppSettings();
  const badgeColor = resource.activityType
    ? ACTIVITY_COLORS[resource.activityType.split(',')[0].trim()] || '#6b7280'
    : '#6b7280';

  const imgSrc = resolveImg(resource.imageUrl);
  const hasImage = !!imgSrc;

  return (
    <div
      className="resource-card rounded-2xl overflow-hidden cursor-pointer"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      onClick={onClick}
    >
      {/* Thumbnail 16:9 — más alta gracias a aspect-video en un contenedor más ancho */}
      <div className="relative w-full aspect-video overflow-hidden" style={{ background: 'var(--sidebar)' }}>
        {hasImage ? (
          <img
            src={imgSrc!}
            alt={resource.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--muted)' }}>
            <ImageOff size={28} />
            <span className="text-xs">Sin imagen</span>
          </div>
        )}

        {/* Badge tipo */}
        {resource.activityType && (
          <span
            className="absolute top-2 left-2 text-xs sm:text-sm font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-white z-10"
            style={{ background: badgeColor }}
          >
            {resource.activityType.split(',')[0].trim()}
          </span>
        )}

        {/* Vistas */}
        {showViews && resource.views > 0 && (
          <span className="absolute top-3 right-3 flex items-center gap-1 text-sm text-white/80 bg-black/50 px-3 py-1.5 rounded-full z-10">
            <Eye size={14} /> {resource.views}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 sm:p-5">
        <h3 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2 mb-1.5">
          {resource.title}
        </h3>
        {resource.description && (
          <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--muted)' }}>
            {resource.description}
          </p>
        )}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {resource.author && (
              <span className="text-xs truncate max-w-[90px] sm:max-w-[130px]" style={{ color: 'var(--muted)' }}>
                {resource.author}
              </span>
            )}
            {resource.course && (
              <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ background: 'rgba(124,58,237,0.25)', color: '#c4b5fd' }}>
                {resource.course.trim()}
              </span>
            )}
          </div>
          {resource.linkUrl && (
            <a
              href={resource.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="icon-btn shrink-0 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
              style={{ color: 'var(--accent)', width: 36, height: 36 }}
            >
              <ExternalLink size={20} />
            </a>
          )}
        </div>
        {resource.oaCode && (
          <div className="mt-2">
            <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: 'rgba(245,197,24,0.15)', color: 'var(--accent)' }}>
              {resource.oaCode}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}