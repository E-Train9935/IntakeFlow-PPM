using System.ComponentModel.DataAnnotations;

namespace IntakeFlowApi.Models
{
    public class Project
    {
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = default!;

        // Portfolio health/lifecycle
        [Required]
        public string Status { get; set; } = "Initiated";

        // Must be globally unique
        [Required]
        public string PlannerTaskId { get; set; } = default!;

        [Required]
        public string Portfolio { get; set; } = "General";

        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }
}
