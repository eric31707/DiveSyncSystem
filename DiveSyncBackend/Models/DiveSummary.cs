using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DiveSyncBackend.Models;

[Table("Dives")]
public class DiveSummary
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [MaxLength(200)]
    public string Site { get; set; } = string.Empty;

    [MaxLength(10)]
    public string Date { get; set; } = string.Empty;

    public double MaxDepth { get; set; }
    public int Duration { get; set; }
    public double Temp { get; set; }
    public double? MaxHeartRate { get; set; }
    public double? AvgHeartRate { get; set; }
    public double? EntryLat { get; set; }
    public double? EntryLng { get; set; }
    public double? ExitLat { get; set; }
    public double? ExitLng { get; set; }

    public double? AvgDepth { get; set; }
    public double? TankVolume { get; set; }
    public double? StartPressure { get; set; }
    public double? EndPressure { get; set; }
    public double? Visibility { get; set; }

    [MaxLength(200)]
    public string? BuddyName { get; set; }

    [MaxLength(2000)]
    public string? Notes { get; set; }

    [MaxLength(50)]
    public string? Mood { get; set; }

    public ICollection<TelemetryPoint> TelemetryPoints { get; set; } = new List<TelemetryPoint>();
}
