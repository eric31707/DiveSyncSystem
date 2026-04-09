using Microsoft.AspNetCore.Mvc;
using Dynastream.Fit;

namespace DiveSyncBackend.Controllers;

public class DiveSummary
{
    public int Id { get; set; }
    public string Site { get; set; }
    public string Date { get; set; }
    public double MaxDepth { get; set; }
    public int Duration { get; set; }
    public double Temp { get; set; }
    public double? MaxHeartRate { get; set; }
    public double? AvgHeartRate { get; set; }
    public double? EntryLat { get; set; }
    public double? EntryLng { get; set; }
    public double? ExitLat { get; set; }
    public double? ExitLng { get; set; }
}

public class TelemetryPoint
{
    public double Time { get; set; }
    public double Depth { get; set; }
    public double Temperature { get; set; }
    public double? HeartRate { get; set; }
    public double? Lat { get; set; }
    public double? Lng { get; set; }
}

internal sealed class DuplicateDiveException : ArgumentException
{
    public DuplicateDiveException(string message) : base(message)
    {
    }
}

public static class DataStore
{
    public static List<DiveSummary> Dives = new()
    {
        new DiveSummary { Id = 1, Site = "綠島大白沙", Date = "2026-04-06", MaxDepth = 32.4, Duration = 47, Temp = 24.3 },
        new DiveSummary { Id = 2, Site = "墾丁後壁湖", Date = "2026-04-02", MaxDepth = 18.2, Duration = 55, Temp = 26.1 }
    };
    public static Dictionary<int, List<TelemetryPoint>> Telemetries = new();
    public static int NextId = 3;
}

[ApiController]
[Route("api/[controller]")]
public class DivesController : ControllerBase
{
    [HttpGet]
    public IActionResult GetDives()
    {
        return Ok(DataStore.Dives);
    }

    [HttpGet("{id}")]
    public IActionResult GetDive(int id)
    {
        var dive = DataStore.Dives.FirstOrDefault(d => d.Id == id);
        if (dive == null) return NotFound();
        return Ok(dive);
    }

    [HttpGet("{id}/telemetry")]
    public IActionResult GetTelemetry(int id)
    {
        if (DataStore.Telemetries.TryGetValue(id, out var points))
        {
            return Ok(new { DiveId = id, Points = points });
        }
        else if (id <= 2) // mock for default
        {
            var random = new Random(id);
            var mockPoints = Enumerable.Range(0, 60).Select(t =>
            {
                double depth = t < 5 ? t * 6.0 : t < 45 ? 30 + Math.Sin(t * 0.15) * 8 : Math.Max(0, 30 - (t - 45) * 2.0);
                return new TelemetryPoint { Time = t, Depth = Math.Round(depth, 1), Temperature = Math.Round(26 - depth * 0.15 + random.NextDouble() * 0.5, 1) };
            }).ToList();
            return Ok(new { DiveId = id, Points = mockPoints });
        }
        return NotFound();
    }

    [HttpPost("upload-fit")]
    public IActionResult UploadFit(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest("No file");
        using var ms = new MemoryStream();
        file.CopyTo(ms);
        ms.Position = 0;
        return ParseAndImportStream(ms, file.FileName);
    }

    [HttpPost("import-local")]
    public IActionResult ImportLocal([FromQuery] string path)
    {
        if (!System.IO.File.Exists(path)) return BadRequest("File not found");
        using var fs = new FileStream(path, FileMode.Open);
        return ParseAndImportStream(fs, Path.GetFileName(path));
    }

    public class GarminLoginRequest
    {
        public string? Username { get; set; }
        public string? Password { get; set; }
    }

    [HttpPost("garmin-login")]
    public async Task<IActionResult> GarminLogin(
        [FromBody] GarminLoginRequest request,
        [FromServices] DiveSyncBackend.Services.GarminAuthService garminAuthService)
    {
        if (string.IsNullOrWhiteSpace(request?.Username) || string.IsNullOrWhiteSpace(request?.Password))
            return BadRequest("請提供帳號和密碼。");

        var (success, error) = await garminAuthService.LoginAsync(request.Username, request.Password);
        if (!success) return StatusCode(500, error);
        return Ok(new { Success = true, Message = "Garmin 登入成功，可以開始同步。" });
    }

