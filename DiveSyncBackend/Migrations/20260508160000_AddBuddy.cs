using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DiveSyncBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddBuddy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BuddyName",
                table: "Dives",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "BuddyName", table: "Dives");
        }
    }
}
