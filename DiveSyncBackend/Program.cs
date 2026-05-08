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
    await db.Database.MigrateAsync();

    var fitImportService = scope.ServiceProvider.GetRequiredService<FitImportService>();
    await fitImportService.ImportConfiguredDirectoryAsync();
}

app.Run();
