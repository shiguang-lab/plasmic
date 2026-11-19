package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func snapshot(t *testing.T, records map[string]object) []byte {
	t.Helper()
	body, err := json.Marshal(map[string]any{"revision": 1, "project": map[string]string{"id": "project", "name": "sample"}, "bundle": map[string]any{"root": "site", "map": records}, "dependencies": []any{}, "libraries": []any{}})
	if err != nil {
		t.Fatal(err)
	}
	return body
}

func TestBoardInputs(t *testing.T) {
	ref := func(s string) object { return object{"__ref": s} }
	data := map[string]object{
		"site": {"__type": "Site", "arenas": []object{ref("arena")}, "styleTokens": []object{ref("theme")}},
		"a":    {"__type": "ArenaFrame", "uuid": "A", "container": ref("one"), "left": 0},
		"b":    {"__type": "ArenaFrame", "uuid": "B", "container": ref("two"), "left": 150},
		"one":  {"__type": "RawText", "text": "one"}, "two": {"__type": "RawText", "text": "two"},
		"theme": {"__type": "StyleToken", "value": "red"},
	}
	keys := func() (string, string) {
		m, err := parseInputs(snapshot(t, data), []byte("release"))
		if err != nil {
			t.Fatal(err)
		}
		return m.key("A"), m.key("B")
	}
	a, b := keys()
	if a == "" || b == "" {
		t.Fatal("static frames not reusable")
	}
	data["one"]["text"] = "new"
	aa, bb := keys()
	if aa == a || bb != b {
		t.Fatal("local edit must invalidate one frame")
	}
	data["a"]["left"] = 300
	a, b = keys()
	if a != aa || b != bb {
		t.Fatal("position belongs to the layout")
	}
	data["theme"]["value"] = "blue"
	aa, bb = keys()
	if aa == a || bb == b {
		t.Fatal("theme must invalidate both")
	}
	data["two"]["shared"] = ref("one")
	a, b = keys()
	data["one"]["text"] = "shared"
	aa, bb = keys()
	if aa == a || bb == b {
		t.Fatal("shared dependency must invalidate both")
	}
	data["one"]["__type"] = "CustomCode"
	data["one"]["code"] = "Date.now()"
	a, b = keys()
	if a != "" || b != "" {
		t.Fatal("dynamic dependency reused")
	}
}

func TestGeometry(t *testing.T) {
	a := board{ID: "A", Key: "key", Left: 8.25, Top: 2.5, Width: 100, Height: 55}
	b := a
	b.Left += 150
	if !b.reusable(a) || !disjoint([]board{a, b}) {
		t.Fatal("whole pixel move should reuse")
	}
	b.Left += 0.25
	if b.reusable(a) {
		t.Fatal("fractional phase changed")
	}
	b = a
	b.Width++
	if b.reusable(a) {
		t.Fatal("scale changed")
	}
	b.Left = 108
	if disjoint([]board{a, b}) {
		t.Fatal("rounded tiles overlap")
	}
}

func TestWholeCoverReuse(t *testing.T) {
	body := snapshot(t, map[string]object{"site": {"__type": "Site"}})
	var doc = []byte("same release")
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			t.Error("missing model credential")
		}
		if r.URL.Path == "/canvas-snapshot/demo/model" {
			w.Write(body)
		} else {
			w.Write(doc)
		}
	}))
	defer backend.Close()
	m, err := parseInputs(body, doc)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	data := []byte("previous encoded image")
	if err := publish(dir, "demo-0.webp", data); err != nil {
		t.Fatal(err)
	}
	w := worker{dir: dir, upstream: backend.URL, cache: map[string]manifest{"demo": {exact: m.exact, file: "demo-0.webp", checksum: digest(data), boards: []board{{}}, until: time.Now().Add(time.Minute), complete: true}}}
	r, err := w.generate(context.Background(), "demo")
	if err != nil || r.Reused != 1 || r.Rendered != 0 || w.browser != nil {
		t.Fatalf("unexpected reuse: %+v %v", r, err)
	}
	got, err := os.ReadFile(filepath.Join(dir, r.Name))
	if err != nil || string(got) != string(data) {
		t.Fatal("new revision not durable")
	}
}

