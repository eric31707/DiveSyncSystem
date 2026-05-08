using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DiveSyncBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Visibility",
                table: "Dives",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Visibility", table: "Dives");
        }
    }
}
