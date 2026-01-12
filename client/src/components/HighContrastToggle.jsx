import React, { useEffect, useState } from 'react';

export default function HighContrastToggle() {
  const [on, setOn] = useState(false);

  // start: odczyt z localStorage + prefers-contrast
  useEffect(() => {
    const stored = localStorage.getItem('hc');
    if (stored === 'on') {
      setOn(true);
      document.documentElement.classList.add('hc');
    } else if (stored === null) {
      // pierwszy raz — podeprzyj się prefers-contrast (jeśli ktoś woli wysoki)
      const mq = window.matchMedia('(prefers-contrast: more)');
      if (mq.matches) {
        setOn(true);
        document.documentElement.classList.add('hc');
        localStorage.setItem('hc', 'on');
      }
    }
  }, []);

  useEffect(() => {
    if (on) {
      document.documentElement.classList.add('hc');
      localStorage.setItem('hc', 'on');
    } else {
      document.documentElement.classList.remove('hc');
      localStorage.setItem('hc', 'off');
    }
  }, [on]);

  return (
    <button
      type="button"
      onClick={() => setOn(v => !v)}
      className="btn-contrast-toggle"
      aria-pressed={on}
      aria-label={on ? 'Wyłącz wysoki kontrast' : 'Włącz wysoki kontrast'}
      title={on ? 'Wyłącz wysoki kontrast' : 'Włącz wysoki kontrast'}
    >
      {on ? 'Kontrast: ON' : 'Kontrast: OFF'}
    </button>
  );
}
