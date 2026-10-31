import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("configure_web", Path(__file__).with_name("configure-web.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ConfigureWebTest(unittest.TestCase):
    def test_host_hash_tracks_rendered_origins_and_previous_files_stay_immutable(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source, target = root / "source", root / "target"
            (source / "static").mkdir(parents=True)
            html = b'<a href="http://plasmic-origin.invalid">Studio</a>'
            original = "host." + hashlib.sha256(html).hexdigest() + ".html"
            (source / "static" / original).write_bytes(html)
            (source / "static" / "host.html").write_bytes(html)
            (source / "app.js").write_text(f'const host="/static/{original}";const defaultHost="http://canvas-origin.invalid/static/host.html";')

            def configure(studio):
                module.configure_web(source, target, studio, "https://canvas.example")
                body = html.replace(b"http://plasmic-origin.invalid", studio.encode())
                name = "host." + hashlib.sha256(body).hexdigest() + ".html"
                self.assertEqual((target / "static" / name).read_bytes(), body)
                self.assertIn(name, (target / "app.js").read_text())
                self.assertIn("https://canvas.example/static/host.html", (target / "app.js").read_text())
                self.assertFalse((target / "static" / original).exists())
                self.assertEqual((target / "static" / "host.html").read_bytes(), body)
                return name, body

            first, first_body = configure("https://studio.example")
            self.assertEqual(configure("https://studio.example"), (first, first_body))
            second, _ = configure("https://another-studio.example")
            self.assertNotEqual(first, second)
            self.assertEqual((target / "static" / first).read_bytes(), first_body)

    def test_rejects_non_origin_configuration_before_writing(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with self.assertRaises(ValueError):
                module.configure_web(root / "source", root / "target", "https://studio.example/path", "https://canvas.example")
            self.assertFalse((root / "target").exists())


if __name__ == "__main__":
    unittest.main()
