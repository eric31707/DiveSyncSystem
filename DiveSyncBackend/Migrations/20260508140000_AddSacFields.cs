using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DiveSyncBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddSacFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "AvgDepth",
                table: "Dives",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "TankVolume",
                table: "Dives",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "StartPressure",
                table: "Dives",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "EndPressure",
                table: "Dives",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "AvgDepth", table: "Dives");
            migrationBuilder.DropColumn(name: "TankVolume", table: "Dives");
            migrationBuilder.DropColumn(name: "StartPressure", table: "Dives");
            migrationBuilder.DropColumn(name: "EndPressure", table: "Dives");
        }
    }
}
