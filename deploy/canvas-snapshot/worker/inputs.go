// Model fingerprints are computed from the complete saved snapshot. A queue
// may skip any number of intermediate revisions.
package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

func digest(parts ...[]byte) string {
	h := sha256.New()
	for _, p := range parts {
		fmt.Fprintf(h, "%d:", len(p))
		h.Write(p)
	}
	return hex.EncodeToString(h.Sum(nil))
}

type object map[string]any
type record struct {
	refs   []string
	hash   string
	stable bool
}
type inputs struct {
	revision              int
	exact, shared         string
	stable                bool
	records               map[string]record
	frames                map[string]string
	structure, textDigest string
	texts                 map[string]string
}

func references(v any, ids *[]string) {
	switch x := v.(type) {
	case map[string]any:
		if id, ok := x["__ref"].(string); ok {
			*ids = append(*ids, id)
			return
		}
		for _, y := range x {
			references(y, ids)
		}
	case []any:
		for _, y := range x {
			references(y, ids)
		}
	}
}

func staticRecord(o object) bool {
	switch o["__type"] {
	case "Component":
		return o["codeComponentMeta"] == nil && o["plumeInfo"] == nil
	case "TplTag":
		switch o["tag"] {
		case "div", "span", "p", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "b", "i", "ul", "ol", "li", "section", "article", "main", "header", "footer", "nav", "label", "button", "a", "br", "hr":
			return true
		}
		return false
	case "CustomCode":
		s, _ := o["code"].(string)
		return json.Valid([]byte(strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(s, "("), ")"))))
	case "RuleSet":
		vals, _ := o["values"].(map[string]any)
		for k, v := range vals {
			s := strings.ToLower(fmt.Sprint(v))
			if strings.HasPrefix(k, "animation") || strings.HasPrefix(k, "transition") || strings.Contains(s, "url(") || strings.Contains(s, "image-set(") {
				return false
			}
		}
		return o["animations"] == nil
	case "Theme", "ThemeStyle", "ThemeLayoutSettings", "GlobalVariantGroup", "GlobalVariantGroupParam", "ArenaFrame", "Variant", "VariantSetting", "TplComponent", "RawText", "StyleMarker", "NodeMarker", "PageMeta", "PageHref", "ColumnsConfig", "Mixin", "StyleToken", "VariantedValue", "VariantedRuleSet", "Arg", "Var", "Param", "PropParam", "SlotParam", "RenderableType", "Text", "Num", "Bool", "TplSlot", "RenderExpr", "VariantsRef":
		return true
	}
	// Data, code components and unknown model types always get fresh pixels.
	return false
}

func (m *inputs) reachable(ids []string) map[string]bool {
	seen := map[string]bool{}
	for len(ids) > 0 {
		i := ids[len(ids)-1]
		ids = ids[:len(ids)-1]
		if seen[i] {
			continue
		}
		seen[i] = true
		ids = append(ids, m.records[i].refs...)
	}
	return seen
}

func (m *inputs) graph(ids []string) (string, bool) {
	seen := m.reachable(ids)
	stable := true
	keys := make([]string, 0, len(seen))
	for i := range seen {
		keys = append(keys, i)
		stable = stable && m.records[i].stable
	}
	sort.Strings(keys)
	h := sha256.New()
	for _, i := range keys {
		fmt.Fprintf(h, "%s:%s\n", i, m.records[i].hash)
	}
	return hex.EncodeToString(h.Sum(nil)), stable
}

