type StatProps = {
  value: string;
  label: string;
};

/** A single headline metric: large value over a muted label. */
export function Stat({ value, label }: StatProps) {
  return (
    <div className="space-y-0.5">
      <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}
