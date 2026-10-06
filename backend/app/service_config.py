"""Non-secret service addresses for the Windows development launcher."""
import json
from app.core.settings import settings

if __name__ == "__main__":
    print(json.dumps({"path": str(settings.STORAGE_ROOT / "chroma"),
                      "host": settings.CHROMA_HOST, "port": settings.CHROMA_PORT}))
