"""Count references that label a session's objects in a V8 heap snapshot."""
import argparse
import collections
import json
import re


def count_markers(path):
    with open(path, encoding="utf-8") as source:
        snapshot = json.load(source)
    meta = snapshot["snapshot"]["meta"]
    fields = meta["edge_fields"]
    type_index = fields.index("type")
    property_type = meta["edge_types"][type_index].index("property")
    name_index = fields.index("name_or_index")
    marker_names = {
        index: name for index, name in enumerate(snapshot["strings"])
        if re.fullmatch(r"routeStudySession[0-9]+", name)
    }
    counts = collections.Counter()
    edges = snapshot["edges"]
    for offset in range(0, len(edges), len(fields)):
        if edges[offset + type_index] == property_type:
            marker = marker_names.get(edges[offset + name_index])
            if marker is not None:
                counts[marker] += 1
    return counts


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("active")
    parser.add_argument("returned")
    args = parser.parse_args()
    active = count_markers(args.active)
    returned = count_markers(args.returned)
    print(json.dumps({"active": active, "returned": returned}, indent=2))
    if active["routeStudySession0"] < 4 or returned:
        raise SystemExit("Missing active-session controls or retained editor objects")
