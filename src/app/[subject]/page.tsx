'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getSubject, getResources, getSubjects, getResourceFilters } from '@/lib/api';
import { Resource, Subject } from '@/types';
import ResourceCard from '@/components/ResourceCard';
import ResourceModal from '@/components/ResourceModal';
import SuggestionModal from '@/components/SuggestionModal';
import SearchBar from '@/components/SearchBar';
import { GridSkeleton } from '@/components/Skeleton';
import { ChevronLeft, ChevronRight, X, Lightbulb, ChevronDown } from 'lucide-react';
import { useDataSync } from '@/hooks/useDataSync';

// Order helper so courses always appear in a logical sequence
const COURSE_ORDER = ['Primero','Segundo','Tercero','Cuarto','Quinto','Sexto','Séptimo','Septimo','Octavo'];
function sortCourses(courses: string[]) {
  return [...courses].sort((a, b) => {
    const ai = COURSE_ORDER.findIndex(c => c.toLowerCase() === a.toLowerCase());
    const bi = COURSE_ORDER.findIndex(c => c.toLowerCase() === b.toLowerCase());
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export default function SubjectPage() {
  const { subject: slug } = useParams() as { subject: string };

  const [subject, setSubject]         = useState<Subject | null>(null);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [resources, setResources]     = useState<Resource[]>([]);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<Resource | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);

  // ── Filter options (from API) ──────────────────────────────────
  const [availCourses, setAvailCourses]         = useState<string[]>([]);
  const [availUnits, setAvailUnits]             = useState<{ id: number; name: string; oaDescription?: string | null }[]>([]);
  const [availActTypes, setAvailActTypes]       = useState<string[]>([]);
  const [filtersLoading, setFiltersLoading]     = useState(false);

  // ── Active filter values ───────────────────────────────────────
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [course, setCourse]           = useState('');
  const [unitId, setUnitId]           = useState<number | undefined>();
  const [activityType, setActivityType] = useState('');

  // Load subject + initial courses
  useEffect(() => {
    getSubjects().then(setAllSubjects).catch(() => {});
    getSubject(slug)
      .then(async (s) => {
        setSubject(s);
        const f = await getResourceFilters(s.id);
        setAvailCourses(sortCourses(f.courses));
      })
      .catch(console.error);
  }, [slug]);

  // When course changes, load dependent options
  useEffect(() => {
    if (!subject) return;
    if (!course) {
      setAvailUnits([]);
      setAvailActTypes([]);
      setUnitId(undefined);
      setActivityType('');
      return;
    }
    setFiltersLoading(true);
    getResourceFilters(subject.id, course)
      .then(f => {
        setAvailUnits(f.units);
        setAvailActTypes(f.activityTypes);
        // Reset dependent filters if they no longer apply
        setUnitId(prev => f.units.some(u => u.id === prev) ? prev : undefined);
        setActivityType(prev => f.activityTypes.includes(prev) ? prev : '');
      })
      .catch(() => {})
      .finally(() => setFiltersLoading(false));
  }, [subject, course]);

  const load = useCallback(async () => {
    if (!subject) return;
    setLoading(true);
    try {
      const res = await getResources({
        subjectId: subject.id,
        unitId,
        activityType: activityType || undefined,
        course: course || undefined,
        search: search || undefined,
        page,
        limit: 20,
      });
      setResources(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } finally {
      setLoading(false);
    }
  }, [subject, unitId, activityType, course, search, page]);

  useEffect(() => { load(); }, [load]);
  useDataSync(load);

  function reset() {
    setCourse('');
    setUnitId(undefined);
    setActivityType('');
    setSearch('');
    setPage(1);
  }

  const hasActiveFilters = !!course || !!unitId || !!activityType || !!search;
  const courseSelected   = !!course;

  if (!subject && !loading) {
    return (
      <div className="p-10 text-center" style={{ color: 'var(--muted)' }}>
        <p className="text-3xl mb-3">🔍</p>
        <p className="text-lg font-medium">Asignatura no encontrada</p>
      </div>
    );
  }

  // Label helpers
  const isObj     = availUnits[0]?.name.toLowerCase().startsWith('objetivo');
  const unitLabel = isObj ? 'Objetivo' : 'Unidad';

  return (
    <div className="p-3 sm:p-6 space-y-4">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{subject?.name || '...'}</h1>
          {!loading && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
              {total} recurso{total !== 1 ? 's' : ''} disponible{total !== 1 ? 's' : ''}
              {hasActiveFilters && ' · filtrado'}
            </p>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowSuggestion(true)}
            className="flex items-center gap-2 px-3 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
            style={{
              height: 44,
              background: 'rgba(245,197,24,0.08)',
              border: '1px solid rgba(245,197,24,0.25)',
              color: 'var(--accent)',
            }}
            title="Sugerir un nuevo recurso"
          >
            <Lightbulb size={15} />
            <span className="hidden sm:inline">Sugerir</span>
          </button>

          {hasActiveFilters && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-3 rounded-xl text-sm transition-colors hover:bg-white/5"
              style={{
                height: 44,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#f87171',
              }}
            >
              <X size={14} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ── Panel de Filtros ────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>

        {/* Step 1 — Curso (siempre visible) */}
        <div className="px-4 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
              style={{ background: courseSelected ? 'var(--accent)' : 'rgba(255,255,255,0.15)', color: courseSelected ? '#1e0d38' : 'var(--muted)' }}
            >1</span>
            <span className="text-xs font-semibold" style={{ color: courseSelected ? 'var(--text)' : 'var(--muted)' }}>
              Selecciona un curso
            </span>
          </div>

          {/* Course pills */}
          {availCourses.length === 0 ? (
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton rounded-full" style={{ width: 80, height: 40 }} />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availCourses.map(c => (
                <button
                  key={c}
                  onClick={() => { setCourse(prev => prev === c ? '' : c); setPage(1); }}
                  className="pill-btn shrink-0 rounded-full text-sm font-semibold transition-all hover:brightness-110 hover:scale-[1.03]"
                  style={{
                    height: 40,
                    minHeight: 40,
                    paddingLeft: 16,
                    paddingRight: 16,
                    background: course === c ? 'var(--accent)' : 'transparent',
                    color: course === c ? '#1e0d38' : '#ffffff',
                    border: `1px solid ${course === c ? 'transparent' : 'rgba(255,255,255,0.3)'}`,
                    fontWeight: course === c ? 700 : 500,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2 — Unidad + Tipo (solo visible cuando hay curso seleccionado) */}
        {courseSelected && (
          <div
            className="border-t px-4 py-2 space-y-2"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
                style={{ background: (!!unitId || !!activityType) ? 'var(--purple)' : 'rgba(255,255,255,0.15)', color: (!!unitId || !!activityType) ? '#fff' : 'var(--muted)' }}
              >2</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                Filtra por {unitLabel.toLowerCase()} o tipo de actividad
              </span>
              {filtersLoading && <span className="text-[10px] ml-1" style={{ color: 'var(--muted)' }}>cargando…</span>}
            </div>

            <div className="grid grid-cols-1 gap-2" style={{ gridTemplateColumns: '1fr' }}>
              <div className="grid gap-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
                {/* Unidad / Objetivo */}
                <div className="relative">
                  <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--muted)' }}>{unitLabel}</label>
                  <div className="relative">
                    <select
                      value={unitId ?? ''}
                      onChange={(e) => { setUnitId(e.target.value ? +e.target.value : undefined); setPage(1); }}
                      className="w-full pl-3 pr-9 rounded-xl outline-none appearance-none"
                      style={{
                        background: unitId ? 'rgba(124,58,237,0.15)' : 'var(--bg)',
                        border: `1px solid ${unitId ? 'rgba(124,58,237,0.45)' : 'var(--border)'}`,
                        color: unitId ? '#c4b5fd' : 'var(--muted)',
                        height: 42,
                        minHeight: 42,
                      }}
                    >
                      <option value="" style={{ color: '#1e0d38', background: '#e9e0f7' }}>{isObj ? 'Todos los objetivos' : 'Todas las unidades'}</option>
                      {availUnits.map(u => <option key={u.id} value={u.id} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{u.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
                  </div>
                </div>

                {/* Tipo de actividad */}
                <div className="relative">
                  <label className="text-xs mb-1 block font-medium" style={{ color: 'var(--muted)' }}>Tipo de actividad</label>
                  <div className="relative">
                    <select
                      value={activityType}
                      onChange={(e) => { setActivityType(e.target.value); setPage(1); }}
                      className="w-full pl-3 pr-9 rounded-xl outline-none appearance-none"
                      style={{
                        background: activityType ? 'rgba(124,58,237,0.15)' : 'var(--bg)',
                        border: `1px solid ${activityType ? 'rgba(124,58,237,0.45)' : 'var(--border)'}`,
                        color: activityType ? '#c4b5fd' : 'var(--muted)',
                        height: 42,
                        minHeight: 42,
                      }}
                    >
                      <option value="" style={{ color: '#1e0d38', background: '#e9e0f7' }}>Todos los tipos</option>
                      {availActTypes.map(t => <option key={t} value={t} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{t}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
                  </div>
                </div>
              </div>

              {/* OA Description — aparece al seleccionar una unidad/objetivo */}
              {unitId && (() => {
                const selectedUnit = availUnits.find(u => u.id === unitId);
                return selectedUnit?.oaDescription ? (
                  <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(124,58,237,0.10)' }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: '#c4b5fd' }}>Objetivo de Aprendizaje</p>
                    <p className="text-xs leading-snug" style={{ color: 'var(--muted)' }}>{selectedUnit.oaDescription}</p>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        )}

        {/* Búsqueda */}
        <div className="border-t px-4 py-2" style={{ borderColor: 'var(--border)' }}>
          <SearchBar
            onSearch={(q) => { setSearch(q); setPage(1); }}
            placeholder={`Buscar en ${subject?.name || 'esta asignatura'}...`}
          />
        </div>
      </div>

      {/* ── Tabs de Unidades (sólo cuando hay curso seleccionado y unidades) ── */}
      {courseSelected && availUnits.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => { setUnitId(undefined); setPage(1); }}
            className="pill-btn shrink-0 rounded-full text-xs font-medium transition-colors"
            style={{
              background: !unitId ? 'var(--purple)' : 'var(--card)',
              color: !unitId ? '#fff' : 'var(--muted)',
              border: '1px solid var(--border)',
            }}
          >
            {isObj ? 'Todos' : 'Todas'}
          </button>
          {availUnits.slice(0, 12).map(u => (
            <button
              key={u.id}
              onClick={() => { setUnitId(u.id); setPage(1); }}
              className="pill-btn shrink-0 rounded-full text-xs font-medium transition-colors"
              style={{
                background: unitId === u.id ? 'var(--purple)' : 'var(--card)',
                color: unitId === u.id ? '#fff' : 'var(--muted)',
                border: `1px solid ${unitId === u.id ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
              }}
            >
              {u.name.length > 22 ? u.name.slice(0, 22) + '…' : u.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Grid de Recursos ────────────────────────────────────────── */}
      {loading ? (
        <GridSkeleton count={20} />
      ) : resources.length === 0 ? (
        <div className="py-16 text-center" style={{ color: 'var(--muted)' }}>
          <p className="text-4xl mb-3">📭</p>
          <p className="text-lg font-semibold text-white mb-1">
            {hasActiveFilters ? 'Sin resultados para estos filtros' : 'Sin recursos disponibles'}
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            {hasActiveFilters ? 'Intenta cambiar o limpiar los filtros aplicados.' : 'Esta asignatura aún no tiene recursos cargados.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={reset}
              className="px-5 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--purple)', color: '#fff', height: 44 }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2 sm:gap-4">
          {resources.map(r => (
            <ResourceCard key={r.id} resource={r} onClick={() => setSelected(r)} />
          ))}
        </div>
      )}

      {/* ── Paginación ──────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="page-btn flex items-center justify-center rounded-xl disabled:opacity-30 hover:bg-white/5 transition-colors"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <ChevronLeft size={18} />
          </button>

          {/* Números — en móvil solo muestra 3, en desktop hasta 7 */}
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = Math.max(1, Math.min(page - 3, totalPages - 6)) + i;
            const showOnMobile = p === page || p === page - 1 || p === page + 1;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`page-btn rounded-xl text-sm font-semibold transition-colors ${showOnMobile ? '' : 'hidden sm:flex'}`}
                style={{
                  background: p === page ? 'var(--purple)' : 'var(--card)',
                  color: p === page ? '#fff' : 'var(--muted)',
                  border: `1px solid ${p === page ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
                  display: showOnMobile ? undefined : undefined,
                }}
              >
                {p}
              </button>
            );
          })}

          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="page-btn flex items-center justify-center rounded-xl disabled:opacity-30 hover:bg-white/5 transition-colors"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {selected && <ResourceModal resource={selected} onClose={() => setSelected(null)} />}

      {showSuggestion && (
        <SuggestionModal
          subjects={allSubjects}
          defaultSubjectId={subject?.id}
          defaultSubjectName={subject?.name}
          onClose={() => setShowSuggestion(false)}
        />
      )}
    </div>
  );
}