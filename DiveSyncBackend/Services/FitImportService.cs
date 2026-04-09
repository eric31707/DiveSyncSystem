using DiveSyncBackend.Controllers;

namespace DiveSyncBackend.Services;

public sealed class FitImportService
{
    private readonly ILogger<FitImportService> _logger;
    private readonly IConfiguration _configuration;

    public FitImportService(ILogger<FitImportService> logger, IConfiguration configuration)
    {
        _logger = logger;
        _configuration = configuration;
    }

    public (int Imported, int Failed, string Directory) ImportConfiguredDirectory(string? overrideDirectory = null)
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

        DataStore.Dives.Clear();
        DataStore.Telemetries.Clear();
        DataStore.NextId = 1;

        var imported = 0;
        var failed = 0;
        var skipped = 0;

        foreach (var file in files)
        {
            try
            {
                using var stream = File.OpenRead(file);
                var dive = DivesController.ParseAndImportStreamCore(stream, Path.GetFileName(file));

                if (ShouldSkipAsNoise(dive, maxNoiseDepthMeters, maxNoiseDurationMinutes))
                {
                    DataStore.Dives.RemoveAll(d => d.Id == dive.Id);
                    DataStore.Telemetries.Remove(dive.Id);
                    skipped++;
                    continue;
                }

                imported++;
            }
            catch (DuplicateDiveException)
            {
                skipped++;
            }
            catch (Exception ex)
            {
                failed++;
                _logger.LogWarning(ex, "Failed to import FIT file {File}", file);
            }
        }

        if (imported == 0)
        {
            DataStore.Dives.Add(new DiveSummary { Id = 1, Site = "Import failed", Date = DateTime.Today.ToString("yyyy-MM-dd"), MaxDepth = 0, Duration = 0, Temp = 0 });
            DataStore.NextId = 2;
        }

        _logger.LogInformation(
            "FIT import completed from {Directory}. Imported: {Imported}, Failed: {Failed}, Skipped: {Skipped}",
            directory,
            imported,
            failed,
            skipped);

        return (imported, failed, directory);
    }

    private static bool ShouldSkipAsNoise(DiveSummary dive, double maxNoiseDepthMeters, int maxNoiseDurationMinutes)
    {
        return dive.MaxDepth <= maxNoiseDepthMeters && dive.Duration <= maxNoiseDurationMinutes;
    }
}