func TestStaticAssetRouting(t *testing.T) {
	w := worker{assetUpstreams: map[string]string{
		"https://studio.test": "http://edge:8080",
		"https://canvas.test": "http://edge:8081",
	}}
	for _, tc := range []struct{ address, internal string }{
		{"https://studio.test/assets/logo.svg?v=3", "http://edge:8080/assets/logo.svg?v=3"},
		{"https://canvas.test/static/fonts/name%20with%20spaces.woff2?x=a%2Fb", "http://edge:8081/static/fonts/name%20with%20spaces.woff2?x=a%2Fb"},
		{"https://studio.test/canvas-snapshot-assets/static/js/app.js", "http://edge:8080/canvas-snapshot-assets/static/js/app.js"},
		{"https://studio.test/api/v1/projects", ""},
		{"https://studio.test/canvas-snapshot/demo/model", ""},
		{"https://cdn.test/static/fonts/font.woff2", ""},
		{"https://studio.test:8443/static/app.js", ""},
	} {
		u, err := url.Parse(tc.address)
		if err != nil {
			t.Fatal(err)
		}
		want := tc.internal
		if want == "" {
			want = tc.address
		}
		if target, routed := w.assetURL(u); target != want || routed != (tc.internal != "") || u.String() != tc.address {
			t.Errorf("%s: target=%q routed=%v original=%q", tc.address, target, routed, u)
		}
	}
}

func TestLoopbackServesOnlyStaticResources(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/static/test.css" || r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" {
			t.Error("unexpected upstream request")
		}
		w.Write([]byte("body{}"))
	}))
	defer backend.Close()
	origin, err := url.Parse(backend.URL)
	if err != nil {
		t.Fatal(err)
	}
	local, err := loopback(origin)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		path   string
		status int
	}{{"/static/test.css", 200}, {"/canvas-snapshot/demo/model", 404}, {"/api/v1/projects", 404}} {
		r, _ := http.NewRequest("GET", local+tc.path, nil)
		r.Header.Set("Authorization", "test")
		r.Header.Set("Cookie", "session=test")
		resp, err := http.DefaultClient.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != tc.status {
			t.Errorf("%s: %d", tc.path, resp.StatusCode)
		}
	}
}

func TestLibraryTextEditScope(t *testing.T) {
	ref := func(id string) object { return object{"__ref": id} }
	records := map[string]object{
		"site":     {"__type": "Site", "globalContexts": []object{ref("provider")}},
		"provider": {"__type": "TplComponent", "value": ref("global")},
		"a":        {"__type": "ArenaFrame", "uuid": "A", "container": ref("one"), "shared": ref("both")},
		"b":        {"__type": "ArenaFrame", "uuid": "B", "container": ref("two"), "shared": ref("both")},
	}
	for _, id := range []string{"one", "two", "both", "global", "outside"} {
		records[id] = object{"__type": "RawText", "text": id}
	}
	boards := []board{{ID: "A"}, {ID: "B"}}
	read := func() *inputs {
		model, err := parseInputs(snapshot(t, records), []byte("renderer"))
		if err != nil {
			t.Fatal(err)
		}
		return model
	}
	before := read()
	scope := before.textScope(boards)
	if before.stable || scope == "" {
		t.Fatal("expected a text-only baseline")
	}
	records["one"]["text"] = "changed"
	after := read()
	if after.textScope(boards) != scope || after.textDigest == before.textDigest || after.key("A") == before.key("A") || after.key("B") != before.key("B") {
		t.Fatal("local text must invalidate only its own board")
	}
	records["both"]["text"] = "edited shared component"
	both := read()
	if both.key("A") == after.key("A") || both.key("B") == after.key("B") {
		t.Fatal("shared text must invalidate all consumers")
	}
	for _, id := range []string{"global", "outside"} {
		records[id]["text"] = "changed"
		if read().textScope(boards) == scope {
			t.Fatalf("unsafe reuse after change to %s", id)
		}
		records[id]["text"] = id
	}
	records["b"]["left"] = 100
	if read().textScope(boards) == scope {
		t.Fatal("structural change must invalidate the library baseline")
	}
}
