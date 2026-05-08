# 🤿 DiveSync System

**English** | [繁體中文](README.zh-TW.md)

A **scuba diving log management system** that automatically parses dive data from Garmin watch `.fit` exports and provides a web dashboard for visualization and management.

---

## ✨ Features

| Feature | Description |
|---|---|
| **FIT File Parsing** | Parses Garmin `.fit` binary files using the FIT SDK — extracts depth, water temp, heart rate, and GPS telemetry |
| **Batch Import** | Auto-scans a configured directory on startup and imports all `.fit` files; manual rescan available via API |
| **Noise Filtering** | Configurable depth / duration thresholds to skip surface tests and non-dive recordings |
| **Duplicate Detection** | Compares date, depth, duration, and temperature to prevent re-importing the same dive |
| **Dashboard** | Switch between dives and view depth profile charts, stat cards, and entry / exit GPS map |
| **Depth Profile Chart** | Built with Recharts — includes safety stop marker, rapid ascent warning, and heart rate overlay |
| **GPS Map** | Leaflet + OpenStreetMap showing entry 🟢 / exit 🔴 markers and dive track |
| **Search & Filter** | Search by site name, filename, or dive ID; filter by date prefix (e.g. `2026-04`); paginated |
| **Edit Dive Info** | Fill in dive site, journal notes, mood, buddy name, visibility, and tank details |
| **SAC Calculation** | Auto-calculates Surface Air Consumption from avg depth, duration, pressures, and tank volume |
| **Delete Dive** | Delete a single dive and all associated telemetry points |
| **Drag & Drop Upload** | Frontend supports drag-and-drop single `.fit` file upload |
| **Persistent Storage** | SQL Server + EF Core Migrations — data survives backend restarts |

---

## 🏗️ Architecture

```
DiveSyncSystem/
├── DiveSyncBackend/              # ASP.NET Core 8 Web API
│   ├── Controllers/
│   │   ├── DivesController.cs       # Dive CRUD + FIT upload/parse
│   │   └── FitImportController.cs   # Batch directory rescan API
│   ├── Services/
│   │   └── FitImportService.cs      # Directory scan + noise filter + import logic
│   ├── Models/
│   │   ├── DiveSummary.cs           # Dive summary entity
│   │   └── TelemetryPoint.cs        # Telemetry data point entity
│   ├── Data/
│   │   └── DiveSyncDbContext.cs     # EF Core DbContext
│   ├── Migrations/                  # EF Core migration files
│   ├── Program.cs                   # App startup + CORS + Swagger + Migration
│   ├── appsettings.json             # FIT import directory, noise filter config
│   └── appsettings.Local.json       # Local overrides (not committed): DB connection, FIT path
│
├── FitParser/                    # Standalone console app for exploring FIT fields (dev tool)
│   └── Program.cs
│
├── dive-sync-frontend/           # React 19 + Vite + TailwindCSS frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx    # Main dashboard (chart + map + stat cards + dive list + edit)
│   │   │   ├── DiveListPage.jsx     # Card-style dive browser
│   │   │   └── UploadPage.jsx       # Drag & drop upload + batch folder import
│   │   ├── components/
│   │   │   ├── charts/DiveDepthChart.jsx   # Recharts depth profile
│   │   │   ├── Map/DiveMap.jsx             # Leaflet GPS map
│   │   │   └── common/                     # AppLayout, StatCard, Spinner
│   │   ├── api/                    # Axios client + API wrappers
│   │   └── hooks/                  # useDiveTelemetry
│   └── vite.config.js              # Dev proxy → backend :5250
│
└── DiveSyncSystem.sln            # Visual Studio solution
```

---

## 🔧 Tech Stack

### Backend
- **ASP.NET Core 8** (Minimal Hosting)
- **Entity Framework Core 9** + **SQL Server** — persistent storage with migrations
- **Garmin FIT SDK** (`Garmin.FIT.Sdk`) — `.fit` binary file parsing
- **Swagger / OpenAPI** — API documentation in development

