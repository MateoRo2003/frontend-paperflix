'use client';
import { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface Props {
  onSearch: (q: string) => void;
  placeholder?: string;
}

export default function SearchBar({ onSearch, placeholder = 'Buscar recursos...' }: Props) {
  const [value, setValue] = useState('');

  const handle = useCallback((v: string) => {
    setValue(v);
    onSearch(v);
  }, [onSearch]);

  return (
    <div className="relative w-full max-w-lg">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
      <input
        type="text"
        value={value}
        onChange={(e) => handle(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none transition-all"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
        }}
        onFocus={(e) => e.target.style.borderColor = 'var(--purple)'}
        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
      />
      {value && (
        <button
          onClick={() => handle('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-white"
          style={{ color: 'var(--muted)' }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
