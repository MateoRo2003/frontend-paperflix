'use client';
import type ExcelJS from 'exceljs';
import { useState, useEffect } from 'react';
import NextImage from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { broadcastDataChange } from '@/hooks/useDataSync';
import {
  getResources, getSubjects, getStats, getSettings, updateSetting,
  deleteResource, createResource, updateResource, scrapeResourceUrl, bulkCreateResources,
  countImageMigration, migrateImagesBatch, scrapeMissingImagesBatch, rescrapeImagesBatch,
  getUnitsByCourse, getDistinctCourses, getDistinctActivityTypes, getAuthors, uploadResourceImage,
  getTopResources, getStatsByCourse, getStatsByActivityType,
  seedCourses, seedActivityTypes,
  createSubject, updateSubject, deleteSubject, reorderSubjects,
  getSuggestions, approveSuggestion, rejectSuggestion, deleteSuggestion, getPendingCount,
  getAllSlides, createSlide, updateSlide, deleteSlide, reorderSlides, uploadSlideImage,
  getUnits, createUnit, updateUnit, deleteUnit, reorderUnits,
  getCourses, createCourse, updateCourse, deleteCourse,
  getActivityTypes, createActivityType, updateActivityType, deleteActivityType,
} from '@/lib/api';
import { Resource, Subject, SubjectStat, Suggestion, Slide, Unit } from '@/types';
import {
  LogIn, LogOut, Plus, Pencil, Trash2, Eye,
  BarChart2, Search, X, Check, BookOpen,
  Layers, TrendingUp, Database, Star, Lightbulb,
  ExternalLink, ThumbsUp, ThumbsDown, Bell,
  Image as ImageIcon, Upload, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Monitor,
  Sparkles, Loader2, FileSpreadsheet, AlertTriangle, CheckCircle2,
} from 'lucide-react';

// ─── Local types ──────────────────────────────────────────────────────────────

interface Course { id: number; name: string; isActive: boolean; sortOrder: number; }
interface ActivityTypeItem { id: number; name: string; isActive: boolean; }

// ─── Course sort order ────────────────────────────────────────────────────────

const GRADE_ORDER: Record<string, number> = {
  'primero': 1, 'segundo': 2, 'tercero': 3, 'cuarto': 4,
  'quinto': 5, 'sexto': 6, 'séptimo': 7, 'septimo': 7,
  'octavo': 8, 'noveno': 9, 'décimo': 10, 'decimo': 10,
};

function gradeRank(name: string): number {
  const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, rank] of Object.entries(GRADE_ORDER)) {
    if (normalized.startsWith(key)) return rank;
  }
  return 99;
}

function sortCourses<T extends { name: string }>(courses: T[]): T[] {
  return [...courses].sort((a, b) => {
    const ra = gradeRank(a.name), rb = gradeRank(b.name);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, 'es');
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="kpi-card flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}22`, color }}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-white">{value}</p>
        <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{label}</p>
        {sub && <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{sub}</p>}
      </div>
    </div>
  );
}

