'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  placeholder?: string;
}

type Panel = 'alpha' | 'nums';

const ALPHA_LOWER = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l','ñ'],
  ['z','x','c','v','b','n','m'],
];
const ALPHA_UPPER = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L','Ñ'],
  ['Z','X','C','V','B','N','M'],
];
const NUMS_ROWS = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['@','#','$','%','&','-','_','(',')','/'],
  ['.', ',', ':', ';', '?', '!', '"', "'", '+', '='],
];
const ACCENTS = ['á','é','í','ó','ú','ü','Á','É','Í','Ó','Ú','Ü','¿','¡'];

export default function VirtualKeyboard({ value, onChange, onClose, placeholder }: Props) {
  const [caps, setCaps] = useState(false);
  const [panel, setPanel] = useState<Panel>('alpha');
  const [showAccents, setShowAccents] = useState(false);
  const [mounted, setMounted] = useState(false);
  const bsInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const bsTimeout  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const valueRef   = useRef(value);
  valueRef.current = value;

  useEffect(() => { setMounted(true); return () => { stopBs(); }; }, []);

  const press = useCallback((char: string) => {
    onChange(valueRef.current + char);
    if (caps && panel === 'alpha') setCaps(false);
  }, [onChange, caps, panel]);

  const startBs = useCallback(() => {
    onChange(valueRef.current.slice(0, -1));
    bsTimeout.current = setTimeout(() => {
      bsInterval.current = setInterval(() => {
        onChange(valueRef.current.slice(0, -1));
      }, 80);
    }, 400);
  }, [onChange]);

  const stopBs = useCallback(() => {
    if (bsTimeout.current)  { clearTimeout(bsTimeout.current);   bsTimeout.current  = null; }
    if (bsInterval.current) { clearInterval(bsInterval.current); bsInterval.current = null; }
  }, []);

  if (!mounted) return null;

  const rows = panel === 'alpha' ? (caps ? ALPHA_UPPER : ALPHA_LOWER) : NUMS_ROWS;

  const KEY: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, fontWeight: 600, cursor: 'pointer',
    userSelect: 'none', transition: 'filter 0.1s, transform 0.08s',
    fontSize: 19, minHeight: 54, flex: 1,
    background: 'rgba(255,255,255,0.09)',
    color: '#ede6f7',
    border: '1px solid rgba(255,255,255,0.13)',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  };

  const keyboard = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      pointerEvents: 'none',
    }}>
      {/* backdrop — click cierra */}
      <div
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
        onPointerDown={onClose}
      />

      {/* panel teclado */}
      <div style={{
        position: 'relative', pointerEvents: 'auto',
        background: '#251145',
        borderTop: '1.5px solid rgba(155,89,232,0.35)',
        borderRadius: '22px 22px 0 0',
        padding: '10px 10px 18px',
        boxShadow: '0 -12px 48px rgba(0,0,0,0.65)',
        display: 'flex', flexDirection: 'column', gap: 7,
        animation: 'kbSlideUp 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* ── barra de vista previa ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,0,0,0.3)', borderRadius: 14,
          padding: '6px 14px', border: '1px solid rgba(255,255,255,0.1)',
          minHeight: 48,
        }}>
          <span style={{
            flex: 1, fontSize: 17, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: value ? '#fff' : 'rgba(255,255,255,0.28)',
          }}>
            {value || placeholder || 'Escribe aquí…'}
          </span>
          {value && (
            <button
              onPointerDown={(e) => { e.preventDefault(); onChange(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4, display: 'flex' }}
            >
              <X size={16} />
            </button>
          )}
          <button
            onPointerDown={(e) => { e.preventDefault(); onClose(); }}
            style={{
              background: 'var(--purple)', border: 'none', borderRadius: 10,
              padding: '5px 16px', color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              minHeight: 36, boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
            }}
          >
            <Check size={14} /> Listo
          </button>
        </div>

        {/* ── acentos (opcional) ── */}
        {showAccents && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
            {ACCENTS.map(c => (
              <button
                key={c}
                onPointerDown={(e) => { e.preventDefault(); press(c); }}
                style={{
                  ...KEY, flex: '0 0 auto', minWidth: 48, minHeight: 46,
                  background: 'rgba(245,197,24,0.14)',
                  borderColor: 'rgba(245,197,24,0.35)',
                  color: 'var(--accent)',
                  fontSize: 20,
                }}
              >{c}</button>
            ))}
          </div>
        )}

        {/* ── filas de teclas ── */}
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 6 }}>

            {/* Shift antes de fila Z */}
            {panel === 'alpha' && ri === 2 && (
              <button
                onPointerDown={(e) => { e.preventDefault(); setCaps(v => !v); }}
                style={{
                  ...KEY, flex: '0 0 58px', minWidth: 58, fontSize: 20,
                  background: caps ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
                  color: caps ? '#1e0d38' : 'rgba(255,255,255,0.65)',
                  borderColor: caps ? 'transparent' : 'rgba(255,255,255,0.1)',
                  fontWeight: 900,
                }}
              >⇧</button>
            )}

            {row.map(char => (
              <button
                key={char}
                onPointerDown={(e) => { e.preventDefault(); press(char); }}
                style={KEY}
              >{char}</button>
            ))}

            {/* Borrar en última fila */}
            {ri === rows.length - 1 && (
              <button
                onPointerDown={(e) => { e.preventDefault(); startBs(); }}
                onPointerUp={stopBs}
                onPointerLeave={stopBs}
                style={{
                  ...KEY, flex: '0 0 58px', minWidth: 58,
                  background: 'rgba(239,68,68,0.14)',
                  borderColor: 'rgba(239,68,68,0.25)',
                  color: '#f87171', fontSize: 20,
                }}
              >⌫</button>
            )}
          </div>
        ))}

        {/* ── barra inferior ── */}
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          <button
            onPointerDown={(e) => { e.preventDefault(); setPanel(p => p === 'alpha' ? 'nums' : 'alpha'); setShowAccents(false); }}
            style={{ ...KEY, flex: '0 0 72px', minWidth: 72, fontSize: 15, fontWeight: 800 }}
          >{panel === 'alpha' ? '123' : 'ABC'}</button>

          <button
            onPointerDown={(e) => { e.preventDefault(); setShowAccents(v => !v); }}
            style={{
              ...KEY, flex: '0 0 54px', minWidth: 54, fontSize: 21,
              background: showAccents ? 'rgba(155,89,232,0.28)' : 'rgba(255,255,255,0.09)',
              borderColor: showAccents ? 'var(--purple)' : 'rgba(255,255,255,0.13)',
            }}
          >á</button>

          <button
            onPointerDown={(e) => { e.preventDefault(); press(' '); }}
            style={{ ...KEY, flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}
          >espacio</button>

          <button
            onPointerDown={(e) => { e.preventDefault(); onClose(); }}
            style={{
              ...KEY, flex: '0 0 90px', minWidth: 90, fontSize: 14, fontWeight: 800,
              background: 'rgba(16,185,129,0.18)',
              borderColor: 'rgba(16,185,129,0.35)',
              color: '#34d399',
              gap: 6,
            }}
          ><Check size={15} /> Listo</button>
        </div>
      </div>
    </div>
  );

  return createPortal(keyboard, document.body);
}
