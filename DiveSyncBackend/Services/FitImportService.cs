using DiveSyncBackend.Controllers;
using DiveSyncBackend.Data;
using DiveSyncBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace DiveSyncBackend.Services;

public sealed class FitImportService
{
    private readonly ILogger<FitImportService> _logger;
    private readonly IConfiguration _configuration;
    private readonly IServiceScopeFactory _scopeFactory;

    public FitImportService(
        ILogger<FitImportService> logger,
        IConfiguration configuration,
        IServiceScopeFactory scopeFactory)
    {
        _logger = logger;
        _configuration = configuration;
        _scopeFactory = scopeFactory;
    }

    public async Task<(int Imported, int Failed, string Directory)> ImportConfiguredDirectoryAsync(string? overrideDirectory = null)
    {
        var directory = string.IsNullOrWhiteSpace(overrideDirectory)
            ? _configuration["FitImport:Directory"]
            : overrideDirectory;
        var maxNoiseDepthMeters = _configuration.GetValue<double?>("FitImport:NoiseFilter:MaxDepthMeters") ?? 3.0;
        var maxNoiseDurationMinutes = _configuration.GetValue<int?>("FitImport:NoiseFilter:MaxDurationMinutes") ?? 5;

        if (string.IsNullOrWhiteSpace(directory))
        {
            _logger.LogInformation("FIT import skipped because no directory is configured.");
            return (0, 0, "");
        }

        if (!Directory.Exists(directory))
        {
            _logger.LogWarning("FIT import directory does not exist: {Directory}", directory);
            return (0, 0, directory);
        }

        var files = Directory.GetFiles(directory, "*.fit", SearchOption.TopDirectoryOnly)
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (files.Length == 0)
        {
            _logger.LogInformation("No FIT files found in {Directory}", directory);
            return (0, 0, directory);
        }

        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DiveSyncDbContext>();

        var imported = 0;
        var failed = 0;
        var skipped = 0;

        foreach (var file in files)
        {
            try
            {
                using var stream = File.OpenRead(file);
                var (dive, points) = DivesController.ParseFitStream(stream, Path.GetFileName(file));

                // 噪音過濾
                if (dive.MaxDepth <= maxNoiseDepthMeters && dive.Duration <= maxNoiseDurationMinutes)
                {
                    skipped++;
                    continue;
                }

                // 重複偵測
                var isDuplicate = await db.Dives.AnyAsync(existing =>
                    existing.Site == dive.Site &&
                    existing.Date == dive.Date &&
                    existing.Duration == dive.Duration &&
                    Math.Abs(existing.MaxDepth - dive.MaxDepth) < 0.05 &&
                    Math.Abs(existing.Temp - dive.Temp) < 0.05);

                if (isDuplicate)
                {
                    skipped++;
                    continue;
                }

                db.Dives.Add(dive);
                await db.SaveChangesAsync();

                foreach (var p in points)
                    p.DiveId = dive.Id;

                db.TelemetryPoints.AddRange(points);
                await db.SaveChangesAsync();

                imported++;
            }
            catch (Exception ex)
            {
                failed++;
                _logger.LogWarning(ex, "Failed to import FIT file {File}", file);
            }
        }

        _logger.LogInformation(
            "FIT import completed from {Directory}. Imported: {Imported}, Failed: {Failed}, Skipped: {Skipped}",
            directory, imported, failed, skipped);

        return (imported, failed, directory);
    }
}
