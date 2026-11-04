package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

func (b *bridge) readSkill(args map[string]any) (any, error) {
	home, e := os.UserHomeDir()
	if e != nil {
		return nil, e
	}
	agents := os.Getenv("DSH_AGENTS_HOME")
	if agents == "" {
		agents = filepath.Join(home, ".agents")
	}
	skill := filepath.Join(agents, "skills", "plasmic", "SKILL.md")
	if selected, exists := args["skillPath"]; exists {
		p, ok := selected.(string)
		if !ok || !filepath.IsAbs(p) {
			return nil, fmt.Errorf("skillPath must be the absolute path of the current client's Plasmic SKILL.md")
		}
		skill = p
		if _, e = os.Stat(skill); e != nil {
			return nil, e
		}
	}
	data, e := os.ReadFile(filepath.Join(filepath.Dir(skill), "local-source.json"))
	if os.IsNotExist(e) {
		return b.data.PublishedSkill, nil
	}
	if e != nil {
		return nil, e
	}
	var config map[string]any
	if e = json.Unmarshal(data, &config); e != nil {
		return nil, e
	}
	resolver := str(config["resolver"])
	if config["source"] != "local" || !filepath.IsAbs(resolver) {
		return nil, fmt.Errorf("Invalid local Plasmic source: an absolute resolver is required in local-source.json")
	}
	for _, p := range []string{skill, resolver} {
		if _, e = os.Stat(p); e != nil {
			return nil, e
		}
	}
	return map[string]any{"source": "local", "skillPath": skill, "resolver": resolver, "instructions": b.data.LocalSkillInstructions}, nil
}
func browserOutput(action string, value any) any {
	wanted := map[string][]string{"load_page": {"url", "title", "loading", "width", "height", "error"}, "get_state": {"visible", "url", "title", "loading", "busy", "width", "height", "zoom", "device", "importHeight", "picking", "error"}, "set_import_height": {"importHeight"}, "select_element": {"picking"}, "close": {"visible"}}
	ks, ok := wanted[action]
	if !ok {
		return value
	}
	m := fields(value)
	out := map[string]any{}
	for _, k := range append(ks, "evidence") {
		if v, ok := m[k]; ok {
			out[k] = v
		}
	}
	if action == "get_state" || action == "select_element" {
		out["selection"] = nil
		if selected := fields(m["selection"]); selected != nil {
			summary := map[string]any{}
			if s, ok := selected["selector"]; ok {
				summary["selector"] = s
			}
			if ancestors, ok := selected["ancestors"].([]any); ok && len(ancestors) > 0 {
				summary["element"] = ancestors[len(ancestors)-1]
			}
			out["selection"] = summary
		}
	}
	return out
}
