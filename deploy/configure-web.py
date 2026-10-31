import hashlib
import os
import re
from pathlib import Path
from urllib.parse import urlsplit


TEXT_TYPES = (".html", ".js", ".css", ".map", ".json")


def configure_web(source_root, target_root, studio_origin, canvas_origin):
    replacements = {}
    for placeholder, value in (
        ("http://plasmic-origin.invalid", studio_origin),
        ("http://canvas-origin.invalid", canvas_origin),
    ):
        origin = value.rstrip("/")
        parsed = urlsplit(origin)
        if parsed.scheme not in ("http", "https") or not parsed.netloc or parsed.path or parsed.query or parsed.fragment:
            raise ValueError("STUDIO_ORIGIN and CANVAS_ORIGIN must be HTTP(S) origins")
        replacements[placeholder.encode()] = origin.encode()

    targets = set()
    for source in source_root.rglob("*"):
        if not source.is_file():
            continue
        target = target_root / source.relative_to(source_root)
        target.parent.mkdir(parents=True, exist_ok=True)
        data = source.read_bytes()
        if source.suffix in TEXT_TYPES:
            for original, replacement in replacements.items():
                data = data.replace(original, replacement)
        target.write_bytes(data)
        targets.add(target)

    # Deployment origins are rendered before the immutable Host identity is set.
    # Leave previous content-addressed files intact for already-open clients.
    host_names = {}
    for target in list(targets):
        if target.parent != target_root / "static" or not re.fullmatch(r"host\.[a-f0-9]{64}\.html", target.name):
            continue
        name = "host." + hashlib.sha256(target.read_bytes()).hexdigest() + ".html"
        if name != target.name:
            host_names[target.name.encode()] = name.encode()
            renamed = target.with_name(name)
            target.replace(renamed)
            targets.remove(target)
            targets.add(renamed)
    for target in targets:
        if target.suffix not in TEXT_TYPES or not host_names:
            continue
        data = target.read_bytes()
        for original, replacement in host_names.items():
            data = data.replace(original, replacement)
        target.write_bytes(data)


if __name__ == "__main__":
    configure_web(Path("/opt/plasmic-web"), Path("/usr/share/nginx/html"),
                  os.environ["STUDIO_ORIGIN"], os.environ["CANVAS_ORIGIN"])
