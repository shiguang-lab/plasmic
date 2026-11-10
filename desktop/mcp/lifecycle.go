package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type lifecycleLog func(string, map[string]any)

func newLifecycleLog(profile string) lifecycleLog {
	var mu sync.Mutex
	directory := filepath.Join(profile, "logs")
	file := filepath.Join(directory, "mcp-lifecycle.log")
	return func(event string, fields map[string]any) {
		mu.Lock()
		defer mu.Unlock()
		row := map[string]any{"time": time.Now().UTC().Format(time.RFC3339Nano), "pid": os.Getpid(), "ppid": os.Getppid(), "event": event}
		for key, value := range fields {
			row[key] = value
		}
		data, err := json.Marshal(row)
		if err != nil || os.MkdirAll(directory, 0700) != nil {
			return
		}
		data = append(data, '\n')
		if info, err := os.Stat(file); err == nil && info.Size()+int64(len(data)) > 2*1024*1024 {
			// Only two bounded files, shared by the client's independent helpers.
			// Another helper may already have rotated the current file.
			_ = os.Rename(file, file+".1")
		}
		f, err := os.OpenFile(file, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
		if err == nil {
			_, _ = f.Write(data)
			_ = f.Close()
		}
	}
}
