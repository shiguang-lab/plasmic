//go:build !windows

package main

import (
	"context"
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCancellationDuringDesktopHandshake(t *testing.T) {
	profile, e := os.MkdirTemp("", "mcp-rpc-")
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { os.RemoveAll(profile) })
	socket := filepath.Join(profile, "rpc.sock")
	listener, e := net.Listen("unix", socket)
	if e != nil {
		t.Fatal(e)
	}
	defer listener.Close()
	data, _ := json.Marshal(rpcAddress{Socket: socket, Token: "fixture"})
	if e = os.WriteFile(filepath.Join(profile, "mcp-connection.json"), data, 0600); e != nil {
		t.Fatal(e)
	}
	accepted := make(chan net.Conn, 1)
	go func() {
		c, e := listener.Accept()
		if e == nil {
			accepted <- c
		}
	}()
	lifetime, closeLifetime := context.WithCancel(context.Background())
	defer closeLifetime()
	rpc := &desktopRPC{profile: profile, ctx: lifetime}
	defer rpc.close()
	ctx, cancel := context.WithCancel(context.Background())
	finished := make(chan error, 1)
	go func() {
		_, e := rpc.call(ctx, "get_app_state", map[string]any{}, map[string]any{"name": "fixture"})
		finished <- e
	}()
	var connection net.Conn
	select {
	case connection = <-accepted:
		defer connection.Close()
	case <-time.After(time.Second):
		t.Fatal("Handshake did not start")
	}
	cancel()
	select {
	case e := <-finished:
		if e == nil {
			t.Fatal("Cancelled handshake succeeded")
		}
		if detail(e)["operationExecuted"] != false {
			t.Fatal("Unsent business operation must be marked unexecuted")
		}
	case <-time.After(time.Second):
		t.Fatal("Cancellation waited for the handshake timeout")
	}
}
