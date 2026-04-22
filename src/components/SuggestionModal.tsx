'use client';
import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { X, Send, CheckCircle, Lightbulb } from 'lucide-react';
import { createSuggestion } from '@/lib/api';
import { Subject } from '@/types';

const ACTIVITY_TYPES = ['Introductoria', 'De desarrollo', 'De cierre', 'Herramienta'];
const COURSES = ['Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo'];

interface Props {
  subjects: Subject[];
  defaultSubjectId?: number;
  defaultSubjectName?: string;
  onClose: () => void;
}

export default function SuggestionModal({ subjects, defaultSubjectId, defaultSubjectName, onClose }: Props) {
  const [form, setForm] = useState({
    title:        '',
    linkUrl:      '',
    description:  '',
    subjectId:    defaultSubjectId ?? '',
    subjectName:  defaultSubjectName ?? '',
    course:       '',
    activityType: '',
    teacherName:  '',
    notes:        '',
  });
  const [saving, setSaving]   = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('El título es obligatorio.'); return; }
    if (!form.linkUrl.trim()) { setError('La URL del recurso es obligatoria.'); return; }
    setError('');
    setSaving(true);
    try {
      // Completar subjectName si eligió asignatura del select
      const subjectName = form.subjectId
        ? subjects.find(s => s.id === +form.subjectId)?.name ?? form.subjectName
        : form.subjectName;

      await createSuggestion({
        title:       form.title.trim(),
        linkUrl:     form.linkUrl.trim(),
        description: form.description.trim() || undefined,
        subjectId:   form.subjectId ? +form.subjectId : undefined,
        subjectName: subjectName || undefined,
        course:      form.course || undefined,
        activityType: form.activityType || undefined,
        teacherName:  form.teacherName.trim() || undefined,
        notes:        form.notes.trim() || undefined,
      });
      setSent(true);
    } catch {
      setError('No se pudo enviar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl flex flex-col"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,197,24,0.15)' }}>
              <Lightbulb size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="font-bold text-white text-base">Sugerir un recurso</h2>
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>El equipo revisará tu sugerencia</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="icon-btn flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors"
            style={{ color: 'var(--muted)', width: 40, height: 40 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ─── Éxito ─────────────────────────────────────────────── */}
        {sent ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <CheckCircle size={32} style={{ color: '#34d399' }} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1">¡Gracias por tu sugerencia!</h3>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                El equipo de PaperFlix la revisará pronto y la agregarán a la plataforma si cumple los criterios.
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--accent)', color: '#1e0d38', height: 48 }}
            >
              Cerrar
            </button>
          </div>
        ) : (
          /* ─── Formulario ─────────────────────────────────────── */
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* Título */}
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted)' }}>
                  Título del recurso *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                  placeholder="ej: Video sobre fracciones – Khan Academy"
                  className="w-full px-4 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 48 }}
                />
              </div>

              {/* URL */}
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted)' }}>
                  URL del recurso *
                </label>
                <input
                  type="url"
                  value={form.linkUrl}
                  onChange={e => set('linkUrl', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 48 }}
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted)' }}>
                  Descripción breve
                </label>
                <textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  rows={2}
                  placeholder="¿De qué trata este recurso? ¿Para qué lo usarías?"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </div>

              {/* Asignatura + Curso */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted)' }}>Asignatura</label>
                  <select
                    value={form.subjectId}
                    onChange={e => set('subjectId', e.target.value)}
                    className="w-full px-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 48 }}
                  >
                    <option value="">Seleccionar...</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted)' }}>Curso</label>
                  <select
                    value={form.course}
                    onChange={e => set('course', e.target.value)}
                    className="w-full px-3 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 48 }}
                  >
                    <option value="">Todos</option>
                    {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Tipo de actividad */}
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted)' }}>Tipo de actividad</label>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('activityType', form.activityType === t ? '' : t)}
                      className="px-3 rounded-full text-xs font-medium transition-colors"
                      style={{
                        height: 36,
                        background: form.activityType === t ? 'var(--purple)' : 'var(--bg)',
                        border: `1px solid ${form.activityType === t ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
                        color: form.activityType === t ? '#fff' : 'var(--muted)',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nombre del maestro + Notas */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted)' }}>
                    Tu nombre (opcional)
                  </label>
                  <input
                    type="text"
                    value={form.teacherName}
                    onChange={e => set('teacherName', e.target.value)}
                    placeholder="Ej: Prof. González"
                    className="w-full px-4 rounded-xl text-sm outline-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', height: 48 }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--muted)' }}>
                    Comentarios adicionales para el admin
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    rows={2}
                    placeholder="¿Por qué crees que este recurso sería valioso?"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <span>⚠</span> {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t shrink-0 flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={onClose}
                className="px-5 rounded-xl text-sm font-medium"
                style={{ color: 'var(--muted)', height: 48 }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 rounded-xl text-sm font-bold disabled:opacity-60 transition-all"
                style={{ background: 'var(--accent)', color: '#1e0d38', height: 48 }}
              >
                <Send size={15} />
                {saving ? 'Enviando...' : 'Enviar Sugerencia'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