### Frontend
- **React 19** + **Vite**
- **TailwindCSS** — dark glassmorphism UI
- **Recharts** — depth profile and heart rate charts
- **Leaflet / react-leaflet** — entry/exit GPS map
- **Axios** — API communication layer
- **React Router** — client-side routing

---

## 🚀 Getting Started

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- SQL Server (local instance or LocalDB)

### 1. Create Local Configuration

Create `appsettings.Local.json` inside `DiveSyncBackend/` (this file is git-ignored):

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

### 2. Start the Backend

```powershell
cd DiveSyncBackend
dotnet run
```

> Listens on `http://localhost:5250` by default.
> On startup, migrations are applied automatically. If the database is empty, it scans `FitImport:Directory` and imports all `.fit` files.

### 3. Start the Frontend

```powershell
cd dive-sync-frontend
npm install
npm run dev
```

> Runs at `http://127.0.0.1:5173` by default. Vite proxy forwards `/api` requests to the backend.

### 4. Open in Browser

Navigate to [http://127.0.0.1:5173](http://127.0.0.1:5173).

---

## ⚙️ Configuration

Noise filter settings in `DiveSyncBackend/appsettings.json`:

```jsonc
{
  "FitImport": {
    "Directory": "",               // Override in appsettings.Local.json
    "NoiseFilter": {
      "MaxDepthMeters": 3.0,       // Dives shallower than this AND shorter than below are skipped
      "MaxDurationMinutes": 5
    }
  }
}
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dives` | Get all dive summaries (newest first) |
| `GET` | `/api/dives/{id}` | Get a single dive |
| `GET` | `/api/dives/{id}/telemetry` | Get telemetry points (depth, temp, HR, GPS) |
| `PATCH` | `/api/dives/{id}` | Update dive info (site, notes, mood, buddy, visibility, tank) |
| `DELETE` | `/api/dives/{id}` | Delete a dive and all its telemetry |
| `POST` | `/api/dives/upload-fit` | Upload and parse a `.fit` file |
| `POST` | `/api/dives/import-local?path=...` | Import a `.fit` file from a local path |
| `POST` | `/api/dives/reset-and-reimport` | Wipe the database and re-import from the configured directory |
| `POST` | `/api/fit-import/rescan` | Rescan the configured directory and import new files only |

---

## 📊 Data Models

### DiveSummary

| Field | Type | Description |
|---|---|---|
| `id` | int | Auto-increment primary key |
| `site` | string | Dive site name (defaults to FIT filename; editable) |
| `date` | string | Dive date `yyyy-MM-dd` |
| `maxDepth` | double | Maximum depth (m) |
| `avgDepth` | double? | Average depth (m), auto-calculated from telemetry |
| `duration` | int | Dive duration (min) |
| `temp` | double | Average water temperature (°C) |
| `maxHeartRate` | double? | Peak heart rate (bpm) |
| `avgHeartRate` | double? | Average heart rate (bpm) |
| `entryLat/Lng` | double? | Entry point GPS coordinates |
| `exitLat/Lng` | double? | Exit point GPS coordinates |
| `tankVolume` | double? | Tank volume (L), manually entered |
| `startPressure` | double? | Start pressure (bar), manually entered |
| `endPressure` | double? | End pressure (bar), manually entered |
| `visibility` | double? | Underwater visibility (m), manually entered |
| `buddyName` | string? | Dive buddy name |
| `notes` | string? | Dive journal / notes |
| `mood` | string? | Mood rating for the dive |

### TelemetryPoint

| Field | Type | Description |
|---|---|---|
| `time` | double | Elapsed time (min) |
| `depth` | double | Depth (m) |
| `temperature` | double | Water temperature (°C) |
| `heartRate` | double? | Heart rate (bpm) |
| `lat/lng` | double? | GPS coordinates |

---

## 🗺️ Roadmap

- **Reverse geocoding** — auto-populate site name from GPS coordinates on import
- **Video sync** — `getVideoSyncMetadata` API stub is in place, feature not yet implemented
- **Authentication** — Axios client has a Bearer token interceptor placeholder, not yet wired up
- **Multi-user support** — currently single-user local setup, no account system

---

## 📝 License

Private project.
