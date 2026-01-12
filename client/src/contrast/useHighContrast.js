import { useEffect, useState } from 'react';

const STORAGE_KEY = 'hc_enabled';

export function useHighContrast() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (enabled) root.classList.add('hc');
    else root.classList.remove('hc');
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch {}
  }, [enabled]);

  return { enabled, toggle: () => setEnabled(v => !v) };
}
