using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace DiveSyncBackend.Services;

public class GarminTokens
{
    public string AccessToken { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public bool IsValid => !string.IsNullOrEmpty(AccessToken) && DateTimeOffset.UtcNow < ExpiresAt.AddMinutes(-5);
}

public class GarminAuthService
{
    private readonly ILogger<GarminAuthService> _logger;
    private readonly IConfiguration _configuration;
    private GarminTokens? _tokens;

    // Garmin Connect 官方 App 的 Consumer Token（公開常數）
    private const string ConsumerToken = "fc3e99d2-118c-44b8-8ae3-03370dde24c0";

    public GarminAuthService(ILogger<GarminAuthService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
    }

    public GarminTokens? GetTokens() => _tokens?.IsValid == true ? _tokens : null;

    public async Task<(bool Success, string Error)> LoginAsync(string username, string password)
    {
        var cookieContainer = new CookieContainer();
        var handler = new HttpClientHandler
        {
            CookieContainer = cookieContainer,
            UseCookies = true,
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli
        };

        using var client = new HttpClient(handler);
        client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

        try
        {
            // Step 1: 取得 SSO 頁面和 CSRF token
            var ssoParams = "id=gauth-widget&embedWidget=true&gauthHost=https%3A%2F%2Fsso.garmin.com" +
                            "&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern" +
                            "&source=https%3A%2F%2Fconnect.garmin.com%2Fsignin" +
                            "&redirectAfterAccountLoginUrl=https%3A%2F%2Fconnect.garmin.com%2Fmodern" +
                            "&redirectAfterAccountCreationUrl=https%3A%2F%2Fconnect.garmin.com%2Fmodern";

            var ssoPage = await client.GetAsync($"https://sso.garmin.com/sso/embed?{ssoParams}");
            var ssoHtml = await ssoPage.Content.ReadAsStringAsync();

            var csrfMatch = Regex.Match(ssoHtml, @"name=""_csrf""\s+value=""(.+?)""");
            if (!csrfMatch.Success)
            {
                _logger.LogError($"SSO 頁面找不到 CSRF token，頁面預覽：{ssoHtml.Substring(0, Math.Min(ssoHtml.Length, 300))}");
                return (false, "無法取得 Garmin SSO 頁面，可能被 Cloudflare 攔截。");
            }

            var csrf = csrfMatch.Groups[1].Value;
            _logger.LogInformation($"[Auth] 取得 CSRF token：{csrf.Substring(0, Math.Min(csrf.Length, 8))}...");

            // Step 2: 送出登入
            var loginForm = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("username", username),
                new KeyValuePair<string, string>("password", password),
                new KeyValuePair<string, string>("_csrf", csrf),
                new KeyValuePair<string, string>("embed", "true"),
                new KeyValuePair<string, string>("id", "gauth-widget"),
                new KeyValuePair<string, string>("service", "https://connect.garmin.com/modern"),
                new KeyValuePair<string, string>("source", "https://connect.garmin.com/signin"),
                new KeyValuePair<string, string>("gauthHost", "https://sso.garmin.com"),
                new KeyValuePair<string, string>("redirectAfterAccountLoginUrl", "https://connect.garmin.com/modern"),
            });

            client.DefaultRequestHeaders.Add("Referer", $"https://sso.garmin.com/sso/embed?{ssoParams}");
            var loginResp = await client.PostAsync("https://sso.garmin.com/sso/signin", loginForm);
            var loginBody = await loginResp.Content.ReadAsStringAsync();

            _logger.LogInformation($"[Auth] 登入回應：{loginResp.StatusCode}");

            // Step 3: 從回應中取得 ticket
            string? ticket = null;

            // 有些情況 ticket 在 redirect Location header
            if (loginResp.Headers.Location != null)
            {
                var loc = loginResp.Headers.Location.ToString();
                var ticketMatch = Regex.Match(loc, @"ticket=([^&]+)");
                if (ticketMatch.Success) ticket = ticketMatch.Groups[1].Value;
            }

            // 有些情況 ticket 在 HTML body
            if (ticket == null)
            {
                var ticketMatch = Regex.Match(loginBody, @"ticket=([A-Z0-9\-]+)");
                if (ticketMatch.Success) ticket = ticketMatch.Groups[1].Value;
            }

            if (string.IsNullOrEmpty(ticket))
            {
                // 檢查是否帳號密碼錯誤
                if (loginBody.Contains("Invalid") || loginBody.Contains("incorrect") ||
                    loginResp.StatusCode == HttpStatusCode.OK)
                {
                    _logger.LogError($"登入失敗，回應內容：{loginBody.Substring(0, Math.Min(loginBody.Length, 500))}");
                    return (false, "登入失敗：帳號或密碼錯誤，或需要雙因素驗證。");
                }
                return (false, $"無法從登入回應取得 ticket。狀態：{loginResp.StatusCode}");
            }

            _logger.LogInformation($"[Auth] 取得 ticket：{ticket.Substring(0, Math.Min(ticket.Length, 12))}...");

            // Step 4: 用 ticket 換 OAuth access token
            using var apiClient = new HttpClient();
            apiClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {ConsumerToken}");
            apiClient.DefaultRequestHeaders.Add("User-Agent", "com.garmin.android.apps.connectmobile");

            var exchangeUrl = $"https://connectapi.garmin.com/oauth-service/oauth/exchange/user/token";
            var exchangeBody = new StringContent(
                JsonSerializer.Serialize(new { ticket }),
                System.Text.Encoding.UTF8,
                "application/json");

            var exchangeResp = await apiClient.PostAsync(exchangeUrl, exchangeBody);
            var exchangeJson = await exchangeResp.Content.ReadAsStringAsync();

            _logger.LogInformation($"[Auth] Token 交換回應：{exchangeResp.StatusCode}, body={exchangeJson.Substring(0, Math.Min(exchangeJson.Length, 200))}");

            if (!exchangeResp.IsSuccessStatusCode)
                return (false, $"OAuth token 交換失敗 ({(int)exchangeResp.StatusCode})：{exchangeJson.Substring(0, Math.Min(exchangeJson.Length, 200))}");

            var tokenDoc = JsonDocument.Parse(exchangeJson);
            var root = tokenDoc.RootElement;

            _tokens = new GarminTokens
            {
                AccessToken = root.GetProperty("access_token").GetString() ?? "",
                RefreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() ?? "" : "",
                ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(
                    root.TryGetProperty("expires_in", out var exp) ? exp.GetInt32() : 3600)
            };

            _logger.LogInformation($"[Auth] 登入成功！AccessToken 長度={_tokens.AccessToken.Length}，有效至 {_tokens.ExpiresAt:HH:mm}");
            return (true, "");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Garmin 登入例外");
            return (false, $"登入例外：{ex.Message}");
        }
    }
}
