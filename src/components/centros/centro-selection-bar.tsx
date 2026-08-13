import { Button } from "@/components/ui/button";
import type { Centro } from "@/types/volbogota";

type CentroSelectionBarProps = {
  centro: Centro;
  onContinue: () => void;
  ctaLabel?: string;
};

/**
 * Fixed bottom bar confirming the chosen center and offering the next step.
 * Anchored to the bottom of the viewport — the primary mobile action pattern.
 */
export function CentroSelectionBar({
  centro,
  onContinue,
  ctaLabel = "Continuar",
}: CentroSelectionBarProps) {
  return (
    <div className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs">Centro seleccionado</p>
          <p className="truncate font-medium">{centro.nombre}</p>
        </div>
        <Button size="lg" onClick={onContinue}>
          {ctaLabel}
        </Button>
      </div>
    </div>
  );
}
