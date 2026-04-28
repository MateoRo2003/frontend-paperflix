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
    <div className="relative w-full">
      <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
      <input
        type="text"
        value={value}
        onChange={(e) => handle(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-12 pr-12 py-3 rounded-xl text-base outline-none transition-all"
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
          className="absolute right-4 top-1/2 -translate-y-1/2 hover:text-white"
          style={{ color: 'var(--muted)' }}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
