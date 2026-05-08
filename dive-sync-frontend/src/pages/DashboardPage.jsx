import { useEffect, useMemo, useRef, useState } from 'react';
import DiveDepthChart from '../components/charts/DiveDepthChart';
import StatCard from '../components/common/StatCard';
import DiveMap from '../components/Map/DiveMap';
import { getDiveList, updateDive } from '../api/diveApi';
import { useDiveTelemetry } from '../hooks/useDiveTelemetry';
import Spinner from '../components/common/Spinner';

const DASHBOARD_SELECTED_DIVE_KEY = 'dashboard:selectedDiveId';
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

export default function DashboardPage() {
  const [diveList, setDiveList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDiveId, setSelectedDiveId] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchText, setSearchText] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ site: '', notes: '', mood: '', tankVolume: '', startPressure: '', endPressure: '', visibility: '' });
  const mapSectionRef = useRef(null);

  useEffect(() => {
    if (!isEditing) return;
    const main = document.querySelector('main');
    if (!main) return;
    const prevent = (e) => e.preventDefault();
    main.addEventListener('wheel', prevent, { passive: false });
    main.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      main.removeEventListener('wheel', prevent);
      main.removeEventListener('touchmove', prevent);
    };
  }, [isEditing]);

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

  const handleEditClick = () => {
    if (!selectedDive) return;
    setEditForm({
      site: selectedDive.site || '',
      notes: selectedDive.notes || '',
      mood: selectedDive.mood || '',
      tankVolume: selectedDive.tankVolume ?? '',
      startPressure: selectedDive.startPressure ?? '',
      endPressure: selectedDive.endPressure ?? '',
      visibility: selectedDive.visibility ?? '',
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      const updatedDive = await updateDive(selectedDive.id, editForm);
      // 更新本地資料
      setDiveList((prev) =>
        prev.map((d) => (d.id === updatedDive.id ? updatedDive : d))
      );
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update dive', error);
      alert('更新失敗，請檢查網路連線。');
    }
  };

  const sac = (() => {
    const d = selectedDive;
    if (!d?.avgDepth || !d?.tankVolume || !d?.startPressure || !d?.endPressure || !d?.duration) return null;
    const pressureChange = d.startPressure - d.endPressure;
    const absPressure = d.avgDepth / 10 + 1;
    return Math.round((pressureChange * d.tankVolume) / (d.duration * absPressure) * 10) / 10;
  })();

  const stats = selectedDive
    ? [
        { icon: 'DEPTH', label: 'Max Depth', value: selectedDive.maxDepth, unit: 'm', color: 'ocean', trend: 'Deepest point reached', emphasis: 'high' },
        { icon: 'AVG', label: 'Avg Depth', value: selectedDive.avgDepth ?? '--', unit: selectedDive.avgDepth != null ? 'm' : '', color: 'sky', trend: 'Average depth across the dive' },
        { icon: 'TIME', label: 'Duration', value: selectedDive.duration, unit: 'min', color: 'emerald', trend: 'Bottom time and ascent included', emphasis: 'high' },
        { icon: 'TEMP', label: 'Temperature', value: selectedDive.temp, unit: 'C', color: 'amber', trend: 'Average water temperature' },
        { icon: 'VIS', label: 'Visibility', value: selectedDive.visibility ?? '--', unit: selectedDive.visibility != null ? 'm' : '', color: 'emerald', trend: selectedDive.visibility != null ? `水下能見度 ${selectedDive.visibility} m` : '請在編輯中填入能見度' },
        { icon: 'HEART', label: 'Avg Heart Rate', value: selectedDive.avgHeartRate || '--', unit: 'bpm', color: 'coral', trend: selectedDive.maxHeartRate ? `Peak ${selectedDive.maxHeartRate} bpm` : 'No heart rate samples' },
        { icon: 'SAC', label: 'SAC', value: sac ?? '--', unit: 'L/min', color: 'violet', trend: sac ? `${selectedDive.startPressure}→${selectedDive.endPressure} bar · ${selectedDive.tankVolume}L · avg ${selectedDive.avgDepth}m` : '請在編輯中填入氣瓶資訊' },
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
            <p className="mt-2 text-sm font-medium text-ocean-200">
              總下水支數：{diveList.length} 支
              {filteredDives.length !== diveList.length ? ` · 目前顯示 ${filteredDives.length} 支` : ''}
            </p>
          </div>
          {selectedDive && (
            <div className="flex shrink-0">
              <button
                onClick={handleEditClick}
                className="rounded-xl border border-ocean-300/25 bg-ocean-500/10 px-5 py-2.5 text-sm font-semibold text-ocean-200 transition-colors hover:bg-ocean-500/20"
              >
                ✏️ 編輯這支潛水
              </button>
            </div>
          )}
        </div>

        {selectedDive && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
        )}

        {selectedDive && (
          <div className="mb-4 flex gap-4 border-b border-slate-700/50">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'overview'
                  ? 'border-ocean-400 text-ocean-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              📊 深度與地圖
            </button>
            <button
              onClick={() => {
                setActiveTab('divelog');
                // 切換到日誌分頁時，將目前的 dive 資料放入編輯表單
                setEditForm({
                  site: selectedDive.site || '',
                  notes: selectedDive.notes || '',
                  mood: selectedDive.mood || '',
                });
              }}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'divelog'
                  ? 'border-ocean-400 text-ocean-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              📝 潛水日誌
            </button>
          </div>
        )}

        {selectedDive && activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-3 animate-fade-in">
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

        {selectedDive && activeTab === 'divelog' && (
          <section className="glass animate-fade-in rounded-2xl border border-ocean-500/30 p-6 lg:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">潛水日誌</h2>
                <p className="text-xs text-slate-400 mt-1">你的潛水紀錄與心情</p>
              </div>
            </div>
            
            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">潛點名稱 / 地點</label>
                  <div className="text-white text-lg font-medium">{selectedDive.site || '未設定'}</div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">當天心情</label>
                  <div className="text-white text-lg">{selectedDive.mood || '未設定'}</div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">水下能見度</label>
                  <div className="text-white text-lg">{selectedDive.visibility != null ? `${selectedDive.visibility} m` : '未設定'}</div>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">潛水日誌 / 備註</label>
                <div className="w-full min-h-[150px] rounded-xl border border-slate-700/60 bg-slate-900/30 p-4 text-sm text-slate-200 whitespace-pre-wrap">
                  {selectedDive.notes || '還沒有寫下任何日誌...'}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 編輯表單區塊 (Modal 彈出視窗) */}
        {selectedDive && isEditing && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/80 pt-[8vh] px-4 sm:px-6 backdrop-blur-sm animate-fade-in">
            <section className="glass w-full max-w-2xl max-h-[82vh] overflow-y-auto rounded-2xl border border-ocean-500/30 p-6 shadow-2xl shadow-ocean-900/40">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">編輯潛水資訊</h2>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">潛點名稱 / 地點</label>
                    <input
                      value={editForm.site}
                      onChange={(e) => setEditForm({ ...editForm, site: e.target.value })}
                      className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-ocean-400/70"
                      placeholder="例如：綠島大白沙"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">當天心情</label>
                    <select
                      value={editForm.mood}
                      onChange={(e) => setEditForm({ ...editForm, mood: e.target.value })}
                      className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-ocean-400/70"
                    >
                      <option value="">-- 請選擇 --</option>
                      <option value="😃 超棒">😃 超棒</option>
                      <option value="🙂 不錯">🙂 不錯</option>
                      <option value="😐 普通">😐 普通</option>
                      <option value="😫 糟糕">😫 糟糕</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">水下能見度</label>
                    <select
                      value={String(editForm.visibility ?? '')}
                      onChange={(e) => setEditForm({ ...editForm, visibility: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-ocean-400/70"
                    >
                      <option value="">-- 請選擇 --</option>
                      <option value="3">3 m</option>
                      <option value="5">5 m</option>
                      <option value="10">10 m</option>
                      <option value="15">15 m</option>
                      <option value="20">20 m</option>
                      <option value="25">25 m</option>
                      <option value="30">30 m+</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">潛水日誌 / 備註</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={5}
                    className="w-full h-[120px] rounded-xl border border-slate-700/60 bg-slate-900/80 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-ocean-400/70 resize-none"
                    placeholder="紀錄下你看到了什麼、裝備設定或是潛伴..."
                  />
                </div>
              </div>
              <div className="mt-4 border-t border-slate-700/40 pt-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-violet-400">SAC 計算 — 氣瓶資訊</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">平均深度 (m) <span className="text-slate-600">自動</span></label>
                    <div className="w-full rounded-xl border border-slate-700/30 bg-slate-900/40 px-3 py-2 text-sm text-slate-300">
                      {selectedDive?.avgDepth != null ? `${selectedDive.avgDepth} m` : '—'}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">氣瓶型號</label>
                    <select
                      value={String(editForm.tankVolume ?? '')}
                      onChange={(e) => setEditForm({ ...editForm, tankVolume: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-400/70"
                    >
                      <option value="">-- 選擇 --</option>
                      <option value="9">S63 — 鋁 9.0 L</option>
                      <option value="11.1">S80 (標準) — 鋁 11.1 L</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">起始壓力 (bar)</label>
                    <select
                      value={String(editForm.startPressure ?? '')}
                      onChange={(e) => setEditForm({ ...editForm, startPressure: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-400/70"
                    >
                      <option value="">-- 選擇 --</option>
                      <option value="200">200 bar</option>
                      <option value="190">190 bar</option>
                      <option value="180">180 bar</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">結束壓力 (bar)</label>
                    <input
                      type="number" min="0" step="1"
                      value={editForm.endPressure}
                      onChange={(e) => setEditForm({ ...editForm, endPressure: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-400/70"
                      placeholder="例：50"
                    />
                  </div>
                </div>
                {editForm.tankVolume && editForm.startPressure && editForm.endPressure && selectedDive?.avgDepth && selectedDive?.duration ? (
                  <p className="mt-2 text-xs text-violet-300">
                    預覽 SAC：{Math.round(((editForm.startPressure - editForm.endPressure) * editForm.tankVolume) / (selectedDive.duration * (selectedDive.avgDepth / 10 + 1)) * 10) / 10} L/min
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">選擇氣瓶型號、起始與結束壓力後自動預覽 SAC</p>
                )}
              </div>
              <div className="mt-8 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-slate-700/60 bg-slate-800/50 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700/60 hover:text-white"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="rounded-xl bg-ocean-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-ocean-500/20 transition-colors hover:bg-ocean-400"
                >
                  儲存變更
                </button>
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

    </>
  );
}
