import { useCallback, useRef, useState } from 'react';
import Spinner from '../components/common/Spinner';
import { pingBackend, uploadFitFile } from '../api/diveApi';

function isBackendOfflineError(error) {
  const message = String(error?.message || '');
  return !error?.response && (
    message.includes('Network Error')
    || message.includes('ERR_CONNECTION_REFUSED')
    || message.includes('Failed to fetch')
  );
}

function isDuplicateImportError(error) {
  const status = error?.response?.status;
  const payload = error?.response?.data;
  const message = typeof payload === 'string'
    ? payload
    : payload?.message || payload?.title || '';

  return status === 409 || String(message).includes('已經匯入過');
}

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [folderUploading, setFolderUploading] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderFitFiles, setFolderFitFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [folderResult, setFolderResult] = useState(null);
  const folderInputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.toLowerCase().endsWith('.fit')) {
      setFile(dropped);
    }
  }, []);

  const handleFileInput = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
    }
  };

  const handleFolderInput = (e) => {
    const files = Array.from(e.target.files ?? []);
    const fitFiles = files.filter((selectedFile) => selectedFile.name.toLowerCase().endsWith('.fit'));
    const firstRelativePath = fitFiles[0]?.webkitRelativePath || files[0]?.webkitRelativePath || '';
    const detectedFolderName = firstRelativePath.split('/')[0] || firstRelativePath.split('\\')[0] || '';

    setFolderFitFiles(fitFiles);
    setFolderName(detectedFolderName || 'Selected Folder');
    setFolderResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      await pingBackend();
      const data = await uploadFitFile(file);
      setResult({
        success: true,
        diveId: data.diveId,
        summary: {
          site: data.summary?.site ?? '',
          maxDepth: data.summary?.maxDepth ?? 0,
          duration: data.summary?.duration ?? 0,
        },
      });
    } catch (error) {
      if (isBackendOfflineError(error)) {
        setResult({ success: false, error: '後端未啟動，請先啟動 DiveSyncBackend。' });
      } else if (isDuplicateImportError(error)) {
        setResult({ success: false, error: '這支 FIT 已經匯入過了，已略過。' });
      } else {
        const message = error.response?.data || error.message;
        setResult({
          success: false,
          error: typeof message === 'object' ? JSON.stringify(message) : message,
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFolderUpload = async () => {
    if (folderFitFiles.length === 0) {
      return;
    }

    setFolderUploading(true);
    setFolderResult(null);

    try {
      await pingBackend();
    } catch {
      setFolderResult({
        success: false,
        uploaded: 0,
        skipped: 0,
        failedCount: folderFitFiles.length,
        failedFiles: [],
        folderName,
        error: '後端未啟動，請先啟動 DiveSyncBackend。',
      });
      setFolderUploading(false);
      return;
    }

    let uploaded = 0;
    let skipped = 0;
    const failed = [];

    for (const fitFile of folderFitFiles) {
      try {
        await uploadFitFile(fitFile);
        uploaded += 1;
      } catch (error) {
        if (isDuplicateImportError(error)) {
          skipped += 1;
          continue;
        }

        failed.push({
          name: fitFile.name,
          error: error.response?.data || error.message,
        });
      }
    }

    setFolderResult({
      success: failed.length === 0,
      uploaded,
      skipped,
      failedCount: failed.length,
      failedFiles: failed.slice(0, 10),
      folderName,
      error: null,
    });

    setFolderUploading(false);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">匯入 FIT 檔</h1>
        <p className="mt-1 text-sm text-slate-400">
          可上傳單一 Garmin FIT 檔，或直接瀏覽資料夾並批次匯入全部 `.fit` 檔。
        </p>
      </div>

      <section className="glass rounded-2xl p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">瀏覽資料夾批次匯入</h2>
            <p className="mt-1 text-sm text-slate-400">
              直接選擇你電腦上的資料夾，前端會讀取其中的 `.fit` 檔並逐筆上傳。
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={() => folderInputRef.current?.click()}
              className="rounded-xl bg-slate-700/60 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-600/70"
            >
              瀏覽資料夾
            </button>
            <button
              onClick={handleFolderUpload}
              disabled={folderUploading || folderFitFiles.length === 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-ocean-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ocean-400 disabled:opacity-50"
            >
              {folderUploading && <Spinner size="sm" />}
              {folderUploading ? '批次上傳中...' : '開始匯入資料夾'}
            </button>
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFolderInput}
              webkitdirectory=""
              directory=""
            />
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 text-sm text-slate-300">
            <div>資料夾：{folderName || '尚未選擇'}</div>
            <div className="mt-1">找到 FIT 檔：{folderFitFiles.length} 個</div>
          </div>
        </div>

        {folderResult && (
          <div
            className={`mt-4 rounded-xl border p-4 text-sm ${
              folderResult.success
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}
          >
            {folderResult.error ? (
              <div>{folderResult.error}</div>
            ) : (
              <>
                <div>
                  資料夾 `{folderResult.folderName || 'Unknown Folder'}` 已匯入 {folderResult.uploaded} 筆，
                  略過 {folderResult.skipped || 0} 筆重複，失敗 {folderResult.failedCount} 筆。
                </div>
                {folderResult.failedFiles?.length > 0 && (
                  <div className="mt-2 text-xs">
                    失敗檔案：{folderResult.failedFiles.map((item) => item.name).join(', ')}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`glass flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-all duration-300 ${
          dragging
            ? 'border-ocean-400 bg-ocean-500/10 shadow-lg shadow-ocean-500/10'
            : 'border-slate-600/40 hover:border-slate-500/60'
        }`}
      >
        <div className="mb-4 text-5xl">FIT</div>
        <p className="text-lg font-medium text-white">
          {file ? file.name : '拖拉一個 .fit 檔到這裡'}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {file ? `${(file.size / 1024).toFixed(1)} KB` : '或使用下方按鈕選擇單一檔案'}
        </p>

        <div className="mt-6 flex gap-3">
          <label className="cursor-pointer rounded-xl bg-slate-700/50 px-5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/70">
            選擇檔案
            <input
              type="file"
              accept=".fit"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-ocean-500 to-ocean-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-ocean-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-ocean-500/30 disabled:opacity-40 disabled:shadow-none"
          >
            {uploading && <Spinner size="sm" />}
            {uploading ? '上傳中...' : '上傳 FIT'}
          </button>
        </div>
      </div>

      {result && !result.success && (
        <section className="glass animate-fade-in rounded-2xl border border-red-500/30 p-6">
          <p className="text-sm text-red-400">{result.error || '匯入失敗。'}</p>
        </section>
      )}

      {result?.success && (
        <section className="glass animate-fade-in rounded-2xl p-6 glow-ocean">
          <h2 className="text-lg font-semibold text-white">單檔匯入完成</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: '潛水 ID', value: `#${result.diveId}` },
              { label: '檔名', value: result.summary.site || '-' },
              { label: '最大深度', value: `${result.summary.maxDepth} m` },
              { label: '時間', value: `${result.summary.duration} min` },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-slate-700/30 p-3 text-center">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="mt-1 text-sm font-bold text-ocean-300">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
