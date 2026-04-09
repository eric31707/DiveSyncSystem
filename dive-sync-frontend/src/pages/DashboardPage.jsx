import { useEffect, useMemo, useRef, useState } from 'react';
import DiveDepthChart from '../components/charts/DiveDepthChart';
import StatCard from '../components/common/StatCard';
import DiveMap from '../components/Map/DiveMap';
import { garminLogin, getDiveList, syncGarmin } from '../api/diveApi';
import { useDiveTelemetry } from '../hooks/useDiveTelemetry';
import Spinner from '../components/common/Spinner';

const DASHBOARD_SELECTED_DIVE_KEY = 'dashboard:selectedDiveId';
const DASHBOARD_LAST_SYNC_KEY = 'dashboard:lastSyncAt';
const PAGE_SIZE = 12;

function getDiveMeta(dive) {
  if (!dive) {
    return { title: 'Unknown Site', subtitle: '', filename: '' };
  }

  const rawSite = String(dive.site ?? '').trim();
  const looksLikeFilename = rawSite.toLowerCase().endsWith('.fit');

  return {
    title: looksLikeFilename ? `Dive #${dive.id}` : (rawSite || `Dive #${dive.id}`),
    subtitle: looksLikeFilename ? 'Unknown Site' : rawSite,
    filename: looksLikeFilename ? rawSite : '',
  };
}

