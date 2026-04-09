using DiveSyncBackend.Services;
using Microsoft.AspNetCore.Mvc;

namespace DiveSyncBackend.Controllers;

[ApiController]
[Route("api/fit-import")]
public class FitImportController : ControllerBase
{
    public sealed class FitImportRescanRequest
    {
        public string? Directory { get; set; }
    }

    [HttpPost("rescan")]
    public IActionResult Rescan(
        [FromBody] FitImportRescanRequest? request,
        [FromServices] FitImportService fitImportService,
        [FromServices] IConfiguration configuration)
    {
        var (imported, failed, directory) = fitImportService.ImportConfiguredDirectory(request?.Directory);
        var effectiveDirectory = string.IsNullOrWhiteSpace(directory)
            ? configuration["FitImport:Directory"] ?? ""
            : directory;

        return Ok(new
        {
            Success = true,
            Directory = effectiveDirectory,
            Imported = imported,
            Failed = failed,
            TotalDives = DataStore.Dives.Count
        });
    }
}
