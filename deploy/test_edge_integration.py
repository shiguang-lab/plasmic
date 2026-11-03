"""Run with RUN_DOCKER_INTEGRATION=1 against isolated Docker fixtures."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.request

spec = importlib.util.spec_from_file_location("rollout", Path(__file__).with_name("rollout.py"))
rollout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rollout)


@unittest.skipUnless(os.environ.get("RUN_DOCKER_INTEGRATION") == "1", "Docker integration is opt-in")
class EdgeIntegrationTest(unittest.TestCase):
    @classmethod
    def docker(cls, *args):
        return subprocess.check_output(["docker", *args], text=True, stderr=subprocess.STDOUT).strip()

    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temporary.name)
        cls.network = f"plasmic-rollout-test-{os.getpid()}"
        cls.containers = []
        cls.http = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        cls.addClassCleanup(cls.cleanup)
        cls.docker("network", "create", cls.network)
        for suffix, label in [("", "current"), ("-next", "next")]:
            backend = cls.root / f"backend{suffix}.conf"
            backend.write_text('server { listen 3004; listen 3011; location / { return 200 "' + label + ':$request_uri"; } }')
            cls.start("backend" + suffix, ["server" + suffix, "preview" + suffix], backend)
            static = cls.root / ("static" + suffix)
            (static / "static").mkdir(parents=True)
            (static / "static/host.html").write_text("fixture-host")
            cls.start("web" + suffix, ["web" + suffix], Path(__file__).with_name("nginx.conf"),
                      ["--hostname", "web" + suffix, "-v", f"{static}:/usr/share/nginx/html:ro"])
        edge = cls.root / "edge"
        edge.mkdir()
        cls.config = edge / "default.conf"
        cls.config.write_text(Path(__file__).with_name("edge").joinpath("default.conf.template").read_text())
        cls.start("edge", [], edge, ["-p", "127.0.0.1::8080"], directory=True)
        cls.port = cls.docker("port", cls.containers[-1], "8080/tcp").rsplit(":", 1)[1]
        for _ in range(100):
            try:
                if cls.get("/healthcheck").startswith("current:"):
                    break
            except Exception:
                time.sleep(0.1)
        else:
            raise RuntimeError("fixture did not become ready")

    @classmethod
    def start(cls, name, aliases, config, extra=(), directory=False):
        container = f"{cls.network}-{name}"
        cls.containers.append(container)
        target = "/etc/nginx/conf.d" if directory else "/etc/nginx/conf.d/default.conf"
        args = ["run", "-d", "--name", container, "--network", cls.network]
        for alias in aliases:
            args.extend(["--network-alias", alias])
        cls.docker(*args, "-v", f"{config}:{target}:ro", *extra, "nginx:1.29-alpine")

    @classmethod
    def get(cls, path):
        with cls.http.open(f"http://127.0.0.1:{cls.port}{path}", timeout=2) as response:
            return response.read().decode()

    @classmethod
    def cleanup(cls):
        for name in reversed(cls.containers):
            subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["docker", "network", "rm", cls.network], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cls.temporary.cleanup()

    def test_cutover_keeps_serving_requests_and_preserves_path_and_query(self):
        path = "/api/v1/projects?query=%22all%22"
        self.assertEqual(self.get(path), "current:" + path)
        observed = []
        failures = []
        stop = threading.Event()

        def read():
            while not stop.is_set():
                try:
                    observed.append(self.get(path))
                except Exception as error:
                    failures.append(str(error))

        thread = threading.Thread(target=read)
        thread.start()
        try:
            self.config.write_text(rollout.switch_config(self.config.read_text(), "web-next"))
            self.docker("exec", self.containers[-1], "nginx", "-t")
            self.docker("exec", self.containers[-1], "nginx", "-s", "reload")
            deadline = time.monotonic() + 5
            while "next:" + path not in observed:
                if time.monotonic() > deadline:
                    self.fail("new release did not receive traffic")
                time.sleep(0.01)
        finally:
            stop.set()
            thread.join()
        self.assertFalse(failures, failures)
        self.assertTrue(observed)
        self.assertTrue(all(body in ["current:" + path, "next:" + path] for body in observed))

    def test_z_healthcheck_fails_when_backend_is_down_even_if_static_files_work(self):
        web = f"{self.network}-web-next"
        self.docker("stop", f"{self.network}-backend-next")
        self.docker("exec", web, "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/static/host.html")
        with self.assertRaises(subprocess.CalledProcessError):
            self.docker("exec", web, "wget", "-q", "-T", "2", "-O", "/dev/null", "http://127.0.0.1:8080/healthcheck")


if __name__ == "__main__":
    unittest.main()
