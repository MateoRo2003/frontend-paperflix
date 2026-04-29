'use client';

import AppShell from '@/components/AppShell';

export default function LegalPage() {
  return (
    <AppShell>
      <div className="flex-1 px-6 py-10 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-white mb-2">Información Legal</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Políticas de protección de datos y condiciones de uso de PaperFlix.
        </p>

        {/* ── Protección de datos ──────────────────────────────── */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Protección de datos personales</h2>
          <div className="rounded-2xl p-5 space-y-3 text-sm leading-relaxed" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <p>
              PaperFlix se compromete a proteger la privacidad y los datos personales de todos
              sus usuarios, en conformidad con la legislación vigente en materia de protección
              de datos personales de la República de Chile, incluyendo la Ley N° 19.628 sobre
              Protección de la Vida Privada y sus modificaciones posteriores.
            </p>
            <p>
              Los datos recopilados a través de esta plataforma se utilizan exclusivamente con
              fines educativos y para mejorar la experiencia del usuario. No se comparten ni
              comercializan datos personales con terceros sin el consentimiento explícito del
              usuario.
            </p>
          </div>
        </section>

        {/* ── Condiciones de uso ──────────────────────────────── */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Condiciones de uso</h2>
          <div className="rounded-2xl p-5 space-y-3 text-sm leading-relaxed" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <p>
              Al utilizar PaperFlix, el usuario acepta las siguientes condiciones:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Los recursos educativos compartidos en la plataforma son de acceso libre para
                fines pedagógicos. PaperFlix no se responsabiliza por el contenido de los
                sitios externos enlazados.
              </li>
              <li>
                Los usuarios que sugieran recursos se comprometen a no compartir material
                inapropiado, con derechos de autor restringidos o que infrinja normativas
                vigentes.
              </li>
              <li>
                El equipo de PaperFlix se reserva el derecho de moderar, aprobar o rechazar
                cualquier sugerencia de recurso.
              </li>
            </ul>
          </div>
        </section>

        {/* ── Propiedad intelectual ───────────────────────────── */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Propiedad intelectual</h2>
          <div className="rounded-2xl p-5 space-y-3 text-sm leading-relaxed" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <p>
              El diseño, logotipo, nombre y contenido propio de PaperFlix son propiedad de sus
              creadores y están protegidos por las leyes de propiedad intelectual. Queda
              prohibida su reproducción total o parcial sin autorización previa.
            </p>
            <p>
              Los recursos educativos enlazados pertenecen a sus respectivos autores y
              plataformas. PaperFlix actúa únicamente como un catálogo de referencia para
              facilitar el acceso a material educativo de calidad.
            </p>
          </div>
        </section>

        {/* ── Contacto ────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Contacto</h2>
          <div className="rounded-2xl p-5 text-sm leading-relaxed" style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <p>
              Para consultas relacionadas con el tratamiento de datos personales, condiciones
              de uso u otros asuntos legales, puede contactarnos a través del correo
              electrónico del equipo de PaperFlix.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
