using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace DiveSyncBackend.Models;

[Table("TelemetryPoints")]
public class TelemetryPoint
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public long Id { get; set; }

    public int DiveId { get; set; }

    [JsonIgnore]
    [ForeignKey(nameof(DiveId))]
    public DiveSummary? Dive { get; set; }

    public double Time { get; set; }
    public double Depth { get; set; }
    public double Temperature { get; set; }
    public double? HeartRate { get; set; }
    public double? Lat { get; set; }
    public double? Lng { get; set; }
}
