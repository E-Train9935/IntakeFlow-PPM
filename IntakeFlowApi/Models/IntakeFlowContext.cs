using Microsoft.EntityFrameworkCore;

namespace IntakeFlowApi.Models
{
    public class IntakeFlowContext : DbContext
    {
        public IntakeFlowContext(DbContextOptions<IntakeFlowContext> options) : base(options) { }

        public DbSet<Project> Projects => Set<Project>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // UNIQUE index at the DB layer → no duplicate Task IDs
            modelBuilder.Entity<Project>()
                .HasIndex(p => p.PlannerTaskId)
                .IsUnique();

            // Reasonable max lengths (optional but good hygiene)
            modelBuilder.Entity<Project>().Property(p => p.Name).HasMaxLength(200);
            modelBuilder.Entity<Project>().Property(p => p.PlannerTaskId).HasMaxLength(100);
            modelBuilder.Entity<Project>().Property(p => p.Portfolio).HasMaxLength(100);
            modelBuilder.Entity<Project>().Property(p => p.Status).HasMaxLength(50);
        }
    }
}
