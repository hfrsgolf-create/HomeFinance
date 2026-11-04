interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({ data, size = 180, thickness = 28, centerLabel, centerValue }: DonutChartProps) {
  const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  let offset = 0;

  const segments = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const fraction = total > 0 ? d.value / total : 0;
      // Minimum visible arc length so very small slices still render (~2 degrees)
      const minLen = total > 0 ? circumference * 0.0056 : 0;
      const len = Math.max(fraction * circumference, minLen);
      const seg = {
        color: d.color,
        dasharray: `${len} ${circumference - len}`,
        dashoffset: -offset,
        label: d.label,
        value: d.value,
      };
      offset += len;
      return seg;
    });

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={thickness} className="stroke-ink-100 dark:stroke-ink-800" />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={s.dasharray}
            strokeDashoffset={s.dashoffset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerValue && <span className="text-lg font-bold text-ink-900 dark:text-ink-50">{centerValue}</span>}
          {centerLabel && <span className="text-xs text-ink-400 mt-0.5">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

export function DonutLegend({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-ink-600 dark:text-ink-300 truncate">{d.label}</span>
          </div>
          <span className="font-medium text-ink-800 dark:text-ink-100 shrink-0">
            {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