const SUBJECT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { admin, signIn, signOut } = useAuth();

  // Login
  const [email, setEmail] = useState('admin@admin.com');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');

  // Resources tab
  const [resources, setResources] = useState<Resource[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterActType, setFilterActType] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterUnits, setFilterUnits] = useState<Unit[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Partial<Resource> | null>(null);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeFields, setScrapeFields] = useState<Set<string>>(new Set());

  // Subjects tab
  const [editingSubject, setEditingSubject] = useState<Partial<Subject> | null>(null);
  const [savingSubject, setSavingSubject] = useState(false);

  // Shared data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [stats, setStats] = useState<SubjectStat[]>([]);
  const [totalResources, setTotalResources] = useState(0);
  const [totalViews, setTotalViews] = useState(0);

  // Extended stats
  const [topResources, setTopResources] = useState<any[]>([]);
  const [statsByCourse, setStatsByCourse] = useState<any[]>([]);
  const [statsByActType, setStatsByActType] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Stats date range filter
  const [statsFrom, setStatsFrom] = useState('');
  const [statsTo, setStatsTo] = useState('');

  const [tab, setTab] = useState<'resources' | 'stats' | 'subjects' | 'suggestions' | 'carousel' | 'config' | 'catalogs'>('resources');

  // Catalog tab
  const [catalogTab, setCatalogTab] = useState<'courses' | 'activityTypes' | 'units'>('courses');
  const [catalogCourses, setCatalogCourses] = useState<Course[]>([]);
  const [catalogActivityTypes, setCatalogActivityTypes] = useState<ActivityTypeItem[]>([]);
  const [catalogUnits, setCatalogUnits] = useState<Unit[]>([]);
  // Derived from resources (real existing data)
  const [derivedCourses, setDerivedCourses] = useState<string[]>([]);
  const [derivedActTypes, setDerivedActTypes] = useState<string[]>([]);
  // Units structured by subject → course (from resources)
  const [unitsByCourse, setUnitsByCourse] = useState<{ subjectId: number; subjectName: string; courses: { course: string; units: { id: number; name: string; code: string; order: number }[] }[] }[]>([]);
  // Accordion open state: subjectId and "subjectId:course" keys
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set());
  const [newCourseName, setNewCourseName] = useState('');
  const [newActivityTypeName, setNewActivityTypeName] = useState('');
  const [newUnit, setNewUnit] = useState({ name: '', subjectId: 0, code: '', course: '', order: 0 });
  const [savingCatalog, setSavingCatalog] = useState(false);
  // Drag-and-drop state for units reorder
  const [dragUnitId, setDragUnitId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  // Drag-and-drop state for subjects reorder
  const [dragSubjectId, setDragSubjectId] = useState<number | null>(null);
  const [dragOverSubjectId, setDragOverSubjectId] = useState<number | null>(null);

  // Inline edit state for catalog items
  const [editingCatalog, setEditingCatalog] = useState<{
    type: 'course' | 'activityType' | 'unit';
    id: number;
    name: string;
    code?: string;
    course?: string;
    order?: number;
  } | null>(null);

  // Resource modal catalog data
  const [modalCourses, setModalCourses] = useState<Course[]>([]);
  const [modalActivityTypes, setModalActivityTypes] = useState<ActivityTypeItem[]>([]);
  const [modalUnits, setModalUnits] = useState<Unit[]>([]);
  const [selectedActTypes, setSelectedActTypes] = useState<string[]>([]);
  const [authors, setAuthors] = useState<string[]>([]);
  const [uploadingResourceImg, setUploadingResourceImg] = useState(false);

  // Bulk import modal
  interface BulkRow {
    titulo: string; url: string; descripcion?: string;
    tipo_actividad?: string; autor?: string;
    codigo_oa?: string; descripcion_oa?: string;
    _error?: string;
  }
  const [showBulk, setShowBulk] = useState(false);
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkUnit, setBulkUnit] = useState('');
  const [bulkCourse, setBulkCourse] = useState('');
  const [bulkUnits, setBulkUnits] = useState<Unit[]>([]);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null);

  // Config tab
  const [showViews, setShowViews] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [migratingImages, setMigratingImages] = useState(false);
  const [scrapingMissing, setScrapingMissing] = useState(false);
  const [rescrapingImages, setRescrapingImages] = useState(false);
  const [rescrapeSubject, setRescrapeSubject] = useState('');
  const [rescrapeProgress, setRescrapeProgress] = useState({ done: 0, total: 0, updated: 0, failed: 0, errors: [] as { id: number; title: string; reason: string }[] });
  const [migrateCount, setMigrateCount] = useState<{ total: number; pending: number; alreadyWebp: number; noImage: number; noImageWithUrl: number } | null>(null);
  const [migrateProgress, setMigrateProgress] = useState({ done: 0, total: 0, converted: 0, failed: 0, errors: [] as { id: number; title: string; reason: string }[] });
  const [scrapeProgress, setScrapeProgress] = useState({ done: 0, total: 0, saved: 0, failed: 0, errors: [] as { id: number; title: string; reason: string }[] });

  // Carousel / Slides tab
  const [slides, setSlides] = useState<Slide[]>([]);
  const [editingSlide, setEditingSlide] = useState<Partial<Slide> | null>(null);
  const [savingSlide, setSavingSlide] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'ok' | 'err'>('ok');

  // Suggestions tab
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [suggestionFilter, setSuggestionFilter] = useState<'' | 'pending' | 'approved' | 'rejected'>('');

  function showMsg(text: string, type: 'ok' | 'err' = 'ok') {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(''), 3500);
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr('');
    try {
      await signIn(email, password);
    } catch (err: any) {
      // Distinguir error de red vs credenciales incorrectas
      const status = err?.response?.status;
      if (status === 401) {
        setLoginErr('Credenciales incorrectas. Verifica tu email y contraseña.');
      } else if (!status) {
        setLoginErr('No se pudo conectar con el servidor. ¿Está el backend corriendo?');
      } else {
        setLoginErr(`Error del servidor (${status}). Intenta de nuevo.`);
      }
    }
  }

  // ── Data loading ────────────────────────────────────────────────────────────

  async function loadSubjects() {
    const s = await getSubjects(true);
    setSubjects(s);
  }

  async function loadStats(from = statsFrom, to = statsTo) {
    try {
      const raw = await getStats(from || undefined, to || undefined);
      // Endpoint devuelve { total, bySubject: [{ subject, slug, count, views? }] }
      const bySubject: { slug: string; subject: string; count: string | number; views?: string | number }[] =
        raw?.bySubject ?? (Array.isArray(raw) ? raw : []);

      const normalized: SubjectStat[] = bySubject.map((s, i) => ({
        id: i,
        name: s.subject ?? s.slug ?? '',
        slug: s.slug ?? '',
        count: typeof s.count === 'string' ? parseInt(s.count, 10) : (s.count ?? 0),
        views: typeof s.views === 'string' ? parseInt(s.views, 10) : (s.views ?? 0),
      }));

      setStats(normalized);
      const totR = typeof raw?.active === 'number' ? raw.active : normalized.reduce((a, s) => a + s.count, 0);
      const totV = normalized.reduce((a, s) => a + (s.views || 0), 0);
      setTotalResources(totR);
      setTotalViews(totV);
    } catch { }
  }

  async function loadResources() {
    setLoading(true);
    try {
      const res = await getResources({
        page, limit: 20,
        search: search || undefined,
        subjectId: filterSubject ? +filterSubject : undefined,
        course: filterCourse || undefined,
        activityType: filterActType || undefined,
        unitId: filterUnit ? +filterUnit : undefined,
      });
      setResources(res.data);
      setTotal(res.total);
    } finally { setLoading(false); }
  }

  async function loadExtendedStats(from = statsFrom, to = statsTo) {
    setLoadingStats(true);
    try {
      const f = from || undefined, t = to || undefined;
      const [top, byCourse, byType] = await Promise.all([
        getTopResources(20, f, t), getStatsByCourse(f, t), getStatsByActivityType(f, t),
      ]);
      setTopResources(top);
      setStatsByCourse(byCourse);
      setStatsByActType(byType);
    } catch { } finally { setLoadingStats(false); }
  }

  async function loadSuggestions(status?: string) {
    try {
      const data = await getSuggestions(status || undefined);
      setSuggestions(data);
    } catch { }
  }

  async function refreshPendingCount() {
    try {
      const { count } = await getPendingCount();
      setPendingCount(count ?? 0);
    } catch { }
  }

  async function loadCatalogCourses() {
    try {
      const [managed, derived] = await Promise.all([getCourses(), getDistinctCourses()]);
      setCatalogCourses(managed);
      setDerivedCourses(derived);
    } catch { }
  }
  async function loadCatalogActivityTypes() {
    try {
      const [managed, derived] = await Promise.all([getActivityTypes(), getDistinctActivityTypes()]);
      setCatalogActivityTypes(managed);
      setDerivedActTypes(derived);
    } catch { }
  }
  async function loadCatalogUnits() {
    try {
      const [all, byCourse] = await Promise.all([getUnits(), getUnitsByCourse()]);
      setCatalogUnits(all);
      setUnitsByCourse(byCourse);
    } catch { }
  }

  useEffect(() => {
    if (admin) {
      loadSubjects(); loadStats(); loadExtendedStats(); loadSuggestions(); refreshPendingCount(); loadSlides();
      loadCatalogCourses(); loadCatalogActivityTypes(); loadCatalogUnits();
      getAuthors().then(setAuthors).catch(() => { });
      getSettings().then((s: Record<string, string>) => {
        setShowViews(s.showViews !== 'false');
      }).catch(() => { });
    }
  }, [admin]);

  useEffect(() => {
    if (admin) loadResources();
  }, [admin, page, search, filterSubject, filterCourse, filterActType, filterUnit]);

  useEffect(() => {
    if (admin && tab === 'stats') {
      loadStats(statsFrom, statsTo);
      loadExtendedStats(statsFrom, statsTo);
    }
  }, [admin, tab, statsFrom, statsTo]);

  // ── Resource modal helpers ───────────────────────────────────────────────────

  async function openResourceModal(resource: Partial<Resource>) {
    setEditing(resource);
    setScrapeFields(new Set());
    const existing = (resource as any).activityType || '';
    setSelectedActTypes(existing ? existing.split(',').map((t: string) => t.trim()).filter(Boolean) : []);

    // Load catalog data + derived data from resources, merge for the selectors
    const [managed_c, managed_a, derived_c, derived_a] = await Promise.all([
      getCourses(), getActivityTypes(), getDistinctCourses(), getDistinctActivityTypes(),
    ]);
    // Union: catalog entries take precedence, derived fill the rest
    const managedCourseNames = new Set(managed_c.map((c: Course) => c.name));
    const extraCourses: Course[] = derived_c
      .filter(name => !managedCourseNames.has(name))
      .map((name, i) => ({ id: -(i + 1), name, isActive: true, sortOrder: 999 }));
    setModalCourses([...managed_c, ...extraCourses]);

    const managedTypeNames = new Set(managed_a.map((a: ActivityTypeItem) => a.name));
    const extraTypes: ActivityTypeItem[] = derived_a
      .filter(name => !managedTypeNames.has(name))
      .map((name, i) => ({ id: -(i + 1), name, isActive: true }));
    setModalActivityTypes([...managed_a, ...extraTypes]);

    if ((resource as any).subjectId) {
      setModalUnits(await getUnits((resource as any).subjectId));
    } else {
      setModalUnits([]);
    }
  }

  // ── CRUD Resources ──────────────────────────────────────────────────────────

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este recurso?')) return;
    await deleteResource(id);
    showMsg('Recurso eliminado'); loadResources(); loadStats();
    broadcastDataChange();
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.linkUrl?.trim()) { showMsg('La URL es obligatoria', 'err'); return; }
    if (!editing.title?.trim()) { showMsg('El título es obligatorio', 'err'); return; }
    if (!editing.description?.trim()) { showMsg('La descripción es obligatoria', 'err'); return; }
    if (!(editing as any).subjectId) { showMsg('La asignatura es obligatoria', 'err'); return; }
    if (!(editing as any).course?.trim()) { showMsg('El curso es obligatorio', 'err'); return; }
    if (!(editing as any).unitId) { showMsg('La unidad es obligatoria', 'err'); return; }
    if (selectedActTypes.length === 0) { showMsg('El tipo de actividad es obligatorio', 'err'); return; }
    if (!(editing as any).author?.trim()) { showMsg('El autor es obligatorio', 'err'); return; }
    const payload = { ...editing, activityType: selectedActTypes.join(',') };
    setSaving(true);
    try {
      if (editing.id) {
        await updateResource(editing.id, payload);
        showMsg('Recurso actualizado correctamente');
      } else {
        await createResource(payload);
        showMsg('Recurso creado');
      }
      setEditing(null); setScrapeFields(new Set());
      loadResources(); loadStats();
      broadcastDataChange();
    } catch { showMsg('Error al guardar', 'err'); }
    finally { setSaving(false); }
  }

  // ── CRUD Subjects ───────────────────────────────────────────────────────────

  async function handleSaveSubject() {
    if (!editingSubject || !editingSubject.name?.trim()) {
      showMsg('El nombre es obligatorio', 'err'); return;
    }
    setSavingSubject(true);
    try {
      if (editingSubject.id) {
        await updateSubject(editingSubject.id, editingSubject);
        showMsg('Asignatura actualizada');
      } else {
        await createSubject({
          ...editingSubject,
          slug: editingSubject.name!.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          isActive: true,
          order: subjects.length + 1,
        });
        showMsg('Asignatura creada');
      }
      setEditingSubject(null); loadSubjects(); loadStats();
      broadcastDataChange();
    } catch { showMsg('Error al guardar asignatura', 'err'); }
    finally { setSavingSubject(false); }
  }

  // ── Suggestions handlers ────────────────────────────────────────────────────

  async function handleApproveSuggestion(id: number) {
    try {
      await approveSuggestion(id);
      showMsg('Sugerencia aprobada');
      loadSuggestions(suggestionFilter || undefined);
      refreshPendingCount();
    } catch { showMsg('Error al aprobar', 'err'); }
  }

  async function handleRejectSuggestion(id: number) {
    try {
      await rejectSuggestion(id);
      showMsg('Sugerencia rechazada');
      loadSuggestions(suggestionFilter || undefined);
      refreshPendingCount();
    } catch { showMsg('Error al rechazar', 'err'); }
  }

  async function handleDeleteSuggestion(id: number) {
    if (!confirm('¿Eliminar esta sugerencia definitivamente?')) return;
    try {
      await deleteSuggestion(id);
      showMsg('Sugerencia eliminada');
      loadSuggestions(suggestionFilter || undefined);
      refreshPendingCount();
    } catch { showMsg('Error al eliminar', 'err'); }
  }

  // ── Slides / Carousel handlers ──────────────────────────────────────────────

  async function loadSlides() {
    try { setSlides(await getAllSlides()); } catch { }
  }

  async function handleSaveSlide() {
    if (!editingSlide || !editingSlide.title?.trim()) {
      showMsg('El título es obligatorio', 'err'); return;
    }
    setSavingSlide(true);
    try {
      if (editingSlide.id) {
        await updateSlide(editingSlide.id, editingSlide);
        showMsg('Slide actualizado');
      } else {
        await createSlide({ ...editingSlide, isActive: editingSlide.isActive ?? true });
        showMsg('Slide creado');
      }
      setEditingSlide(null);
      await loadSlides();
      broadcastDataChange();
    } catch { showMsg('Error al guardar slide', 'err'); }
    finally { setSavingSlide(false); }
  }

  async function handleDeleteSlide(id: number) {
    if (!confirm('¿Eliminar este slide?')) return;
    try {
      await deleteSlide(id);
      showMsg('Slide eliminado');
      await loadSlides();
      broadcastDataChange();
    } catch { showMsg('Error al eliminar', 'err'); }
  }

  async function handleMoveSlide(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= slides.length) return;
    const newOrder = slides.map(s => s.id);
    [newOrder[index], newOrder[next]] = [newOrder[next], newOrder[index]];
    await reorderSlides(newOrder);
    await loadSlides();
    broadcastDataChange();
  }


  async function handleUploadImage(file: File) {
    setUploadingImg(true);
    try {
      const { url } = await uploadSlideImage(file);
      // url is like /uploads/slides/filename.jpg — proxy via Next.js rewrite
      setEditingSlide(prev => ({ ...prev!, imageUrl: url }));
      showMsg('Imagen subida correctamente');
    } catch { showMsg('Error al subir imagen', 'err'); }
    finally { setUploadingImg(false); }
  }

  async function handleDeleteSubject(id: number) {
    const s = subjects.find(s => s.id === id);
    if (!confirm(`¿Eliminar permanentemente "${s?.name}"?\n\nLa asignatura quedará eliminada del sistema (los recursos asociados no se borran). Para ocultarla del sidebar sin eliminarla, usa "Editar → Inactiva".`)) return;
    try {
      await deleteSubject(id);
      showMsg('Asignatura eliminada'); loadSubjects(); loadStats();
      broadcastDataChange();
    } catch { showMsg('No se pudo eliminar', 'err'); }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────────────────────────

  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="PaperFlix" style={{ height: 36, width: 'auto', objectFit: 'contain' }} />
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full ml-2" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--muted)' }}>Admin</span>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                className="w-full px-4 rounded-xl outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 48 }} />
            </div>
            <div>
              <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Contraseña</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••"
                className="w-full px-4 rounded-xl outline-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 48 }} />
            </div>
            {loginErr && <p className="text-red-400 text-sm">{loginErr}</p>}
            <button type="submit"
              className="w-full rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              style={{ background: 'var(--accent)', color: '#1e0d38', height: 52 }}>
              <LogIn size={17} /> Ingresar al Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PANEL PRINCIPAL
  // ─────────────────────────────────────────────────────────────────────────────

  const maxCount = Math.max(...stats.map(s => s.count), 1);
  const topByViews = [...stats].sort((a, b) => (b.views || 0) - (a.views || 0));
  const activeSubs = subjects.filter(s => s.isActive).length;

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Panel de Administración</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Bienvenido, {admin.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowBulk(true); setBulkRows([]); setBulkResult(null); }}
            className="flex items-center gap-2 px-4 rounded-xl text-sm font-semibold"
            style={{ height: 44, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}
          >
            <FileSpreadsheet size={15} /> Carga masiva
          </button>
          <button
            onClick={() => openResourceModal({})}
            className="flex items-center gap-2 px-5 rounded-xl text-sm font-bold"
            style={{ background: 'var(--accent)', color: '#1e0d38', height: 44 }}
          >
            <Plus size={16} /> Nuevo Recurso
          </button>
          <button
            onClick={signOut}
            className="flex items-center justify-center rounded-xl px-3"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted)', height: 44, minWidth: 44 }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* ── Toast ──────────────────────────────────────────────────── */}
      {msg && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{
            background: msgType === 'ok' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            color: msgType === 'ok' ? '#34d399' : '#f87171',
            border: `1px solid ${msgType === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}
        >
          {msgType === 'ok' ? <Check size={15} /> : <X size={15} />} {msg}
        </div>
      )}

      {/* ── KPI Strip ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Database} label="Total recursos" value={totalResources.toLocaleString()} color="#7c3aed" />
        <KpiCard icon={Eye} label="Visualizaciones" value={totalViews.toLocaleString()} color="#3b82f6" />
        <KpiCard icon={BookOpen} label="Asignaturas activas" value={activeSubs} color="#10b981" />
        <KpiCard icon={TrendingUp} label="Promedio vistas/rec" value={totalResources ? Math.round(totalViews / totalResources) : 0} color="#f59e0b" />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto">
        {([
          { key: 'resources', label: `Recursos (${total})`, icon: Database },
          { key: 'stats', label: 'Estadísticas', icon: BarChart2 },
          { key: 'subjects', label: 'Asignaturas', icon: Layers },
          { key: 'suggestions', label: 'Sugerencias', icon: Lightbulb },
          { key: 'carousel', label: 'Carrusel', icon: Monitor },
          { key: 'catalogs', label: 'Catálogos', icon: Layers },
          { key: 'config', label: 'Configuración', icon: Star },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              if (key === 'suggestions') loadSuggestions(suggestionFilter || undefined);
              if (key === 'carousel') { loadSlides(); setPreviewIdx(0); }
              if (key === 'catalogs') { loadCatalogCourses(); loadCatalogActivityTypes(); loadCatalogUnits(); }
              if (key === 'stats') loadExtendedStats();
            }}
            className="flex items-center gap-2 px-4 rounded-xl text-sm font-medium transition-colors shrink-0"
            style={{
              height: 44,
              background: tab === key ? 'var(--purple)' : 'var(--card)',
              color: tab === key ? '#fff' : 'var(--muted)',
              border: `1px solid ${tab === key ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
            }}
          >
            <Icon size={15} /> {label}
            {key === 'suggestions' && pendingCount > 0 && (
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                style={{ background: '#ef4444', color: '#fff' }}
              >
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          TAB: RECURSOS
      ══════════════════════════════════════════════════════════════ */}
      {tab === 'resources' && (
        <>
          {/* Filtros */}
          {(() => {
            const activeCount = [filterSubject, filterCourse, filterActType, filterUnit].filter(Boolean).length;
            const clearAll = () => {
              setFilterSubject(''); setFilterCourse(''); setFilterActType('');
              setFilterUnit(''); setFilterUnits([]); setSearch(''); setPage(1);
            };
            return (
              <div className="space-y-2">
                {/* Barra principal */}
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1" style={{ minWidth: 200 }}>
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
                    <input
                      value={search}
                      onChange={e => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Buscar por título, descripción…"
                      className="w-full pl-9 pr-3 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', height: 44 }}
                    />
                  </div>
                  <button
                    onClick={() => setShowAdvanced(v => !v)}
                    className="flex items-center gap-2 px-4 rounded-xl text-sm font-medium shrink-0"
                    style={{
                      height: 44,
                      background: showAdvanced || activeCount > 0 ? 'rgba(124,58,237,0.15)' : 'var(--card)',
                      border: `1px solid ${showAdvanced || activeCount > 0 ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`,
                      color: showAdvanced || activeCount > 0 ? '#c4b5fd' : 'var(--muted)',
                    }}
                  >
                    <Database size={14} /> Filtros
                    {activeCount > 0 && (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                        style={{ background: 'var(--purple)', color: '#fff' }}>
                        {activeCount}
                      </span>
                    )}
                  </button>
                  {activeCount > 0 && (
                    <button onClick={clearAll}
                      className="flex items-center gap-1.5 px-3 rounded-xl text-xs font-medium shrink-0"
                      style={{ height: 44, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                      <X size={13} /> Limpiar
                    </button>
                  )}
                </div>

                {/* Panel de filtros avanzados */}
                {showAdvanced && (
                  <div className="rounded-xl p-4 grid grid-cols-2 lg:grid-cols-4 gap-3"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    {/* Asignatura */}
                    <div>
                      <label className="text-[11px] mb-1 block font-medium" style={{ color: 'var(--muted)' }}>Asignatura</label>
                      <select value={filterSubject}
                        onChange={async e => {
                          const val = e.target.value;
                          setFilterSubject(val); setFilterUnit(''); setPage(1);
                          if (val) setFilterUnits(await getUnits(+val));
                          else setFilterUnits([]);
                        }}
                        className="w-full px-3 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--bg)', border: `1px solid ${filterSubject ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`, color: 'var(--text)', height: 40 }}>
                        <option value="">Todas</option>
                        {subjects.map(s => <option key={s.id} value={s.id} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{s.name}</option>)}
                      </select>
                    </div>

                    {/* Unidad */}
                    <div>
                      <label className="text-[11px] mb-1 block font-medium" style={{ color: 'var(--muted)' }}>Unidad / Objetivo</label>
                      <select value={filterUnit}
                        onChange={e => { setFilterUnit(e.target.value); setPage(1); }}
                        disabled={!filterUnits.length}
                        className="w-full px-3 rounded-xl text-sm outline-none disabled:opacity-40"
                        style={{ background: 'var(--bg)', border: `1px solid ${filterUnit ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`, color: 'var(--text)', height: 40 }}>
                        <option value="">Todas</option>
                        {filterUnits.map(u => <option key={u.id} value={u.id} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{u.name}</option>)}
                      </select>
                    </div>

                    {/* Curso */}
                    <div>
                      <label className="text-[11px] mb-1 block font-medium" style={{ color: 'var(--muted)' }}>Curso</label>
                      <select value={filterCourse}
                        onChange={e => { setFilterCourse(e.target.value); setPage(1); }}
                        className="w-full px-3 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--bg)', border: `1px solid ${filterCourse ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`, color: 'var(--text)', height: 40 }}>
                        <option value="">Todos</option>
                        {sortCourses(derivedCourses.map((name, i) => ({ id: i, name, isActive: true, sortOrder: i }))).map(c => (
                          <option key={c.name} value={c.name} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tipo de actividad */}
                    <div>
                      <label className="text-[11px] mb-1 block font-medium" style={{ color: 'var(--muted)' }}>Tipo de actividad</label>
                      <select value={filterActType}
                        onChange={e => { setFilterActType(e.target.value); setPage(1); }}
                        className="w-full px-3 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--bg)', border: `1px solid ${filterActType ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`, color: 'var(--text)', height: 40 }}>
                        <option value="">Todos</option>
                        {derivedActTypes.map(t => (
                          <option key={t} value={t} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Chips de filtros activos */}
                {activeCount > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {filterSubject && (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)' }}>
                        {subjects.find(s => String(s.id) === filterSubject)?.name}
                        <button onClick={() => { setFilterSubject(''); setFilterUnit(''); setFilterUnits([]); setPage(1); }}><X size={11} /></button>
                      </span>
                    )}
                    {filterUnit && (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)' }}>
                        {filterUnits.find(u => String(u.id) === filterUnit)?.name}
                        <button onClick={() => { setFilterUnit(''); setPage(1); }}><X size={11} /></button>
                      </span>
                    )}
                    {filterCourse && (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(245,197,24,0.15)', color: 'var(--accent)', border: '1px solid rgba(245,197,24,0.3)' }}>
                        {filterCourse}
                        <button onClick={() => { setFilterCourse(''); setPage(1); }}><X size={11} /></button>
                      </span>
                    )}
                    {filterActType && (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
                        {filterActType}
                        <button onClick={() => { setFilterActType(''); setPage(1); }}><X size={11} /></button>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Tabla */}
          <div className="rounded-xl overflow-auto" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['ID', 'Título', 'Asignatura', 'Curso', 'Tipo', 'Vistas', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--muted)' }}>Cargando...</td></tr>
                ) : resources.map(r => (
                  <tr key={r.id} className="border-t transition-colors hover:bg-white/[0.03]" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted)' }}>{r.id}</td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="font-medium text-white truncate">{r.title}</p>
                      {r.oaCode && <span className="text-[10px] font-mono" style={{ color: 'var(--accent)' }}>{r.oaCode}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{r.subject?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{r.course?.trim() || '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>{r.activityType?.split(',')[0] || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                        <Eye size={11} />{r.views}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openResourceModal(r)}
                          className="icon-btn flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                          style={{ color: 'var(--muted)', width: 36, height: 36 }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="icon-btn flex items-center justify-center rounded-lg hover:bg-red-500/20 transition-colors text-red-400"
                          style={{ width: 36, height: 36 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between text-sm" style={{ color: 'var(--muted)' }}>
            <span>Mostrando {resources.length} de {total}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 rounded-xl disabled:opacity-30 hover:bg-white/5 transition-colors"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', height: 44 }}
              >
                ← Anterior
              </button>
              <button
                disabled={resources.length < 20}
                onClick={() => setPage(p => p + 1)}
                className="px-4 rounded-xl disabled:opacity-30 hover:bg-white/5 transition-colors"
                style={{ background: 'var(--card)', border: '1px solid var(--border)', height: 44 }}
              >
                Siguiente →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB: ESTADÍSTICAS
      ══════════════════════════════════════════════════════════════ */}
      {tab === 'stats' && (() => {
        const maxViews = Math.max(...stats.map(s => s.views || 0), 1);
        const maxCourseViews = Math.max(...statsByCourse.map(c => +c.views || 0), 1);
        const totalActViews = statsByActType.reduce((a, t) => a + (+t.count || 0), 0);

        // ── Export helpers ──────────────────────────────────────────
        async function exportExcel() {
          const ExcelJS = (await import('exceljs')).default;
          const wb = new ExcelJS.Workbook();
          wb.creator = 'PaperFlix Admin';
          wb.created = new Date();
          const date = new Date().toLocaleDateString('es-CL');
          const periodLabel = statsFrom || statsTo
            ? `${statsFrom || 'inicio'} → ${statsTo || 'hoy'}`
            : 'Todo el período';
          const fileName = `paperflix-estadisticas-${statsFrom || statsTo ? `${statsFrom || 'inicio'}_${statsTo || 'hoy'}` : new Date().toISOString().slice(0, 10)}.xlsx`;

          // ── Paleta ───────────────────────────────────────────────────
          const C = {
            purple: '5B21B6', purpleLight: 'EDE9FE', purpleDark: '3B0764',
            accent: 'F5C518', accentLight: 'FEF9C3',
            green: '059669', greenLight: 'D1FAE5',
            blue: '1D4ED8', blueLight: 'DBEAFE',
            rowEven: 'F5F3FF', rowOdd: 'FFFFFF',
            text: '1E1B4B', muted: '6B7280', white: 'FFFFFF',
            border: 'C4B5FD',
          } as const;

          // ── Shared helpers ───────────────────────────────────────────
          const borderAll = (color: string = C.border) => ({
            top: { style: 'thin' as const, color: { argb: color } },
            left: { style: 'thin' as const, color: { argb: color } },
            bottom: { style: 'thin' as const, color: { argb: color } },
            right: { style: 'thin' as const, color: { argb: color } },
          });
          const borderBottom = (color: string = C.border) => ({
            bottom: { style: 'medium' as const, color: { argb: color } },
          });

          function styleHeader(row: ExcelJS.Row, bgColor: string = C.purple) {
            row.height = 28;
            row.eachCell(cell => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
              cell.font = { bold: true, color: { argb: C.white }, size: 11, name: 'Calibri' };
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
              cell.border = borderBottom();
            });
          }

          function styleTitle(row: ExcelJS.Row) {
            row.height = 36;
            row.getCell(1).value = row.getCell(1).value;
            row.getCell(1).font = { bold: true, color: { argb: C.white }, size: 16, name: 'Calibri' };
            row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.purpleDark } };
            row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
          }

          function styleSub(row: ExcelJS.Row, cols: number) {
            row.height = 18;
            for (let c = 1; c <= cols; c++) {
              const cell = row.getCell(c);
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.purpleDark } };
              cell.font = { italic: true, color: { argb: 'A78BFA' }, size: 9, name: 'Calibri' };
            }
          }

          function styleDataRow(row: ExcelJS.Row, even: boolean, numCols: number[], total?: number) {
            const bg = even ? C.rowEven : C.rowOdd;
            row.height = 20;
            row.eachCell({ includeEmpty: true }, (cell, colNum) => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
              cell.font = { size: 10, name: 'Calibri', color: { argb: C.text } };
              cell.border = borderAll();
              if (numCols.includes(colNum)) {
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.numFmt = '#,##0';
              } else {
                cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
              }
            });
          }

          function addKpiBlock(ws: ExcelJS.Worksheet, startRow: number, items: { label: string; value: string | number; color: string }[]) {
            items.forEach((kpi, i) => {
              const col = i + 1;
              const r1 = ws.getRow(startRow);
              const r2 = ws.getRow(startRow + 1);
              const r3 = ws.getRow(startRow + 2);
              r1.height = 10;
              r2.height = 30;
              r3.height = 18;
              const c1 = r2.getCell(col);
              c1.value = kpi.value;
              c1.font = { bold: true, size: 18, color: { argb: kpi.color }, name: 'Calibri' };
              c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F3FF' } };
              c1.alignment = { horizontal: 'center', vertical: 'middle' };
              c1.border = { top: { style: 'medium', color: { argb: kpi.color } }, ...borderAll('E5E7EB') };
              const c2 = r3.getCell(col);
              c2.value = kpi.label;
              c2.font = { size: 9, italic: true, color: { argb: C.muted }, name: 'Calibri' };
              c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F5F3FF' } };
              c2.alignment = { horizontal: 'center' };
              c2.border = { ...borderAll('E5E7EB'), bottom: { style: 'medium', color: { argb: kpi.color } } };
            });
          }

          // ════════════════════════════════════════════════════════════
          // Hoja 1 — Resumen general
          // ════════════════════════════════════════════════════════════
          const ws1 = wb.addWorksheet('📊 Resumen', {
            properties: { tabColor: { argb: C.purple } },
            pageSetup: { fitToPage: true, fitToWidth: 1 },
          });
          ws1.columns = [
            { key: 'a', width: 34 }, { key: 'b', width: 16 },
            { key: 'c', width: 16 }, { key: 'd', width: 14 },
          ];

          // Título
          ws1.mergeCells('A1:D1'); ws1.mergeCells('A2:D2');
          ws1.getRow(1).getCell(1).value = '  PaperFlix — Reporte de Estadísticas';
          styleTitle(ws1.getRow(1));
          ws1.getRow(2).getCell(1).value = `  Generado el ${date}  ·  Período: ${periodLabel}`;
          styleSub(ws1.getRow(2), 4);
          ws1.getRow(3).height = 10;

          // KPIs
          addKpiBlock(ws1, 4, [
            { label: 'Total recursos', value: totalResources, color: C.purple },
            { label: 'Vistas acumuladas', value: totalViews, color: C.blue },
            { label: 'Promedio vistas/rec.', value: totalResources ? Math.round(totalViews / totalResources) : 0, color: C.green },
            { label: 'Asignaturas activas', value: stats.length, color: '7C3AED' },
          ]);
          ws1.getRow(8).height = 14;

          // Tabla asignaturas
          const hRow1 = ws1.getRow(9);
          hRow1.values = ['', 'Asignatura', 'Recursos', 'Vistas', '% del total'];
          // re-set properly with correct columns
          const h1 = ws1.addRow(['#', 'Asignatura', 'Recursos', 'Vistas', '% del total']);
          // remove last and redo from row 9
          ws1.spliceRows(9, 1);
          const tableHeader = ws1.insertRow(9, ['#', 'Asignatura', 'Recursos', 'Vistas', '% del total']);
          ws1.columns = [
            { key: 'num', width: 6 }, { key: 'name', width: 34 },
            { key: 'count', width: 14 }, { key: 'views', width: 16 }, { key: 'pct', width: 14 },
          ];
          styleHeader(tableHeader);

          const sortedStats = [...stats].sort((a, b) => (b.views || 0) - (a.views || 0));
          sortedStats.forEach((s, i) => {
            const row = ws1.addRow([
              i + 1, s.name, s.count, s.views || 0,
              totalViews > 0 ? (s.views || 0) / totalViews : 0,
            ]);
            styleDataRow(row, i % 2 === 0, [1, 3, 4, 5]);
            row.getCell(5).numFmt = '0.0%';
            // Color dot on rank col
            if (i < 3) {
              row.getCell(1).font = { bold: true, color: { argb: C.accent }, name: 'Calibri', size: 10 };
              row.getCell(2).font = { bold: true, color: { argb: C.purple }, name: 'Calibri', size: 10 };
            }
          });
          const spacerRow = ws1.addRow([]);
          spacerRow.height = 6;
          ws1.views = [{ state: 'frozen', xSplit: 0, ySplit: 9 }];
          ws1.autoFilter = { from: 'A9', to: 'E9' };

          // ════════════════════════════════════════════════════════════
          // Hoja 2 — Por Curso
          // ════════════════════════════════════════════════════════════
          const ws2 = wb.addWorksheet('🎓 Por Curso', {
            properties: { tabColor: { argb: C.accent } },
          });
          ws2.columns = [
            { key: 'num', width: 6 }, { key: 'course', width: 28 },
            { key: 'count', width: 14 }, { key: 'views', width: 16 }, { key: 'pct', width: 14 },
          ];
          ws2.mergeCells('A1:E1'); ws2.mergeCells('A2:E2');
          ws2.getRow(1).getCell(1).value = '  PaperFlix — Estadísticas por Curso';
          styleTitle(ws2.getRow(1));
          ws2.getRow(2).getCell(1).value = `  ${date} · ${statsByCourse.length} cursos`;
          styleSub(ws2.getRow(2), 5);
          ws2.getRow(3).height = 10;

          const h2 = ws2.addRow(['#', 'Curso', 'Recursos', 'Vistas', '% de vistas']);
          styleHeader(h2, '92400E'); // amber dark
          h2.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '78350F' } }; });

          const sortedCourses = sortCourses(statsByCourse.map(c => ({ ...c, name: c.course })));
          const totalCVis = statsByCourse.reduce((a, c) => a + (+c.views || 0), 0);
          sortedCourses.forEach((c, i) => {
            const row = ws2.addRow([i + 1, c.course, +c.count, +c.views || 0, totalCVis > 0 ? (+c.views || 0) / totalCVis : 0]);
            styleDataRow(row, i % 2 === 0, [1, 3, 4, 5]);
            row.getCell(5).numFmt = '0.0%';
            row.getCell(2).font = { bold: i < 3, size: 10, color: { argb: i < 3 ? '92400E' : C.text }, name: 'Calibri' };
          });
          ws2.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
          ws2.autoFilter = { from: 'A4', to: 'E4' };

          // ════════════════════════════════════════════════════════════
          // Hoja 3 — Tipos de Actividad
          // ════════════════════════════════════════════════════════════
          const ws3 = wb.addWorksheet('🏷️ Tipos de Actividad', {
            properties: { tabColor: { argb: C.green } },
          });
          ws3.columns = [
            { key: 'num', width: 6 }, { key: 'type', width: 36 },
            { key: 'count', width: 14 }, { key: 'pct', width: 14 },
          ];
          ws3.mergeCells('A1:D1'); ws3.mergeCells('A2:D2');
          ws3.getRow(1).getCell(1).value = '  PaperFlix — Tipos de Actividad';
          styleTitle(ws3.getRow(1));
          ws3.getRow(2).getCell(1).value = `  ${date}`;
          styleSub(ws3.getRow(2), 4);
          ws3.getRow(3).height = 10;

          const h3 = ws3.addRow(['#', 'Tipo de actividad', 'Recursos', '% del total']);
          h3.eachCell(c => {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '065F46' } };
            c.font = { bold: true, color: { argb: C.white }, size: 11, name: 'Calibri' };
            c.alignment = { horizontal: 'center', vertical: 'middle' };
            c.border = borderBottom('6EE7B7');
          });
          h3.height = 28;

          statsByActType.forEach((t, i) => {
            const row = ws3.addRow([i + 1, t.activityType, +t.count, totalActViews > 0 ? +t.count / totalActViews : 0]);
            styleDataRow(row, i % 2 === 0, [1, 3, 4]);
            row.getCell(4).numFmt = '0.0%';
            const bg = i % 2 === 0 ? 'ECFDF5' : 'FFFFFF';
            row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }; });
          });
          ws3.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];
          ws3.autoFilter = { from: 'A4', to: 'D4' };

          // ════════════════════════════════════════════════════════════
          // Hoja 4 — Top Recursos
          // ════════════════════════════════════════════════════════════
          const ws4 = wb.addWorksheet('🔥 Top Recursos', {
            properties: { tabColor: { argb: C.blue } },
          });
          ws4.columns = [
            { key: 'rank', width: 6 }, { key: 'title', width: 52 },
            { key: 'subject', width: 24 }, { key: 'course', width: 18 },
            { key: 'actType', width: 22 }, { key: 'views', width: 12 },
          ];
          ws4.mergeCells('A1:F1'); ws4.mergeCells('A2:F2');
          ws4.getRow(1).getCell(1).value = '  PaperFlix — Top 20 Recursos Más Vistos';
          styleTitle(ws4.getRow(1));
          ws4.getRow(2).getCell(1).value = `  ${date}`;
          styleSub(ws4.getRow(2), 6);
          ws4.getRow(3).height = 10;

          const h4 = ws4.addRow(['#', 'Título', 'Asignatura', 'Curso', 'Tipo', 'Vistas']);
          h4.eachCell(c => {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A5F' } };
            c.font = { bold: true, color: { argb: C.white }, size: 11, name: 'Calibri' };
            c.alignment = { horizontal: 'center', vertical: 'middle' };
            c.border = borderBottom('93C5FD');
          });
          h4.height = 28;

          topResources.forEach((r, i) => {
            const row = ws4.addRow([
              i + 1, r.title, r.subject?.name || '—', r.course || '—',
              r.activityType?.split(',')[0] || '—', r.views,
            ]);
            row.height = 22;
            const bg = i % 2 === 0 ? 'EFF6FF' : 'FFFFFF';
            row.eachCell((cell, col) => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
              cell.font = { size: 10, name: 'Calibri', color: { argb: C.text } };
              cell.border = borderAll('BFDBFE');
              cell.alignment = col === 6
                ? { horizontal: 'right', vertical: 'middle' }
                : { horizontal: col === 1 ? 'center' : 'left', vertical: 'middle', indent: col > 1 ? 1 : 0 };
              if (col === 6) cell.numFmt = '#,##0';
            });
            // Top 3 gold rank
            if (i < 3) {
              const medalColors = ['F5C518', 'C0C0C0', 'CD7F32'];
              row.getCell(1).font = { bold: true, size: 12, color: { argb: medalColors[i] }, name: 'Calibri' };
              row.getCell(2).font = { bold: true, size: 10, color: { argb: C.blue }, name: 'Calibri' };
              row.getCell(6).font = { bold: true, size: 10, color: { argb: '1D4ED8' }, name: 'Calibri' };
            }
          });
          ws4.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

          // ── Download ─────────────────────────────────────────────────
          const buf = await wb.xlsx.writeBuffer();
          const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(a.href);
        }

        function exportPDF() {
          const win = window.open('', '_blank');
          if (!win) return;
          const rows = (arr: any[][], head: string[]) =>
            `<table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${arr.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
          win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Estadísticas Paperflix</title>
            <style>body{font-family:sans-serif;padding:24px;color:#111}h1{color:#7c3aed}h2{color:#444;margin-top:28px;font-size:14px}
            table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
            th{background:#f3f0ff;padding:6px 10px;text-align:left;border:1px solid #ddd}
            td{padding:5px 10px;border:1px solid #eee}tr:nth-child(even){background:#fafafa}
            @media print{h2{page-break-before:auto}}</style></head><body>
            <h1>Estadísticas Paperflix — ${new Date().toLocaleDateString('es-CL')}</h1>
            <p>Período: <b>${statsFrom || statsTo ? `${statsFrom || 'inicio'} → ${statsTo || 'hoy'}` : 'Todo el período'}</b></p>
            <p>Total recursos: <b>${totalResources}</b> · Total vistas: <b>${totalViews.toLocaleString()}</b></p>
            <h2>Recursos por asignatura</h2>
            ${rows([...stats].sort((a, b) => b.count - a.count).map(s => [s.name, s.count, (s.views || 0).toLocaleString()]), ['Asignatura', 'Recursos', 'Vistas'])}
            <h2>Vistas por curso</h2>
            ${rows(statsByCourse.map(c => [c.course, c.count, (+c.views || 0).toLocaleString()]), ['Curso', 'Recursos', 'Vistas'])}
            <h2>Tipo de actividad</h2>
            ${rows(statsByActType.map(t => [t.activityType, t.count]), ['Tipo', 'Recursos'])}
            <h2>Top 20 recursos más vistos</h2>
            ${rows(topResources.map((r, i) => [i + 1, r.title, r.subject?.name || '—', r.course || '—', r.views]), ['#', 'Título', 'Asignatura', 'Curso', 'Vistas'])}
            </body></html>`);
          win.document.close(); win.focus(); setTimeout(() => win.print(), 400);
        }

        return (
          <div className="space-y-5">

            {/* ── Toolbar ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-white">Análisis de actividad</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {statsFrom || statsTo
                      ? `${statsFrom || '—'} → ${statsTo || '—'}`
                      : `Todos los períodos · ${new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={exportExcel}
                    className="flex items-center gap-2 px-4 rounded-xl text-sm font-semibold"
                    style={{ height: 40, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
                    <Database size={14} /> Exportar Excel
                  </button>
                  <button onClick={exportPDF}
                    className="flex items-center gap-2 px-4 rounded-xl text-sm font-semibold"
                    style={{ height: 40, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', color: '#c4b5fd' }}>
                    <Eye size={14} /> Exportar PDF
                  </button>
                </div>
              </div>

              {/* ── Date range bar ── */}
              {(() => {
                const now = new Date();
                const iso = (d: Date) => d.toISOString().slice(0, 10);
                const presets = [
                  { label: 'Todo', from: '', to: '' },
                  { label: 'Hoy', from: iso(now), to: iso(now) },
                  { label: 'Esta semana', from: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())), to: iso(now) },
                  { label: 'Este mes', from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) },
                  { label: 'Este año', from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) },
                  { label: 'Año anterior', from: iso(new Date(now.getFullYear() - 1, 0, 1)), to: iso(new Date(now.getFullYear() - 1, 11, 31)) },
                ];
                const active = presets.find(p => p.from === statsFrom && p.to === statsTo);
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    {presets.map(p => (
                      <button key={p.label}
                        onClick={() => { setStatsFrom(p.from); setStatsTo(p.to); }}
                        className="px-3 rounded-lg text-xs font-semibold transition-colors"
                        style={{
                          height: 30,
                          background: active?.label === p.label ? 'rgba(124,58,237,0.25)' : 'var(--card)',
                          border: `1px solid ${active?.label === p.label ? '#7c3aed' : 'var(--border)'}`,
                          color: active?.label === p.label ? '#c4b5fd' : 'var(--muted)',
                        }}>
                        {p.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 ml-1">
                      <input type="date" value={statsFrom} onChange={e => setStatsFrom(e.target.value)}
                        className="rounded-lg text-xs px-2"
                        style={{ height: 30, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', colorScheme: 'dark' }} />
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>→</span>
                      <input type="date" value={statsTo} onChange={e => setStatsTo(e.target.value)}
                        className="rounded-lg text-xs px-2"
                        style={{ height: 30, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', colorScheme: 'dark' }} />
                      {(statsFrom || statsTo) && (
                        <button onClick={() => { setStatsFrom(''); setStatsTo(''); }}
                          className="flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                          style={{ width: 30, height: 30, color: 'var(--muted)' }}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── KPI Strip ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total recursos', value: totalResources.toLocaleString(), sub: 'en el catálogo', color: '#7c3aed' },
                { label: 'Total vistas', value: totalViews.toLocaleString(), sub: 'acumuladas', color: '#3b82f6' },
                { label: 'Promedio vistas', value: totalResources ? Math.round(totalViews / totalResources) : 0, sub: 'por recurso', color: '#10b981' },
                { label: 'Asignatura líder', value: topByViews[0]?.name?.split(' ')[0] || '—', sub: `${(topByViews[0]?.views || 0).toLocaleString()} vistas`, color: '#f59e0b' },
              ].map(k => (
                <div key={k.label} className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${k.color}20`, color: k.color }}>
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-white leading-none">{k.value}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{k.label}</p>
                    <p className="text-[10px]" style={{ color: k.color }}>{k.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Row: Asignaturas + Cursos ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Recursos por asignatura */}
              <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart2 size={16} style={{ color: 'var(--purple)' }} /> Asignaturas
                  </h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd' }}>por vistas</span>
                </div>
                {[...stats].sort((a, b) => (b.views || 0) - (a.views || 0)).map((s, i) => {
                  const pct = Math.round(((s.views || 0) / maxViews) * 100);
                  const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                  return (
                    <div key={s.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                          <span className="text-xs font-medium text-white truncate max-w-[140px]">{s.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--muted)' }}>
                          <span>{s.count} rec.</span>
                          <span className="flex items-center gap-1 font-semibold" style={{ color }}><Eye size={10} />{(s.views || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg,${color}99,${color})` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vistas por curso */}
              <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers size={16} style={{ color: 'var(--accent)' }} /> Cursos
                  </h3>
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,197,24,0.12)', color: 'var(--accent)' }}>por vistas</span>
                </div>
                {loadingStats ? <p className="text-xs" style={{ color: 'var(--muted)' }}>Cargando…</p>
                  : sortCourses(statsByCourse.map(c => ({ ...c, name: c.course }))).map((c, i) => {
                    const pct = Math.round(((+c.views || 0) / maxCourseViews) * 100);
                    const color = SUBJECT_COLORS[(i + 2) % SUBJECT_COLORS.length];
                    return (
                      <div key={c.course}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-xs font-medium text-white">{c.course}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--muted)' }}>
                            <span>{c.count} rec.</span>
                            <span className="flex items-center gap-1 font-semibold" style={{ color }}><Eye size={10} />{(+c.views || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg,${color}99,${color})` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* ── Mapa de calor (grid uniforme) ── */}
            <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Star size={16} style={{ color: 'var(--accent)' }} /> Mapa de calor — actividad por asignatura
                </h3>
                <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--muted)' }}>
                  <span>Baja</span>
                  <div className="flex gap-0.5">
                    {[0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map(v => (
                      <span key={v} className="block rounded-sm" style={{ width: 14, height: 14, background: `rgba(124,58,237,${v})` }} />
                    ))}
                  </div>
                  <span>Alta</span>
                </div>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                {[...stats].sort((a, b) => (b.views || 0) - (a.views || 0)).map((s, i) => {
                  const intensity = (s.views || 0) / maxViews;
                  const viewsPct = totalViews > 0 ? ((s.views || 0) / totalViews * 100).toFixed(1) : '0';
                  return (
                    <div key={s.id} className="rounded-xl p-3 flex flex-col gap-1"
                      title={`${s.name} · ${(s.views || 0).toLocaleString()} vistas · ${s.count} recursos`}
                      style={{
                        background: `rgba(124,58,237,${0.08 + intensity * 0.55})`,
                        border: `1px solid rgba(124,58,237,${0.15 + intensity * 0.45})`,
                      }}>
                      <p className="text-xs font-bold text-white leading-tight truncate">{s.name}</p>
                      <p className="text-lg font-extrabold leading-none" style={{ color: `rgba(${hexToRgb(SUBJECT_COLORS[i % SUBJECT_COLORS.length])},${0.6 + intensity * 0.4})` }}>
                        {(s.views || 0).toLocaleString()}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.count} rec.</span>
                        <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>{viewsPct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Row: Tipos de actividad + Top recursos ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Tipo de actividad */}
              <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Lightbulb size={16} style={{ color: '#f59e0b' }} /> Distribución por tipo de actividad
                </h3>
                {loadingStats ? <p className="text-xs" style={{ color: 'var(--muted)' }}>Cargando…</p>
                  : statsByActType.length === 0 ? <p className="text-xs" style={{ color: 'var(--muted)' }}>Sin datos</p>
                    : (() => {
                      const maxTypeCount = Math.max(...statsByActType.map(t => +t.count), 1);
                      return statsByActType.slice(0, 12).map((t, i) => {
                        const pct = Math.round((+t.count / totalActViews) * 100);
                        const barPct = Math.round((+t.count / maxTypeCount) * 100);
                        const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
                        return (
                          <div key={t.activityType} className="flex items-center gap-3">
                            <span className="text-xs text-white shrink-0 truncate" style={{ width: 120 }}>{t.activityType}</span>
                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
                              <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: color }} />
                            </div>
                            <span className="text-[11px] font-bold shrink-0 w-8 text-right" style={{ color }}>{pct}%</span>
                            <span className="text-[11px] shrink-0 w-10 text-right" style={{ color: 'var(--muted)' }}>{t.count}</span>
                          </div>
                        );
                      });
                    })()}
              </div>

              {/* Top recursos más vistos */}
              <div className="rounded-xl p-5 space-y-2" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp size={16} style={{ color: '#10b981' }} /> Top 10 recursos más vistos
                </h3>
                {loadingStats ? <p className="text-xs" style={{ color: 'var(--muted)' }}>Cargando…</p>
                  : topResources.slice(0, 10).map((r, i) => (
                    <div key={r.id} className="flex items-center gap-3 py-1.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-extrabold shrink-0"
                        style={{ background: i < 3 ? 'var(--accent)' : 'rgba(255,255,255,0.06)', color: i < 3 ? '#1e0d38' : 'var(--muted)' }}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{r.title}</p>
                        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                          {r.subject?.name || '—'}{r.course ? ` · ${r.course}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold shrink-0" style={{ color: '#3b82f6' }}>
                        <Eye size={11} />{r.views.toLocaleString()}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════
          TAB: ASIGNATURAS
      ══════════════════════════════════════════════════════════════ */}
      {tab === 'subjects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {subjects.length} asignatura{subjects.length !== 1 ? 's' : ''} en el sistema
            </p>
            <button
              onClick={() => setEditingSubject({ color: '#7c3aed' })}
              className="flex items-center gap-2 px-4 rounded-xl text-sm font-bold"
              style={{ background: 'var(--accent)', color: '#1e0d38', height: 44 }}
            >
              <Plus size={15} /> Nueva Asignatura
            </button>
          </div>

          <div className="space-y-2">
            {subjects.map((s, i) => {
              const stat = stats.find(st => st.slug === s.slug);
              const isDragging = dragSubjectId === s.id;
              const isOver = dragOverSubjectId === s.id;
              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => { setDragSubjectId(s.id); setDragOverSubjectId(null); }}
                  onDragEnd={() => { setDragSubjectId(null); setDragOverSubjectId(null); }}
                  onDragOver={e => { e.preventDefault(); if (dragSubjectId !== s.id) setDragOverSubjectId(s.id); }}
                  onDragLeave={() => setDragOverSubjectId(null)}
                  onDrop={async () => {
                    if (dragSubjectId === null || dragSubjectId === s.id) { setDragSubjectId(null); setDragOverSubjectId(null); return; }
                    const list = [...subjects];
                    const fromIdx = list.findIndex(x => x.id === dragSubjectId);
                    const toIdx = list.findIndex(x => x.id === s.id);
                    if (fromIdx === -1 || toIdx === -1) return;
                    list.splice(toIdx, 0, list.splice(fromIdx, 1)[0]);
                    const reordered = list.map((x, idx) => ({ id: x.id, order: idx + 1 }));
                    setDragSubjectId(null); setDragOverSubjectId(null);
                    setSubjects(list);
                    try { await reorderSubjects(reordered); broadcastDataChange(); }
                    catch { showMsg('Error al reordenar', 'err'); loadSubjects(); }
                  }}
                  className="flex items-center gap-4 p-4 rounded-xl transition-all"
                  style={{
                    background: isOver ? 'rgba(124,58,237,0.08)' : 'var(--card)',
                    border: `1px solid ${isOver ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
                    borderTop: isOver ? '2px solid rgba(124,58,237,0.5)' : undefined,
                    opacity: isDragging ? 0.4 : 1,
                    cursor: 'grab',
                  }}
                >
                  {/* Drag handle */}
                  <span className="shrink-0 flex flex-col gap-[3px] opacity-25 hover:opacity-60 transition-opacity" style={{ cursor: 'grab' }}>
                    {[0, 1, 2].map(i => <span key={i} className="block rounded-full" style={{ width: 16, height: 2.5, background: 'var(--muted)' }} />)}
                  </span>

                  {/* Order badge */}
                  <span className="text-xs font-mono w-5 text-center shrink-0" style={{ color: 'var(--muted)' }}>{i + 1}</span>

                  {/* Color avatar */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg shrink-0"
                    style={{ background: `${s.color || SUBJECT_COLORS[i % SUBJECT_COLORS.length]}22`, color: s.color || SUBJECT_COLORS[i % SUBJECT_COLORS.length] }}
                  >
                    {s.name.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{s.name}</p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      /{s.slug} · {stat?.count ?? 0} recursos · {(stat?.views || 0).toLocaleString()} vistas
                    </p>
                  </div>

                  <span
                    className="text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0"
                    style={{
                      background: s.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                      color: s.isActive ? '#34d399' : '#f87171',
                    }}
                  >
                    {s.isActive ? 'Activa' : 'Inactiva'}
                  </span>

                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setEditingSubject(s)}
                      className="icon-btn flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                      style={{ color: 'var(--muted)', width: 36, height: 36 }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteSubject(s.id)}
                      className="icon-btn flex items-center justify-center rounded-lg hover:bg-red-500/20 transition-colors text-red-400"
                      style={{ width: 36, height: 36 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB: SUGERENCIAS
      ══════════════════════════════════════════════════════════════ */}
      {tab === 'suggestions' && (
        <div className="space-y-4">

          {/* Filtro de estado */}
          <div className="flex gap-2 flex-wrap">
            {([
              { val: '', label: 'Todas' },
              { val: 'pending', label: 'Pendientes' },
              { val: 'approved', label: 'Aprobadas' },
              { val: 'rejected', label: 'Rechazadas' },
            ] as const).map(({ val, label }) => (
              <button
                key={val}
                onClick={() => {
                  setSuggestionFilter(val);
                  loadSuggestions(val || undefined);
                }}
                className="px-4 rounded-xl text-sm font-medium transition-colors"
                style={{
                  height: 40,
                  background: suggestionFilter === val ? 'var(--purple)' : 'var(--card)',
                  color: suggestionFilter === val ? '#fff' : 'var(--muted)',
                  border: `1px solid ${suggestionFilter === val ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
                }}
              >
                {label}
                {val === 'pending' && pendingCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                    style={{ background: '#ef4444', color: '#fff' }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Lista de sugerencias */}
          {suggestions.length === 0 ? (
            <div className="py-12 text-center rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
              <p className="text-3xl mb-2">💡</p>
              <p className="text-sm">No hay sugerencias{suggestionFilter ? ` con estado "${suggestionFilter}"` : ''}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map(s => (
                <div
                  key={s.id}
                  className="rounded-xl p-4 space-y-3"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  {/* Fila superior */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-white">{s.title}</p>
                        {/* Badge de estado */}
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            background: s.status === 'pending'
                              ? 'rgba(245,197,24,0.15)'
                              : s.status === 'approved'
                                ? 'rgba(16,185,129,0.15)'
                                : 'rgba(239,68,68,0.12)',
                            color: s.status === 'pending' ? 'var(--accent)'
                              : s.status === 'approved' ? '#34d399' : '#f87171',
                          }}
                        >
                          {s.status === 'pending' ? '⏳ Pendiente' : s.status === 'approved' ? '✓ Aprobada' : '✗ Rechazada'}
                        </span>
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
                        {s.teacherName && <span>👤 {s.teacherName}</span>}
                        {s.subjectName && <span>📚 {s.subjectName}</span>}
                        {s.course && <span>🎓 {s.course}</span>}
                        {s.activityType && <span>🏷 {s.activityType}</span>}
                        <span>📅 {new Date(s.createdAt).toLocaleDateString('es-CL')}</span>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-1 shrink-0">
                      {s.linkUrl && (
                        <a
                          href={s.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="icon-btn flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                          style={{ color: 'var(--muted)', width: 36, height: 36 }}
                          title="Ver recurso"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      {s.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApproveSuggestion(s.id)}
                            className="icon-btn flex items-center justify-center rounded-lg transition-colors hover:bg-emerald-500/20 text-emerald-400"
                            style={{ width: 36, height: 36 }}
                            title="Aprobar"
                          >
                            <ThumbsUp size={14} />
                          </button>
                          <button
                            onClick={() => handleRejectSuggestion(s.id)}
                            className="icon-btn flex items-center justify-center rounded-lg transition-colors hover:bg-amber-500/20"
                            style={{ color: '#fbbf24', width: 36, height: 36 }}
                            title="Rechazar"
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteSuggestion(s.id)}
                        className="icon-btn flex items-center justify-center rounded-lg hover:bg-red-500/20 transition-colors text-red-400"
                        style={{ width: 36, height: 36 }}
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Descripción / notas */}
                  {(s.description || s.notes) && (
                    <div className="space-y-1">
                      {s.description && (
                        <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
                          {s.description}
                        </p>
                      )}
                      {s.notes && (
                        <p className="text-xs rounded-lg px-3 py-2 italic" style={{ background: 'rgba(245,197,24,0.05)', color: 'var(--muted)', border: '1px solid rgba(245,197,24,0.12)' }}>
                          💬 {s.notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* URL del recurso */}
                  {s.linkUrl && (
                    <p className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>
                      🔗 <span className="font-mono">{s.linkUrl}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB: CATÁLOGOS
      ══════════════════════════════════════════════════════════════ */}
      {tab === 'catalogs' && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'courses', label: 'Cursos' },
              { key: 'activityTypes', label: 'Tipos de actividad' },
              { key: 'units', label: 'Unidades / Objetivos' },
            ] as const).map(({ key, label }) => (
              <button key={key} onClick={() => setCatalogTab(key)}
                className="px-4 rounded-xl text-sm font-medium transition-colors"
                style={{
                  height: 40,
                  background: catalogTab === key ? 'var(--purple)' : 'var(--card)',
                  color: catalogTab === key ? '#fff' : 'var(--muted)',
                  border: `1px solid ${catalogTab === key ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Cursos ── */}
          {catalogTab === 'courses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {catalogCourses.length} curso{catalogCourses.length !== 1 ? 's' : ''} en el catálogo
                </p>
                {derivedCourses.length > catalogCourses.length && (
                  <button
                    disabled={savingCatalog}
                    onClick={async () => {
                      setSavingCatalog(true);
                      try {
                        const { inserted } = await seedCourses();
                        await loadCatalogCourses();
                        showMsg(`${inserted} curso${inserted !== 1 ? 's' : ''} importado${inserted !== 1 ? 's' : ''} desde recursos`);
                      } catch { showMsg('Error al importar', 'err'); }
                      finally { setSavingCatalog(false); }
                    }}
                    className="flex items-center gap-2 px-4 rounded-xl text-xs font-bold disabled:opacity-40"
                    style={{ height: 36, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
                    <Sparkles size={13} /> Importar {derivedCourses.length - catalogCourses.length} desde recursos
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input value={newCourseName} onChange={e => setNewCourseName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key !== 'Enter' || !newCourseName.trim()) return;
                    setSavingCatalog(true);
                    try {
                      await createCourse({ name: newCourseName.trim(), isActive: true, sortOrder: catalogCourses.length });
                      setNewCourseName(''); await loadCatalogCourses(); showMsg('Curso agregado');
                    } catch { showMsg('Error', 'err'); } finally { setSavingCatalog(false); }
                  }}
                  placeholder="Nuevo curso (Enter para guardar)"
                  className="flex-1 px-4 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', height: 44 }} />
                <button disabled={savingCatalog || !newCourseName.trim()}
                  onClick={async () => {
                    setSavingCatalog(true);
                    try {
                      await createCourse({ name: newCourseName.trim(), isActive: true, sortOrder: catalogCourses.length });
                      setNewCourseName(''); await loadCatalogCourses(); showMsg('Curso agregado');
                    } catch { showMsg('Error', 'err'); } finally { setSavingCatalog(false); }
                  }}
                  className="flex items-center gap-2 px-5 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#1e0d38', height: 44 }}>
                  <Plus size={15} /> Agregar
                </button>
              </div>
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                {catalogCourses.length === 0
                  ? <p className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>Sin cursos. Usa "Importar desde recursos" o agrega uno.</p>
                  : sortCourses(catalogCourses).map((c, i) => {
                    const isEditing = editingCatalog?.type === 'course' && editingCatalog.id === c.id;
                    return (
                      <div key={c.id} className="flex items-center gap-2 px-4 py-2.5 border-b last:border-0"
                        style={{ borderColor: 'var(--border)', background: isEditing ? 'rgba(124,58,237,0.06)' : undefined }}>
                        <span className="text-xs font-mono w-6 text-center shrink-0" style={{ color: 'var(--muted)' }}>{i + 1}</span>
                        {isEditing ? (
                          <>
                            <input autoFocus value={editingCatalog.name}
                              onChange={e => setEditingCatalog(prev => prev ? { ...prev, name: e.target.value } : null)}
                              onKeyDown={async e => {
                                if (e.key === 'Escape') { setEditingCatalog(null); return; }
                                if (e.key === 'Enter' && editingCatalog.name.trim()) {
                                  setSavingCatalog(true);
                                  try { await updateCourse(c.id, { name: editingCatalog.name.trim() }); setEditingCatalog(null); await loadCatalogCourses(); showMsg('Curso actualizado'); }
                                  catch { showMsg('Error', 'err'); } finally { setSavingCatalog(false); }
                                }
                              }}
                              className="flex-1 px-3 rounded-lg text-sm outline-none text-white"
                              style={{ background: 'var(--bg)', border: '1px solid rgba(124,58,237,0.5)', height: 36 }} />
                            <button onClick={async () => {
                              if (!editingCatalog.name.trim()) return;
                              setSavingCatalog(true);
                              try { await updateCourse(c.id, { name: editingCatalog.name.trim() }); setEditingCatalog(null); await loadCatalogCourses(); showMsg('Curso actualizado'); }
                              catch { showMsg('Error', 'err'); } finally { setSavingCatalog(false); }
                            }} className="flex items-center justify-center rounded-lg shrink-0"
                              style={{ width: 30, height: 30, background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>
                              <Check size={13} />
                            </button>
                            <button onClick={() => setEditingCatalog(null)} className="flex items-center justify-center rounded-lg shrink-0"
                              style={{ width: 30, height: 30, color: 'var(--muted)' }}>
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm font-medium text-white">{c.name}</span>
                            <button onClick={() => setEditingCatalog({ type: 'course', id: c.id, name: c.name })}
                              className="icon-btn flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors shrink-0"
                              style={{ color: 'var(--muted)', width: 30, height: 30 }}>
                              <Pencil size={12} />
                            </button>
                            <button onClick={async () => {
                              if (!confirm(`¿Eliminar "${c.name}"?`)) return;
                              await deleteCourse(c.id); loadCatalogCourses(); showMsg('Eliminado');
                            }} className="icon-btn flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-400 shrink-0"
                              style={{ width: 30, height: 30 }}>
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}

          {/* ── Tipos de actividad ── */}
          {catalogTab === 'activityTypes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {catalogActivityTypes.length} tipo{catalogActivityTypes.length !== 1 ? 's' : ''} en el catálogo
                </p>
                {derivedActTypes.length > catalogActivityTypes.length && (
                  <button
                    disabled={savingCatalog}
                    onClick={async () => {
                      setSavingCatalog(true);
                      try {
                        const { inserted } = await seedActivityTypes();
                        await loadCatalogActivityTypes();
                        showMsg(`${inserted} tipo${inserted !== 1 ? 's' : ''} importado${inserted !== 1 ? 's' : ''} desde recursos`);
                      } catch { showMsg('Error al importar', 'err'); }
                      finally { setSavingCatalog(false); }
                    }}
                    className="flex items-center gap-2 px-4 rounded-xl text-xs font-bold disabled:opacity-40"
                    style={{ height: 36, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
                    <Sparkles size={13} /> Importar {derivedActTypes.length - catalogActivityTypes.length} desde recursos
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input value={newActivityTypeName} onChange={e => setNewActivityTypeName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key !== 'Enter' || !newActivityTypeName.trim()) return;
                    setSavingCatalog(true);
                    try {
                      await createActivityType({ name: newActivityTypeName.trim(), isActive: true });
                      setNewActivityTypeName(''); await loadCatalogActivityTypes(); showMsg('Tipo agregado');
                    } catch { showMsg('Error', 'err'); } finally { setSavingCatalog(false); }
                  }}
                  placeholder="Nuevo tipo (Enter para guardar)"
                  className="flex-1 px-4 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', height: 44 }} />
                <button disabled={savingCatalog || !newActivityTypeName.trim()}
                  onClick={async () => {
                    setSavingCatalog(true);
                    try {
                      await createActivityType({ name: newActivityTypeName.trim(), isActive: true });
                      setNewActivityTypeName(''); await loadCatalogActivityTypes(); showMsg('Tipo agregado');
                    } catch { showMsg('Error', 'err'); } finally { setSavingCatalog(false); }
                  }}
                  className="flex items-center gap-2 px-5 rounded-xl text-sm font-bold disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#1e0d38', height: 44 }}>
                  <Plus size={15} /> Agregar
                </button>
              </div>
              {catalogActivityTypes.length === 0
                ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin tipos. Usa "Importar desde recursos" o agrega uno.</p>
                : (
                  <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    {catalogActivityTypes.map((at, i) => {
                      const isEditing = editingCatalog?.type === 'activityType' && editingCatalog.id === at.id;
                      return (
                        <div key={at.id} className="flex items-center gap-2 px-4 py-2.5 border-b last:border-0"
                          style={{ borderColor: 'var(--border)', background: isEditing ? 'rgba(124,58,237,0.06)' : undefined }}>
                          <span className="text-xs font-mono w-6 text-center shrink-0" style={{ color: 'var(--muted)' }}>{i + 1}</span>
                          {isEditing ? (
                            <>
                              <input autoFocus value={editingCatalog.name}
                                onChange={e => setEditingCatalog(prev => prev ? { ...prev, name: e.target.value } : null)}
                                onKeyDown={async e => {
                                  if (e.key === 'Escape') { setEditingCatalog(null); return; }
                                  if (e.key === 'Enter' && editingCatalog.name.trim()) {
                                    setSavingCatalog(true);
                                    try { await updateActivityType(at.id, { name: editingCatalog.name.trim() }); setEditingCatalog(null); await loadCatalogActivityTypes(); showMsg('Tipo actualizado'); }
                                    catch { showMsg('Error', 'err'); } finally { setSavingCatalog(false); }
                                  }
                                }}
                                className="flex-1 px-3 rounded-lg text-sm outline-none text-white"
                                style={{ background: 'var(--bg)', border: '1px solid rgba(124,58,237,0.5)', height: 36 }} />
                              <button onClick={async () => {
                                if (!editingCatalog.name.trim()) return;
                                setSavingCatalog(true);
                                try { await updateActivityType(at.id, { name: editingCatalog.name.trim() }); setEditingCatalog(null); await loadCatalogActivityTypes(); showMsg('Tipo actualizado'); }
                                catch { showMsg('Error', 'err'); } finally { setSavingCatalog(false); }
                              }} className="flex items-center justify-center rounded-lg shrink-0"
                                style={{ width: 30, height: 30, background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>
                                <Check size={13} />
                              </button>
                              <button onClick={() => setEditingCatalog(null)} className="flex items-center justify-center rounded-lg shrink-0"
                                style={{ width: 30, height: 30, color: 'var(--muted)' }}>
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm text-white">{at.name}</span>
                              <button onClick={() => setEditingCatalog({ type: 'activityType', id: at.id, name: at.name })}
                                className="icon-btn flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors shrink-0"
                                style={{ color: 'var(--muted)', width: 30, height: 30 }}>
                                <Pencil size={12} />
                              </button>
                              <button onClick={async () => {
                                if (!confirm(`¿Eliminar "${at.name}"?`)) return;
                                await deleteActivityType(at.id); loadCatalogActivityTypes(); showMsg('Eliminado');
                              }} className="icon-btn flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-400 shrink-0"
                                style={{ width: 30, height: 30 }}>
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              }
            </div>
          )}

          {/* ── Unidades / Objetivos — acordeón Asignatura → Curso → Unidades ── */}
          {catalogTab === 'units' && (
            <div className="space-y-3">
              {/* Add form */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold text-white">Nueva Unidad / Objetivo
                  <span className="ml-2 font-normal" style={{ color: 'var(--muted)' }}>— el orden se asigna automáticamente, arrástralo para reordenar</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Asignatura *</label>
                    <select value={newUnit.subjectId || ''} onChange={e => setNewUnit(prev => ({ ...prev, subjectId: +e.target.value }))}
                      className="w-full px-3 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 40 }}>
                      <option value="">Seleccionar...</option>
                      {subjects.map(s => <option key={s.id} value={s.id} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Curso *</label>
                    <select value={newUnit.course || ''} onChange={e => setNewUnit(prev => ({ ...prev, course: e.target.value }))}
                      className="w-full px-3 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 40 }}>
                      <option value="">Sin curso</option>
                      {sortCourses(catalogCourses).map(c => <option key={c.id} value={c.name} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Nombre *</label>
                    <input type="text" value={newUnit.name} placeholder="ej: Objetivo 7, Unidad 3…"
                      onChange={e => setNewUnit(prev => ({ ...prev, name: e.target.value }))}
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && newUnit.name.trim() && newUnit.subjectId) {
                          setSavingCatalog(true);
                          try {
                            await createUnit({ name: newUnit.name.trim(), subjectId: newUnit.subjectId, code: newUnit.code || undefined, course: newUnit.course || undefined });
                            setNewUnit(prev => ({ ...prev, name: '', code: '', course: '' }));
                            await loadCatalogUnits();
                            setOpenSubjects(prev => {
                              const next = new Set<string>();
                              prev.forEach(v => next.add(v));
                              next.add(String(newUnit.subjectId));
                              return next;
                            });
                            showMsg('Unidad creada');
                          } catch { showMsg('Error al crear unidad', 'err'); }
                          finally { setSavingCatalog(false); }
                        }
                      }}
                      className="w-full px-3 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 40 }} />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Código</label>
                      <input type="text" value={newUnit.code} placeholder="OA7"
                        onChange={e => setNewUnit(prev => ({ ...prev, code: e.target.value }))}
                        className="w-full px-3 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 40 }} />
                    </div>
                    <div className="flex items-end">
                      <button disabled={savingCatalog || !newUnit.name.trim() || !newUnit.subjectId}
                        onClick={async () => {
                          setSavingCatalog(true);
                          try {
                            await createUnit({ name: newUnit.name.trim(), subjectId: newUnit.subjectId, code: newUnit.code || undefined, course: newUnit.course || undefined });
                            setNewUnit(prev => ({ ...prev, name: '', code: '', course: '' }));
                            await loadCatalogUnits();
                            setOpenSubjects(prev => {
                              const next = new Set<string>();
                              prev.forEach(v => next.add(v));
                              next.add(String(newUnit.subjectId));
                              return next;
                            });
                            showMsg('Unidad creada');
                          } catch { showMsg('Error al crear unidad', 'err'); }
                          finally { setSavingCatalog(false); }
                        }}
                        className="flex items-center gap-2 px-4 rounded-xl text-sm font-bold disabled:opacity-40 shrink-0"
                        style={{ background: 'var(--accent)', color: '#1e0d38', height: 40 }}>
                        <Plus size={15} /> Crear
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Acordeón: Asignatura → Curso → Unidades (derivado de recursos) */}
              {unitsByCourse.map(s => {
                const totalUnits = s.courses.reduce((acc, c) => acc + c.units.length, 0);
                if (totalUnits === 0) return null;
                const subKey = String(s.subjectId);
                const subOpen = openSubjects.has(subKey);

                // Units in this subject that have NO resources (not in unitsByCourse)
                const assignedIds = new Set(s.courses.flatMap(c => c.units.map(u => u.id)));
                const unassigned = catalogUnits
                  .filter(u => u.subjectId === s.subjectId && !assignedIds.has(u.id))
                  .sort((a, b) => a.order - b.order)
                  .map(u => ({ ...u, code: u.code ?? '' }));

                // Inline unit row renderer (shared between course groups and unassigned)
                const renderUnitRow = (u: { id: number; name: string; code: string; order: number }, idx: number, groupUnits: { id: number; name: string; code: string; order: number }[]) => {
                  const isEditing = editingCatalog?.type === 'unit' && editingCatalog.id === u.id;
                  const isDragging = dragUnitId === u.id;
                  const isOver = dragOverId === u.id;

                  const handleDrop = async (targetId: number) => {
                    if (dragUnitId === null || dragUnitId === targetId) { setDragUnitId(null); setDragOverId(null); return; }
                    const list = [...groupUnits];
                    const fromIdx = list.findIndex(x => x.id === dragUnitId);
                    const toIdx = list.findIndex(x => x.id === targetId);
                    if (fromIdx === -1 || toIdx === -1) return;
                    list.splice(toIdx, 0, list.splice(fromIdx, 1)[0]);
                    const reordered = list.map((x, i) => ({ id: x.id, order: i + 1 }));
                    setDragUnitId(null); setDragOverId(null);
                    setUnitsByCourse(prev => prev.map(sub =>
                      sub.subjectId !== s.subjectId ? sub : {
                        ...sub,
                        courses: sub.courses.map(c =>
                          !c.units.some(x => x.id === u.id) ? c :
                            { ...c, units: list.map((x, i) => ({ ...x, order: i + 1 })) }
                        ),
                      }
                    ));
                    try { await reorderUnits(reordered); }
                    catch { showMsg('Error al reordenar', 'err'); loadCatalogUnits(); }
                  };

                  return (
                    <div key={u.id}
                      draggable={!isEditing}
                      onDragStart={() => { setDragUnitId(u.id); setDragOverId(null); }}
                      onDragEnd={() => { setDragUnitId(null); setDragOverId(null); }}
                      onDragOver={e => { e.preventDefault(); if (dragUnitId !== u.id) setDragOverId(u.id); }}
                      onDragLeave={() => setDragOverId(null)}
                      onDrop={e => { e.preventDefault(); handleDrop(u.id); }}
                      className="border-t transition-colors"
                      style={{
                        borderColor: 'var(--border)',
                        opacity: isDragging ? 0.4 : 1,
                        background: isOver ? 'rgba(124,58,237,0.12)' : isEditing ? 'rgba(124,58,237,0.06)' : undefined,
                        borderTop: isOver ? '2px solid rgba(124,58,237,0.5)' : undefined,
                        cursor: isEditing ? 'default' : 'grab',
                      }}>
                      {isEditing ? (
                        <div className="flex items-center gap-2 pl-8 pr-4 py-2">
                          <span className="text-[11px] font-mono w-5 text-center shrink-0" style={{ color: 'var(--muted)' }}>{idx + 1}</span>
                          <input autoFocus value={editingCatalog.name}
                            onChange={e => setEditingCatalog(prev => prev ? { ...prev, name: e.target.value } : null)}
                            onKeyDown={async e => {
                              if (e.key === 'Escape') { setEditingCatalog(null); return; }
                              if (e.key === 'Enter' && editingCatalog.name.trim()) {
                                setSavingCatalog(true);
                                try {
                                  await updateUnit(u.id, { name: editingCatalog.name.trim(), code: editingCatalog.code || undefined });
                                  setEditingCatalog(null); await loadCatalogUnits(); showMsg('Unidad actualizada');
                                } catch { showMsg('Error', 'err'); } finally { setSavingCatalog(false); }
                              }
                            }}
                            placeholder="Nombre"
                            className="flex-1 px-2 rounded-lg text-sm outline-none"
                            style={{ background: 'var(--bg)', border: '1px solid rgba(124,58,237,0.5)', color: 'var(--text)', height: 32 }} />
                          <input value={editingCatalog.code ?? ''}
                            onChange={e => setEditingCatalog(prev => prev ? { ...prev, code: e.target.value } : null)}
                            placeholder="Código"
                            className="px-2 rounded-lg text-xs outline-none font-mono"
                            style={{ width: 72, background: 'var(--bg)', border: '1px solid rgba(124,58,237,0.4)', color: '#c4b5fd', height: 32 }} />
                          <button onClick={async () => {
                            if (!editingCatalog.name.trim()) return;
                            setSavingCatalog(true);
                            try {
                              await updateUnit(u.id, { name: editingCatalog.name.trim(), code: editingCatalog.code || undefined });
                              setEditingCatalog(null); await loadCatalogUnits(); showMsg('Unidad actualizada');
                            } catch { showMsg('Error', 'err'); } finally { setSavingCatalog(false); }
                          }} style={{ width: 28, height: 28, background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Check size={12} />
                          </button>
                          <button onClick={() => setEditingCatalog(null)} style={{ width: 28, height: 28, color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 pl-8 pr-4 py-2">
                          <span className="shrink-0 flex flex-col gap-[3px] opacity-30 hover:opacity-70 transition-opacity" style={{ cursor: 'grab' }}>
                            {[0, 1, 2].map(i => <span key={i} className="block rounded-full" style={{ width: 12, height: 2, background: 'var(--muted)' }} />)}
                          </span>
                          <span className="text-[11px] font-mono w-5 text-center shrink-0 rounded px-1"
                            style={{ color: 'var(--accent)', background: 'rgba(245,197,24,0.1)' }}>
                            {idx + 1}
                          </span>
                          <span className="flex-1 text-sm text-white">{u.name}</span>
                          {u.code && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0"
                              style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd' }}>
                              {u.code}
                            </span>
                          )}
                          <button onClick={() => setEditingCatalog({ type: 'unit', id: u.id, name: u.name, code: u.code || '', order: u.order })}
                            className="icon-btn flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors shrink-0"
                            style={{ color: 'var(--muted)', width: 26, height: 26 }}>
                            <Pencil size={11} />
                          </button>
                          <button onClick={async () => {
                            if (!confirm(`¿Eliminar "${u.name}"?`)) return;
                            try { await deleteUnit(u.id); loadCatalogUnits(); showMsg('Unidad eliminada'); }
                            catch { showMsg('No se puede eliminar (tiene recursos asociados)', 'err'); }
                          }} className="icon-btn flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-400 shrink-0"
                            style={{ width: 26, height: 26 }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <div key={s.subjectId} className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    {/* Subject header */}
                    <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
                      onClick={() => setOpenSubjects(prev => {
                        const next = new Set<string>();
                        prev.forEach(v => next.add(v));
                        if (next.has(subKey)) next.delete(subKey); else next.add(subKey);
                        return next;
                      })}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0"
                          style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>
                          {s.subjectName.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-white">{s.subjectName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd' }}>
                          {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399' }}>
                          {s.courses.length} {s.courses.length === 1 ? 'curso' : 'cursos'}
                        </span>
                      </div>
                      {subOpen ? <ChevronUp size={16} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--muted)' }} />}
                    </button>

                    {subOpen && (
                      <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                        {/* Course groups derived from resources */}
                        {s.courses.map(cg => {
                          const courseKey = `${s.subjectId}:${cg.course}`;
                          const courseOpen = openSubjects.has(courseKey);
                          const sortedUnits = [...cg.units].sort((a, b) => a.order - b.order);
                          return (
                            <div key={courseKey}>
                              <button className="w-full flex items-center justify-between px-5 py-2 hover:bg-white/[0.02] transition-colors"
                                style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}
                                onClick={() => setOpenSubjects(prev => {
                                  const next = new Set<string>();
                                  prev.forEach(v => next.add(v));
                                  if (next.has(courseKey)) next.delete(courseKey); else next.add(courseKey);
                                  return next;
                                })}>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>{cg.course}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,197,24,0.12)', color: 'var(--accent)' }}>
                                    {cg.units.length} {cg.units.length === 1 ? 'unidad' : 'unidades'}
                                  </span>
                                </div>
                                {courseOpen ? <ChevronUp size={13} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={13} style={{ color: 'var(--muted)' }} />}
                              </button>
                              {courseOpen && sortedUnits.map((u, idx) => renderUnitRow(u, idx, sortedUnits))}
                            </div>
                          );
                        })}

                        {/* Units with no resources (not in any course group) */}
                        {unassigned.length > 0 && (() => {
                          const courseKey = `${s.subjectId}:__unassigned__`;
                          const courseOpen = openSubjects.has(courseKey);
                          return (
                            <div>
                              <button className="w-full flex items-center justify-between px-5 py-2 hover:bg-white/[0.02] transition-colors"
                                style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}
                                onClick={() => setOpenSubjects(prev => {
                                  const next = new Set<string>();
                                  prev.forEach(v => next.add(v));
                                  if (next.has(courseKey)) next.delete(courseKey); else next.add(courseKey);
                                  return next;
                                })}>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Sin recursos aún</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>
                                    {unassigned.length}
                                  </span>
                                </div>
                                {courseOpen ? <ChevronUp size={13} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={13} style={{ color: 'var(--muted)' }} />}
                              </button>
                              {courseOpen && unassigned.map((u, idx) => renderUnitRow(u, idx, unassigned))}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}

              {unitsByCourse.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Sin unidades registradas en recursos.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Editar / Crear Recurso
      ══════════════════════════════════════════════════════════════ */}
      {editing !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => { setEditing(null); setScrapeFields(new Set()); }}>
          <div className="fixed inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold text-white">{editing.id ? 'Editar Recurso' : 'Nuevo Recurso'}</h2>
              <button
                onClick={() => { setEditing(null); setScrapeFields(new Set()); }}
                className="icon-btn flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: 'var(--muted)', width: 40, height: 40 }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">

              {/* ── URL del recurso + botón scrape ── */}
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>URL del recurso</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={(editing as any).linkUrl || ''}
                    onChange={e => setEditing(prev => ({ ...prev!, linkUrl: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 px-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 44 }}
                  />
                  <button
                    type="button"
                    disabled={scraping || !(editing as any)?.linkUrl?.trim()}
                    onClick={async () => {
                      const url = (editing as any).linkUrl?.trim();
                      if (!url) return;
                      setScraping(true);
                      setScrapeFields(new Set());
                      try {
                        const data = await scrapeResourceUrl(url);
                        const filled = new Set<string>();
                        // Detect author from URL domain
                        let detectedAuthor = '';
                        try {
                          const host = new URL(url).hostname.toLowerCase();
                          if (host.includes('wordwall')) detectedAuthor = 'wordwall';
                          else if (host.includes('educaplay')) detectedAuthor = 'educaplay';
                          else detectedAuthor = host.replace(/^www\./, '').split('.')[0];
                        } catch { }
                        setEditing(prev => {
                          const next = { ...prev! };
                          if (data.title && !prev?.title) { next.title = data.title; filled.add('title'); }
                          if (data.description && !prev?.description) { next.description = data.description; filled.add('description'); }
                          if (data.imageUrl && !prev?.imageUrl) { next.imageUrl = data.imageUrl; filled.add('imageUrl'); }
                          if (detectedAuthor && !(prev as any)?.author) { (next as any).author = detectedAuthor; filled.add('author'); }
                          return next;
                        });
                        setScrapeFields(filled);
                        if (!data.imageUrl) showMsg('Sin imagen automática — súbela manualmente', 'err');
                        else showMsg('Imagen descargada y guardada localmente');
                      } catch { showMsg('No se pudo obtener info de la URL', 'err'); }
                      finally { setScraping(false); }
                    }}
                    className="flex items-center gap-2 px-4 rounded-xl text-sm font-semibold shrink-0 disabled:opacity-40"
                    style={{ height: 44, background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', color: '#c4b5fd', whiteSpace: 'nowrap' }}
                  >
                    {scraping ? <><Loader2 size={14} className="animate-spin" /> Obteniendo…</> : <><Sparkles size={14} /> Auto-rellenar</>}
                  </button>
                </div>
                {!editing?.id && <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>Pega la URL y pulsa "Auto-rellenar" para completar el formulario automáticamente.</p>}
              </div>

              {/* ── Título ── */}
              <div>
                <label className="text-xs mb-1.5 flex items-center gap-2 font-medium" style={{ color: 'var(--muted)' }}>
                  Título *
                  {scrapeFields.has('title') && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>auto</span>}
                </label>
                <input type="text" value={(editing as any).title || ''} onChange={e => setEditing(prev => ({ ...prev!, title: e.target.value }))}
                  className="w-full px-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg)', border: `1px solid ${scrapeFields.has('title') ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`, color: 'var(--text)', height: 44 }} />
              </div>

              {/* ── Descripción ── */}
              <div>
                <label className="text-xs mb-1.5 flex items-center gap-2 font-medium" style={{ color: 'var(--muted)' }}>
                  Descripción
                  {scrapeFields.has('description') && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>auto</span>}
                </label>
                <textarea value={(editing as any).description || ''} onChange={e => setEditing(prev => ({ ...prev!, description: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'var(--bg)', border: `1px solid ${scrapeFields.has('description') ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`, color: 'var(--text)' }} />
              </div>

              {/* ── Imagen ── */}
              <div>
                <label className="text-xs mb-1.5 flex items-center gap-2 font-medium" style={{ color: 'var(--muted)' }}>
                  Imagen preview
                  {scrapeFields.has('imageUrl') && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>auto</span>}
                </label>
                {(editing as any).imageUrl ? (
                  <div className="flex gap-3 items-start">
                    <div className="rounded-xl overflow-hidden shrink-0 relative" style={{ width: 120, height: 72, background: 'var(--bg)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={(editing as any).imageUrl} alt="preview" className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-[11px] truncate font-mono" style={{ color: 'var(--muted)' }}>{(editing as any).imageUrl}</p>
                      <button onClick={() => setEditing(prev => ({ ...prev!, imageUrl: '' }))}
                        className="flex items-center gap-1 text-[11px] px-3 py-1 rounded-lg"
                        style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <X size={11} /> Quitar imagen
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all hover:border-purple-500/50"
                    style={{ height: 90, background: 'var(--bg)', border: '2px dashed var(--border)' }}>
                    {uploadingResourceImg
                      ? <><Loader2 size={20} className="animate-spin" style={{ color: 'var(--muted)' }} /><span className="text-xs" style={{ color: 'var(--muted)' }}>Subiendo...</span></>
                      : <><Upload size={20} style={{ color: 'var(--muted)' }} /><span className="text-xs" style={{ color: 'var(--muted)' }}>Clic para subir imagen manualmente</span></>
                    }
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingResourceImg}
                      onChange={async e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setUploadingResourceImg(true);
                        try {
                          const { url } = await uploadResourceImage(f);
                          setEditing(prev => ({ ...prev!, imageUrl: url }));
                          showMsg('Imagen subida correctamente');
                        } catch { showMsg('Error al subir imagen', 'err'); }
                        finally { setUploadingResourceImg(false); }
                      }} />
                  </label>
                )}
              </div>

              {/* ── Asignatura + Unidad ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Asignatura *</label>
                  <select value={(editing as any).subjectId || ''} onChange={async e => {
                    const sid = +e.target.value;
                    setEditing(prev => ({ ...prev!, subjectId: sid, unitId: undefined }));
                    if (sid) setModalUnits(await getUnits(sid));
                    else setModalUnits([]);
                  }}
                    className="w-full px-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 44 }}>
                    <option value="">Sin asignatura</option>
                    {subjects.map(s => <option key={s.id} value={s.id} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Unidad / Objetivo *</label>
                  <select value={(editing as any).unitId || ''} onChange={e => setEditing(prev => ({ ...prev!, unitId: +e.target.value || undefined }))}
                    disabled={!modalUnits.length}
                    className="w-full px-3 rounded-xl text-sm outline-none disabled:opacity-40"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 44 }}>
                    <option value="">Sin unidad</option>
                    {modalUnits.map(u => <option key={u.id} value={u.id} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Curso ── */}
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Curso *</label>
                {modalCourses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {sortCourses(modalCourses).map(c => (
                      <button key={c.id} type="button"
                        onClick={() => setEditing(prev => ({ ...prev!, course: prev?.course === c.name ? '' : c.name }))}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: (editing as any).course === c.name ? 'rgba(245,197,24,0.2)' : 'var(--bg)',
                          border: `1px solid ${(editing as any).course === c.name ? 'rgba(245,197,24,0.5)' : 'var(--border)'}`,
                          color: (editing as any).course === c.name ? 'var(--accent)' : 'var(--muted)',
                        }}>
                        {c.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Sin cursos — agrégalos en la pestaña Catálogos</p>
                )}
              </div>

              {/* ── Tipo de actividad (multi-select chips) ── */}
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>
                  Tipo de actividad *
                  {selectedActTypes.length > 0 && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>{selectedActTypes.length} seleccionado{selectedActTypes.length > 1 ? 's' : ''}</span>}
                </label>
                {modalActivityTypes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {modalActivityTypes.map(at => {
                      const active = selectedActTypes.includes(at.name);
                      return (
                        <button key={at.id} type="button"
                          onClick={() => setSelectedActTypes(prev => active ? prev.filter(x => x !== at.name) : [...prev, at.name])}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                          style={{
                            background: active ? 'rgba(124,58,237,0.2)' : 'var(--bg)',
                            border: `1px solid ${active ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
                            color: active ? '#c4b5fd' : 'var(--muted)',
                          }}>
                          {at.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Sin tipos — agrégalos en la pestaña Catálogos</p>
                )}
              </div>

              {/* ── Autor (con datalist autocomplete) ── */}
              <div>
                <label className="text-xs mb-1.5 flex items-center gap-2 font-medium" style={{ color: 'var(--muted)' }}>
                  Autor *
                  {scrapeFields.has('author') && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>auto</span>}
                </label>
                <input list="authors-list" type="text" value={(editing as any).author || ''}
                  onChange={e => setEditing(prev => ({ ...prev!, author: e.target.value }))}
                  placeholder="Nombre del autor..."
                  className="w-full px-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg)', border: `1px solid ${scrapeFields.has('author') ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`, color: 'var(--text)', height: 44 }} />
                <datalist id="authors-list">
                  {authors.map(a => <option key={a} value={a} />)}
                </datalist>
              </div>

              {/* ── Código OA ── */}
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Código OA <span className="font-normal opacity-60">(opcional)</span></label>
                <input type="text" value={(editing as any).oaCode || ''} onChange={e => setEditing(prev => ({ ...prev!, oaCode: e.target.value }))}
                  className="w-full px-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 44 }} />
              </div>

            </div>

            <div className="px-5 py-4 border-t flex justify-end gap-3 shrink-0" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => { setEditing(null); setScrapeFields(new Set()); }}
                className="px-5 rounded-xl text-sm font-medium"
                style={{ color: 'var(--muted)', height: 44 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 rounded-xl text-sm font-bold disabled:opacity-60"
                style={{ background: 'var(--accent)', color: '#1e0d38', height: 44 }}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB: CARRUSEL
      ══════════════════════════════════════════════════════════════ */}
      {tab === 'carousel' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Slides del Carrusel</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                {slides.length} slide{slides.length !== 1 ? 's' : ''} configurado{slides.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setEditingSlide({ title: '', subtitle: '', imageUrl: '', linkUrl: '', buttonText: 'Ver recurso', isActive: true })}
              className="flex items-center gap-2 px-5 rounded-xl text-sm font-bold"
              style={{ background: 'var(--accent)', color: '#1e0d38', height: 44 }}
            >
              <Plus size={16} /> Nuevo Slide
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Slide list ── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Lista de Slides</h3>
              {slides.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 rounded-xl text-center"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <ImageIcon size={30} style={{ color: 'var(--muted)' }} className="mb-3" />
                  <p className="text-sm font-medium text-white mb-1">Sin slides</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Crea el primer slide con el botón "Nuevo Slide"</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {slides.map((slide, idx) => (
                    <div
                      key={slide.id}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{
                        background: 'var(--card)',
                        border: `1px solid ${slide.isActive ? 'var(--border)' : 'rgba(239,68,68,0.3)'}`,
                        opacity: slide.isActive ? 1 : 0.6,
                      }}
                    >
                      {/* Thumbnail */}
                      <div className="shrink-0 rounded-lg overflow-hidden relative" style={{ width: 72, height: 44, background: 'var(--sidebar)' }}>
                        {slide.imageUrl ? (
                          <NextImage
                            src={slide.imageUrl}
                            alt={slide.title}
                            fill
                            sizes="72px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={16} style={{ color: 'var(--muted)' }} />
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{slide.title}</p>
                        {slide.subtitle && <p className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>{slide.subtitle}</p>}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
                          style={{ background: slide.isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: slide.isActive ? '#34d399' : '#f87171' }}>
                          {slide.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleMoveSlide(idx, -1)} disabled={idx === 0}
                          className="icon-btn flex items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30"
                          style={{ color: 'var(--muted)', width: 32, height: 32 }} title="Subir">
                          <ChevronUp size={15} />
                        </button>
                        <button onClick={() => handleMoveSlide(idx, 1)} disabled={idx === slides.length - 1}
                          className="icon-btn flex items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30"
                          style={{ color: 'var(--muted)', width: 32, height: 32 }} title="Bajar">
                          <ChevronDown size={15} />
                        </button>
                        <button onClick={() => { setEditingSlide({ ...slide }); setPreviewIdx(idx); }}
                          className="icon-btn flex items-center justify-center rounded-lg hover:bg-white/10"
                          style={{ color: 'var(--accent)', width: 32, height: 32 }} title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDeleteSlide(slide.id)}
                          className="icon-btn flex items-center justify-center rounded-lg hover:bg-red-500/20"
                          style={{ color: '#f87171', width: 32, height: 32 }} title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Preview Simulator ── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Monitor size={15} style={{ color: 'var(--muted)' }} /> Simulador de Vista
                <span className="text-[10px] font-normal ml-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>
                  Vista previa fiel al carrusel real
                </span>
              </h3>
              <div className="rounded-2xl overflow-hidden relative select-none"
                style={{ background: '#2d1757', border: '1px solid var(--border)', height: 300 }}>
                {slides.filter(s => s.isActive).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Monitor size={32} style={{ color: 'var(--muted)' }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Sin slides activos</p>
                    <p className="text-xs" style={{ color: 'rgba(145,129,180,0.6)' }}>Activa algún slide para previsualizar</p>
                  </div>
                ) : (() => {
                  const activeSlides = slides.filter(s => s.isActive);
                  const idx = previewIdx % activeSlides.length;
                  const slide = activeSlides[idx];
                  return (
                    <>
                      {slide.imageUrl ? (
                        <NextImage
                          src={slide.imageUrl}
                          alt={slide.title}
                          fill
                          sizes="(max-width: 1024px) 100vw, 50vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1e0d38 0%, var(--card-hover) 100%)' }} />
                      )}
                      {/* Mismo gradiente que la home */}
                      <div className="absolute inset-0" style={{
                        background: 'linear-gradient(to top, rgba(22,8,51,0.97) 0%, rgba(22,8,51,0.55) 45%, transparent 70%), linear-gradient(to right, rgba(22,8,51,0.7) 0%, transparent 55%)',
                      }} />
                      <div className="relative z-10 px-7 pb-7 flex flex-col justify-end h-full">
                        <h4 className="text-lg font-extrabold text-white mb-1 max-w-xs leading-tight" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
                          {slide.title}
                        </h4>
                        {slide.subtitle && (
                          <p className="text-xs max-w-xs line-clamp-2 mb-3" style={{ color: 'rgba(226,217,243,0.8)' }}>{slide.subtitle}</p>
                        )}
                        {slide.buttonText && (
                          <span className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold w-fit"
                            style={{ background: 'var(--accent)', color: '#1e0d38' }}>
                            {slide.buttonText}
                          </span>
                        )}
                      </div>
                      {/* Dots + barra de progreso — igual que la home */}
                      {activeSlides.length > 1 && (
                        <div className="absolute bottom-0 left-0 right-0 z-20 px-7 pb-4">
                          <div className="flex justify-center gap-1.5 mb-2">
                            {activeSlides.map((_s, i) => (
                              <button key={i} onClick={() => setPreviewIdx(i)} className="rounded-full transition-all duration-300"
                                style={{ width: i === idx ? 22 : 7, height: 7, background: i === idx ? 'var(--accent)' : 'rgba(255,255,255,0.3)' }} />
                            ))}
                          </div>
                          <div className="w-full rounded-full overflow-hidden" style={{ height: 2, background: 'rgba(255,255,255,0.12)' }}>
                            <div style={{ width: `${((idx + 1) / activeSlides.length) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 9999, transition: 'width 0.3s ease' }} />
                          </div>
                        </div>
                      )}
                      {/* Flechas izquierda/derecha */}
                      {activeSlides.length > 1 && (
                        <>
                          <button onClick={() => setPreviewIdx((previewIdx - 1 + activeSlides.length) % activeSlides.length)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center rounded-full bg-black/35 hover:bg-black/55 transition-all"
                            style={{ width: 36, height: 36, color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
                            <ChevronLeft size={16} />
                          </button>
                          <button onClick={() => setPreviewIdx((previewIdx + 1) % activeSlides.length)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center rounded-full bg-black/35 hover:bg-black/55 transition-all"
                            style={{ width: 36, height: 36, color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
                            <ChevronRight size={16} />
                          </button>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
              {slides.filter(s => s.isActive).length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {slides.filter(s => s.isActive).map((s, i) => (
                    <button key={s.id} onClick={() => setPreviewIdx(i)}
                      className="flex-1 text-[11px] py-1.5 rounded-lg truncate transition-colors"
                      style={{
                        background: previewIdx % slides.filter(sl => sl.isActive).length === i ? 'rgba(124,58,237,0.3)' : 'var(--card)',
                        border: `1px solid ${previewIdx % slides.filter(sl => sl.isActive).length === i ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
                        color: previewIdx % slides.filter(sl => sl.isActive).length === i ? '#c4b5fd' : 'var(--muted)',
                      }}>
                      {s.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB: CONFIGURACIÓN
      ══════════════════════════════════════════════════════════════ */}
      {tab === 'config' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-white">Configuración General</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Ajustes globales de visibilidad y comportamiento del sitio.</p>
          </div>

          {/* ── Ajustes rápidos ── */}
          <div className="max-w-xl">

            {/* Toggle: mostrar vistas al público */}
            <div
              className="rounded-2xl p-5 space-y-4"
              style={{
                background: 'var(--card)',
                border: `1px solid ${showViews ? 'rgba(245,197,24,0.25)' : 'var(--border)'}`,
                transition: 'border-color 0.3s ease',
              }}
            >
              {/* Header row */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300"
                  style={{
                    background: showViews ? 'rgba(245,197,24,0.18)' : 'rgba(255,255,255,0.06)',
                    color: showViews ? 'var(--accent)' : 'var(--muted)',
                  }}
                >
                  <Eye size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">Visualizaciones públicas</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Contador de vistas en tarjetas y modal de recursos
                  </p>
                </div>
                {/* State badge */}
                <span
                  className="text-[11px] px-2.5 py-1 rounded-full font-bold shrink-0 transition-all duration-300"
                  style={{
                    background: showViews ? 'rgba(245,197,24,0.15)' : 'rgba(255,255,255,0.06)',
                    color: showViews ? 'var(--accent)' : 'var(--muted)',
                  }}
                >
                  {showViews ? 'ACTIVADO' : 'DESACTIVADO'}
                </span>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Description + toggle row */}
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {showViews
                    ? 'Los visitantes pueden ver cuántas veces se ha visto cada recurso.'
                    : 'El contador de vistas está oculto para los visitantes del sitio.'}
                </p>

                {/* Big toggle */}
                <button
                  onClick={async () => {
                    const next = !showViews;
                    setSavingConfig(true);
                    try {
                      await updateSetting('showViews', String(next));
                      setShowViews(next);
                      showMsg(`Visualizaciones ${next ? 'visibles' : 'ocultas'} para el público`);
                    } catch { showMsg('Error al guardar', 'err'); }
                    finally { setSavingConfig(false); }
                  }}
                  disabled={savingConfig}
                  title={showViews ? 'Desactivar' : 'Activar'}
                  className="shrink-0 flex items-center gap-2 px-4 rounded-xl font-semibold text-sm transition-all duration-300 disabled:opacity-50"
                  style={{
                    height: 44,
                    background: showViews ? 'rgba(245,197,24,0.18)' : 'rgba(255,255,255,0.07)',
                    border: `1px solid ${showViews ? 'rgba(245,197,24,0.4)' : 'rgba(255,255,255,0.12)'}`,
                    color: showViews ? 'var(--accent)' : 'var(--muted)',
                    minWidth: 130,
                  }}
                >
                  {/* Pill switch */}
                  <span
                    className="relative shrink-0"
                    style={{
                      display: 'inline-block',
                      width: 44,
                      height: 24,
                      borderRadius: 9999,
                      background: showViews ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                      transition: 'background 0.3s ease',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 3,
                        left: showViews ? 23 : 3,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: showViews ? '#1e0d38' : 'rgba(255,255,255,0.6)',
                        transition: 'left 0.25s cubic-bezier(.4,0,.2,1), background 0.3s ease',
                      }}
                    />
                  </span>
                  <span>{savingConfig ? 'Guardando…' : showViews ? 'Activado' : 'Desactivado'}</span>
                </button>
              </div>
            </div>

          </div>{/* end max-w-xl */}

          {/* ── Herramientas de imágenes — grid 3 columnas ── */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Herramientas de imágenes</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* ── Migración de imágenes a WebP ── */}
              <div className="rounded-2xl p-5 space-y-4"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                    <ImageIcon size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Migrar imágenes preview a WebP local</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      Descarga cada imagen externa (ibb.co, etc.), la convierte a <span className="font-mono">.webp</span> y la guarda en el servidor. Las imágenes dejan de depender de URLs externas.
                    </p>
                  </div>
                </div>

                <div style={{ height: 1, background: 'var(--border)' }} />

                {/* Análisis previo */}
                {migrateCount && (
                  <div className="grid grid-cols-5 gap-2 text-center text-xs">
                    {[
                      { label: 'Total', value: migrateCount.total, color: 'var(--muted)' },
                      { label: 'URL→WebP', value: migrateCount.pending, color: '#f5c518' },
                      { label: 'Ya en WebP', value: migrateCount.alreadyWebp, color: '#34d399' },
                      { label: 'Sin imagen', value: migrateCount.noImage, color: '#f87171' },
                      { label: 'Scrapeables', value: migrateCount.noImageWithUrl, color: '#c4b5fd' },
                    ].map(k => (
                      <div key={k.label} className="rounded-xl p-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <p className="text-base font-bold" style={{ color: k.color }}>{k.value}</p>
                        <p style={{ color: 'var(--muted)' }}>{k.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Barra de progreso */}
                {migrateProgress.total > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}>
                      <span>Procesando {migrateProgress.done} / {migrateProgress.total}</span>
                      <span style={{ color: '#34d399' }}>{migrateProgress.converted} convertidas · {migrateProgress.failed} fallidas</span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ background: 'var(--bg)', height: 8 }}>
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.round(migrateProgress.done / migrateProgress.total * 100)}%`, background: 'linear-gradient(90deg,#7c3aed,#34d399)' }} />
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      {migrateProgress.done >= migrateProgress.total
                        ? '✓ Completado'
                        : 'No cierres esta ventana mientras procesa…'}
                    </p>
                    {migrateProgress.errors.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-red-400">Ver errores ({migrateProgress.errors.length})</summary>
                        <ul className="mt-1 space-y-0.5 pl-3" style={{ color: 'var(--muted)' }}>
                          {migrateProgress.errors.slice(0, 30).map(e => (
                            <li key={e.id}>ID {e.id} — {e.title}: <span className="text-red-400">{e.reason}</span></li>
                          ))}
                          {migrateProgress.errors.length > 30 && <li>…y {migrateProgress.errors.length - 30} más</li>}
                        </ul>
                      </details>
                    )}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <button
                    disabled={migratingImages}
                    onClick={async () => {
                      setMigratingImages(true);
                      try {
                        const r = await countImageMigration();
                        setMigrateCount(r);
                      } catch { showMsg('Error al analizar', 'err'); }
                      finally { setMigratingImages(false); }
                    }}
                    className="flex items-center gap-2 px-4 rounded-xl text-xs font-semibold disabled:opacity-50"
                    style={{ height: 38, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                    {migratingImages && migrateProgress.total === 0 ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                    Analizar
                  </button>

                  <button
                    disabled={migratingImages || (migrateCount !== null && migrateCount.pending === 0)}
                    onClick={async () => {
                      if (!confirm('Esto descargará y convertirá todas las imágenes externas a WebP local. Puede tardar varios minutos. ¿Continuar?')) return;
                      setMigratingImages(true);
                      const BATCH = 10;
                      const MAX_RETRIES = 3;

                      // Get fresh count
                      let count = migrateCount;
                      if (!count) { count = await countImageMigration(); setMigrateCount(count); }
                      const total = count.pending;
                      setMigrateProgress({ done: 0, total, converted: 0, failed: 0, errors: [] });

                      let offset = 0, totalConverted = 0, totalFailed = 0, done = 0;
                      const allErrors: { id: number; title: string; reason: string }[] = [];

                      try {
                        while (true) {
                          // Retry logic for network errors
                          let r: Awaited<ReturnType<typeof migrateImagesBatch>> | null = null;
                          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                            try {
                              r = await migrateImagesBatch(offset, BATCH);
                              break;
                            } catch (e: any) {
                              if (attempt === MAX_RETRIES) throw e;
                              // Wait 2s before retry
                              await new Promise(res => setTimeout(res, 2000));
                            }
                          }
                          if (!r) break;
                          totalConverted += r.converted;
                          totalFailed += r.failed;
                          allErrors.push(...r.errors);
                          done = Math.min(offset + r.processed, total);
                          setMigrateProgress({ done, total, converted: totalConverted, failed: totalFailed, errors: allErrors });
                          if (r.done || r.processed === 0) break;
                          offset += BATCH;
                        }
                        showMsg(`✓ ${totalConverted} imágenes convertidas a WebP`, 'ok');
                        countImageMigration().then(setMigrateCount).catch(() => { });
                      } catch (e: any) {
                        showMsg(`Error en lote (offset ${offset}): ${e?.message} — puedes reintentar, retomará desde donde quedó`, 'err');
                      } finally {
                        setMigratingImages(false);
                      }
                    }}
                    className="flex items-center gap-2 px-5 rounded-xl text-xs font-bold disabled:opacity-50"
                    style={{ height: 38, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
                    {migratingImages && migrateProgress.total > 0
                      ? <><Loader2 size={13} className="animate-spin" /> Procesando lote {Math.ceil(migrateProgress.done / 30)} / {Math.ceil(migrateProgress.total / 30)}…</>
                      : <><Upload size={13} /> Descargar y convertir a WebP</>}
                  </button>
                </div>
              </div>

              {/* ── Scraping de imágenes faltantes ── */}
              <div className="rounded-2xl p-5 space-y-4"
                style={{ background: 'var(--card)', border: '1px solid rgba(124,58,237,0.3)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd' }}>
                    <Sparkles size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Scraping de imágenes faltantes</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      Para cada recurso sin imagen que tiene URL, accede a la página, extrae la imagen principal (og:image) y la guarda localmente en WebP.
                    </p>
                  </div>
                </div>

                <div style={{ height: 1, background: 'var(--border)' }} />

                {/* Progreso */}
                {scrapeProgress.total > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}>
                      <span>Procesando {scrapeProgress.done} / {scrapeProgress.total}</span>
                      <span style={{ color: '#c4b5fd' }}>{scrapeProgress.saved} guardadas · {scrapeProgress.failed} sin imagen</span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ background: 'var(--bg)', height: 8 }}>
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.round(scrapeProgress.done / scrapeProgress.total * 100)}%`, background: 'linear-gradient(90deg,#7c3aed,#c4b5fd)' }} />
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      {scrapeProgress.done >= scrapeProgress.total ? '✓ Completado' : 'El scraping puede tardar — no cierres esta ventana…'}
                    </p>
                    {scrapeProgress.errors.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer" style={{ color: '#f5c518' }}>Sin imagen encontrada ({scrapeProgress.errors.length})</summary>
                        <ul className="mt-1 space-y-0.5 pl-3" style={{ color: 'var(--muted)' }}>
                          {scrapeProgress.errors.slice(0, 30).map(e => (
                            <li key={e.id}>ID {e.id} — {e.title}: <span style={{ color: '#f87171' }}>{e.reason}</span></li>
                          ))}
                          {scrapeProgress.errors.length > 30 && <li>…y {scrapeProgress.errors.length - 30} más</li>}
                        </ul>
                      </details>
                    )}
                  </div>
                )}

                <div className="flex gap-2 items-center flex-wrap">
                  {migrateCount && (
                    <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)' }}>
                      {migrateCount.noImageWithUrl} recursos scrapeables
                    </span>
                  )}
                  <button
                    disabled={scrapingMissing || migratingImages || (migrateCount !== null && migrateCount.noImageWithUrl === 0)}
                    onClick={async () => {
                      if (!confirm('Accederá a la URL de cada recurso sin imagen para extraer su imagen principal. Puede tardar varios minutos. ¿Continuar?')) return;
                      setScrapingMissing(true);
                      const BATCH = 10;
                      const MAX_RETRIES = 3;

                      let count = migrateCount;
                      if (!count) { count = await countImageMigration(); setMigrateCount(count); }
                      const total = count.noImageWithUrl;
                      setScrapeProgress({ done: 0, total, saved: 0, failed: 0, errors: [] });

                      let offset = 0, totalSaved = 0, totalFailed = 0;
                      const allErrors: { id: number; title: string; reason: string }[] = [];

                      try {
                        while (true) {
                          let r: Awaited<ReturnType<typeof scrapeMissingImagesBatch>> | null = null;
                          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                            try { r = await scrapeMissingImagesBatch(offset, BATCH); break; }
                            catch { if (attempt === MAX_RETRIES) throw new Error('Timeout tras 3 intentos'); await new Promise(res => setTimeout(res, 2000)); }
                          }
                          if (!r) break;
                          totalSaved += r.saved;
                          totalFailed += r.failed;
                          allErrors.push(...r.errors);
                          const done = Math.min(offset + r.processed, total);
                          setScrapeProgress({ done, total, saved: totalSaved, failed: totalFailed, errors: allErrors });
                          if (r.done || r.processed === 0) break;
                          offset += BATCH;
                        }
                        showMsg(`✓ ${totalSaved} imágenes encontradas y guardadas`, 'ok');
                        countImageMigration().then(setMigrateCount).catch(() => { });
                      } catch (e: any) {
                        showMsg(`Error en scraping: ${e?.message} — puedes reintentar`, 'err');
                      } finally {
                        setScrapingMissing(false);
                      }
                    }}
                    className="flex items-center gap-2 px-5 rounded-xl text-xs font-bold disabled:opacity-50"
                    style={{ height: 38, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)', color: '#c4b5fd' }}>
                    {scrapingMissing
                      ? <><Loader2 size={13} className="animate-spin" /> Scrapeando lote {Math.ceil((scrapeProgress.done || 1) / 10)}…</>
                      : <><Sparkles size={13} /> Scrapear imágenes faltantes</>}
                  </button>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  Los recursos sin URL o cuya página no tiene og:image quedarán sin imagen. Si se interrumpe, puedes reintentar — solo procesa los que aún no tienen imagen.
                </p>
              </div>

              {/* ── Corregir imágenes incorrectas ── */}
              <div className="rounded-2xl p-5 space-y-4"
                style={{ background: 'var(--card)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                    <Pencil size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Corregir imágenes incorrectas</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      Vuelve a scrapear la imagen desde la URL de cada recurso, sobreescribiendo la imagen actual. Útil cuando la imagen no coincide con el título. Filtra por asignatura para procesar solo las afectadas.
                    </p>
                  </div>
                </div>

                <div style={{ height: 1, background: 'var(--border)' }} />

                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1" style={{ minWidth: 200 }}>
                    <label className="text-[11px] mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>
                      Filtrar por asignatura <span style={{ fontWeight: 400 }}>(vacío = todas)</span>
                    </label>
                    <select value={rescrapeSubject} onChange={e => setRescrapeSubject(e.target.value)}
                      disabled={rescrapingImages}
                      className="w-full px-3 rounded-xl text-sm outline-none disabled:opacity-40"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 42 }}>
                      <option value="">— Todas las asignaturas —</option>
                      {subjects.filter(s => s.isActive).map(s => (
                        <option key={s.id} value={s.id} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {rescrapeProgress.total > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs" style={{ color: 'var(--muted)' }}>
                      <span>Procesando {rescrapeProgress.done} / {rescrapeProgress.total}</span>
                      <span style={{ color: '#34d399' }}>{rescrapeProgress.updated} actualizadas · <span className="text-red-400">{rescrapeProgress.failed} sin imagen</span></span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ background: 'var(--bg)', height: 8 }}>
                      <div className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.round(rescrapeProgress.done / rescrapeProgress.total * 100)}%`, background: 'linear-gradient(90deg,#ef4444,#f59e0b)' }} />
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      {rescrapeProgress.done >= rescrapeProgress.total ? '✓ Completado' : 'No cierres esta ventana mientras procesa…'}
                    </p>
                    {rescrapeProgress.errors.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-red-400">Sin imagen encontrada ({rescrapeProgress.errors.length})</summary>
                        <ul className="mt-1 space-y-0.5 pl-3 max-h-40 overflow-y-auto" style={{ color: 'var(--muted)' }}>
                          {rescrapeProgress.errors.map(e => (
                            <li key={e.id}>ID {e.id} — {e.title}: <span className="text-red-400">{e.reason}</span></li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}

                <button
                  disabled={rescrapingImages || migratingImages || scrapingMissing}
                  onClick={async () => {
                    const subjectName = rescrapeSubject
                      ? subjects.find(s => String(s.id) === rescrapeSubject)?.name
                      : 'TODAS las asignaturas';
                    if (!confirm(`Esto sobreescribirá las imágenes actuales de "${subjectName}" con las obtenidas desde la URL de cada recurso. ¿Continuar?`)) return;

                    setRescrapingImages(true);
                    const BATCH = 5;
                    const MAX_RETRIES = 3;
                    const subjectId = rescrapeSubject ? +rescrapeSubject : undefined;
                    setRescrapeProgress({ done: 0, total: 0, updated: 0, failed: 0, errors: [] });

                    let offset = 0, totalUpdated = 0, totalFailed = 0, grandTotal = 0;
                    const allErrors: { id: number; title: string; reason: string }[] = [];

                    try {
                      while (true) {
                        let r: Awaited<ReturnType<typeof rescrapeImagesBatch>> | null = null;
                        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                          try { r = await rescrapeImagesBatch(offset, BATCH, subjectId); break; }
                          catch { if (attempt === MAX_RETRIES) throw new Error('Timeout tras 3 intentos'); await new Promise(res => setTimeout(res, 2000)); }
                        }
                        if (!r) break;
                        if (grandTotal === 0) grandTotal = r.total;
                        totalUpdated += r.updated;
                        totalFailed += r.failed;
                        allErrors.push(...r.errors);
                        const done = Math.min(offset + r.processed, grandTotal);
                        setRescrapeProgress({ done, total: grandTotal, updated: totalUpdated, failed: totalFailed, errors: allErrors });
                        if (r.done || r.processed === 0) break;
                        offset += BATCH;
                      }
                      showMsg(`✓ ${totalUpdated} imágenes corregidas`, 'ok');
                      countImageMigration().then(setMigrateCount).catch(() => { });
                    } catch (e: any) {
                      showMsg(`Error: ${e?.message} — puedes reintentar`, 'err');
                    } finally {
                      setRescrapingImages(false);
                    }
                  }}
                  className="flex items-center gap-2 px-5 rounded-xl text-xs font-bold disabled:opacity-50"
                  style={{ height: 38, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                  {rescrapingImages
                    ? <><Loader2 size={13} className="animate-spin" /> Corrigiendo {rescrapeProgress.done}/{rescrapeProgress.total}…</>
                    : <><Sparkles size={13} /> {rescrapeSubject ? `Corregir ${subjects.find(s => String(s.id) === rescrapeSubject)?.name}` : 'Corregir todas'}</>}
                </button>

                <p className="text-[11px]" style={{ color: '#f87171', opacity: 0.8 }}>
                  ⚠ Sobreescribe las imágenes actuales. Úsala asignatura por asignatura para verificar los resultados antes de continuar.
                </p>
              </div>

            </div>{/* end grid */}
          </div>{/* end herramientas */}

        </div>
      )}

      {/* ── Slide editor modal ── */}
      {editingSlide !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setEditingSlide(null)}>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-bold text-white">{editingSlide.id ? 'Editar Slide' : 'Nuevo Slide'}</h3>
              <button onClick={() => setEditingSlide(null)}
                className="icon-btn flex items-center justify-center rounded-xl hover:bg-white/10"
                style={{ color: 'var(--muted)', width: 40, height: 40 }}>
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4" style={{ maxHeight: 'calc(90vh - 130px)' }}>
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Título *</label>
                <input value={editingSlide.title || ''} onChange={e => setEditingSlide(prev => ({ ...prev!, title: e.target.value }))}
                  placeholder="Título del slide"
                  className="w-full px-4 rounded-xl outline-none text-sm"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 48 }} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Subtítulo</label>
                <input value={editingSlide.subtitle || ''} onChange={e => setEditingSlide(prev => ({ ...prev!, subtitle: e.target.value }))}
                  placeholder="Descripción breve (opcional)"
                  className="w-full px-4 rounded-xl outline-none text-sm"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 48 }} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Imagen</label>
                <div className="space-y-2">
                  <input value={editingSlide.imageUrl || ''} onChange={e => setEditingSlide(prev => ({ ...prev!, imageUrl: e.target.value }))}
                    placeholder="https://... (URL de imagen)"
                    className="w-full px-4 rounded-xl outline-none text-sm"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 48 }} />
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>o subir archivo:</span>
                    <label className="flex items-center gap-2 px-4 rounded-xl text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)', height: 36 }}>
                      <Upload size={13} />
                      {uploadingImg ? 'Subiendo...' : 'Elegir imagen'}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingImg}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadImage(f); }} />
                    </label>
                  </div>
                  {editingSlide.imageUrl && (
                    <div className="rounded-xl overflow-hidden relative" style={{ height: 100 }}>
                      <NextImage
                        src={editingSlide.imageUrl}
                        alt="preview"
                        fill
                        sizes="480px"
                        className="object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>URL del enlace (al hacer clic)</label>
                <input value={editingSlide.linkUrl || ''} onChange={e => setEditingSlide(prev => ({ ...prev!, linkUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-4 rounded-xl outline-none text-sm"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 48 }} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Texto del botón</label>
                <input value={editingSlide.buttonText || ''} onChange={e => setEditingSlide(prev => ({ ...prev!, buttonText: e.target.value }))}
                  placeholder="Ver recurso"
                  className="w-full px-4 rounded-xl outline-none text-sm"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 48 }} />
              </div>
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Estado</label>
                <div className="flex gap-3">
                  {([true, false] as const).map(val => (
                    <button key={String(val)} onClick={() => setEditingSlide(prev => ({ ...prev!, isActive: val }))}
                      className="flex-1 rounded-xl text-sm font-semibold transition-colors"
                      style={{
                        height: 44,
                        background: editingSlide.isActive === val ? val ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)' : 'var(--bg)',
                        border: `1px solid ${editingSlide.isActive === val ? val ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
                        color: editingSlide.isActive === val ? val ? '#34d399' : '#f87171' : 'var(--muted)',
                      }}>
                      {val ? 'Activo' : 'Inactivo'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setEditingSlide(null)} className="px-5 rounded-xl text-sm font-medium"
                style={{ color: 'var(--muted)', height: 44 }}>
                Cancelar
              </button>
              <button onClick={handleSaveSlide} disabled={savingSlide}
                className="px-6 rounded-xl text-sm font-bold disabled:opacity-60"
                style={{ background: 'var(--accent)', color: '#1e0d38', height: 44 }}>
                {savingSlide ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Editar / Crear Asignatura
      ══════════════════════════════════════════════════════════════ */}
      {editingSubject !== null && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setEditingSubject(null)}>
          <div className="fixed inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-bold text-white">{editingSubject.id ? 'Editar Asignatura' : 'Nueva Asignatura'}</h2>
              <button
                onClick={() => setEditingSubject(null)}
                className="icon-btn flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: 'var(--muted)', width: 40, height: 40 }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Nombre *</label>
                <input
                  type="text"
                  value={editingSubject.name || ''}
                  onChange={e => setEditingSubject(prev => ({ ...prev!, name: e.target.value }))}
                  placeholder="ej: Historia y Geografía"
                  className="w-full px-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 48 }}
                />
              </div>

              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editingSubject.color || '#7c3aed'}
                    onChange={e => setEditingSubject(prev => ({ ...prev!, color: e.target.value }))}
                    className="rounded-lg cursor-pointer"
                    style={{ width: 48, height: 48, padding: 4, background: 'var(--bg)', border: '1px solid var(--border)' }}
                  />
                  <div className="flex gap-2 flex-wrap">
                    {SUBJECT_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setEditingSubject(prev => ({ ...prev!, color: c }))}
                        className="rounded-lg"
                        style={{
                          width: 28, height: 28, background: c,
                          outline: editingSubject.color === c ? '2px solid white' : 'none',
                          outlineOffset: 2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {editingSubject.id && (
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Estado</label>
                  <div className="flex gap-3">
                    {[true, false].map(val => (
                      <button
                        key={String(val)}
                        onClick={() => setEditingSubject(prev => ({ ...prev!, isActive: val }))}
                        className="flex-1 rounded-xl text-sm font-semibold transition-colors"
                        style={{
                          height: 44,
                          background: editingSubject.isActive === val
                            ? val ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.15)'
                            : 'var(--bg)',
                          border: `1px solid ${editingSubject.isActive === val
                            ? val ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.4)'
                            : 'var(--border)'}`,
                          color: editingSubject.isActive === val
                            ? val ? '#34d399' : '#f87171'
                            : 'var(--muted)',
                        }}
                      >
                        {val ? 'Activa' : 'Inactiva'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setEditingSubject(null)}
                className="px-5 rounded-xl text-sm font-medium"
                style={{ color: 'var(--muted)', height: 44 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSubject}
                disabled={savingSubject}
                className="px-6 rounded-xl text-sm font-bold disabled:opacity-60"
                style={{ background: 'var(--accent)', color: '#1e0d38', height: 44 }}
              >
                {savingSubject ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: CARGA MASIVA
      ══════════════════════════════════════════════════════════════ */}
      {showBulk && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => { if (!bulkImporting) setShowBulk(false); }}>
          <div className="fixed inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-5xl rounded-2xl shadow-2xl my-8"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
                  <FileSpreadsheet size={18} style={{ color: '#34d399' }} />
                </div>
                <div>
                  <h2 className="font-bold text-white">Carga masiva de recursos</h2>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Importa múltiples recursos desde un archivo Excel (.xlsx)</p>
                </div>
              </div>
              <button onClick={() => { if (!bulkImporting) setShowBulk(false); }}
                className="flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: 'var(--muted)', width: 40, height: 40 }}>
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* ── Formato requerido ── */}
              <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(245,197,24,0.07)', border: '1px solid rgba(245,197,24,0.2)' }}>
                <p className="text-xs font-bold flex items-center gap-2" style={{ color: '#f5c518' }}>
                  <AlertTriangle size={13} /> Formato requerido del Excel
                </p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  La primera fila debe ser el encabezado con exactamente estos nombres de columna (sin tildes, en minúscula):
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { col: 'titulo', req: true },
                    { col: 'url', req: true },
                    { col: 'descripcion', req: false },
                    { col: 'tipo_actividad', req: false },
                    { col: 'autor', req: false },
                    { col: 'codigo_oa', req: false },
                    { col: 'descripcion_oa', req: false },
                  ].map(({ col, req }) => (
                    <span key={col} className="px-2 py-0.5 rounded font-mono text-[11px]"
                      style={{
                        background: req ? 'rgba(124,58,237,0.2)' : 'var(--bg)',
                        border: `1px solid ${req ? 'rgba(124,58,237,0.4)' : 'var(--border)'}`,
                        color: req ? '#c4b5fd' : 'var(--muted)',
                      }}>
                      {col}{req ? ' *' : ''}
                    </span>
                  ))}
                </div>
                <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  * Obligatorio · La asignatura, curso y unidad se definen abajo — no hace falta incluirlos en el Excel.
                </p>
                <button
                  onClick={async () => {
                    const XLSX = await import('xlsx');
                    const ws = XLSX.utils.aoa_to_sheet([
                      ['titulo', 'url', 'descripcion', 'tipo_actividad', 'autor', 'codigo_oa', 'descripcion_oa'],
                      ['Introducción a las fracciones', 'https://ejemplo.com', 'Descripción opcional', 'Video', 'Autor Ejemplo', 'MA01 OA 01', 'Descripción del objetivo de aprendizaje'],
                    ]);
                    ws['!cols'] = [36, 44, 44, 22, 22, 30, 15, 44].map(w => ({ wch: w }));
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Recursos');
                    XLSX.writeFile(wb, 'plantilla-recursos-paperflix.xlsx');
                  }}
                  className="flex items-center gap-2 px-3 rounded-lg text-xs font-semibold mt-1"
                  style={{ height: 32, background: 'rgba(245,197,24,0.12)', border: '1px solid rgba(245,197,24,0.3)', color: '#f5c518' }}>
                  <FileSpreadsheet size={13} /> Descargar plantilla
                </button>
              </div>

              {/* ── Selección de destino ── */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold text-white">Destino de los recursos <span className="font-normal" style={{ color: 'var(--muted)' }}>— selecciona en orden</span></p>
                <div className="grid grid-cols-3 gap-3">
                  {/* 1. Asignatura */}
                  <div>
                    <label className="text-[11px] mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>1. Asignatura *</label>
                    <select value={bulkSubject}
                      onChange={async e => {
                        const val = e.target.value;
                        setBulkSubject(val); setBulkCourse(''); setBulkUnit(''); setBulkUnits([]);
                        if (val) setBulkUnits(await getUnits(+val));
                      }}
                      className="w-full px-3 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', height: 42 }}>
                      <option value="">— Seleccionar —</option>
                      {subjects.filter(s => s.isActive).map(s => (
                        <option key={s.id} value={s.id} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Curso del catálogo */}
                  <div>
                    <label className="text-[11px] mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>2. Curso *</label>
                    <select value={bulkCourse} onChange={e => { setBulkCourse(e.target.value); setBulkUnit(''); }}
                      disabled={!bulkSubject}
                      className="w-full px-3 rounded-xl text-sm outline-none disabled:opacity-40"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', height: 42 }}>
                      <option value="">— Seleccionar —</option>
                      {sortCourses(catalogCourses.filter(c => c.isActive)).map(c => (
                        <option key={c.id} value={c.name} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Unidad */}
                  <div>
                    <label className="text-[11px] mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>3. Unidad *</label>
                    <select value={bulkUnit} onChange={e => setBulkUnit(e.target.value)}
                      disabled={!bulkCourse || !bulkUnits.length}
                      className="w-full px-3 rounded-xl text-sm outline-none disabled:opacity-40"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', height: 42 }}>
                      <option value="">— Seleccionar —</option>
                      {bulkUnits.map(u => (
                        <option key={u.id} value={u.id} style={{ color: '#1e0d38', background: '#e9e0f7' }}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Resumen visual del destino seleccionado */}
                {(bulkSubject || bulkCourse || bulkUnit) && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {bulkSubject && (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(124,58,237,0.15)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)' }}>
                        {subjects.find(s => String(s.id) === bulkSubject)?.name}
                      </span>
                    )}
                    {bulkCourse && (
                      <>
                        <ChevronRight size={12} style={{ color: 'var(--muted)' }} />
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                          style={{ background: 'rgba(245,197,24,0.12)', color: '#f5c518', border: '1px solid rgba(245,197,24,0.25)' }}>
                          {bulkCourse}
                        </span>
                      </>
                    )}
                    {bulkUnit && (
                      <>
                        <ChevronRight size={12} style={{ color: 'var(--muted)' }} />
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                          style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                          {bulkUnits.find(u => String(u.id) === bulkUnit)?.name}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* ── File upload ── */}
              {!bulkResult && (
                <div>
                  <label className="text-[11px] mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>
                    Seleccionar archivo Excel (.xlsx, .xls)
                  </label>
                  <label
                    className="flex flex-col items-center justify-center rounded-xl cursor-pointer transition-colors hover:border-purple-500/50"
                    style={{ border: '2px dashed var(--border)', background: 'var(--bg)', minHeight: 100 }}>
                    <input type="file" accept=".xlsx,.xls" className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        e.target.value = '';
                        setBulkRows([]);
                        setBulkResult(null);
                        const XLSX = await import('xlsx');
                        const buf = await file.arrayBuffer();
                        const wb = XLSX.read(buf, { type: 'array' });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

                        const VALID_COLS = new Set(['titulo', 'url', 'descripcion', 'tipo_actividad', 'autor', 'codigo_oa', 'descripcion_oa']);
                        const parsed: BulkRow[] = raw.map((r) => {
                          const norm: Record<string, string> = {};
                          for (const k of Object.keys(r)) {
                            const nk = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
                            if (VALID_COLS.has(nk)) norm[nk] = String(r[k] ?? '').trim();
                          }
                          const row: BulkRow = {
                            titulo: norm.titulo || '',
                            url: norm.url || '',
                            descripcion: norm.descripcion,
                            tipo_actividad: norm.tipo_actividad,
                            autor: norm.autor,
                            codigo_oa: norm.codigo_oa,
                            descripcion_oa: norm.descripcion_oa,
                          };
                          if (!row.titulo) row._error = 'Sin título';
                          else if (!row.url) row._error = 'Sin URL';
                          return row;
                        });
                        setBulkRows(parsed);
                      }} />
                    <Upload size={22} style={{ color: 'var(--muted)' }} />
                    <span className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
                      Arrastra o haz clic para seleccionar
                    </span>
                    <span className="text-xs mt-1" style={{ color: 'var(--muted)', opacity: 0.6 }}>.xlsx · .xls</span>
                  </label>
                </div>
              )}

              {/* ── Preview table ── */}
              {bulkRows.length > 0 && !bulkResult && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-white">
                      Vista previa — {bulkRows.length} filas
                      {bulkRows.filter(r => r._error).length > 0 && (
                        <span className="ml-2 text-xs font-normal text-red-400">
                          ({bulkRows.filter(r => r._error).length} con error — se omitirán)
                        </span>
                      )}
                    </p>
                    <button onClick={() => setBulkRows([])}
                      className="text-xs flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                      <X size={12} /> Limpiar
                    </button>
                  </div>
                  <div className="rounded-xl overflow-auto max-h-72" style={{ border: '1px solid var(--border)' }}>
                    <table className="w-full text-xs min-w-[700px]">
                      <thead>
                        <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                          {['#', 'Título', 'URL', 'Tipo actividad', 'Autor', 'Cód. OA', 'Estado'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: 'var(--muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.map((row, i) => (
                          <tr key={i}
                            className="border-t"
                            style={{
                              borderColor: 'var(--border)',
                              background: row._error ? 'rgba(239,68,68,0.06)' : i % 2 === 0 ? 'var(--card)' : 'transparent',
                            }}>
                            <td className="px-3 py-2 font-mono" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                            <td className="px-3 py-2 max-w-[200px] truncate text-white">{row.titulo || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>vacío</span>}</td>
                            <td className="px-3 py-2 max-w-[160px] truncate" style={{ color: 'var(--muted)' }}>{row.url || '—'}</td>
                            <td className="px-3 py-2 truncate" style={{ color: 'var(--muted)' }}>{row.tipo_actividad || '—'}</td>
                            <td className="px-3 py-2 truncate" style={{ color: 'var(--muted)' }}>{row.autor || '—'}</td>
                            <td className="px-3 py-2 font-mono" style={{ color: 'var(--accent)' }}>{row.codigo_oa || '—'}</td>
                            <td className="px-3 py-2">
                              {row._error
                                ? <span className="flex items-center gap-1 text-red-400"><AlertTriangle size={11} />{row._error}</span>
                                : <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 size={11} />OK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── Resultado ── */}
              {bulkResult && (
                <div className="rounded-xl p-4 space-y-2"
                  style={{ background: bulkResult.errors.length === 0 ? 'rgba(16,185,129,0.08)' : 'rgba(245,197,24,0.07)', border: `1px solid ${bulkResult.errors.length === 0 ? 'rgba(16,185,129,0.25)' : 'rgba(245,197,24,0.25)'}` }}>
                  <p className="font-bold text-white flex items-center gap-2">
                    <CheckCircle2 size={16} style={{ color: '#34d399' }} />
                    {bulkResult.created} recursos importados correctamente
                    {bulkResult.errors.length > 0 && ` · ${bulkResult.errors.length} con error`}
                  </p>
                  {bulkResult.errors.length > 0 && (
                    <ul className="text-xs space-y-0.5" style={{ color: '#f87171' }}>
                      {bulkResult.errors.map(e => <li key={e.row}>Fila {e.row}: {e.message}</li>)}
                    </ul>
                  )}
                  <button onClick={() => { setBulkRows([]); setBulkResult(null); }}
                    className="text-xs mt-1 underline" style={{ color: 'var(--muted)' }}>
                    Importar otro archivo
                  </button>
                </div>
              )}

            </div>

            {/* Footer */}
            {!bulkResult && (
              <div className="px-6 py-4 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {!bulkSubject || !bulkCourse || !bulkUnit
                    ? 'Selecciona asignatura, curso y unidad antes de importar'
                    : bulkRows.filter(r => !r._error).length > 0
                      ? `Se importarán ${bulkRows.filter(r => !r._error).length} recursos → ${subjects.find(s => String(s.id) === bulkSubject)?.name} · ${bulkCourse} · ${bulkUnits.find(u => String(u.id) === bulkUnit)?.name}`
                      : 'Sube un archivo para previsualizar'}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setShowBulk(false)} disabled={bulkImporting}
                    className="px-5 rounded-xl text-sm font-medium disabled:opacity-50"
                    style={{ color: 'var(--muted)', height: 44 }}>
                    Cancelar
                  </button>
                  <button
                    disabled={bulkImporting || !bulkSubject || !bulkCourse || !bulkUnit || bulkRows.filter(r => !r._error).length === 0}
                    onClick={async () => {
                      if (!bulkSubject) return;
                      setBulkImporting(true);
                      try {
                        const validRows = bulkRows.filter(r => !r._error);
                        const items = validRows.map(r => ({
                          subjectId: +bulkSubject,
                          unitId: bulkUnit ? +bulkUnit : undefined,
                          course: bulkCourse,
                          title: r.titulo,
                          linkUrl: r.url,
                          description: r.descripcion || undefined,
                          activityType: r.tipo_actividad || undefined,
                          author: r.autor || undefined,
                          oaCode: r.codigo_oa || undefined,
                          oaDescription: r.descripcion_oa || undefined,
                          isActive: true,
                        }));
                        const result = await bulkCreateResources(items);
                        setBulkResult(result);
                        await loadResources();
                        broadcastDataChange();
                        showMsg(`${result.created} recursos importados correctamente`, 'ok');
                      } catch (err: any) {
                        showMsg('Error al importar: ' + (err?.response?.data?.message || err.message), 'err');
                      } finally {
                        setBulkImporting(false);
                      }
                    }}
                    className="flex items-center gap-2 px-6 rounded-xl text-sm font-bold disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#1e0d38', height: 44 }}>
                    {bulkImporting
                      ? <><Loader2 size={15} className="animate-spin" /> Importando...</>
                      : <><Upload size={15} /> Importar {bulkRows.filter(r => !r._error).length} recursos</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// Convierte hex #rrggbb a "r, g, b"
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
