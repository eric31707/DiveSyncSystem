import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'DB' },
  { to: '/dives', label: 'Dive List', icon: 'DV' },
  { to: '/upload', label: 'Import FIT', icon: 'UP' },
];

export default function AppLayout() {
  return (
    <div className="flex min-h-dvh bg-[radial-gradient(circle_at_top,#123046_0%,#080b18_46%,#04060e_100%)]">
      <aside className="glass fixed bottom-0 left-0 top-0 z-40 flex w-64 flex-col border-r border-white/10 bg-slate-950/80">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-ocean-300 to-ocean-600 text-sm font-black tracking-[0.2em] text-white shadow-lg">
            DS
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">DiveSync</h1>
            <p className="text-[11px] text-slate-300">Dive telemetry and Garmin import</p>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-2 px-3">
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'border-ocean-400/30 bg-ocean-500/20 text-white shadow-md shadow-ocean-500/10'
                    : 'border-transparent text-slate-200 hover:border-white/8 hover:bg-white/6 hover:text-white'
                }`
              }
            >
              <span className="inline-flex min-w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold tracking-[0.18em] text-slate-200">
                {icon}
              </span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-6 py-4">
          <p className="text-[11px] text-slate-400">v0.1.0 · Garmin + GoPro</p>
        </div>
      </aside>

      <main className="ml-64 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