func parseInputs(body, document []byte) (*inputs, error) {
	var s struct {
		Revision                        int
		Project                         struct{ ID, Name string }
		Bundle, Dependencies, Libraries json.RawMessage
	}
	if err := json.Unmarshal(body, &s); err != nil {
		return nil, err
	}
	if s.Revision <= 0 {
		return nil, fmt.Errorf("invalid snapshot revision")
	}
	var b struct {
		Root, Version string
		Deps          json.RawMessage
		Map           map[string]json.RawMessage
	}
	if err := json.Unmarshal(s.Bundle, &b); err != nil {
		return nil, err
	}
	m := &inputs{revision: s.Revision, records: map[string]record{}, frames: map[string]string{}, stable: true}
	var root object
	if err := json.Unmarshal(b.Map[b.Root], &root); err != nil {
		return nil, fmt.Errorf("invalid site: %w", err)
	}
	globals, _ := root["globalContexts"].([]any)
	textOnly := len(globals) > 0 || root["pageWrapper"] != nil || !bytes.Equal(bytes.TrimSpace(s.Libraries), []byte("[]"))
	var structure map[string]string
	if textOnly {
		structure = make(map[string]string, len(b.Map))
		m.texts = map[string]string{}
	}
	for _, k := range []string{"components", "arenas", "componentArenas", "pageArenas"} {
		delete(root, k)
	}
	for id, raw := range b.Map {
		var o object
		if err := json.Unmarshal(raw, &o); err != nil {
			return nil, err
		}
		if textOnly {
			// Keep every structural field, including frame moves and event handlers.
			// Only the literal text of a saved RawText may vary between these captures.
			if value, ok := o["text"].(string); ok && o["__type"] == "RawText" {
				m.texts[id] = digest([]byte(value))
				delete(o, "text")
				shape, _ := json.Marshal(o)
				structure[id] = digest(shape)
				o["text"] = value
			} else {
				shape, _ := json.Marshal(o)
				structure[id] = digest(shape)
			}
		}
		if o["__type"] == "ArenaFrame" {
			uuid, _ := o["uuid"].(string)
			m.frames[uuid] = id
			delete(o, "top")
			delete(o, "left")
		}
		// A click handler is never invoked during a cover capture. Follow other
		// event/lifecycle expressions conservatively.
		if o["__type"] == "VariantSetting" {
			attrs, _ := o["attrs"].(map[string]any)
			handler, _ := attrs["onClick"].(map[string]any)
			ref, _ := handler["__ref"].(string)
			var target struct {
				Type string `json:"__type"`
			}
			if ref != "" {
				json.Unmarshal(b.Map[ref], &target)
				if target.Type == "EventHandler" {
					attrs["onClick"] = "snapshot-click-handler"
				}
			}
		}
		if o["__type"] == "PageHref" {
			// A page link depends on the destination route, not its rendered subtree.
			link, _ := o["page"].(map[string]any)
			ref, _ := link["__ref"].(string)
			var dest struct {
				UUID     string
				PageMeta map[string]string
			}
			if json.Unmarshal(b.Map[ref], &dest) == nil {
				o["page"] = dest.UUID
				o["linkedPageMeta"] = map[string]any{"__ref": dest.PageMeta["__ref"]}
			}
		}
		var refs []string
		references(map[string]any(o), &refs)
		data, _ := json.Marshal(o)
		m.records[id] = record{refs, digest(data), staticRecord(o) && !bytes.Contains(raw, []byte(`"__xref"`))}
	}
	var refs []string
	references(map[string]any(root), &refs)
	global, stable := m.graph(refs)
	m.stable = stable && !textOnly
	cfg, _ := json.Marshal(root)
	m.shared = digest(document, []byte(s.Project.ID), []byte(s.Project.Name), []byte(b.Version), cfg, []byte(global), s.Dependencies, s.Libraries)
	if textOnly {
		shape, _ := json.Marshal(structure)
		text, _ := json.Marshal(m.texts)
		m.structure = digest([]byte(m.shared), []byte(b.Root), b.Deps, shape)
		m.textDigest = digest(text)
	} else {
		m.exact = digest([]byte(m.shared), s.Bundle)
	}
	return m, nil
}

func (m *inputs) key(uuid string) string {
	iid, ok := m.frames[uuid]
	if !ok || (!m.stable && m.structure == "") {
		return ""
	}
	hash, stable := m.graph([]string{iid})
	if !stable && m.structure == "" {
		return ""
	}
	return digest([]byte(m.shared), []byte(hash))
}

// Text outside the displayed frame graphs has no established owner. Include
// it with the shared inputs so changing it forces a complete capture.
func (m *inputs) textScope(boards []board) string {
	if m.structure == "" {
		return ""
	}
	var frames []string
	for _, b := range boards {
		id, ok := m.frames[b.ID]
		if !ok {
			return ""
		}
		frames = append(frames, id)
	}
	owned := m.reachable(frames)
	other := map[string]string{}
	for id, value := range m.texts {
		if !owned[id] {
			other[id] = value
		}
	}
	data, _ := json.Marshal(other)
	return digest([]byte(m.structure), data)
}