    public class GarminSyncRequest
    {
        public string? SessionCookie { get; set; }
        public string? OAuthToken { get; set; }
    }

    [HttpPost("sync-garmin")]
    public async Task<IActionResult> SyncGarmin(
        [FromBody] GarminSyncRequest request,
        [FromServices] DiveSyncBackend.Services.GarminSyncService garminSyncService,
        [FromServices] DiveSyncBackend.Services.GarminAuthService garminAuthService,
        [FromServices] IConfiguration configuration)
    {
        // 優先使用已登入的 OAuth token
        var tokens = garminAuthService.GetTokens();
        string? oauthToken = tokens?.AccessToken;

        // 否則退回手動提供的 token 或 cookie
        if (string.IsNullOrEmpty(oauthToken))
        {
            oauthToken = string.IsNullOrWhiteSpace(request?.OAuthToken)
                ? configuration["Garmin:OAuthToken"]
                : request.OAuthToken;
        }

        var cookie = string.IsNullOrWhiteSpace(request?.SessionCookie)
            ? configuration["Garmin:SessionCookie"]
            : request.SessionCookie;

        var csrfToken = configuration["Garmin:CsrfToken"];

        if (string.IsNullOrWhiteSpace(oauthToken) && string.IsNullOrWhiteSpace(cookie))
            return BadRequest("請先呼叫 /api/dives/garmin-login 登入，或提供 OAuth Token。");

        var result = await garminSyncService.SyncLatestDiveActivityAsync(cookie ?? "", oauthToken, csrfToken);

        if (!result.Success)
            return StatusCode(500, result.Error);

        return Ok(new { Success = true, DiveId = result.DiveId!.Value });
    }

    private IActionResult ParseAndImportStream(Stream stream, string filename)
    {
        try 
        {
            var dive = ParseAndImportStreamCore(stream, filename);
            return Ok(new { Success = true, DiveId = dive.Id, Summary = dive });
        }
        catch (DuplicateDiveException ex)
        {
            return Conflict(new { success = false, message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    internal static DiveSummary ParseAndImportStreamCore(Stream stream, string filename)
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
        var durationMinutes = (int)Math.Round(points.Max(p => p.Time));
        var avgTemp = Math.Round(points.Average(p => p.Temperature), 1);
        
        var hrPoints = points.Where(p => p.HeartRate.HasValue).Select(p => p.HeartRate.Value).ToList();
        double? maxHr = hrPoints.Any() ? hrPoints.Max() : null;
        double? avgHr = hrPoints.Any() ? Math.Round(hrPoints.Average(), 0) : null;
        
        var startDateTime = startTime.HasValue ? new System.DateTime(1989, 12, 31, 0, 0, 0, System.DateTimeKind.Utc).AddSeconds(startTime.Value).ToString("yyyy-MM-dd") : System.DateTime.Now.ToString("yyyy-MM-dd");

        var duplicateDive = FindDuplicateDive(filename, startDateTime, maxDepth, durationMinutes, avgTemp);
        if (duplicateDive != null)
        {
            throw new DuplicateDiveException($"這支 FIT 已經匯入過了（Dive #{duplicateDive.Id}）。");
        }

        var id = DataStore.NextId++;

        var dive = new DiveSummary
        {
            Id = id,
            Site = filename,
            Date = startDateTime,
            MaxDepth = maxDepth,
            Duration = durationMinutes,
            Temp = avgTemp,
            MaxHeartRate = maxHr,
            AvgHeartRate = avgHr,
            EntryLat = sessionEntryLat ?? firstLat,
            EntryLng = sessionEntryLng ?? firstLng,
            ExitLat = sessionExitLat ?? lastLat,
            ExitLng = sessionExitLng ?? lastLng
        };

        DataStore.Dives.Insert(0, dive);
        DataStore.Telemetries[id] = points;

        return dive;
    }

    internal static DiveSummary? FindDuplicateDive(
        string site,
        string date,
        double maxDepth,
        int durationMinutes,
        double avgTemp)
    {
        return DataStore.Dives.FirstOrDefault(existing =>
            string.Equals(existing.Site, site, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(existing.Date, date, StringComparison.Ordinal) &&
            existing.Duration == durationMinutes &&
            Math.Abs(existing.MaxDepth - maxDepth) < 0.05 &&
            Math.Abs(existing.Temp - avgTemp) < 0.05);
    }
}
