import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("rollout", Path(__file__).with_name("rollout.py"))
rollout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rollout)


class FakeDeployment(rollout.Deployment):
    def __init__(self, directory, fail=None):
        super().__init__(directory, "0.6.5")
        self.calls = []
        self.fail = fail

    def compose(self, *args):
        self.calls.append(args)
        if args[0] == "run":
            return "[ ] pending migration" if self.fail == "migration" else "[X] applied migration"
        return ""

    def healthy(self, service):
        return True

    def wait(self, services):
        if self.fail == "startup":
            raise RuntimeError("candidate unhealthy")

    def probe(self, web):
        if self.fail == "probe":
            raise RuntimeError("preview broken")

    def install_edge(self, config):
        self.calls.append(("switch", rollout.active_web(config)))
        if self.fail == "switch" and rollout.active_web(config) == "web-next":
            raise RuntimeError("reload rejected")
        (self.directory / "edge/default.conf").write_text(config)


class RolloutTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.edge = self.directory / "edge/default.conf"
        self.edge.parent.mkdir()
        self.original = Path(__file__).with_name("edge").joinpath("default.conf.template").read_text()
        self.edge.write_text(self.original)
        (self.directory / ".env").write_text("IMAGE_TAG=0.6.4\nPRIVATE_SETTING=preserved\n")

    def test_switches_all_origins_before_stopping_old_release(self):
        deployment = FakeDeployment(self.directory)
        deployment.deploy()
        self.assertEqual(rollout.active_web(self.edge.read_text()), "web-next")
        self.assertLess(deployment.calls.index(("switch", "web-next")),
                        deployment.calls.index(("stop", "web", "preview", "server")))
        self.assertIn(("up", "-d", "--no-deps", "server-next", "preview-next", "web-next"), deployment.calls)
        self.assertEqual((self.directory / ".env").read_text(), "IMAGE_TAG=0.6.5\nPRIVATE_SETTING=preserved\n")

    def test_next_upgrade_returns_to_original_slot(self):
        self.edge.write_text(rollout.switch_config(self.original, "web-next"))
        deployment = FakeDeployment(self.directory)
        deployment.deploy()
        self.assertEqual(rollout.active_web(self.edge.read_text()), "web")
        self.assertIn(("stop", "web-next", "preview-next", "server-next"), deployment.calls)

    def test_pending_migrations_never_start_candidate_or_change_live_release(self):
        deployment = FakeDeployment(self.directory, "migration")
        with self.assertRaisesRegex(RuntimeError, "maintenance"):
            deployment.deploy()
        self.assertFalse(any(c[0] in ("switch", "stop", "up") for c in deployment.calls))
        self.assertEqual(self.edge.read_text(), self.original)

    def test_candidate_failures_restore_edge_and_only_stop_candidate(self):
        for failure in ("startup", "probe", "switch"):
            with self.subTest(failure=failure):
                deployment = FakeDeployment(self.directory, failure)
                with self.assertRaises(RuntimeError):
                    deployment.deploy()
                self.assertEqual(self.edge.read_text(), self.original)
                stops = [c for c in deployment.calls if c[0] == "stop"]
                self.assertEqual(stops, [("stop", "server-next", "preview-next", "web-next")])

    def test_rejects_mixed_origins_and_untrusted_target(self):
        with self.assertRaises(ValueError):
            rollout.active_web(self.original.replace("web:8081", "web-next:8081"))
        with self.assertRaises(ValueError):
            rollout.switch_config(self.original, "external.example")
        with self.assertRaises(ValueError):
            rollout.Deployment(self.directory, "latest; stop")

    def test_invalid_env_fails_before_any_deployment_operation(self):
        (self.directory / ".env").write_text("IMAGE_TAG=first\nIMAGE_TAG=second\n")
        deployment = FakeDeployment(self.directory)
        with self.assertRaises(ValueError):
            deployment.deploy()
        self.assertEqual(deployment.calls, [])

    def test_initialization_never_overwrites_active_slot(self):
        template = self.edge.with_name("default.conf.template")
        template.write_text(self.original)
        self.edge.unlink()
        rollout.initialize_edge(self.directory)
        self.assertEqual(self.edge.read_text(), self.original)
        switched = rollout.switch_config(self.original, "web-next")
        self.edge.write_text(switched)
        with self.assertRaises(FileExistsError):
            rollout.initialize_edge(self.directory)
        self.assertEqual(self.edge.read_text(), switched)


if __name__ == "__main__":
    unittest.main()
