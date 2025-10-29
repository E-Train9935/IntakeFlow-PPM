using Microsoft.EntityFrameworkCore;
using IntakeFlowApi.Models;

namespace IntakeFlowApi.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }
        public DbSet<Project> Projects { get; set; } = default!;
    }
}
