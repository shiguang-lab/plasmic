package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestLifecycleLogRotatesAndSurvivesUnavailableDirectory(t *testing.T) {
	profile := t.TempDir()
	log := newLifecycleLog(profile)
	log("process.start", map[string]any{"version": "fixture"})
	file := filepath.Join(profile, "logs", "mcp-lifecycle.log")
	data, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	var row map[string]any
	if err = json.Unmarshal(data, &row); err != nil || row["event"] != "process.start" || row["pid"] != float64(os.Getpid()) || row["time"] == nil {
		t.Fatalf("Invalid lifecycle record: %s, %v", data, err)
	}
	if err = os.Truncate(file, 2*1024*1024); err != nil {
		t.Fatal(err)
	}
	log("stdin.eof", nil)
	data, err = os.ReadFile(file)
	if err != nil || json.Unmarshal(data, &row) != nil || row["event"] != "stdin.eof" {
		t.Fatalf("Rotation lost the current event: %s, %v", data, err)
	}
	if info, err := os.Stat(file + ".1"); err != nil || info.Size() != 2*1024*1024 {
		t.Fatalf("Missing rotated log: %v", err)
	}
	blocked := filepath.Join(profile, "not-a-directory")
	if err = os.WriteFile(blocked, []byte("fixture"), 0600); err != nil {
		t.Fatal(err)
	}
	newLifecycleLog(blocked)("process.exit", nil)
}
