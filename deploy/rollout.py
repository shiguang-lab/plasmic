#!/usr/bin/env python3
"""Prepare the inactive runtime, check it, then reload the stable edge."""

import argparse
import fcntl
import os
from pathlib import Path
import re
import subprocess
import time


def active_web(config):
    matches = re.findall(r"http://(web(?:-next)?):808[012]", config)
    if len(matches) != 3 or len(set(matches)) != 1:
        raise ValueError("edge config must route all three ports to one release")
    return matches[0]


def switch_config(config, web):
    active_web(config)
    if web not in ("web", "web-next"):
        raise ValueError("invalid runtime slot")
    return re.sub(r"http://web(?:-next)?:808([012])", rf"http://{web}:808\1", config)


def initialize_edge(directory):
    edge = Path(directory) / "edge"
    template = (edge / "default.conf.template").read_text()
    # The active file is deployment state, never a release artifact. Copying a
    # new release must not silently reset the slot before it has been prepared.
    with (edge / "default.conf").open("x") as output:
        output.write(template)


class Deployment:
    def __init__(self, directory, tag):
        if not re.fullmatch(r"\d+\.\d+\.\d+", tag):
            raise ValueError("image tag must be a numeric release")
        self.directory = Path(directory)
        self.env = dict(os.environ, IMAGE_TAG=tag)

    def run(self, *args):
        return subprocess.check_output(args, cwd=self.directory, env=self.env, text=True)

    def compose(self, *args):
        return self.run("docker", "compose", "--profile", "rollout", *args)

    def healthy(self, service):
        container = self.compose("ps", "-q", service).strip()
        if not container:
            return False
        return self.run("docker", "inspect", "--format", "{{.State.Health.Status}}", container).strip() == "healthy"

    def wait(self, services):
        deadline = time.monotonic() + 240
        while not all(self.healthy(service) for service in services):
            if time.monotonic() >= deadline:
                raise RuntimeError("candidate did not become healthy; live release was retained")
            time.sleep(1)

    def probe(self, web):
        for url in (
            "http://127.0.0.1:8080/healthcheck",
            "http://127.0.0.1:8081/static/host.html",
            "http://127.0.0.1:8082/api/healthcheck",
        ):
            self.compose("exec", "-T", web, "wget", "-q", "-T", "5", "-O", "/dev/null", url)

    def install_edge(self, config):
        path = self.directory / "edge/default.conf"
        temporary = path.with_suffix(".pending")
        temporary.write_text(config)
        temporary.replace(path)
        self.compose("exec", "-T", "edge", "nginx", "-t")
        self.compose("exec", "-T", "edge", "nginx", "-s", "reload")

    def deploy(self):
        path = self.directory / "edge/default.conf"
        previous = path.read_text()
        env_file = self.directory / ".env"
        if len(re.findall(r"^IMAGE_TAG=.*$", env_file.read_text(), re.MULTILINE)) != 1:
            raise ValueError(".env must contain exactly one IMAGE_TAG")
        old_web = active_web(previous)
        suffix = "-next" if old_web == "web" else ""
        services = ["server" + suffix, "preview" + suffix, "web" + suffix]
        if not self.healthy("edge"):
            raise RuntimeError("install and verify the stable edge before using rolling upgrades")
        self.compose("pull", *services, "ai-worker")
        # Startup automatically runs migrations. Refuse schema changes before
        # starting a standby against the live database; those require maintenance.
        migrations = self.compose("run", "--rm", "--no-deps", services[0],
                                  "node_modules/typeorm/cli.js", "migration:show")
        migrations = re.sub(r"\x1b\[[0-9;]*m", "", migrations)
        if re.search(r"^\s*\[\s*\]", migrations, re.MULTILINE):
            raise RuntimeError("pending database migrations require a maintenance deployment")
        promoted = False
        try:
            self.compose("up", "-d", "--no-deps", *services)
            self.wait(services)
            self.probe(services[2])
            self.install_edge(switch_config(previous, services[2]))
            self.compose("exec", "-T", "edge", "wget", "-q", "-T", "5", "-O", "/dev/null",
                         "http://127.0.0.1:8080/healthcheck")
            promoted = True
        finally:
            if not promoted:
                try:
                    self.install_edge(previous)
                finally:
                    self.compose("stop", *services)
        # The worker always broadcasts through the stable edge to the active
        # server. Do not stop the previous runtime until traffic has switched.
        content = env_file.read_text()
        content, count = re.subn(r"^IMAGE_TAG=.*$", "IMAGE_TAG=" + self.env["IMAGE_TAG"], content, flags=re.MULTILINE)
        if count != 1:
            raise RuntimeError("active release switched, but .env must contain exactly one IMAGE_TAG")
        temporary = env_file.with_suffix(".pending")
        with os.fdopen(os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as output:
            os.fchmod(output.fileno(), env_file.stat().st_mode & 0o777)
            output.write(content)
        temporary.replace(env_file)
        self.compose("up", "-d", "--no-deps", "ai-worker")
        old_suffix = "-next" if old_web == "web-next" else ""
        self.compose("stop", "web" + old_suffix, "preview" + old_suffix, "server" + old_suffix)
        print(f"Active runtime: {services[2]}; image: {self.env['IMAGE_TAG']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tag", nargs="?")
    parser.add_argument("--init", action="store_true", help="initialize the edge once, before first startup")
    args = parser.parse_args()
    if bool(args.tag) == args.init:
        parser.error("provide either a numeric release tag or --init")
    directory = Path(__file__).resolve().parent
    with (directory / ".rollout.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.init:
            initialize_edge(directory)
        else:
            Deployment(directory, args.tag).deploy()


if __name__ == "__main__":
    main()
