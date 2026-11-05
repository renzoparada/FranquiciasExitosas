"use client";

import { useEffect } from "react";
import { useCelebration } from "./celebration";

/** Celebra una puerta superada recientemente (una vez por navegador). */
export function CelebrateGate({ gateId, gateName, passedAt }: { gateId: string; gateName: string; passedAt: string | null }) {
  const { celebrate } = useCelebration();
  useEffect(() => {
    if (passedAt && Date.now() - Date.parse(passedAt) < 14 * 864e5) celebrate(gateName, gateId);
  }, [gateId, gateName, passedAt, celebrate]);
  return null;
}
