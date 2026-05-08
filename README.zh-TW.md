# 🤿 DiveSync System

> 語系 / Language：**繁體中文** | [English](README.md)

一套 **水肺潛水紀錄管理系統**，能自動從 Garmin 手錶匯出的 `.fit` 檔解析潛水數據，並透過 Web Dashboard 進行視覺化瀏覽與管理。

---

## ✨ 功能特色

| 功能 | 說明 |
|---|---|
| **FIT 檔解析** | 使用 Garmin FIT SDK 解析 `.fit` 二進位檔，提取深度、水溫、心率、GPS 遙測 |
| **批次匯入** | 啟動時自動掃描設定資料夾，匯入全部 `.fit` 檔；也可透過 API 手動 rescan |
| **噪音過濾** | 設定深度 / 時間門檻，自動跳過水面測試等非正式潛水紀錄 |
| **重複偵測** | 比對日期、深度、時長、水溫，防止同一筆潛水重複匯入 |
| **Dashboard** | 即時切換潛水紀錄，查看深度剖面圖、統計卡、入水 / 出水 GPS 地圖 |
| **深度剖面圖** | Recharts 繪製，含安全停留標記線、快速上升警告、心率疊加曲線 |
| **GPS 地圖** | Leaflet + OpenStreetMap，顯示入水 🟢 / 出水 🔴 及潛水路徑軌跡 |
| **搜尋 & 篩選** | 站名 / 檔名 / ID 搜尋 + 日期前綴篩選（如 `2026-04`），支援分頁 |
| **編輯潛水資訊** | 可補填潛點名稱、日誌備註、當天心情、潛伴姓名、能見度、氣瓶資訊 |
| **SAC 計算** | 根據平均深度、潛水時長、起始 / 結束氣壓、氣瓶容積自動計算 SAC 值 |
| **刪除潛水** | 單筆刪除，同時清除對應的所有遙測資料點 |
| **拖拉上傳** | 前端支援 Drag & Drop 單檔上傳 |
| **持久化儲存** | SQL Server + EF Core Migrations，資料重啟後保留 |

---

## 🏗️ 系統架構

```
DiveSyncSystem/
├── DiveSyncBackend/              # ASP.NET Core 8 Web API
│   ├── Controllers/
│   │   ├── DivesController.cs       # 潛水 CRUD + FIT 上傳解析
│   │   └── FitImportController.cs   # 資料夾批次 rescan API
│   ├── Services/
│   │   └── FitImportService.cs      # 資料夾掃描 + 噪音過濾 + 匯入邏輯
│   ├── Models/
│   │   ├── DiveSummary.cs           # 潛水摘要 Entity
│   │   └── TelemetryPoint.cs        # 遙測數據點 Entity
│   ├── Data/
│   │   └── DiveSyncDbContext.cs     # EF Core DbContext
│   ├── Migrations/                  # EF Core Migration 檔案
│   ├── Program.cs                   # App 啟動 + CORS + Swagger + Migration
│   ├── appsettings.json             # FIT 匯入目錄、噪音門檻設定
│   └── appsettings.Local.json       # 本機設定（不 commit）：DB 連線字串、FIT 路徑
│
├── FitParser/                    # 獨立 Console App（開發用 FIT 欄位探索）
│   └── Program.cs
│
├── dive-sync-frontend/           # React 19 + Vite + TailwindCSS 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx    # 主儀表板（深度圖 + 地圖 + 統計卡 + 潛水列表 + 編輯）
│   │   │   ├── DiveListPage.jsx     # 卡片式潛水紀錄瀏覽
│   │   │   └── UploadPage.jsx       # 單檔拖拉上傳 + 資料夾批次匯入
│   │   ├── components/
│   │   │   ├── charts/DiveDepthChart.jsx   # Recharts 深度剖面圖
│   │   │   ├── Map/DiveMap.jsx             # Leaflet GPS 地圖
│   │   │   └── common/                     # AppLayout, StatCard, Spinner
│   │   ├── api/                    # Axios client + API 封裝
│   │   └── hooks/                  # useDiveTelemetry
│   └── vite.config.js              # Dev proxy → backend :5250
│
└── DiveSyncSystem.sln            # Visual Studio 解決方案
```

---

## 🔧 技術棧

### Backend
- **ASP.NET Core 8** (Minimal Hosting)
- **Entity Framework Core 9** + **SQL Server** — 持久化儲存，支援 Migration
- **Garmin FIT SDK** (`Garmin.FIT.Sdk`) — 解析 `.fit` 二進位檔
- **Swagger / OpenAPI** — 開發環境 API 文件

### Frontend
- **React 19** + **Vite**
- **TailwindCSS** — 深色系 glassmorphism UI
- **Recharts** — 深度剖面圖、心率曲線
- **Leaflet / react-leaflet** — GPS 入水出水地圖
- **Axios** — API 通訊層
- **React Router** — 路由

