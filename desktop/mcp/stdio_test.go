package main

import (
	"context"
	"errors"
	"io"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type blockedOutput struct {
	started chan struct{}
	release chan struct{}
	once    sync.Once
}

func (out *blockedOutput) Write(p []byte) (int, error) {
	out.once.Do(func() { close(out.started) })
	<-out.release
	return len(p), nil
}

func TestStdioDisconnectInterruptsBlockedOutput(t *testing.T) {
	for _, end := range []string{"eof", "cancel"} {
		t.Run(end, func(t *testing.T) {
			input, client := io.Pipe()
			defer client.Close()
			output := &blockedOutput{started: make(chan struct{}), release: make(chan struct{})}
			defer close(output.release)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			// A single large response, without any concurrent client requests.
			server := mcp.NewServer(&mcp.Implementation{Name: "test", Version: "1"}, &mcp.ServerOptions{Instructions: strings.Repeat("x", 1024*1024)})
			finished := make(chan error, 1)
			go func() { finished <- runStdio(ctx, server, input, output, func(string, map[string]any) {}) }()
			_, err := io.WriteString(client, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}`+"\n")
			if err != nil {
				t.Fatal(err)
			}
			select {
			case <-output.started:
			case <-time.After(3 * time.Second):
				t.Fatal("Response never reached stdout")
			}
			if end == "eof" {
				client.Close()
			} else {
				cancel()
			}
			select {
			case err := <-finished:
				if end == "eof" && err != nil || end == "cancel" && !errors.Is(err, context.Canceled) {
					t.Fatalf("Unexpected shutdown error: %v", err)
				}
			case <-time.After(3 * time.Second):
				t.Fatal("Shutdown waited for the client to drain stdout")
			}
		})
	}
}

type failedOutput struct{ err error }

func (out failedOutput) Write([]byte) (int, error) { return 0, out.err }

func TestStdioOutputFailureClosesSession(t *testing.T) {
	input, client := io.Pipe()
	defer client.Close()
	failure := errors.New("client closed stdout")
	finished := make(chan error, 1)
	go func() {
		server := mcp.NewServer(&mcp.Implementation{Name: "test", Version: "1"}, nil)
		finished <- runStdio(context.Background(), server, input, failedOutput{failure}, func(string, map[string]any) {})
	}()
	io.WriteString(client, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}`+"\n")
	select {
	case err := <-finished:
		if !errors.Is(err, failure) {
			t.Fatalf("Lost stdout error: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("Broken stdout left the session alive")
	}
}
