const YEAR_PALETTE = [
  '#338cff', // blue
  '#f97316', // orange
  '#22c55e', // green
  '#a855f7', // purple
  '#ef4444', // red
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#ec4899', // pink
];

export interface MultiLineSeriesItem {
  month: number; // 1–12
  value: number | null;
}

export interface MultiLineSeries {
  year: number;
  data: MultiLineSeriesItem[]; // one entry per month present (gaps are null)
  color: string;
}

interface MultiLineChartProps {
  series: MultiLineSeries[];
  height?: number;
  formatValue?: (v: number) => string;
}

export function yearColor(index: number): string {
  return YEAR_PALETTE[index % YEAR_PALETTE.length];
}

export function MultiLineChart({ series, height = 220, formatValue }: MultiLineChartProps) {
  if (series.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-ink-400">
        No data yet
      </div>
    );
  }

  const svgW = 600;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 16;
  const padBottom = 32; // room for month labels + legend
  const chartH = height - padTop - padBottom;
  const chartW = svgW - padLeft - padRight;

  // Fixed 12-month X axis (Jan=1 … Dec=12)
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Collect all non-null values to compute Y range
  const allValues: number[] = [];
  for (const s of series) {
    for (const d of s.data) {
      if (d.value !== null) allValues.push(d.value);
    }
  }
  const minVal = Math.min(0, ...allValues);
  const maxVal = Math.max(0, ...allValues);
  const range = maxVal - minVal || 1;

  // X position for a given month (1–12), evenly distributed
  const xForMonth = (m: number) =>
    padLeft + ((m - 1) / 11) * chartW;

  // Y position for a given value
  const yForValue = (v: number) =>
    padTop + chartH - ((v - minVal) / range) * chartH;

  // Build SVG path segments for a series, splitting on null gaps
  const buildSegments = (s: MultiLineSeries): string[] => {
    // Map month → value
    const byMonth: Record<number, number | null> = {};
    for (const d of s.data) byMonth[d.month] = d.value;

    const segments: string[] = [];
    let current = '';
    for (const m of months) {
      const v = byMonth[m] ?? null;
      if (v !== null) {
        const x = xForMonth(m).toFixed(1);
        const y = yForValue(v).toFixed(1);
        if (current === '') {
          current = `M ${x} ${y}`;
        } else {
          current += ` L ${x} ${y}`;
        }
      } else {
        // Gap — flush current segment
        if (current) {
          segments.push(current);
          current = '';
        }
      }
    }
    if (current) segments.push(current);
    return segments;
  };

  // Collect dot positions per series
  const buildDots = (s: MultiLineSeries) => {
    const byMonth: Record<number, number | null> = {};
    for (const d of s.data) byMonth[d.month] = d.value;
    return months
      .map((m) => ({ m, v: byMonth[m] ?? null }))
      .filter((p): p is { m: number; v: number } => p.v !== null)
      .map(({ m, v }) => ({ x: xForMonth(m), y: yForValue(v), v }));
  };

  // Grid lines at 0%, 25%, 50%, 75%, 100%
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => padTop + t * chartH);

  return (
    <div className="w-full space-y-3">
      <svg
        viewBox={`0 0 ${svgW} ${height - 24}`}
        className="w-full"
        style={{ height: height - 24 }}
        preserveAspectRatio="none"
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.year} id={`grad-${s.year}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
            </linearGradient>
          ))}
        </defs>

        {/* Horizontal grid lines */}
        {gridLines.map((y, i) => (
          <line
            key={i}
            x1={padLeft}
            y1={y}
            x2={svgW - padRight}
            y2={y}
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-ink-100 dark:text-ink-800"
          />
        ))}

        {/* Month axis labels */}
        {months.map((m, i) => (
          <text
            key={m}
            x={xForMonth(m)}
            y={height - padBottom - 4}
            textAnchor="middle"
            fontSize="10"
            fill="currentColor"
            className="text-ink-400"
          >
            {monthLabels[i]}
          </text>
        ))}

        {/* Lines per series (drawn back-to-front so later years appear on top) */}
        {[...series].reverse().map((s) => {
          const segments = buildSegments(s);
          const dots = buildDots(s);

          // Build soft area fill for single-segment series
          const singleSeg = segments.length === 1 ? segments[0] : null;
          let areaPath = '';
          if (singleSeg) {
            const parts = singleSeg.split(' L ');
            const first = parts[0].replace('M ', '').split(' ');
            const last = parts[parts.length - 1].split(' ');
            areaPath = `${singleSeg} L ${last[0]} ${(padTop + chartH).toFixed(1)} L ${first[0]} ${(padTop + chartH).toFixed(1)} Z`;
          }

          return (
            <g key={s.year}>
              {areaPath && (
                <path d={areaPath} fill={`url(#grad-${s.year})`} />
              )}
              {segments.map((seg, i) => (
                <path
                  key={i}
                  d={seg}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {dots.map((dot, i) => (
                <g key={i}>
                  <circle
                    cx={dot.x}
                    cy={dot.y}
                    r="4"
                    fill={s.color}
                    stroke="white"
                    strokeWidth="1.5"
                    className="dark:stroke-ink-900"
                  />
                  {/* Tooltip-style value label on last dot only */}
                  {i === dots.length - 1 && formatValue && (
                    <text
                      x={Math.min(dot.x, svgW - 55)}
                      y={Math.max(dot.y - 10, 14)}
                      textAnchor="end"
                      fontSize="10"
                      fontWeight="600"
                      fill={s.color}
                    >
                      {formatValue(dot.v)}
                    </text>
                  )}
                </g>
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1">
        {series.map((s) => (
          <div key={s.year} className="flex items-center gap-1.5">
            <span
              className="inline-block w-7 h-0.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-xs font-medium text-ink-500 dark:text-ink-400">{s.year}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
