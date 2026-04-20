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
              const res = await getResources({ subjectId: subject.id, limit: 4, page: 1 });
              return { subject, resources: res.data };
            } catch {
              return { subject, resources: [] };
            }
          })
        );
        // Only show subjects that actually have resources
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
    <div className="p-8 space-y-10">

      {/* ── Hero Banner ────────────────────────────────────────────── */}
      {(loading || hero) && (
        <div
          className="relative w-full rounded-2xl overflow-hidden select-none"
          style={{ height: 460 }}
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
                className="relative z-10 px-10 pb-10 flex flex-col justify-end h-full cursor-pointer"
                onClick={handleHeroClick}
                style={{ paddingTop: 40 }}
              >
                {!heroIsSlide && (hero as Resource).subject && (
                  <span
                    className="text-xs font-bold px-3 py-1.5 rounded-full mb-3 w-fit"
                    style={{ background: 'rgba(245,197,24,0.18)', color: 'var(--accent)', border: '1px solid rgba(245,197,24,0.3)' }}
                  >
                    {(hero as Resource).subject!.name}
                  </span>
                )}

                <h1 className="text-3xl sm:text-5xl font-extrabold text-white mb-3 max-w-2xl leading-tight" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
                  {hero.title}
                </h1>

                {(heroIsSlide ? (hero as Slide).subtitle : (hero as Resource).description) && (
                  <p className="text-sm sm:text-base max-w-lg line-clamp-2 mb-5" style={{ color: 'rgba(226,217,243,0.8)' }}>
                    {heroIsSlide ? (hero as Slide).subtitle : (hero as Resource).description}
                  </p>
                )}

                <div className="flex items-center gap-4">
                  <span
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
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
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/55 backdrop-blur-sm transition-all"
                    style={{ width: 48, height: 48, color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); goHero((heroIdx + 1) % heroItems.length); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/55 backdrop-blur-sm transition-all"
                    style={{ width: 48, height: 48, color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}

              {heroItems.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 z-20 px-10 pb-5">
                  <div className="flex justify-center gap-2 mb-3">
                    {heroItems.map((_item, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); goHero(i); }}
                        className="rounded-full transition-all duration-300"
                        style={{
                          width:  i === heroIdx ? 28 : 8,
                          height: 8,
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
          <h2 className="text-xl font-bold text-white mb-5">
            {searching ? 'Buscando...' : `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''}`}
          </h2>
          {searching ? <GridSkeleton count={8} /> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-7">
              {searchResults.map(r => (
                <ResourceCard key={r.id} resource={r} onClick={() => setSelected(r)} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Filas por Asignatura (estilo Netflix) ───────────────────── */}
      {searchResults === null && (
        <>
          {/* Destacados — fila rápida mientras cargan las filas por asignatura */}
          {featured.length > 0 && rowsLoading && (
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-white">Destacados</h2>
              </div>
              {loading ? <GridSkeleton count={4} /> : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-7">
                  {featured.slice(0, 4).map(r => (
                    <ResourceCard key={r.id} resource={r} onClick={() => setSelected(r)} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Una fila por asignatura */}
          {rowsLoading && subjectRows.length === 0
            ? // Skeleton de 3 filas mientras carga
              [...Array(3)].map((_, i) => (
                <section key={i}>
                  <div className="skeleton rounded-lg mb-5" style={{ width: 180, height: 28 }} />
                  <GridSkeleton count={4} />
                </section>
              ))
            : subjectRows.map(({ subject, resources }) => (
                <section key={subject.id}>
                  {/* Encabezado de fila */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      {/* Pastilla de color de la asignatura */}
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0"
                        style={{ background: `${subject.color}22`, color: subject.color }}
                      >
                        <SubjectIcon icon={subject.icon} color={subject.color} size={18} fallback={subject.name.charAt(0)} />
                      </span>
                      <h2 className="text-xl font-bold text-white">{subject.name}</h2>
                    </div>

                    <Link
                      href={`/${subject.slug}`}
                      className="flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-80 group"
                      style={{ color: 'var(--accent)' }}
                    >
                      Ver todos
                      <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>

                  {/* Grid de 4 recursos */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-7">
                    {resources.map(r => (
                      <ResourceCard key={r.id} resource={r} onClick={() => setSelected(r)} />
                    ))}
                  </div>
                </section>
              ))
          }
        </>
      )}

      {selected && <ResourceModal resource={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}