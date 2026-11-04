interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  formatValue?: (v: number) => string;
}

export function BarChart({ data, height = 200, formatValue }: BarChartProps) {
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
  const max = Math.max(...values.map(Math.abs), 1);

  const barGap = data.length > 12 ? 2 : 6;
  const barW = Math.max(2, (chartW - barGap * (data.length - 1)) / data.length);
  const zeroY = padTop + chartH / 2;
  const hasNeg = values.some((v) => v < 0);
  const hasPos = values.some((v) => v > 0);
  const baseline = hasNeg && hasPos ? zeroY : hasNeg ? padTop + chartH : padTop;

  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {/* zero line */}
      <line x1={padX} y1={baseline} x2={width - padX} y2={baseline} stroke="currentColor" strokeWidth="0.5" className="text-ink-200 dark:text-ink-700" />
      {data.map((d, i) => {
        const x = padX + i * (barW + barGap);
        const barH = (Math.abs(d.value) / max) * (chartH / (hasNeg && hasPos ? 2 : 1));
        const y = d.value >= 0 ? baseline - barH : baseline;
        const color = d.value >= 0 ? '#22c55e' : '#ef4444';
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, 1)} rx={Math.min(barW / 2, 3)} fill={color} opacity={0.85} />
            {i % labelStep === 0 && (
              <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="currentColor" className="text-ink-400">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
      {formatValue && data.length > 0 && (
        <text x={width - padX} y={12} textAnchor="end" fontSize="11" fontWeight="600" fill="currentColor" className="text-ink-500 dark:text-ink-400">
          {formatValue(data[data.length - 1].value)}
        </text>
      )}
    </svg>
  );
}

interface StackedBarChartProps {
  data: { label: string; interest: number; winnings: number }[];
  height?: number;
}

export function StackedBarChart({ data, height = 160 }: StackedBarChartProps) {
  if (data.length === 0) {
    return <div style={{ height }} className="flex items-center justify-center text-sm text-ink-400">No data yet</div>;
  }

  const width = 600;
  const padX = 8;
  const padTop = 12;
  const padBottom = 24;
  const chartH = height - padTop - padBottom;
  const chartW = width - padX * 2;

  const totals = data.map((d) => d.interest + d.winnings);
  const max = Math.max(...totals, 1);

  const barGap = data.length > 12 ? 2 : 4;
  const barW = Math.max(2, (chartW - barGap * (data.length - 1)) / data.length);
  const baseline = padTop + chartH;
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <line x1={padX} y1={baseline} x2={width - padX} y2={baseline} stroke="currentColor" strokeWidth="0.5" className="text-ink-200 dark:text-ink-700" />
      {data.map((d, i) => {
        const x = padX + i * (barW + barGap);
        const interestH = (d.interest / max) * chartH;
        const winningsH = (d.winnings / max) * chartH;
        const interestY = baseline - interestH;
        const winningsY = interestY - winningsH;
        return (
          <g key={i}>
            {d.interest > 0 && (
              <rect x={x} y={interestY} width={barW} height={Math.max(interestH, 1)} rx={Math.min(barW / 2, 2)} fill="#338cff" opacity={0.85} />
            )}
            {d.winnings > 0 && (
              <rect x={x} y={winningsY} width={barW} height={Math.max(winningsH, 1)} rx={Math.min(barW / 2, 2)} fill="#f59e0b" opacity={0.85} />
            )}
            {i % labelStep === 0 && (
              <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="currentColor" className="text-ink-400">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
