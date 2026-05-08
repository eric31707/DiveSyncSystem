using DiveSyncBackend.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 載入不會被 git 追蹤的本機設定（Garmin credentials、FIT 目錄等）
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// 註冊資料庫 (SQL Server)
builder.Services.AddDbContext<DiveSyncBackend.Data.DiveSyncDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── CORS ──
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactDev", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",
                "https://localhost:5173",
                "http://127.0.0.1:5173",
                "https://127.0.0.1:5173",
                "http://localhost:5174",
                "https://localhost:5174",
                "http://127.0.0.1:5174",
                "https://127.0.0.1:5174")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSingleton<FitImportService>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();

app.UseCors("ReactDev");
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<DiveSyncBackend.Data.DiveSyncDbContext>();

    // 確保 migration history 表存在
    await db.Database.ExecuteSqlRawAsync(@"
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '__EFMigrationsHistory')
        CREATE TABLE __EFMigrationsHistory (
            MigrationId    nvarchar(150) NOT NULL,
            ProductVersion nvarchar(32)  NOT NULL,
            CONSTRAINT PK___EFMigrationsHistory PRIMARY KEY (MigrationId)
        )");

    // Dives 表已存在但 InitialCreate 沒記錄 → 補上（手動建表或舊版資料庫的情況）
    await db.Database.ExecuteSqlRawAsync(@"
        IF EXISTS     (SELECT 1 FROM sys.tables WHERE name = 'Dives')
           AND NOT EXISTS (SELECT 1 FROM __EFMigrationsHistory WHERE MigrationId = '20260508123138_InitialCreate')
        INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion)
        VALUES ('20260508123138_InitialCreate', '8.0.17')");

    // AvgDepth 欄位已存在但 AddSacFields 沒記錄 → 補上（手動 ALTER TABLE 的情況）
    await db.Database.ExecuteSqlRawAsync(@"
        IF EXISTS     (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Dives') AND name = 'AvgDepth')
           AND NOT EXISTS (SELECT 1 FROM __EFMigrationsHistory WHERE MigrationId = '20260508140000_AddSacFields')
        INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion)
        VALUES ('20260508140000_AddSacFields', '8.0.17')");

    // 只套用尚未記錄在 history 的 migration（已套用的就跳過，速度很快）
    await db.Database.MigrateAsync();

    // DB 已有資料就跳過，避免每次啟動都掃 FIT 目錄
    // 需要重匯時請呼叫 POST /api/dives/reset-and-reimport
    var hasData = await db.Dives.AnyAsync();
    if (!hasData)
    {
        var fitImportService = scope.ServiceProvider.GetRequiredService<FitImportService>();
        await fitImportService.ImportConfiguredDirectoryAsync();
    }
}

app.Run();
