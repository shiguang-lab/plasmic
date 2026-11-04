package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode/utf16"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const maxJSONBytes = 64 * 1024
const resultIdleTTL = 10 * time.Minute
const expiredResult = "Result expired or belongs to another MCP connection. Re-read source data; do not repeat a successful mutation."

type storedResult struct {
	value   any
	bytes   int
	expires time.Time
}
type resultStore struct {
	mu      sync.Mutex
	entries map[string]*storedResult
	order   []string
	bytes   int
	timer   *time.Timer
	closed  bool
}

func newResultStore() *resultStore { return &resultStore{entries: map[string]*storedResult{}} }
func description(v any) map[string]any {
	m := map[string]any{}
	switch x := v.(type) {
	case nil:
		m["type"] = "null"
	case string:
		m["type"] = "string"
		m["total"] = len(utf16.Encode([]rune(x)))
		m["unit"] = "utf16"
	case []any:
		m["type"] = "array"
		m["total"] = len(x)
	case *object, map[string]any:
		m["type"] = "object"
		m["total"] = len(fields(v))
	case bool:
		m["type"] = "boolean"
	default:
		m["type"] = "number"
	}
	return m
}
func message(v any) *mcp.CallToolResult {
	data, _ := marshal(v)
	return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: string(data)}}}
}
func resultWire(r *mcp.CallToolResult) map[string]any {
	content := []map[string]any{}
	for _, item := range r.Content {
		switch c := item.(type) {
		case *mcp.TextContent:
			content = append(content, map[string]any{"type": "text", "text": c.Text})
		case *mcp.ImageContent:
			content = append(content, map[string]any{"type": "image", "data": base64.StdEncoding.EncodeToString(c.Data), "mimeType": c.MIMEType})
		}
	}
	return map[string]any{"content": content, "isError": r.IsError}
}
func fits(v any) bool {
	data, e := marshal(resultWire(message(v)))
	return e == nil && len(data) <= maxJSONBytes
}
func (s *resultStore) scheduleLocked() {
	if s.timer != nil {
		s.timer.Stop()
		s.timer = nil
	}
	if len(s.entries) == 0 || s.closed {
		return
	}
	var expiry time.Time
	for _, r := range s.entries {
		if expiry.IsZero() || r.expires.Before(expiry) {
			expiry = r.expires
		}
	}
	s.timer = time.AfterFunc(time.Until(expiry), func() { s.mu.Lock(); defer s.mu.Unlock(); s.pruneLocked(time.Now()); s.scheduleLocked() })
}
func (s *resultStore) pruneLocked(now time.Time) {
	order := s.order[:0]
	for _, id := range s.order {
		r := s.entries[id]
		if !r.expires.After(now) {
			s.bytes -= r.bytes
			delete(s.entries, id)
		} else {
			order = append(order, id)
		}
	}
	s.order = order
}
func (s *resultStore) close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closed = true
	if s.timer != nil {
		s.timer.Stop()
		s.timer = nil
	}
	s.entries = map[string]*storedResult{}
	s.order = nil
	s.bytes = 0
}
func (s *resultStore) retain(v any) map[string]any {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked(time.Now())
	data, _ := marshal(v)
	id := uuid()
	s.entries[id] = &storedResult{v, len(data), time.Now().Add(resultIdleTTL)}
	s.order = append(s.order, id)
	s.bytes += len(data)
	for len(s.order) > 1 && (len(s.order) > 16 || s.bytes > 64*1024*1024) {
		id := s.order[0]
		s.order = s.order[1:]
		s.bytes -= s.entries[id].bytes
		delete(s.entries, id)
	}
	s.scheduleLocked()
	m := description(v)
	m["__type"] = "ResultReference"
	m["resultId"] = id
	m["bytes"] = len(data)
	return m
}
func (s *resultStore) output(v any) *mcp.CallToolResult {
	if !fits(v) {
		v = s.retain(v)
	}
	return message(v)
}
func (s *resultStore) failure(msg string, detail any) *mcp.CallToolResult {
	m := map[string]any{"msg": msg, "detail": detail}
	if !fits(m) {
		m["detail"] = s.retain(detail)
	}
	r := message(m)
	r.IsError = true
	return r
}
func (s *resultStore) read(args map[string]any) (any, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked(time.Now())
	r := s.entries[str(args["resultId"])]
	if r == nil {
		return nil, fmt.Errorf("%s", expiredResult)
	}
	r.expires = time.Now().Add(resultIdleTTL)
	s.scheduleLocked()
	v := r.value
	p, _ := args["path"].([]any)
	if p == nil {
		p = []any{}
	}
	for _, k := range p {
		key := propertyKey(k)
		var ok bool
		v, ok = at(v, key)
		if !ok {
			return nil, fmt.Errorf("Result path does not exist")
		}
	}
	offset, limit := integer(args["offset"], 0), integer(args["limit"], 16000)
	base := description(v)
	base["__type"] = "ResultPage"
	base["resultId"] = args["resultId"]
	base["path"] = p
	checked := func() (any, error) {
		if !fits(base) {
			return nil, fmt.Errorf("Result path or key exceeds the response budget; request a shorter parent path")
		}
		return base, nil
	}
	if text, ok := v.(string); ok {
		units := utf16.Encode([]rune(text))
		if offset > len(units) {
			return nil, fmt.Errorf("Offset exceeds string length")
		}
		if offset > 0 && offset < len(units) && low(units[offset]) && high(units[offset-1]) {
			return nil, fmt.Errorf("Offset splits a Unicode character; use nextOffset")
		}
		end := min(len(units), offset+limit)
		if end < len(units) && end > 0 && high(units[end-1]) && low(units[end]) {
			end++
		}
		page := func() {
			base["offset"] = offset
			base["text"] = string(utf16.Decode(units[offset:end]))
			delete(base, "nextOffset")
			if end < len(units) {
				base["nextOffset"] = end
			}
		}
		page()
		for !fits(base) && end > offset+2 {
			end = offset + (end-offset)/2
			if end < len(units) && high(units[end-1]) && low(units[end]) {
				end--
			}
			page()
		}
		return checked()
	}
	if fields(v) == nil {
		if _, ok := v.([]any); !ok {
			base["value"] = v
			return checked()
		}
	}
	ks := keys(v)
	if offset > len(ks) {
		return nil, fmt.Errorf("Offset exceeds collection length")
	}
	entries := []any{}
	base["offset"] = offset
	page := func() {
		base["entries"] = entries
		delete(base, "nextOffset")
		if offset+len(entries) < len(ks) {
			base["nextOffset"] = offset + len(entries)
		}
	}
	for _, key := range ks[offset:min(len(ks), offset+min(limit, 50))] {
		value, _ := at(v, key)
		var k any = key
		if _, ok := v.([]any); ok {
			k = integerFromKey(key)
		}
		entries = append(entries, map[string]any{"key": k, "value": value})
		page()
		if !fits(base) {
			entries = entries[:len(entries)-1]
			if len(entries) == 0 {
				entries = append(entries, map[string]any{"key": k, "reference": description(value)})
			}
			break
		}
	}
	page()
	return checked()
}
func high(c uint16) bool          { return c >= 0xd800 && c <= 0xdbff }
func low(c uint16) bool           { return c >= 0xdc00 && c <= 0xdfff }
func integerFromKey(k string) int { var n int; fmt.Sscan(k, &n); return n }
func uuid() string {
	var b [16]byte
	if _, e := rand.Read(b[:]); e != nil {
		panic(e)
	}
	b[6] = (b[6] & 15) | 64
	b[8] = (b[8] & 63) | 128
	return strings.ToLower(fmt.Sprintf("%x-%x-%x-%x-%x", b[:4], b[4:6], b[6:8], b[8:10], b[10:]))
}
