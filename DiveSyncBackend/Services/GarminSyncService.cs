using System.IO.Compression;
using System.Text.Json;
using DiveSyncBackend.Controllers;

namespace DiveSyncBackend.Services;

public class GarminSyncResult
{
    public bool Success { get; init; }
    public int? DiveId { get; init; }
    public string? Error { get; init; }

    public static GarminSyncResult Ok(int diveId) => new() { Success = true, DiveId = diveId };
    public static GarminSyncResult Fail(string error) => new() { Success = false, Error = error };
}

public class GarminSyncService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<GarminSyncService> _logger;

    public GarminSyncService(ILogger<GarminSyncService> logger)
    {
        _logger = logger;

        var handler = new HttpClientHandler
        {
            UseCookies = false,
            AllowAutoRedirect = true,
            AutomaticDecompression = System.Net.DecompressionMethods.GZip
                                   | System.Net.DecompressionMethods.Deflate
                                   | System.Net.DecompressionMethods.Brotli
        };

        _httpClient = new HttpClient(handler);
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/json, text/plain, */*");
        _httpClient.DefaultRequestHeaders.Add("nk", "NT");
        _httpClient.DefaultRequestHeaders.Add("origin", "https://connect.garmin.com");
        _httpClient.DefaultRequestHeaders.Add("referer", "https://connect.garmin.com/");
    }

    /// <summary>從 cookie 字串解析指定 key 的值</summary>
    private static string? ExtractCookieValue(string cookieString, string key)
    {
        foreach (var part in cookieString.Split(';'))
        {
            var kv = part.Trim().Split('=', 2);
            if (kv.Length == 2 && kv[0].Trim().Equals(key, StringComparison.OrdinalIgnoreCase))
                return kv[1].Trim();
        }
        return null;
    }

    public async Task<GarminSyncResult> SyncLatestDiveActivityAsync(string sessionCookie, string? oauthToken = null, string? csrfToken = null)
    {
        try
        {
            // 優先使用直接傳入的 OAuth token，否則從 cookie 解析 JWT_WEB
            var bearerToken = !string.IsNullOrWhiteSpace(oauthToken)
                ? oauthToken
                : ExtractCookieValue(sessionCookie, "JWT_WEB");

            if (string.IsNullOrEmpty(bearerToken))
                return GarminSyncResult.Fail("找不到 OAuth Token，請從瀏覽器 F12 → Network → connectapi.garmin.com 任一請求 → Authorization header 複製 Bearer token。");

            _logger.LogInformation($"[Token] 使用 Bearer token，長度={bearerToken.Length}");

            _httpClient.DefaultRequestHeaders.Remove("Authorization");
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {bearerToken}");
            if (!string.IsNullOrEmpty(sessionCookie))
            {
                _httpClient.DefaultRequestHeaders.Remove("Cookie");
                _httpClient.DefaultRequestHeaders.Add("Cookie", sessionCookie);
            }

            // CSRF token — connect.garmin.com/proxy/ 端點必須送這個才不回 {}
            if (!string.IsNullOrEmpty(csrfToken))
            {
                _httpClient.DefaultRequestHeaders.Remove("connect-csrf-token");
                _httpClient.DefaultRequestHeaders.Add("connect-csrf-token", csrfToken);
            }

            string[] candidateUrls =
            [
                "https://connect.garmin.com/proxy/activitylist-service/activities/search/activities?start=0&limit=1",
                "https://connectapi.garmin.com/activitylist-service/activities/search/activities?start=0&limit=1",
            ];

            HttpResponseMessage? response = null;
            string content = "";
            string activityListUrl = "";

            foreach (var url in candidateUrls)
            {
                var r = await _httpClient.GetAsync(url);
                var c = await r.Content.ReadAsStringAsync();
                _logger.LogInformation($"[Try] {url} → {r.StatusCode}, len={c.Length}, body={c.Substring(0, Math.Min(c.Length, 200))}");
                if (r.IsSuccessStatusCode && c.Length > 2)   // > 2 排除空的 {}
                {
                    response = r;
                    content = c;
                    activityListUrl = url;
                    break;
                }
            }

            if (response == null || string.IsNullOrEmpty(content) || content.Length <= 2)
                return GarminSyncResult.Fail("所有 Garmin 端點均無法取得活動清單，可能需要重新整理 Cookie 或 Garmin API 已變更。");

            string activityListUrl2 = activityListUrl; // 僅供 log 用
            _ = activityListUrl2;

            JsonElement[] activities;
            try
            {
                var json = JsonDocument.Parse(content);
                var root = json.RootElement;

                if (root.ValueKind == JsonValueKind.Array)
                {
                    activities = root.EnumerateArray().ToArray();
                }
                else if (root.ValueKind == JsonValueKind.Object)
                {
                    JsonElement listEl;
                    if (root.TryGetProperty("activityList", out listEl) ||
                        root.TryGetProperty("activities", out listEl))
                    {
                        activities = listEl.EnumerateArray().ToArray();
                    }
                    else
                    {
                        return GarminSyncResult.Fail($"Garmin 回應結構未知，完整內容：{content}");
                    }
                }
                else
                {
                    return GarminSyncResult.Fail($"Garmin 回應非預期格式（{root.ValueKind}）");
                }
            }
            catch (Exception ex)
            {
                return GarminSyncResult.Fail($"JSON 解析失敗：{ex.Message}。內容：{content.Substring(0, Math.Min(content.Length, 300))}");
            }

            if (activities.Length == 0)
                return GarminSyncResult.Fail("帳號中找不到任何活動紀錄。");

            var latestActivity = activities[0];
            long activityId = latestActivity.GetProperty("activityId").GetInt64();
            string activityName = latestActivity.TryGetProperty("activityName", out var nameProp)
                ? nameProp.GetString() ?? "未命名潛水" : "未命名潛水";

            _logger.LogInformation($"找到最新紀錄！ID: {activityId}, 名稱: {activityName}");

            // 2. 下載 FIT ZIP（下載仍走 connect.garmin.com）
            string downloadUrl = $"https://connect.garmin.com/proxy/download-service/files/activity/{activityId}";
            _logger.LogInformation($"下載 FIT：{downloadUrl}");

            var zipResponse = await _httpClient.GetAsync(downloadUrl);
            if (!zipResponse.IsSuccessStatusCode)
            {
                var errZip = await zipResponse.Content.ReadAsStringAsync();
                return GarminSyncResult.Fail($"下載 FIT 失敗 ({(int)zipResponse.StatusCode})，Activity ID: {activityId}");
            }

            _logger.LogInformation("下載成功，解壓縮中...");

            // 3. 解壓縮並解析 FIT
            using var zipStream = await zipResponse.Content.ReadAsStreamAsync();
            using var archive = new ZipArchive(zipStream, ZipArchiveMode.Read);

            var fitEntry = archive.Entries.FirstOrDefault(e => e.FullName.EndsWith(".fit", StringComparison.OrdinalIgnoreCase));
            if (fitEntry == null)
                return GarminSyncResult.Fail($"ZIP 內找不到 .fit 檔（共 {archive.Entries.Count} 項）");

            using var fitStream = fitEntry.Open();
            using var ms = new MemoryStream();
            await fitStream.CopyToAsync(ms);
            ms.Position = 0;

            _logger.LogInformation("開始匯入 FIT...");
            var resultDive = DivesController.ParseAndImportStreamCore(ms, $"{activityId}_{activityName}");
            _logger.LogInformation($"同步完成！Dive ID: {resultDive.Id}");

            return GarminSyncResult.Ok(resultDive.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Garmin 同步例外");
            return GarminSyncResult.Fail($"例外：{ex.Message}");
        }
    }
}
