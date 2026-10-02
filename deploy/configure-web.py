import os
from pathlib import Path
from urllib.parse import urlsplit
origin = os.environ["STUDIO_ORIGIN"].rstrip("/")
parsed = urlsplit(origin)
if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.path or parsed.query or parsed.fragment:
    raise ValueError("STUDIO_ORIGIN must be an HTTP(S) origin")
for source in Path("/opt/plasmic-web").rglob("*"):
    if source.is_file():
        target = Path("/usr/share/nginx/html") / source.relative_to("/opt/plasmic-web")
        target.parent.mkdir(parents=True, exist_ok=True)
        data = source.read_bytes()
        if source.suffix in (".html", ".js", ".css", ".map", ".json"):
            data = data.replace(b"http://plasmic-origin.invalid", origin.encode())
        target.write_bytes(data)
