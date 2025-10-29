using IntakeFlowApi.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// --- API KEY (write-protect) ---
var apiKey = Environment.GetEnvironmentVariable("INTAKEFLOW_API_KEY") ?? "dev-12345";

// --- Controllers + EF Core (SQLite file) ---
builder.Services.AddControllers();

// Local file 'intakeflow.db' in app directory
var conn = builder.Configuration.GetConnectionString("Default")
           ?? "Data Source=intakeflow.db";
builder.Services.AddDbContext<IntakeFlowContext>(o => o.UseSqlite(conn));

builder.Services.AddCors(o =>
{
    o.AddPolicy("AllowAll", p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "IntakeFlow API", Version = "v1" });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// CORS for Vite dev server
app.UseCors("AllowAll");

// API key middleware for write routes
app.Use(async (ctx, next) =>
{
    var method = ctx.Request.Method.ToUpperInvariant();
    var isWrite = method is "POST" or "PUT" or "PATCH" or "DELETE";
    var isApi = ctx.Request.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase);

    if (isWrite && isApi)
    {
        if (!ctx.Request.Headers.TryGetValue("x-api-key", out var provided)
            || !string.Equals(provided.ToString(), apiKey, StringComparison.Ordinal))
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await ctx.Response.WriteAsync("Unauthorized: missing or invalid x-api-key");
            return;
        }
    }
    await next();
});

app.MapControllers();

// Ensure DB exists + create unique index; seed sample rows once
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<IntakeFlowContext>();
    db.Database.EnsureCreated();

    if (!db.Projects.Any())
    {
        db.Projects.AddRange(
            new Project {
                Name="General and Admin", Portfolio="Corporate", Status="InProgress",
                PlannerTaskId="PLN-001", StartDate=new DateTime(2024,1,1), EndDate=new DateTime(2027,12,31)
            },
            new Project {
                Name="Innovations", Portfolio="R&D", Status="Approved",
                PlannerTaskId="PLN-002", StartDate=new DateTime(2024,2,6), EndDate=new DateTime(2026,11,26)
            },
            new Project {
                Name="Information Technology Portfolio", Portfolio="IT", Status="InProgress",
                PlannerTaskId="PLN-003", StartDate=new DateTime(2024,12,19), EndDate=new DateTime(2026,3,19)
            }
        );
        db.SaveChanges();
    }
}

app.Run();
