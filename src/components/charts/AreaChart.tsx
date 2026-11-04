interface AreaChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}

export function AreaChart({ data, height = 200, color = '#338cff', formatValue }: AreaChartProps) {
  if (data.length === 0) {
    return <div style={{ height }} className="flex items-center justify-center text-sm text-ink-400">No data yet</div>;
  }

  const width = 600;
  const padX = 8;
  const padTop = 16;
  const padBottom = 28;
  const chartH = height - padTop - padBottom;
  const chartW = width - padX * 2;

  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padX + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
    const y = padTop + chartH - ((d.value - min) / range) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${padTop + chartH} L ${points[0].x.toFixed(1)} ${padTop + chartH} Z`;

  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = padTop + t * chartH;
        return <line key={t} x1={padX} y1={y} x2={width - padX} y2={y} stroke="currentColor" strokeWidth="0.5" className="text-ink-100 dark:text-ink-800" />;
      })}
      <path d={areaPath} fill="url(#areaGrad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill={color} stroke="white" strokeWidth="1.5" className="dark:stroke-ink-900" />
          {i % labelStep === 0 && (
            <text x={p.x} y={height - 8} textAnchor="middle" fontSize="10" fill="currentColor" className="text-ink-400">
              {p.label}
            </text>
          )}
        </g>
      ))}
      {/* last value label */}
      {formatValue && points.length > 0 && (
        <text x={Math.min(points[points.length - 1].x, width - 60)} y={Math.max(points[points.length - 1].y - 8, 12)} textAnchor="end" fontSize="11" fontWeight="600" fill={color}>
          {formatValue(points[points.length - 1].value)}
        </text>
      )}
    </svg>
  );
}