---

## 🚀 快速啟動

### 前置需求

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- SQL Server（本機或 LocalDB 均可）

### 1. 建立本機設定

在 `DiveSyncBackend/` 新增 `appsettings.Local.json`（此檔不會被 git 追蹤）：

```jsonc
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=DiveSync;Trusted_Connection=True;TrustServerCertificate=True"
  },
  "FitImport": {
    "Directory": "C:\\path\\to\\your\\fit\\files"
  }
}
```

### 2. 啟動 Backend

```powershell
cd DiveSyncBackend
dotnet run
```

> 預設 listen `http://localhost:5250`
> 啟動時自動執行 Migration，若 DB 為空則掃描 `FitImport:Directory` 批次匯入。

### 3. 啟動 Frontend

```powershell
cd dive-sync-frontend
npm install
npm run dev
```

> 預設 `http://127.0.0.1:5173`，Vite proxy 已設定將 `/api` 轉發到 backend。

### 4. 開啟瀏覽器

前往 [http://127.0.0.1:5173](http://127.0.0.1:5173) 即可使用。

---

## ⚙️ 設定

`DiveSyncBackend/appsettings.json` 中的噪音過濾設定：

```jsonc
{
  "FitImport": {
    "Directory": "",                 // 覆寫於 appsettings.Local.json
    "NoiseFilter": {
      "MaxDepthMeters": 3.0,         // 低於此深度且短於下方時間 → 視為噪音跳過
      "MaxDurationMinutes": 5
    }
  }
}
```

---

## 📡 API 端點

| Method | Endpoint | 說明 |
|---|---|---|
| `GET` | `/api/dives` | 取得所有潛水摘要（依日期降冪） |
| `GET` | `/api/dives/{id}` | 取得單筆潛水詳情 |
| `GET` | `/api/dives/{id}/telemetry` | 取得遙測數據（深度、水溫、心率、GPS） |
| `PATCH` | `/api/dives/{id}` | 更新潛水資訊（潛點、日誌、心情、潛伴、能見度、氣瓶） |
| `DELETE` | `/api/dives/{id}` | 刪除單筆潛水及其遙測資料 |
| `POST` | `/api/dives/upload-fit` | 上傳單一 `.fit` 檔並解析匯入 |
| `POST` | `/api/dives/import-local?path=...` | 匯入本機指定路徑的 `.fit` 檔 |
| `POST` | `/api/dives/reset-and-reimport` | 清空 DB 並重新從設定資料夾批次匯入 |
| `POST` | `/api/fit-import/rescan` | 重新掃描設定資料夾，僅匯入新增的檔案 |

---

## 📊 資料模型

### DiveSummary

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | int | 自動遞增 ID |
| `site` | string | 潛點名稱（預設為 FIT 檔名，可手動編輯） |
| `date` | string | 潛水日期 `yyyy-MM-dd` |
| `maxDepth` | double | 最大深度 (m) |
| `avgDepth` | double? | 平均深度 (m)，從遙測自動計算 |
| `duration` | int | 潛水時長 (min) |
| `temp` | double | 平均水溫 (°C) |
| `maxHeartRate` | double? | 最大心率 (bpm) |
| `avgHeartRate` | double? | 平均心率 (bpm) |
| `entryLat/Lng` | double? | 入水點 GPS |
| `exitLat/Lng` | double? | 出水點 GPS |
| `tankVolume` | double? | 氣瓶容積 (L)，手動填入 |
| `startPressure` | double? | 起始氣壓 (bar)，手動填入 |
| `endPressure` | double? | 結束氣壓 (bar)，手動填入 |
| `visibility` | double? | 水下能見度 (m)，手動填入 |
| `buddyName` | string? | 潛伴姓名 |
| `notes` | string? | 潛水日誌 / 備註 |
| `mood` | string? | 當天心情 |

### TelemetryPoint

| 欄位 | 型別 | 說明 |
|---|---|---|
| `time` | double | 相對時間 (min) |
| `depth` | double | 深度 (m) |
| `temperature` | double | 水溫 (°C) |
| `heartRate` | double? | 心率 (bpm) |
| `lat/lng` | double? | GPS 座標 |

---

## 🗺️ Roadmap

- **潛點 reverse geocoding** — 目前 FIT 匯入後 site 為檔名，未來可根據 GPS 自動帶入地名
- **影片同步** — `getVideoSyncMetadata` API stub 已預留，功能尚未完成
- **認證機制** — axiosClient 預留 Bearer token 攔截器但尚未啟用
- **多使用者** — 目前為單人本機使用，尚無帳號系統

---

## 📝 License

Private project.