function formatLastSynced(timestamp) {
  if (!timestamp) {
    return 'Never synced';
  }

  const diffMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 60) {
    return `Last synced ${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `Last synced ${diffHours} hr ago`;
  }

  return `Last synced ${new Date(timestamp).toLocaleString()}`;
}

export default function DashboardPage() {
  const [diveList, setDiveList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDiveId, setSelectedDiveId] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => {
    const stored = Number(window.localStorage.getItem(DASHBOARD_LAST_SYNC_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  });

  const mapSectionRef = useRef(null);

  useEffect(() => {
    getDiveList()
      .then((data) => {
        setDiveList(data);
        const savedId = Number(window.localStorage.getItem(DASHBOARD_SELECTED_DIVE_KEY));
        const hasSavedDive = data.some((dive) => dive.id === savedId);
        setSelectedDiveId(hasSavedDive ? savedId : data?.[0]?.id ?? null);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selectedDiveId == null) {
      window.localStorage.removeItem(DASHBOARD_SELECTED_DIVE_KEY);
      return;
    }

    window.localStorage.setItem(DASHBOARD_SELECTED_DIVE_KEY, String(selectedDiveId));
  }, [selectedDiveId]);

  const filteredDives = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return diveList.filter((dive) => {
      const meta = getDiveMeta(dive);
      const matchesSearch = !normalizedSearch
        || meta.title.toLowerCase().includes(normalizedSearch)
        || meta.subtitle.toLowerCase().includes(normalizedSearch)
        || meta.filename.toLowerCase().includes(normalizedSearch)
        || String(dive.id).includes(normalizedSearch);
      const normalizedDiveDate = String(dive.date ?? '').trim();
      const matchesDate = !dateFilter || normalizedDiveDate.startsWith(dateFilter);
      return matchesSearch && matchesDate;
    });
  }, [dateFilter, diveList, searchText]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, dateFilter]);

  const applySearch = () => {
    setSearchText(searchInput.trim());
    setDateFilter(dateInput.trim().replaceAll('/', '-'));
  };

  useEffect(() => {
    if (filteredDives.length === 0) {
      return;
    }

    const stillVisible = filteredDives.some((dive) => dive.id === selectedDiveId);
    if (!stillVisible) {
      setSelectedDiveId(filteredDives[0].id);
    }
  }, [filteredDives, selectedDiveId]);

  const totalPages = Math.max(1, Math.ceil(filteredDives.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  const pagedDives = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return filteredDives.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredDives, safePage]);

  const selectedDive = useMemo(
    () => filteredDives.find((dive) => dive.id === selectedDiveId)
      ?? diveList.find((dive) => dive.id === selectedDiveId)
      ?? filteredDives[0]
      ?? diveList[0]
      ?? null,
    [diveList, filteredDives, selectedDiveId],
  );

  const selectedDiveMeta = getDiveMeta(selectedDive);
  const selectedDiveIndex = filteredDives.findIndex((dive) => dive.id === selectedDive?.id);
  const previousDive = selectedDiveIndex > 0 ? filteredDives[selectedDiveIndex - 1] : null;
  const nextDive = selectedDiveIndex >= 0 && selectedDiveIndex < filteredDives.length - 1
    ? filteredDives[selectedDiveIndex + 1]
    : null;
  const quickSwitchDives = filteredDives.slice(0, 8);

  const handleGarminLogin = async () => {
    setLoginLoading(true);
    try {
      await garminLogin(loginForm.username, loginForm.password);
      setShowLoginModal(false);
      window.alert('Garmin login succeeded. You can sync now.');
    } catch (e) {
      const errData = e.response?.data;
      const errMsg = typeof errData === 'object'
        ? (errData.title || errData.message || JSON.stringify(errData))
        : errData;
      window.alert(`Login failed: ${errMsg || e.message}`);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGarminSync = async () => {
    setSyncLoading(true);
    try {
      const data = await syncGarmin();
      if (data.success) {
        const now = Date.now();
        window.localStorage.setItem(DASHBOARD_LAST_SYNC_KEY, String(now));
        setLastSyncedAt(now);
        window.alert('Garmin sync completed. Reloading dashboard.');
        window.location.reload();
      }
    } catch (e) {
      const errData = e.response?.data;
      const errMsg = typeof errData === 'object'
        ? (errData.title || errData.message || JSON.stringify(errData))
        : errData;
      if (String(errMsg).toLowerCase().includes('login')) {
        setShowLoginModal(true);
      } else {
        window.alert(`Sync failed: ${errMsg || e.message}`);
      }
    } finally {
      setSyncLoading(false);
    }
  };

  const handleMapFullscreen = async () => {
    if (!mapSectionRef.current) {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await mapSectionRef.current.requestFullscreen();
  };

  const stats = selectedDive
    ? [
        { icon: 'DEPTH', label: 'Max Depth', value: selectedDive.maxDepth, unit: 'm', color: 'ocean', trend: 'Deepest point reached', emphasis: 'high' },
        { icon: 'TIME', label: 'Duration', value: selectedDive.duration, unit: 'min', color: 'emerald', trend: 'Bottom time and ascent included', emphasis: 'high' },
        { icon: 'TEMP', label: 'Temperature', value: selectedDive.temp, unit: 'C', color: 'amber', trend: 'Average water temperature' },
        { icon: 'HEART', label: 'Avg Heart Rate', value: selectedDive.avgHeartRate || '--', unit: 'bpm', color: 'coral', trend: selectedDive.maxHeartRate ? `Peak ${selectedDive.maxHeartRate} bpm` : 'No heart rate samples' },
      ]
    : [];

  const { data: telemetryData, isLoading: isLoadingTelemetry } = useDiveTelemetry(selectedDive?.id, {
    enabled: !!selectedDive,
  });

  if (isLoading) {
    return <div className="flex justify-center p-12"><Spinner size="lg" /></div>;
  }

  return (
    <>
      <div className="animate-fade-in space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-300">
              {selectedDive ? `Viewing ${selectedDive.date} at ${selectedDiveMeta.title}` : 'No dive records available yet.'}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">{formatLastSynced(lastSyncedAt)}</p>
            <p className="mt-2 text-sm font-medium text-ocean-200">
              總下水支數：{diveList.length} 支
              {filteredDives.length !== diveList.length ? ` · 目前顯示 ${filteredDives.length} 支` : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowLoginModal(true)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition-all hover:bg-white/10"
            >
              Garmin Login
            </button>
            <button
              onClick={handleGarminSync}
              disabled={syncLoading}
              className="flex items-center gap-2 rounded-xl border border-ocean-300/30 bg-ocean-500 px-4 py-2 font-semibold text-white transition-all hover:scale-[1.02] hover:bg-ocean-400 disabled:opacity-50 disabled:hover:scale-100"
            >
              {syncLoading && <Spinner size="sm" />}
              {syncLoading ? 'Syncing...' : 'Sync Garmin'}
            </button>
          </div>
        </div>

        {selectedDive && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        )}

        {selectedDive && (
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="glass rounded-2xl p-6 glow-ocean lg:col-span-2">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Depth Profile</h2>
                  <p className="text-xs text-slate-300">{selectedDiveMeta.title} · {selectedDive.date}</p>
                  {selectedDiveMeta.filename && <p className="mt-1 text-[11px] text-slate-500">{selectedDiveMeta.filename}</p>}
                </div>
                <div className="text-right text-xs text-slate-400">
                  <div>Dive #{selectedDive.id}</div>
                  <div>{selectedDiveIndex >= 0 ? `${selectedDiveIndex + 1} / ${filteredDives.length}` : null}</div>
                </div>
              </div>

              {isLoadingTelemetry ? (
                <div className="flex justify-center py-12"><Spinner /></div>
              ) : telemetryData?.points ? (
                <DiveDepthChart
                  data={telemetryData.points}
                  height={320}
                  showTemperature={false}
                  timeKey="time"
                  depthKey="depth"
                  syncId="dashboard-sync"
                />
              ) : (
                <div className="py-12 text-center text-slate-400">No telemetry available for this dive.</div>
              )}
            </section>

            <section ref={mapSectionRef} className="glass flex flex-col rounded-2xl p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Entry / Exit Map</h2>
                  <p className="text-xs text-slate-300">Selected dive location markers</p>
                </div>
                <button
                  onClick={handleMapFullscreen}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10"
                >
                  Fullscreen
                </button>
              </div>
              <div className="relative min-h-[320px] grow overflow-hidden rounded-xl bg-slate-800/10">
                <DiveMap
                  entryLat={selectedDive.entryLat}
                  entryLng={selectedDive.entryLng}
                  exitLat={selectedDive.exitLat}
                  exitLng={selectedDive.exitLng}
                  site={selectedDiveMeta.title}
                  telemetryData={telemetryData}
                />
              </div>
            </section>
          </div>
        )}

        <section className="glass rounded-2xl p-6">
          <div className="mb-5 flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">All Dives</h2>
                <p className="text-xs text-slate-300">Search, filter, and switch the current dashboard dive here.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Page {safePage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safePage <= 1}
                  className="rounded-lg border border-slate-700/60 bg-slate-800/50 px-3 py-1.5 text-sm text-white transition-colors hover:border-slate-500 hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prev Page
                </button>
                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safePage >= totalPages}
                  className="rounded-lg border border-slate-700/60 bg-slate-800/50 px-3 py-1.5 text-sm text-white transition-colors hover:border-slate-500 hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next Page
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_220px_auto]">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">Search Dive</label>
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      applySearch();
                    }
                  }}
                  placeholder="Search by site, filename, or dive ID"
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-ocean-400/70"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">Filter Date</label>
                <input
                  type="text"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      applySearch();
                    }
                  }}
                  placeholder="2022 or 2022-04 or 2022-04-07"
                  className="w-full rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-ocean-400/70"
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={applySearch}
                  className="rounded-xl border border-ocean-300/25 bg-ocean-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ocean-400"
                >
                  Search
                </button>
                <button
                  onClick={() => previousDive && setSelectedDiveId(previousDive.id)}
                  disabled={!previousDive}
                  className="rounded-xl border border-slate-700/60 bg-slate-800/50 px-4 py-3 text-sm font-medium text-white transition-colors hover:border-slate-500 hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => nextDive && setSelectedDiveId(nextDive.id)}
                  disabled={!nextDive}
                  className="rounded-xl border border-slate-700/60 bg-slate-800/50 px-4 py-3 text-sm font-medium text-white transition-colors hover:border-slate-500 hover:bg-slate-700/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
                <button
                  onClick={() => {
                    setSearchInput('');
                    setSearchText('');
                    setDateInput('');
                    setDateFilter('');
                  }}
                  className="rounded-xl border border-slate-700/60 bg-slate-800/50 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:bg-slate-700/60 hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-400">
              {filteredDives.length} dives in current view.
              {selectedDive && ` Selected dive #${selectedDive.id}.`}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700/40 text-xs uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4 font-medium">Site</th>
                  <th className="pb-3 pr-4 font-medium">Date</th>
                  <th className="pb-3 pr-4 text-right font-medium">File</th>
                  <th className="pb-3 pr-4 text-right font-medium">Depth</th>
                  <th className="pb-3 pr-4 text-right font-medium">Duration</th>
                  <th className="pb-3 pr-4 text-right font-medium">Heart Rate</th>
                  <th className="pb-3 text-right font-medium">Temp</th>
                </tr>
              </thead>
              <tbody>
                {pagedDives.map((dive, index) => {
                  const isActive = selectedDive?.id === dive.id;
                  const meta = getDiveMeta(dive);

                  return (
                    <tr
                      key={dive.id}
                      onClick={() => setSelectedDiveId(dive.id)}
                      className={`cursor-pointer border-b border-slate-700/20 transition-colors ${
                        isActive
                          ? 'bg-ocean-500/12'
                          : index % 2 === 0
                            ? 'bg-white/[0.02] hover:bg-white/[0.05]'
                            : 'bg-transparent hover:bg-white/[0.05]'
                      }`}
                    >
                      <td className="py-3 pr-4 text-white">
                        <div className="font-medium">{meta.title}</div>
                        <div className="text-xs text-slate-500">{meta.subtitle || 'Primary dive label'}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-300">{dive.date}</td>
                      <td className="py-3 pr-4 text-right text-xs text-slate-500">{meta.filename || '-'}</td>
                      <td className="py-3 pr-4 text-right font-semibold text-ocean-200">{dive.maxDepth} m</td>
                      <td className="py-3 pr-4 text-right font-semibold text-slate-200">{dive.duration} min</td>
                      <td className="py-3 pr-4 text-right font-semibold text-coral-200">{dive.avgHeartRate || '--'} bpm</td>
                      <td className="py-3 text-right font-semibold text-amber-300">{dive.temp} C</td>
                    </tr>
                  );
                })}
                {pagedDives.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-4 text-center text-slate-400">No dives match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {quickSwitchDives.length > 0 && (
          <section className="glass rounded-2xl p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Quick Switch</h2>
                <p className="text-xs text-slate-400">Jump between the current filtered dives.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickSwitchDives.map((dive) => {
                  const meta = getDiveMeta(dive);
                  return (
                    <button
                      key={dive.id}
                      onClick={() => setSelectedDiveId(dive.id)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition-all ${
                        selectedDive?.id === dive.id
                          ? 'border-ocean-400 bg-ocean-500/20 text-ocean-100'
                          : 'border-slate-700/60 bg-slate-800/40 text-slate-200 hover:border-slate-500 hover:text-white'
                      }`}
                    >
                      <div className="font-medium">{meta.title}</div>
                      <div className="text-xs opacity-80">{dive.date}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>

      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass w-full max-w-sm space-y-4 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white">Garmin Login</h2>
            <p className="text-xs text-slate-400">Sign in before starting a Garmin sync.</p>
            <input
              type="email"
              placeholder="Garmin email"
              value={loginForm.username}
              onChange={(e) => setLoginForm((form) => ({ ...form, username: e.target.value }))}
              className="w-full rounded-xl bg-slate-700/50 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-teal-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((form) => ({ ...form, password: e.target.value }))}
              className="w-full rounded-xl bg-slate-700/50 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-teal-500"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLoginModal(false)}
                className="rounded-xl px-4 py-2 text-sm text-slate-400 transition-colors hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleGarminLogin}
                disabled={loginLoading}
                className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-500 disabled:opacity-50"
              >
                {loginLoading && <Spinner size="sm" />}
                {loginLoading ? 'Logging in...' : 'Login'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
