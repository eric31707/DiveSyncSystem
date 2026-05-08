using DiveSyncBackend.Data;
using DiveSyncBackend.Models;
using DiveSyncBackend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Dynastream.Fit;

namespace DiveSyncBackend.Controllers;

internal sealed class DuplicateDiveException : ArgumentException
{
    public DuplicateDiveException(string message) : base(message) { }
}

[ApiController]
[Route("api/[controller]")]
public class DivesController : ControllerBase
{
    public class DiveUpdateRequest
    {
        public string? Site { get; set; }
        public string? Notes { get; set; }
        public string? Mood { get; set; }
        public double? AvgDepth { get; set; }
        public double? TankVolume { get; set; }
        public double? StartPressure { get; set; }
        public double? EndPressure { get; set; }
    }

    private readonly DiveSyncDbContext _db;
    private readonly FitImportService _fitImportService;

    public DivesController(DiveSyncDbContext db, FitImportService fitImportService)
    {
        _db = db;
        _fitImportService = fitImportService;
    }

    [HttpPost("reset-and-reimport")]
    public async Task<IActionResult> ResetAndReimport()
    {
        await _db.Database.ExecuteSqlRawAsync("DELETE FROM TelemetryPoints");
        await _db.Database.ExecuteSqlRawAsync("DELETE FROM Dives");

        var (imported, failed, directory) = await _fitImportService.ImportConfiguredDirectoryAsync();
        return Ok(new { imported, failed, directory });
    }

    [HttpPatch("{id}")]
    public async Task<IActionResult> UpdateDive(int id, [FromBody] DiveUpdateRequest request)
    {
        var dive = await _db.Dives.FindAsync(id);
        if (dive == null) return NotFound();

        if (request.Site != null) dive.Site = request.Site;
        if (request.Notes != null) dive.Notes = request.Notes;
        if (request.Mood != null) dive.Mood = request.Mood;
        if (request.AvgDepth.HasValue) dive.AvgDepth = request.AvgDepth;
        if (request.TankVolume.HasValue) dive.TankVolume = request.TankVolume;
        if (request.StartPressure.HasValue) dive.StartPressure = request.StartPressure;
        if (request.EndPressure.HasValue) dive.EndPressure = request.EndPressure;

        await _db.SaveChangesAsync();
        return Ok(dive);
    }

    [HttpGet]
    public async Task<IActionResult> GetDives()
    {
        var dives = await _db.Dives
            .OrderByDescending(d => d.Date)
            .ThenByDescending(d => d.Id)
            .AsNoTracking()
            .ToListAsync();
        return Ok(dives);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetDive(int id)
    {
        var dive = await _db.Dives.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id);
        if (dive == null) return NotFound();
        return Ok(dive);
    }

    [HttpGet("{id}/telemetry")]
    public async Task<IActionResult> GetTelemetry(int id)
    {
        var exists = await _db.Dives.AnyAsync(d => d.Id == id);
        if (!exists) return NotFound();

        var points = await _db.TelemetryPoints
            .Where(t => t.DiveId == id)
            .OrderBy(t => t.Time)
            .AsNoTracking()
            .ToListAsync();

        return Ok(new { DiveId = id, Points = points });
    }

    [HttpPost("upload-fit")]
    public async Task<IActionResult> UploadFit(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest("No file");
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        ms.Position = 0;
        return await ParseAndImportStream(ms, file.FileName);
    }

    [HttpPost("import-local")]
    public async Task<IActionResult> ImportLocal([FromQuery] string path)
    {
        if (!System.IO.File.Exists(path)) return BadRequest("File not found");
        using var fs = new FileStream(path, FileMode.Open);
        return await ParseAndImportStream(fs, Path.GetFileName(path));
    }

