using DiveSyncBackend.Data;
using DiveSyncBackend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
    public async Task<IActionResult> Rescan(
        [FromBody] FitImportRescanRequest? request,
        [FromServices] FitImportService fitImportService,
        [FromServices] IConfiguration configuration,
        [FromServices] DiveSyncDbContext db)
    {
        var (imported, failed, directory) = await fitImportService.ImportConfiguredDirectoryAsync(request?.Directory);
        var effectiveDirectory = string.IsNullOrWhiteSpace(directory)
            ? configuration["FitImport:Directory"] ?? ""
            : directory;

        var totalDives = await db.Dives.CountAsync();

        return Ok(new
        {
            Success = true,
            Directory = effectiveDirectory,
            Imported = imported,
            Failed = failed,
            TotalDives = totalDives
        });
    }
}
