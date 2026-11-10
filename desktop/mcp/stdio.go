package main

import (
	"context"
	"errors"
	"io"
	"sync"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func runStdio(ctx context.Context, server *mcp.Server, input io.Reader, output io.Writer, log lifecycleLog) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	inReader, inWriter := io.Pipe()
	defer inReader.Close()
	defer inWriter.Close()
	reader, writer := io.Pipe()
	defer reader.Close()
	defer writer.Close()
	// The SDK waits for response writes before closing its session. Keep the
	// actual OS I/O off that path: closing the pipes interrupts SDK reads and
	// writes even when inherited stdin/stdout are blocked in OS syscalls.
	stop := context.AfterFunc(ctx, func() {
		reader.CloseWithError(ctx.Err())
		inReader.CloseWithError(ctx.Err())
	})
	defer stop()
	var once sync.Once
	ended := make(chan error, 1)
	finish := func(event string, err error) {
		once.Do(func() {
			fields := map[string]any{}
			if err != nil && !errors.Is(err, io.EOF) {
				fields["error"] = err.Error()
			}
			log(event, fields)
			ended <- err
			cancel()
		})
	}
	go func() {
		_, err := io.Copy(output, reader)
		if err != nil && ctx.Err() == nil {
			finish("stdout.failed", err)
		}
	}()
	go func() {
		_, err := io.Copy(inWriter, input)
		if ctx.Err() == nil {
			event := "stdin.failed"
			if err == nil {
				err = io.EOF
				event = "stdin.eof"
			}
			finish(event, err)
		}
	}()
	err := server.Run(ctx, &mcp.IOTransport{Reader: inReader, Writer: writer, MaxLineLength: -1})
	select {
	case terminal := <-ended:
		if errors.Is(terminal, io.EOF) {
			return nil
		}
		return terminal
	default:
		return err
	}
}
