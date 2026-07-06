const DEFAULT_LABELS = { title: 'Importing…', subtitle: 'Processing rows' };

export function ImportProgressStep({ percent, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  return (
    <div className="flex flex-col gap-2 py-6">
      <div className="flex justify-between text-sm font-medium">
        <span data-testid="ImportProgressStep__title">{text.title}</span>
        <span className="tabular-nums" data-testid="ImportProgressStep__percent">{percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          data-testid="ImportProgressStep__bar"
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{text.subtitle}</span>
    </div>
  );
}
