import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';

const DEMO_DATA = Array.from({ length: 60 }, (_, i) => {
  const t = i;
  const depth = t < 5 ? t * 6 : t < 45 ? 30 + Math.sin((t - 5) * 0.15) * 8 : Math.max(0, 30 - (t - 45) * 2);
  return {
    time: t,
    depth: Math.round(depth * 10) / 10,
    temperature: 26 - depth * 0.15,
    heartRate: 90 + Math.random() * 20,
  };
});

function buildChartEvents(data, timeKey, depthKey, safetyStopDepth) {
  const events = [];

  for (let i = 1; i < data.length; i += 1) {
    const previous = data[i - 1];
    const current = data[i];
    const previousDepth = previous?.[depthKey] ?? 0;
    const currentDepth = current?.[depthKey] ?? 0;
    const timeDelta = (current?.[timeKey] ?? 0) - (previous?.[timeKey] ?? 0);

    if (timeDelta <= 0) {
      continue;
    }

    const ascentRate = (previousDepth - currentDepth) / timeDelta;

    if (
      currentDepth <= safetyStopDepth + 0.7
      && currentDepth >= Math.max(0, safetyStopDepth - 1.2)
      && !events.some((event) => event.type === 'safety-stop')
    ) {
      events.push({
        type: 'safety-stop',
        x: current[timeKey],
        y: currentDepth,
        label: 'Safety Stop',
        color: '#facc15',
      });
    }

    if (ascentRate > 1.2 && !events.some((event) => event.type === 'ascent-alert')) {
      events.push({
        type: 'ascent-alert',
        x: current[timeKey],
        y: currentDepth,
        label: 'Fast Ascent',
        color: '#fb7185',
      });
    }
  }

  return events;
}

export default function DiveDepthChart({
  data = DEMO_DATA,
  timeKey = 'time',
  depthKey = 'depth',
  height = 360,
  safetyStopDepth = 5,
  showTemperature = false,
  syncId = null,
}) {
  const maxDepth = Math.max(...data.map((d) => d[depthKey] || 0));
  const chartEvents = buildChartEvents(data, timeKey, depthKey, safetyStopDepth);

  return (
    <div className="dive-depth-chart">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          syncId={syncId}
          margin={{ top: 12, right: 28, left: 8, bottom: 12 }}
          style={{ outline: 'none' }}
        >
          <defs>
            <linearGradient id="depthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.7} />
              <stop offset="45%" stopColor="#0891b2" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#082f49" stopOpacity={0.03} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />

          <XAxis
            dataKey={timeKey}
            tick={{ fill: '#cbd5e1', fontSize: 12 }}
            tickFormatter={(v) => `${v} min`}
            axisLine={{ stroke: '#334155' }}
            tickLine={{ stroke: '#334155' }}
          />

          <YAxis
            yAxisId={0}
            dataKey={depthKey}
            reversed
            domain={[0, Math.ceil(maxDepth + 5)]}
            tick={{ fill: '#cbd5e1', fontSize: 12 }}
            tickFormatter={(v) => `${v}m`}
            axisLine={{ stroke: '#334155' }}
            tickLine={{ stroke: '#334155' }}
            label={{
              value: 'Depth (m)',
              angle: -90,
              position: 'insideLeft',
              fill: '#cbd5e1',
              fontSize: 13,
              fontWeight: 600,
            }}
          />

          <YAxis
            yAxisId={1}
            orientation="right"
            domain={['auto', 'auto']}
            hide={!showTemperature}
            tick={{ fill: '#cbd5e1', fontSize: 12 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={{ stroke: '#334155' }}
          />

          <Tooltip
            contentStyle={{
              background: 'rgba(15, 23, 42, 0.96)',
              border: '1px solid rgba(100, 116, 139, 0.35)',
              borderRadius: 14,
              color: '#e2e8f0',
              backdropFilter: 'blur(8px)',
              outline: 'none',
            }}
            formatter={(value, name) => {
              if (name === depthKey) return [`${value} m`, 'Depth'];
              if (name === 'temperature') return [`${Number(value).toFixed(1)} C`, 'Temperature'];
              if (name === 'heartRate') return [`${value} bpm`, 'Heart Rate'];
              return [value, name];
            }}
            labelFormatter={(v) => `Time: ${v} min`}
          />

          <ReferenceLine
            yAxisId={0}
            y={safetyStopDepth}
            stroke="#facc15"
            strokeDasharray="6 3"
            label={{
              value: `Safety Stop ${safetyStopDepth}m`,
              fill: '#fde047',
              fontSize: 11,
              position: 'insideBottomRight',
            }}
          />

          <Area
            yAxisId={0}
            type="monotone"
            dataKey={depthKey}
            stroke="#22d3ee"
            strokeWidth={2.5}
            fill="url(#depthGradient)"
            animationDuration={1200}
          />

          <Line
            yAxisId={1}
            type="monotone"
            dataKey="heartRate"
            stroke="#fb7185"
            strokeWidth={1.7}
            dot={false}
            animationDuration={1200}
          />

          {showTemperature && (
            <Line
              yAxisId={1}
              type="monotone"
              dataKey="temperature"
              stroke="#fb923c"
              strokeWidth={1.5}
              dot={false}
              animationDuration={1200}
            />
          )}

          {chartEvents.map((event) => (
            <ReferenceDot
              key={`${event.type}-${event.x}`}
              yAxisId={0}
              x={event.x}
              y={event.y}
              r={5}
              fill={event.color}
              stroke="#fff"
              strokeWidth={1.5}
              label={{
                value: event.label,
                position: 'top',
                fill: event.color,
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
