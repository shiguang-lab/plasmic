package main

import (
	"encoding/json"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"
)

func recoverResult(t *testing.T, s *resultStore, id string, path []any) any {
	t.Helper()
	offset := 0
	var text strings.Builder
	var collection any
	for {
		v, e := s.read(map[string]any{"resultId": id, "path": path, "offset": offset, "limit": 16000})
		if e != nil {
			t.Fatal(e)
		}
		page := fields(v)
		if !fits(page) {
			t.Fatal("Response exceeds wire budget")
		}
		switch page["type"] {
		case "string":
			text.WriteString(str(page["text"]))
		case "object", "array":
			if collection == nil {
				if page["type"] == "array" {
					collection = []any{}
				} else {
					collection = map[string]any{}
				}
			}
			for _, entry := range page["entries"].([]any) {
				m := fields(entry)
				value, ok := m["value"]
				if !ok {
					value = recoverResult(t, s, id, append(append([]any{}, path...), m["key"]))
				}
				if a, ok := collection.([]any); ok {
					collection = append(a, value)
				} else {
					collection.(map[string]any)[str(m["key"])] = value
				}
			}
		default:
			return page["value"]
		}
		next, ok := page["nextOffset"]
		if !ok {
			if page["type"] == "string" {
				return text.String()
			}
			return collection
		}
		offset = integer(next, 0)
	}
}
func TestLargeResultsAndUnicode(t *testing.T) {
	s := newResultStore()
	defer s.close()
	original := map[string]any{"props": map[string]any{"options": []any{strings.Repeat("业务😀\n\"", 40000)}}, "markup": strings.Repeat("<div>😀业务</div>", 20000), "empty": []any{}, "nullable": nil}
	ref := s.retain(original)
	got := recoverResult(t, s, str(ref["resultId"]), nil)
	if !reflect.DeepEqual(got, original) {
		t.Fatal("Large snapshot changed during paging")
	}
	if _, e := s.read(map[string]any{"resultId": ref["resultId"], "path": []any{"constructor"}}); e == nil {
		t.Fatal("Non-own path accepted")
	}
	text := "😀" + strings.Repeat("\x00", 20000) + strings.Repeat("中", 20000)
	ref = s.retain(text)
	v, e := s.read(map[string]any{"resultId": ref["resultId"], "limit": 1})
	if e != nil {
		t.Fatal(e)
	}
	if fields(v)["text"] != "😀" || fields(v)["nextOffset"] != 2 {
		t.Fatal("UTF-16 continuation changed")
	}
	if _, e = s.read(map[string]any{"resultId": ref["resultId"], "offset": 1}); e == nil {
		t.Fatal("Split surrogate accepted")
	}
	if recoverResult(t, s, str(ref["resultId"]), nil) != text {
		t.Fatal("Unicode string changed")
	}
}
func TestEvictionExpiryAndClose(t *testing.T) {
	s := newResultStore()
	defer s.close()
	first := s.retain("first")
	for i := 0; i < 16; i++ {
		s.retain(i)
	}
	if _, e := s.read(first); e == nil {
		t.Fatal("Evicted result retained")
	}
	other := newResultStore()
	defer other.close()
	if _, e := other.read(s.retain(42)); e == nil {
		t.Fatal("Cross-connection result read")
	}
	s.close()
	if s.bytes != 0 || len(s.entries) != 0 || s.timer != nil {
		t.Fatal("Close retained snapshots or timer")
	}
	s = newResultStore()
	defer s.close()
	idle, active := s.retain(strings.Repeat("unused", 20000)), s.retain(strings.Repeat("paged", 20000))
	s.mu.Lock()
	s.entries[str(idle["resultId"])].expires = time.Now().Add(5 * time.Millisecond)
	s.entries[str(active["resultId"])].expires = time.Now().Add(5 * time.Millisecond)
	s.mu.Unlock()
	if _, e := s.read(active); e != nil {
		t.Fatal(e)
	}
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		s.mu.Lock()
		_, ok := s.entries[str(idle["resultId"])]
		s.mu.Unlock()
		if !ok {
			break
		}
		time.Sleep(time.Millisecond)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.entries) != 1 || s.bytes != integer(active["bytes"], 0) {
		t.Fatal("Idle snapshot was not released independently of active paging")
	}
}
func TestConcurrentPagingAndDiagnostics(t *testing.T) {
	s := newResultStore()
	defer s.close()
	ref := s.retain(strings.Repeat("snapshot😀", 20000))
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Go(func() {
			if _, e := s.read(map[string]any{"resultId": ref["resultId"]}); e != nil {
				t.Error(e)
			}
		})
	}
	wg.Wait()
	diagnostic := map[string]any{"message": "Invalid target", "code": "TARGET_INVALID", "operationExecuted": false, "cause": map[string]any{"stack": strings.Repeat("诊断\n\"", 40000)}}
	response := s.failure("Tool call failed.", diagnostic)
	if !response.IsError {
		t.Fatal("Lost error status")
	}
	raw, _ := marshal(resultWire(response))
	if len(raw) > maxJSONBytes {
		t.Fatal("Diagnostic exceeds wire budget")
	}
	var output struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if e := json.Unmarshal(raw, &output); e != nil {
		t.Fatal(e)
	}
	v, e := decodeJSON([]byte(output.Content[0].Text))
	if e != nil {
		t.Fatal(e)
	}
	detail := fields(fields(v)["detail"])
	if detail["__type"] != "ResultReference" {
		t.Fatal("Large diagnostics not retained")
	}
	got := recoverResult(t, s, str(detail["resultId"]), nil)
	if !reflect.DeepEqual(got, diagnostic) {
		t.Fatal("Diagnostic context was lost")
	}
}
func TestSourceObjectOrder(t *testing.T) {
	value, e := decodeJSON([]byte(`{"b":1,"10":2,"2":3,"a":{"z":4,"x":5}}`))
	if e != nil {
		t.Fatal(e)
	}
	if !reflect.DeepEqual(keys(value), []string{"2", "10", "b", "a"}) {
		t.Fatal(keys(value))
	}
	s := newResultStore()
	defer s.close()
	ref := s.retain(value)
	v, e := s.read(map[string]any{"resultId": ref["resultId"], "offset": 2, "limit": 1})
	if e != nil {
		t.Fatal(e)
	}
	entries := fields(v)["entries"].([]any)
	if fields(entries[0])["key"] != "b" || fields(v)["nextOffset"] != 3 {
		t.Fatal("Source key continuation changed")
	}
	delete(fields(value), "b")
	if !reflect.DeepEqual(keys(value), []string{"2", "10", "a"}) {
		t.Fatal("Removed image/data fields must not reappear in paged metadata")
	}
}

func TestJSONIntegerSpellings(t *testing.T) {
	s := newResultStore()
	defer s.close()
	ref := s.retain([]any{"first", "second"})
	v, e := s.read(map[string]any{"resultId": ref["resultId"], "path": []any{json.Number("0.0")}})
	if e != nil || fields(v)["text"] != "first" {
		t.Fatal("JSON integer path changed", e)
	}
	v, e = s.read(map[string]any{"resultId": ref["resultId"], "offset": json.Number("1.0"), "limit": json.Number("1e0")})
	if e != nil || len(fields(v)["entries"].([]any)) != 1 {
		t.Fatal("JSON integer pagination changed", e)
	}
	if _, e = s.read(map[string]any{"resultId": ref["resultId"], "offset": json.Number("1e100")}); e == nil {
		t.Fatal("Out-of-range offset was not rejected")
	}
}
