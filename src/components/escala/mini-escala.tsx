import { EscalaTile } from "./escala-tile";
import { GateDiamond } from "./gate-diamond";
import { GATES, gateState, letterStates, type OverviewBrand } from "@/lib/escala";

/** ESCALA en miniatura para tarjetas y listas. */
export function MiniEscala({ brands }: { brands: OverviewBrand[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1">
        {letterStates(brands).map(({ step, state }) => (
          <EscalaTile key={step.code} letter={step.letter} state={state} size="sm" title={step.name} />
        ))}
      </div>
      <div className="flex gap-2 pl-1">
        {GATES.map((g) => (
          <GateDiamond key={g.code} status={gateState(brands, g.code)} size="sm" />
        ))}
      </div>
    </div>
  );
}