    private async Task<IActionResult> ParseAndImportStream(Stream stream, string filename)
    {
        try
        {
            var (dive, points) = ParseFitStream(stream, filename);

            // 重複偵測
            var duplicate = await _db.Dives.FirstOrDefaultAsync(existing =>
                existing.Site == dive.Site &&
                existing.Date == dive.Date &&
                existing.Duration == dive.Duration &&
                Math.Abs(existing.MaxDepth - dive.MaxDepth) < 0.05 &&
                Math.Abs(existing.Temp - dive.Temp) < 0.05);

            if (duplicate != null)
                return Conflict(new { success = false, message = $"這支 FIT 已經匯入過了（Dive #{duplicate.Id}）。" });

            _db.Dives.Add(dive);
            await _db.SaveChangesAsync();

            foreach (var p in points)
                p.DiveId = dive.Id;

            _db.TelemetryPoints.AddRange(points);
            await _db.SaveChangesAsync();

            return Ok(new { Success = true, DiveId = dive.Id, Summary = dive });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    /// <summary>
    /// 純解析，不碰 DB。回傳 (DiveSummary, List&lt;TelemetryPoint&gt;)
    /// </summary>
    internal static (DiveSummary Dive, List<TelemetryPoint> Points) ParseFitStream(Stream stream, string filename)
    {
        var decode = new Decode();
        var mesgBroadcaster = new MesgBroadcaster();
        decode.MesgEvent += mesgBroadcaster.OnMesg;

        var points = new List<TelemetryPoint>();
        uint? startTime = null;

        double? firstLat = null, firstLng = null;
        double? lastLat = null, lastLng = null;

        double? sessionExitLat = null, sessionExitLng = null;
        double? sessionEntryLat = null, sessionEntryLng = null;

        mesgBroadcaster.RecordMesgEvent += (sender, e) =>
        {
            var r = (RecordMesg)e.mesg;
            if (startTime == null && r.GetTimestamp() != null) startTime = r.GetTimestamp().GetTimeStamp();
            var ts = r.GetTimestamp()?.GetTimeStamp() ?? 0;
            var depth = r.GetDepth() ?? 0f;
            var temp = r.GetTemperature() ?? 0;
            var hr = r.GetHeartRate() != null ? (double?)r.GetHeartRate() : null;

            var latPos = r.GetPositionLat();
            var lngPos = r.GetPositionLong();
            double? curLat = null;
            double? curLng = null;
            if (latPos != null && lngPos != null)
            {
                curLat = latPos * (180.0 / 2147483648.0);
                curLng = lngPos * (180.0 / 2147483648.0);
                if (firstLat == null) { firstLat = curLat; firstLng = curLng; }
                lastLat = curLat; lastLng = curLng;
            }

            if (startTime.HasValue && ts >= startTime)
            {
                points.Add(new TelemetryPoint
                {
                    Time = Math.Round((ts - startTime.Value) / 60.0, 2),
                    Depth = Math.Round(depth, 1),
                    Temperature = temp,
                    HeartRate = hr,
                    Lat = curLat,
                    Lng = curLng
                });
            }
        };

        mesgBroadcaster.SessionMesgEvent += (sender, e) =>
        {
            var s = (SessionMesg)e.mesg;
            if (s.GetStartPositionLat() != null && s.GetStartPositionLong() != null)
            {
                sessionEntryLat = s.GetStartPositionLat() * (180.0 / 2147483648.0);
                sessionEntryLng = s.GetStartPositionLong() * (180.0 / 2147483648.0);
            }
            if (s.GetEndPositionLat() != null && s.GetEndPositionLong() != null)
            {
                sessionExitLat = s.GetEndPositionLat() * (180.0 / 2147483648.0);
                sessionExitLng = s.GetEndPositionLong() * (180.0 / 2147483648.0);
            }
        };

        try { decode.Read(stream); } catch { throw new ArgumentException("Invalid FIT file"); }

        if (!points.Any()) throw new ArgumentException("No telemetry in FIT file");

        var maxDepth = points.Max(p => p.Depth);
        var avgDepth = Math.Round(points.Average(p => p.Depth), 1);
        var durationMinutes = (int)Math.Round(points.Max(p => p.Time));
        var avgTemp = Math.Round(points.Average(p => p.Temperature), 1);

        var hrPoints = points.Where(p => p.HeartRate.HasValue).Select(p => p.HeartRate!.Value).ToList();
        double? maxHr = hrPoints.Any() ? hrPoints.Max() : null;
        double? avgHr = hrPoints.Any() ? Math.Round(hrPoints.Average(), 0) : null;

        var startDateTime = startTime.HasValue
            ? new System.DateTime(1989, 12, 31, 0, 0, 0, System.DateTimeKind.Utc).AddSeconds(startTime.Value).ToString("yyyy-MM-dd")
            : System.DateTime.Now.ToString("yyyy-MM-dd");

        var dive = new DiveSummary
        {
            Site = filename,
            Date = startDateTime,
            MaxDepth = maxDepth,
            AvgDepth = avgDepth,
            Duration = durationMinutes,
            Temp = avgTemp,
            MaxHeartRate = maxHr,
            AvgHeartRate = avgHr,
            EntryLat = sessionEntryLat ?? firstLat,
            EntryLng = sessionEntryLng ?? firstLng,
            ExitLat = sessionExitLat ?? lastLat,
            ExitLng = sessionExitLng ?? lastLng
        };

        return (dive, points);
    }
}
