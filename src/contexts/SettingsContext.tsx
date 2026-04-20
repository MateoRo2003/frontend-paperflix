'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getSettings } from '@/lib/api';

interface AppSettings {
  showViews: boolean;
}

const defaults: AppSettings = { showViews: false };

const SettingsContext = createContext<AppSettings>(defaults);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaults);

  useEffect(() => {
    getSettings()
      .then((raw: Record<string, string>) => {
        setSettings({
          showViews: raw.showViews !== 'false',
        });
      })
      .catch(() => {});
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettings {
  return useContext(SettingsContext);
}
