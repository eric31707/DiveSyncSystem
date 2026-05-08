export default function StatCard({
  icon,
  label,
  value,
  unit,
  trend,
  color = 'ocean',
  emphasis = 'default',
}) {
  const colorMap = {
    ocean: 'from-ocean-500/20 to-ocean-600/10 border-ocean-400/30',
    coral: 'from-coral-500/20 to-coral-400/10 border-coral-400/30',
    amber: 'from-amber-500/20 to-amber-400/10 border-amber-400/30',
    emerald: 'from-emerald-500/20 to-emerald-400/10 border-emerald-400/30',
    sky: 'from-sky-500/20 to-sky-600/10 border-sky-400/30',
    violet: 'from-violet-500/20 to-violet-600/10 border-violet-400/30',
  };

  const textColor = {
    ocean: 'text-white',
    coral: 'text-rose-100',
    amber: 'text-amber-50',
    emerald: 'text-emerald-50',
    sky: 'text-sky-50',
    violet: 'text-violet-50',
  };

  const accentColor = {
    ocean: 'text-ocean-300',
    coral: 'text-red-400',
    amber: 'text-amber-300',
    emerald: 'text-emerald-300',
    sky: 'text-sky-300',
    violet: 'text-violet-300',
  };

  const emphasisClass = emphasis === 'high' ? 'text-3xl sm:text-4xl lg:text-5xl' : 'text-2xl sm:text-3xl lg:text-4xl';

  return (
    <div
      className={`glass-light group relative rounded-2xl border bg-gradient-to-br p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${colorMap[color]}`}
    >
      <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
        {icon}
      </span>
      <div className="mb-4 pr-14">
        <span className={`text-xs font-semibold uppercase tracking-[0.24em] ${accentColor[color]}`}>
          {label}
        </span>
      </div>

      <div className="flex items-end gap-2">
        <span className={`${emphasisClass} font-black leading-none tracking-tight ${textColor[color]}`}>
          {value}
        </span>
        {unit && <span className="pb-1 text-sm font-medium text-slate-400">{unit}</span>}
      </div>

      {trend && (
        <p className="mt-3 text-xs font-medium text-slate-400">{trend}</p>
      )}
    </div>
  );
}
