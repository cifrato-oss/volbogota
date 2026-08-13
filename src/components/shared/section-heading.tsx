type SectionHeadingProps = {
  title: string;
  description?: string;
};

/** Consistent title + optional description for a page section. */
export function SectionHeading({ title, description }: SectionHeadingProps) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
    </div>
  );
}
