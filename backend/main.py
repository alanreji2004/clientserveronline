from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import projects, sessions, ws, system

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Browser-based IDE with concurrent multi-process execution and socket networking for Python and C."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(sessions.router)
app.include_router(ws.router)
app.include_router(system.router)

@app.get("/")
def root():
    return {
        "message": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
        "api_endpoints": {
            "projects": "/api/projects",
            "sessions": "/api/sessions",
            "system_health": "/api/system/health"
        }
    }

if __name__ == "__main__":
    import uvicorn
    # reload is set to False so writing files in data/workspaces does not restart the backend
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)

