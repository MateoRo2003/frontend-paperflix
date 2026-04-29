'use client';
import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { getSlides, getFeatured, getSubjects, getResources } from '@/lib/api';
import { Resource, Subject, Slide } from '@/types';
import ResourceCard from '@/components/ResourceCard';
import ResourceModal from '@/components/ResourceModal';
import SearchBar from '@/components/SearchBar';
import { GridSkeleton } from '@/components/Skeleton';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { SubjectIcon } from '@/components/SubjectIcon';
import Link from 'next/link';
import { useDataSync } from '@/hooks/useDataSync';


function isProxiable(url: string): boolean {
  try { return new URL(url).protocol === 'https:'; }
  catch { return false; }
}

interface SubjectRow {
  subject: Subject;
  resources: Resource[];
}

export default function HomePage() {
  const [slides, setSlides]               = useState<Slide[]>([]);
  const [featured, setFeatured]           = useState<Resource[]>([]);
  const [subjectRows, setSubjectRows]     = useState<SubjectRow[]>([]);
  const [searchResults, setSearchResults] = useState<Resource[] | null>(null);
  const [searching, setSearching]         = useState(false);
  const [selected, setSelected]           = useState<Resource | null>(null);
  const [loading, setLoading]             = useState(true);
  const [rowsLoading, setRowsLoading]     = useState(true);
  const [heroIdx, setHeroIdx]             = useState(0);
  const [heroKey, setHeroKey]             = useState(0);

  const fetchHome = useCallback(() => {
    // Fetch hero/slides + featured + subjects in parallel
    Promise.all([getSlides(), getFeatured(), getSubjects()])
      .then(async ([sl, f, subjects]) => {
        setSlides(sl);
        setFeatured(f);
        setLoading(false);

        // For each subject with resources, fetch 4 cards
        setRowsLoading(true);
        const rows = await Promise.all(
          subjects.map(async (subject) => {
            try {
              const res = await getResources({ subjectId: subject.id, limit: 4, page: 1, random: true });
              return { subject, resources: res.data };
            } catch {
              return { subject, resources: [] };
            }
          })
        );
        setSubjectRows(rows.filter(r => r.resources.length > 0));
        setRowsLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchHome(); }, [fetchHome]);
  useDataSync(fetchHome);

  // Use slides for carousel; fall back to featured resources if no slides configured
  const heroItems: (Slide | Resource)[] = slides.length > 0 ? slides : featured.slice(0, 5);

  useEffect(() => {
    if (heroItems.length === 0) return;
    const t = setInterval(() => {
      setHeroIdx(i => {
        setHeroKey(k => k + 1);
        return (i + 1) % heroItems.length;
      });
    }, 6000);
    return () => clearInterval(t);
  }, [heroItems.length]);

  const goHero = useCallback((i: number) => {
    setHeroIdx(i);
    setHeroKey(k => k + 1);
  }, []);

  async function handleSearch(q: string) {
    if (!q.trim()) { setSearchResults(null); return; }
    setSearching(true);
    const res = await getResources({ search: q, limit: 24 });
    setSearchResults(res.data);
    setSearching(false);
  }

  const hero = heroItems[heroIdx];
  const heroIsSlide = hero && 'buttonText' in hero;

  function handleHeroClick() {
    if (!hero) return;
    if (heroIsSlide) {
      const slide = hero as Slide;
      if (slide.linkUrl) window.open(slide.linkUrl, '_blank', 'noopener,noreferrer');
    } else {
      setSelected(hero as Resource);
    }
  }

  return (
    <div className="flex flex-col flex-1 p-4 sm:p-5 md:p-6 gap-4 md:gap-5">

      {/* ── Hero Banner ────────────────────────────────────────────── */}
      {(loading || hero) && (
        <div
          className="relative w-full rounded-2xl overflow-hidden select-none"
          style={{ height: 'clamp(200px, 36vw, 320px)' }}
        >
          {hero ? (
            <>
              <div key={heroKey} className="absolute inset-0 hero-img-enter">
                {hero.imageUrl && isProxiable(hero.imageUrl) ? (
                  <Image
                    src={hero.imageUrl}
                    alt={hero.title}
                    fill
                    priority
                    sizes="(max-width: 1200px) 100vw, 1000px"
                    className="object-cover"
                  />
                ) : hero.imageUrl ? (
                  <img src={hero.imageUrl} alt={hero.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, #1e0d38 0%, #2d1469 100%)' }} />
                )}
              </div>

              <div className="hero-overlay absolute inset-0" />

              <div
                className="relative z-10 pl-14 pr-5 pb-6 md:pl-24 md:pr-20 md:pb-8 flex flex-col justify-end h-full cursor-pointer"
                onClick={handleHeroClick}
                style={{ paddingTop: 32 }}
              >
                {!heroIsSlide && (hero as Resource).subject && (
                  <span
                    className="text-xs font-bold px-3 py-1.5 rounded-full mb-3 w-fit"
                    style={{ background: 'rgba(245,197,24,0.18)', color: 'var(--accent)', border: '1px solid rgba(245,197,24,0.3)' }}
                  >
                    {(hero as Resource).subject!.name}
                  </span>
                )}

                <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-white mb-2 md:mb-3 max-w-2xl leading-tight" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
                  {hero.title}
                </h1>

                {(heroIsSlide ? (hero as Slide).subtitle : (hero as Resource).description) && (
                  <p className="hidden sm:block text-sm sm:text-base max-w-lg line-clamp-2 mb-4" style={{ color: 'rgba(226,217,243,0.8)' }}>
                    {heroIsSlide ? (hero as Slide).subtitle : (hero as Resource).description}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all hover:opacity-90"
                    style={{ background: 'var(--accent)', color: '#1e0d38' }}
                  >
                    {heroIsSlide ? ((hero as Slide).buttonText || 'Ver más') : 'Ver recurso'}
                  </span>
                  {heroItems.length > 1 && (
                    <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {heroIdx + 1} / {heroItems.length}
                    </span>
                  )}
                </div>
              </div>

              {heroItems.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); goHero((heroIdx - 1 + heroItems.length) % heroItems.length); }}
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-all w-9 h-9 md:w-14 md:h-14"
                    style={{ color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
                  >
                    <ChevronLeft className="w-4 h-4 md:w-6 md:h-6" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); goHero((heroIdx + 1) % heroItems.length); }}
                    className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-all w-9 h-9 md:w-14 md:h-14"
                    style={{ color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
                  >
                    <ChevronRight className="w-4 h-4 md:w-6 md:h-6" />
                  </button>
                </>
              )}

              {heroItems.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 z-20 px-4 sm:px-10 pb-3 sm:pb-5">
                  <div className="flex justify-center gap-1.5 mb-2">
                    {heroItems.map((_item, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); goHero(i); }}
                        className="rounded-full transition-all duration-300"
                        style={{
                          width:  i === heroIdx ? 'clamp(12px, 4vw, 28px)' : 'clamp(4px, 1.5vw, 8px)',
                          height: 'clamp(4px, 1.2vw, 8px)',
                          background: i === heroIdx ? 'var(--accent)' : 'rgba(255,255,255,0.3)',
                        }}
                      />
                    ))}
                  </div>
                  <div className="w-full rounded-full overflow-hidden" style={{ height: 2, background: 'rgba(255,255,255,0.12)' }}>
                    <div
                      key={`progress-${heroKey}`}
                      className="hero-progress h-full rounded-full"
                      style={{ background: 'var(--accent)' }}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="skeleton w-full h-full" />
          )}
        </div>
      )}

      {/* ── Search ──────────────────────────────────────────────────── */}
      <SearchBar onSearch={handleSearch} />

      {/* ── Search Results ──────────────────────────────────────────── */}
      {searchResults !== null && (
        <section>
          <h2 className="text-2xl font-bold text-white mb-3">
            {searching ? 'Buscando...' : `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''}`}
          </h2>
          {searching ? <GridSkeleton count={8} /> : (
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-5">
              {searchResults.map(r => (
                <ResourceCard key={r.id} resource={r} onClick={() => setSelected(r)} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Grid de asignaturas ──────────────────────────────────────── */}
      {searchResults === null && (
        <div className="flex-1 grid grid-cols-2 xl:grid-cols-4 gap-4" style={{ gridAutoRows: '1fr', minHeight: 0 }}>
          {rowsLoading && subjectRows.length === 0
            ? [...Array(8)].map((_, i) => (
                <div key={i} className="skeleton rounded-2xl" style={{ height: 210 }} />
              ))
            : subjectRows.map(({ subject, resources }) => {
                const top = resources[0];
                if (!top) return null;
                const imgSrc = top.imageUrl
                  ? (isProxiable(top.imageUrl) ? top.imageUrl : top.imageUrl)
                  : null;
                const badgeColor = top.activityType
                  ? ({ 'Introductoria': '#3b82f6', 'De desarrollo': '#10b981', 'De cierre': '#f59e0b', 'Herramienta': '#8b5cf6' } as Record<string,string>)[top.activityType.split(',')[0].trim()] ?? '#6b7280'
                  : null;
                return (
                  <div
                    key={subject.id}
                    className="rounded-2xl overflow-hidden cursor-pointer group flex flex-col h-full"
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                    }}
                    onClick={() => setSelected(top)}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.35)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = '';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                    }}
                  >
                    <div
                      className="flex items-center justify-between px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border)' }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <SubjectIcon icon={subject.icon} color={subject.color} size={18} fallback={subject.name.charAt(0)} />
                        <span className="font-bold text-base text-white truncate">{subject.name}</span>
                      </div>
                      <Link
                        href={`/${subject.slug}`}
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-0.5 text-sm font-semibold shrink-0 hover:opacity-75 transition-opacity ml-2"
                        style={{ color: 'var(--accent)' }}
                      >
                        Ver todos <ChevronRight size={14} />
                      </Link>
                    </div>

                    <div className="relative flex-1 min-h-0" style={{ background: 'var(--sidebar)' }}>
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={top.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--sidebar)' }}>
                          <SubjectIcon icon={subject.icon} color={subject.color} size={44} fallback={subject.name.charAt(0)} />
                        </div>
                      )}
                      {badgeColor && top.activityType && (
                        <span
                          className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ background: badgeColor }}
                        >
                          {top.activityType.split(',')[0].trim()}
                        </span>
                      )}
                      <div
                        className="absolute inset-x-0 bottom-0 px-3 py-2"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
                      >
                        <p className="text-white font-semibold text-sm leading-snug line-clamp-2">{top.title}</p>
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}

      {selected && <ResourceModal resource={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}