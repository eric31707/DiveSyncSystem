# 🤿 DiveSync System

一套 **水肺潛水紀錄管理系統**，能自動從 Garmin 手錶匯出的 `.fit` 檔解析潛水數據，並透過 Web Dashboard 進行視覺化瀏覽與管理。

---

## ✨ 功能特色

| 功能 | 說明 |
|---|---|
| **FIT 檔解析** | 使用 Garmin FIT SDK 解析 `.fit` 檔，提取深度曲線、水溫、心率、GPS 軌跡等遙測數據 |
| **批次匯入** | 支援指定本機資料夾，啟動時自動掃描並匯入全部 `.fit` 檔；也可透過 API 手動觸發 rescan |
| **噪音過濾** | 可設定深度 / 時間門檻，自動跳過非正式潛水的短淺記錄（如水面測試） |
| **重複偵測** | 比對日期、深度、時長、水溫，防止同一筆潛水被重複匯入 |
| **Dashboard** | 即時切換潛水紀錄，查看深度剖面圖、統計數據、入水 / 出水 GPS 地圖 |
| **深度剖面圖** | 使用 Recharts 繪製，包含安全停留標記線、快速上升警告、心率疊加曲線 |
| **GPS 地圖** | Leaflet + Google Satellite 底圖，顯示入水點 🟢 / 出水點 🔴 及潛水路徑軌跡 |
| **搜尋 & 篩選** | 支援站名 / 檔名 / ID 搜尋 + 日期前綴篩選（如 `2026-04`），分頁瀏覽 |
| **拖拉上傳** | 前端支援 Drag & Drop 單檔上傳，以及資料夾批次匯入 |

---

## 🏗️ 系統架構

```
DiveSyncSystem/
├── DiveSyncBackend/      # ASP.NET Core 8 Web API
│   ├── Controllers/
│   │   ├── DivesController.cs       # 潛水 CRUD + FIT 上傳解析
│   │   └── FitImportController.cs   # 資料夾批次 rescan API
│   ├── Services/
│   │   └── FitImportService.cs      # 資料夾掃描 + 噪音過濾 + 匯入邏輯
│   ├── Program.cs                   # App 啟動 + CORS + Swagger
│   └── appsettings.json             # FIT 匯入目錄、噪音門檻、Garmin session 設定
│
├── FitParser/            # 獨立 Console App（開發階段用來探索 FIT 欄位）
│   └── Program.cs
│
├── dive-sync-frontend/   # React 19 + Vite 8 + TailwindCSS 4 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx    # 主儀表板（深度圖 + 地圖 + 統計卡 + 潛水列表）
│   │   │   ├── DiveListPage.jsx     # 卡片式潛水紀錄瀏覽
│   │   │   └── UploadPage.jsx       # 單檔拖拉上傳 + 資料夾批次匯入
│   │   ├── components/
│   │   │   ├── charts/DiveDepthChart.jsx   # Recharts 深度剖面圖
│   │   │   ├── Map/DiveMap.jsx             # Leaflet GPS 地圖
│   │   │   └── common/                     # AppLayout, StatCard, Spinner
│   │   ├── api/                    # Axios client + API 封裝
│   │   └── hooks/                  # useDiveTelemetry (自動 fetch + abort + polling)
│   └── vite.config.js              # Dev proxy → backend :5250
│
└── DiveSyncSystem.sln    # Visual Studio 解決方案
```

---

## 🔧 技術棧

### Backend
- **ASP.NET Core 8** (Minimal Hosting)
- **Garmin FIT SDK** (`Garmin.FIT.Sdk v21.200.0`) — 解析 `.fit` 二進位檔
- **Swagger / OpenAPI** — 開發環境 API 文件
- **In-Memory DataStore** — 目前無持久化資料庫，所有潛水數據存在靜態 `List` + `Dictionary`

### Frontend
- **React 19** + **Vite 8**
- **TailwindCSS 4** — 深色系 glassmorphism UI
- **Recharts 3** — 深度剖面圖、心率曲線
- **Leaflet / react-leaflet 5** — GPS 入水出水地圖
- **Axios** — API 通訊層
- **React Router 7** — 路由

---

## 🚀 快速啟動

### 前置需求

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)

### 1. 啟動 Backend

```powershell
cd DiveSyncBackend
dotnet run
```

> 預設 listen `http://localhost:5250`
> 啟動時會自動掃描 `appsettings.json` 中的 `FitImport:Directory`，匯入所有 `.fit` 檔。

### 2. 啟動 Frontend

```powershell
cd dive-sync-frontend
npm install
npm run dev
```

> 預設 `http://127.0.0.1:5173`，已設定 Vite proxy 將 `/api` 轉發到 backend。

### 3. 開啟瀏覽器

前往 [http://127.0.0.1:5173](http://127.0.0.1:5173) 即可使用。

---

## ⚙️ 設定

`DiveSyncBackend/appsettings.json` 中的關鍵設定：

```jsonc
{
  "FitImport": {
    "Directory": "E:\\潛水影片\\Activity",  // Garmin .fit 檔所在資料夾
    "NoiseFilter": {
      "MaxDepthMeters": 3.0,     // 低於此深度 + 短於下方時間 → 視為噪音跳過
      "MaxDurationMinutes": 5
    }
  }
}
```

---

## 📡 API 端點

| Method | Endpoint | 說明 |
|---|---|---|
| `GET` | `/api/dives` | 取得所有潛水摘要 |
| `GET` | `/api/dives/{id}` | 取得單筆潛水詳情 |
| `GET` | `/api/dives/{id}/telemetry` | 取得該潛水的遙測數據（深度、水溫、心率、GPS） |
| `POST` | `/api/dives/upload-fit` | 上傳單一 `.fit` 檔並解析匯入 |
| `POST` | `/api/dives/import-local?path=...` | 匯入本機指定路徑的 `.fit` 檔 |
| `POST` | `/api/fit-import/rescan` | 重新掃描設定的資料夾並批次匯入 |

---

## 📊 資料模型

### DiveSummary

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | int | 自動遞增 ID |
| `site` | string | 潛點名稱（或 FIT 檔名） |
| `date` | string | 潛水日期 `yyyy-MM-dd` |
| `maxDepth` | double | 最大深度 (m) |
| `duration` | int | 潛水時長 (min) |
| `temp` | double | 平均水溫 (°C) |
| `maxHeartRate` | double? | 最大心率 (bpm) |
| `avgHeartRate` | double? | 平均心率 (bpm) |
| `entryLat/Lng` | double? | 入水點 GPS |
| `exitLat/Lng` | double? | 出水點 GPS |

### TelemetryPoint

| 欄位 | 型別 | 說明 |
|---|---|---|
| `time` | double | 相對時間 (min) |
| `depth` | double | 深度 (m) |
| `temperature` | double | 水溫 (°C) |
| `heartRate` | double? | 心率 (bpm) |
| `lat/lng` | double? | GPS 座標 |

---

## 🗺️ Roadmap / 已知限制

- **無持久化儲存** — 目前所有資料存在記憶體，重啟 backend 後需重新匯入
- **無認證機制** — axiosClient 預留了 Bearer token 攔截器但尚未啟用
- **Garmin Connect 整合** — appsettings 中有 Garmin session cookie 設定，但直接串接 API 尚未實作
- **影片同步** — 前端有 `video/` component 目錄及 `getVideoSyncMetadata` API stub，但功能尚未完成
- **潛點名稱** — 目前 FIT 匯入後 site 欄位為檔名，未來需要手動編輯或 reverse geocoding

---

## 📝 License

Private project.
