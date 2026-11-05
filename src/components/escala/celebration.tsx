"use client";

import confetti from "canvas-confetti";
import { createContext, useCallback, useContext, useState } from "react";
import { GateDiamond } from "./gate-diamond";

type Ctx = { celebrate: (gateName: string, gateId?: string) => void };
const CelebrationContext = createContext<Ctx>({ celebrate: () => {} });
export const useCelebration = () => useContext(CelebrationContext);

const SEEN_KEY = "escala:gates-celebrated";
const RED = ["#E30613", "#FF3B47", "#B00010", "#FFFFFF", "#1D1D1F"];

function burst() {
  const end = Date.now() + 1600;
  const frame = () => {
    confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: RED, disableForReducedMotion: true });
    confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: RED, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  confetti({ particleCount: 140, spread: 100, startVelocity: 45, origin: { y: 0.45 }, colors: RED, disableForReducedMotion: true });
  frame();
}

/** Confeti rojo + mensaje "Puerta X superada". */
export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [gate, setGate] = useState<string | null>(null);

  const celebrate = useCallback((gateName: string, gateId?: string) => {
    // Cada puerta se celebra una sola vez por navegador.
    if (gateId) {
      let seen: string[] = [];
      try {
        seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
      } catch {}
      if (seen.includes(gateId)) return;
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, gateId].slice(-50)));
      } catch {}
    }
    setGate(gateName.toUpperCase());
    burst();
    window.setTimeout(() => setGate(null), 4200);
  }, []);

  return (
    <CelebrationContext.Provider value={{ celebrate }}>
      {children}
      {gate && (
        <div
          role="status"
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6"
        >
          <div className="pointer-events-auto flex flex-col items-center gap-4 rounded-3xl bg-ink px-10 py-8 text-center text-canvas shadow-2xl animate-pop">
            <GateDiamond status="superada" size="lg" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-canvas/60">¡Felicitaciones!</p>
            <p className="font-display text-2xl font-black sm:text-3xl">
              Puerta <span className="text-brand">{gate}</span> superada
            </p>
            <button onClick={() => setGate(null)} className="text-sm text-canvas/60 underline-offset-4 hover:underline">
              Continuar
            </button>
          </div>
        </div>
      )}
    </CelebrationContext.Provider>
  );
}
