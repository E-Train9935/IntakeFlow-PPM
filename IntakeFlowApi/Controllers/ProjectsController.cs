using IntakeFlowApi.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IntakeFlowApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProjectsController : ControllerBase
    {
        private readonly IntakeFlowContext _db;

        private static readonly HashSet<string> AllowedStatuses = new(StringComparer.OrdinalIgnoreCase)
        {
            "Initiated","Approved","InProgress","OnHold","Completed","Rejected"
        };

        public ProjectsController(IntakeFlowContext db) => _db = db;

        // GET /api/Projects
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Project>>> GetAll()
        {
            var items = await _db.Projects.AsNoTracking()
                .OrderBy(p => p.Portfolio).ThenBy(p => p.StartDate).ToListAsync();
            return Ok(items);
        }

        // GET /api/Projects/{id}
        [HttpGet("{id:int}")]
        public async Task<ActionResult<Project>> GetById([FromRoute] int id)
            => await _db.Projects.FindAsync(id) is { } p ? Ok(p) : NotFound();

        // POST /api/Projects
        public record CreateProjectDto(
            string Name,
            string PlannerTaskId,
            string? Portfolio,
            DateTime? StartDate,
            DateTime? EndDate
        );

        [HttpPost]
        public async Task<ActionResult<Project>> Create([FromBody] CreateProjectDto dto)
        {
            if (dto is null || string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.PlannerTaskId))
                return BadRequest("Fields 'name' and 'plannerTaskId' are required.");

            if (dto.StartDate.HasValue && dto.EndDate.HasValue && dto.EndDate < dto.StartDate)
                return BadRequest("endDate cannot be earlier than startDate.");

            var entity = new Project
            {
                Name = dto.Name.Trim(),
                PlannerTaskId = dto.PlannerTaskId.Trim(),
                Portfolio = string.IsNullOrWhiteSpace(dto.Portfolio) ? "General" : dto.Portfolio.Trim(),
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                Status = "Initiated"
            };

            _db.Projects.Add(entity);

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (IsUniqueTaskIdViolation(ex))
            {
                return Conflict($"A project with PlannerTaskId '{entity.PlannerTaskId}' already exists.");
            }

            return Created($"/api/Projects/{entity.Id}", entity);
        }

        // PUT /api/Projects/{id}
        public record UpdateProjectDto(
            string Name,
            string PlannerTaskId,
            string Status,
            string? Portfolio,
            DateTime? StartDate,
            DateTime? EndDate
        );

        [HttpPut("{id:int}")]
        public async Task<ActionResult<Project>> Update([FromRoute] int id, [FromBody] UpdateProjectDto dto)
        {
            if (dto is null || string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.PlannerTaskId))
                return BadRequest("Fields 'name' and 'plannerTaskId' are required.");

            if (!AllowedStatuses.Contains(dto.Status?.Trim() ?? ""))
                return BadRequest($"Invalid status. Allowed: {string.Join(", ", AllowedStatuses)}");

            if (dto.StartDate.HasValue && dto.EndDate.HasValue && dto.EndDate < dto.StartDate)
                return BadRequest("endDate cannot be earlier than startDate.");

            var entity = await _db.Projects.FindAsync(id);
            if (entity is null) return NotFound($"Project {id} not found.");

            entity.Name = dto.Name.Trim();
            entity.PlannerTaskId = dto.PlannerTaskId.Trim();
            entity.Status = AllowedStatuses.First(s => s.Equals(dto.Status.Trim(), StringComparison.OrdinalIgnoreCase));
            entity.Portfolio = string.IsNullOrWhiteSpace(dto.Portfolio) ? "General" : dto.Portfolio.Trim();
            entity.StartDate = dto.StartDate;
            entity.EndDate = dto.EndDate;

            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (IsUniqueTaskIdViolation(ex))
            {
                return Conflict($"A project with PlannerTaskId '{entity.PlannerTaskId}' already exists.");
            }

            return Ok(entity);
        }

        // PUT /api/Projects/{id}/status
        public record UpdateStatusDto(string Status);

        [HttpPut("{id:int}/status")]
        public async Task<ActionResult<Project>> UpdateStatus([FromRoute] int id, [FromBody] UpdateStatusDto dto)
        {
            if (dto is null || string.IsNullOrWhiteSpace(dto.Status))
                return BadRequest("A non-empty 'status' is required.");
            if (!AllowedStatuses.Contains(dto.Status.Trim()))
                return BadRequest($"Invalid status. Allowed: {string.Join(", ", AllowedStatuses)}");

            var entity = await _db.Projects.FindAsync(id);
            if (entity is null) return NotFound($"Project {id} not found.");

            entity.Status = AllowedStatuses.First(s => s.Equals(dto.Status.Trim(), StringComparison.OrdinalIgnoreCase));
            await _db.SaveChangesAsync();
            return Ok(entity);
        }

        // DELETE /api/Projects/{id}
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete([FromRoute] int id)
        {
            var entity = await _db.Projects.FindAsync(id);
            if (entity is null) return NotFound();

            _db.Projects.Remove(entity);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private static bool IsUniqueTaskIdViolation(DbUpdateException ex)
        {
            // SQLite returns SqliteException with constraint name including 'UNIQUE' / index name
            return ex.InnerException?.Message?.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase) == true
                || ex.Message.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase);
        }
    }
}
