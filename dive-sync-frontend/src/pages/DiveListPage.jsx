import { useState, useEffect } from 'react';
import DiveDepthChart from '../components/charts/DiveDepthChart';
import { getDiveList } from '../api/diveApi';
import { useDiveTelemetry } from '../hooks/useDiveTelemetry';
import Spinner from '../components/common/Spinner';

export default function DiveListPage() {
  const [selected, setSelected] = useState(null);
  const [diveList, setDiveList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch Dive List
  useEffect(() => {
    getDiveList().then(data => {
      setDiveList(data);
      setIsLoading(false);
    }).catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  }, []);

  // 2. Fetch selected dive telemetry
  const { data: telemetryData, isLoading: isLoadingTelemetry } = useDiveTelemetry(selected?.id, {
    enabled: !!selected
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">潛水紀錄</h1>
        <p className="mt-1 text-sm text-slate-400">點擊查看深度曲線</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><Spinner /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {diveList.map((dive) => (
            <button
              key={dive.id}
              onClick={() => setSelected(dive)}
              className={`glass-light group cursor-pointer rounded-2xl p-5 text-left transition-all duration-300 hover:scale-[1.02] ${
                selected?.id === dive.id
                  ? 'ring-2 ring-ocean-400/60 shadow-lg shadow-ocean-500/10'
                  : 'hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white truncate max-w-[150px]">{dive.site}</h3>
                <span className="rounded-lg bg-ocean-500/15 px-2.5 py-1 text-xs text-ocean-300">
                  {dive.maxDepth}m
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{dive.date}</p>
              <div className="mt-3 flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="text-emerald-400 text-[10px]">⏱</span> {dive.duration}m</span>
                {dive.avgHeartRate && <span className="flex items-center gap-1.5"><span className="text-red-400 text-[10px]">❤️</span> {dive.avgHeartRate}</span>}
                <span className="flex items-center gap-1.5"><span className="text-amber-400 text-[10px]">🌡</span> {dive.temp}°</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {selected && (
        <section className="glass animate-fade-in rounded-2xl p-6 glow-ocean">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{selected.site}</h2>
              <p className="text-xs text-slate-400">
                {selected.date} · 最大深度 {selected.maxDepth}m · {selected.duration} min
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="rounded-lg bg-slate-700/40 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700/60"
            >
              關閉
            </button>
          </div>
          {isLoadingTelemetry ? (
            <div className="flex justify-center p-12"><Spinner /></div>
          ) : telemetryData?.points ? (
            <DiveDepthChart data={telemetryData.points} height={300} showTemperature={true} timeKey="time" depthKey="depth" />
          ) : (
            <div className="text-center text-slate-400 p-8">無法載入遙測數據</div>
          )}
        </section>
      )}
    </div>
  );
}
