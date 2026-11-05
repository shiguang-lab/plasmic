"""Verify archived metrics and evidence hashes without running the model."""
import hashlib
import json
import math
from pathlib import Path

folder = Path(__file__).resolve().parent
manifest = json.loads((folder / 'manifest.json').read_text())
for name, expected in manifest['evidenceSha256'].items():
    actual = hashlib.sha256((folder / name).read_bytes()).hexdigest()
    assert actual == expected, f'Evidence changed: {name}'
native = json.loads((folder / 'native-final.json').read_text())
assert native['corpusSha256'] == 'b7191a546a488cc1b8ac0dec708e342938b3d6a494db557dcb636d1a2dafcdd4'
results = native['retrieval']['results']
positives = [row for row in results if row['expected']]
assert len(positives) == native['retrieval']['positiveCases'] == 37
hits = sum(any(c['componentUuid'] in row['expected'] for c in row['candidates']) for row in positives)
assert hits == native['retrieval']['hitAt3'] == 30
assert native['retrieval']['negativeSuggestions'] == [row['id'] for row in results if not row['expected'] and row['candidates']]
assert native['coldCounters']['documentEmbeddings'] == 154
assert native['incremental']['documentEmbeddings'] == 1
for row in native['warmReopen']:
    assert row['documentEmbeddings'] == row['queryEmbeddings'] == 0
    assert row['indexed'] == row['total'] == 101
    assert row['nativeStarted'] is False
warm = native['warmQuery']
values = sorted(row['elapsedMs'] for row in warm['samples'])
assert len(values) == 30
assert warm['p50Ms'] == values[math.ceil(len(values) * .5) - 1]
assert warm['p95Ms'] == values[math.ceil(len(values) * .95) - 1]
assert warm['counters']['queryEmbeddings'] == 10
assert warm['counters']['queryCacheHits'] == 22
registrations = json.loads((folder / 'registrations.json').read_text())
# The simplified parameter carries exactly the same retrieval text as the archived run.
current_cases = json.loads((folder.parents[2] / 'desktop/tests/performance/component-reuse-cases.json').read_text())
def retrieval_text(item):
    interaction = item.get('interaction')
    parts = [item['purpose']]
    if interaction:
        parts.append(interaction['action'] + '\uff1b' + interaction['result'])
    return '\u3002'.join(parts + item.get('constraints', []))
assert len(current_cases) == len(registrations['cases']) == 10
for current, archived in zip(current_cases, registrations['cases']):
    assert current['id'] == archived['id']
    assert current['purpose'] == retrieval_text(archived)
    assert current['retrieval']['purpose'] == retrieval_text(archived['retrieval'])
assert registrations['unchangedContracts'] is True
before, after = registrations['before'], registrations['after']
assert before['catalogueCount'] == after['catalogueCount'] == 126
assert before['described'] == 11 and after['described'] == 39
changed = []
for old, new in zip(before['documents'], after['documents']):
    for key in ['componentUuid', 'name', 'fromProject', 'props', 'slots', 'events', 'parent']:
        assert old.get(key) == new.get(key), (old['name'], key)
    assert old['sections'][1:] == new['sections'][1:]
    if old['description'] != new['description']:
        changed.append(new['name'])
assert changed == registrations['descriptionChanges'] and len(changed) == 30
for report, expected in [(before, 6), (after, 8), (after['chineseOnlyComparison'], 5)]:
    rows = report['results']
    assert sum(any(c['componentUuid'] in row['expected'] for c in row['candidates']) for row in rows if row['expected']) == report['hitAt3'] == expected
    assert report['negativeSuggestions'] == [row['id'] for row in rows if not row['expected'] and row['candidates']] == []
    assert all(len(row['candidates']) <= 3 for row in rows)
assert after['indexing']['counters']['documentEmbeddings'] == 0
assert after['indexing']['nativeStarted'] is False
runtime = json.loads((folder / 'runtime.json').read_text())
assert runtime['model'] == native['model'] == registrations['model']
assert runtime['seedComponents'] == 126
assert runtime['seedVectors'] == len([f for f in runtime['files'] if f['name'].startswith('vector-')]) == 260
assert runtime['seedVectors'] * (32 + 4 * 768) == 807040
print('PASS: evidence hashes, frozen corpus, rankings, cache counters, percentiles, registration changes and 260 public vector seeds')
