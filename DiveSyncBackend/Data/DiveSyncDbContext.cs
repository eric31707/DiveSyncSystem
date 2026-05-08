using DiveSyncBackend.Models;
using Microsoft.EntityFrameworkCore;

namespace DiveSyncBackend.Data;

public class DiveSyncDbContext : DbContext
{
    public DiveSyncDbContext(DbContextOptions<DiveSyncDbContext> options) : base(options) { }

    public DbSet<DiveSummary> Dives => Set<DiveSummary>();
    public DbSet<TelemetryPoint> TelemetryPoints => Set<TelemetryPoint>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DiveSummary>(entity =>
        {
            entity.HasIndex(e => e.Date);
            entity.HasIndex(e => new { e.Date, e.MaxDepth, e.Duration, e.Temp })
                  .HasDatabaseName("IX_Dives_DuplicateCheck");
        });

        modelBuilder.Entity<TelemetryPoint>(entity =>
        {
            entity.HasIndex(e => e.DiveId);
            entity.HasOne(e => e.Dive)
                  .WithMany(d => d.TelemetryPoints)
                  .HasForeignKey(e => e.DiveId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
