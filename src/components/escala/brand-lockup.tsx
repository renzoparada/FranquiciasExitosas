import { cn } from "@/lib/utils";

/** Marca "Franquicias Exitosas" + (opcional) logo del cliente. */
export function BrandLockup({
  clientLogo,
  clientName,
  compact = false,
  className,
}: {
  clientLogo?: string | null;
  clientName?: string | null;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand font-display text-base font-black text-white">
          FE
        </span>
        {!compact && (
          <div className={cn("leading-tight", (clientLogo || clientName) && "hidden sm:block")}>
            <div className="font-display text-sm font-black tracking-tight">Franquicias Exitosas</div>
            <div className="text-[11px] font-medium text-muted">Método ESCALA®</div>
          </div>
        )}
      </div>
      {(clientLogo || clientName) && (
        <>
          <span className="h-7 w-px bg-line" aria-hidden />
          {clientLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clientLogo} alt={clientName ?? "Cliente"} className="h-8 max-w-28 object-contain" />
          ) : (
            <span className="max-w-40 truncate text-sm font-semibold">{clientName}</span>
          )}
        </>
      )}
    </div>
  );
}
