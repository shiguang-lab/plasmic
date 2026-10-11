from pathlib import Path
import json
p=Path(__file__).parent
base=p.parent/'consistent-v2'
source=(base/'ui.js').read_text().split('let output;')[0]
(p/'base.js').write_text(source)
(p/'screen.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="stylesheet" href="../consistent-v2/ui.css"><link rel="stylesheet" href="v3.css"><div id="root"></div><script src="base.js"></script><script src="v3.js"></script></html>''')
