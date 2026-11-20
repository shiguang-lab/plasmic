"""Publish the verified CI beta archive into the NAS Desktop update directory."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import tarfile
import tempfile


def publish(archive, directory):
    directory.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=directory, prefix=".staging-") as temporary:
        staged = Path(temporary) / "release"
        staged.mkdir(mode=0o755)
        with tarfile.open(archive, "r:gz") as bundle:
            for entry in bundle:
                relative = Path(entry.name)
                if relative.is_absolute() or ".." in relative.parts:
                    raise ValueError("Invalid distribution path")
                if entry.isdir():
                    continue
                if not entry.isfile():
                    raise ValueError("Expected a regular distribution file")
                target = staged / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                with bundle.extractfile(entry) as source, target.open("xb") as output:
                    shutil.copyfileobj(source, output)

        version = json.loads((staged / "latest.json").read_text())["version"]
        number = r"(?:0|[1-9][0-9]*)"
        if not re.fullmatch(rf"{number}\.{number}\.{number}-beta\.{number}", version):
            raise ValueError("Expected a numbered beta release")
        if archive.name != f"desktop-beta-{version}.tar.gz":
            raise ValueError("Archive name and embedded version differ")
        for platform, arch, manifest in [
            ("darwin", "arm64", "latest-mac.yml"), ("darwin", "x64", "latest-mac.yml"),
            ("linux", "x64", "latest-linux.yml"), ("win32", "x64", "latest.yml"),
        ]:
            if not (staged / platform / arch / manifest).is_file():
                raise ValueError(f"Missing {platform}/{arch}/{manifest}")
        # One same-filesystem rename exposes every platform at once. An existing
        # published directory is nonempty, so concurrent retries cannot replace it.
        destination = directory / version
        os.rename(staged, destination)
        return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--directory", type=Path, default=Path(__file__).resolve().parent / "desktop-beta")
    args = parser.parse_args()
    os.umask(0o022)  # The read-only server container reads the published files.
    print(publish(args.archive, args.directory))
