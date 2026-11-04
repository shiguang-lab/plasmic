package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"
)

type bridgeError struct{ detail map[string]any }

func (e *bridgeError) Error() string { return str(e.detail["message"]) }
func detail(err error) map[string]any {
	var e *bridgeError
	if errors.As(err, &e) {
		if _, ok := e.detail["name"].(string); !ok {
			e.detail["name"] = "Error"
		}
		return e.detail
	}
	return map[string]any{"message": err.Error(), "name": "Error"}
}
func transportError(err error, sent bool) error {
	var executed any = false
	if sent {
		executed = nil
	}
	return &bridgeError{map[string]any{"message": err.Error(), "name": "Error", "cause": detail(err), "code": "DESKTOP_CONNECTION_LOST", "operationExecuted": executed}}
}

type rpcAddress struct {
	Socket string `json:"socket"`
	Token  string `json:"token"`
}

func address(profile string) (rpcAddress, error) {
	var a rpcAddress
	b, e := os.ReadFile(filepath.Join(profile, "mcp-connection.json"))
	if e != nil {
		return a, fmt.Errorf("Start Plasmic before connecting MCP")
	}
	e = json.Unmarshal(b, &a)
	if e != nil {
		return a, fmt.Errorf("Start Plasmic before connecting MCP")
	}
	return a, nil
}

type desktopSession struct {
	conn   net.Conn
	id     string
	ctx    context.Context
	cancel context.CancelFunc
	dead   atomic.Bool
}

func (s *desktopSession) close() { s.dead.Store(true); s.cancel(); s.conn.Close() }

type desktopRPC struct {
	profile string
	ctx     context.Context
	mu      sync.Mutex
	session *desktopSession
}

func (r *desktopRPC) close() {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.session != nil {
		r.session.close()
		r.session = nil
	}
}
func (r *desktopRPC) getSession(requestCtx context.Context, info any) (*desktopSession, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if e := r.ctx.Err(); e != nil {
		return nil, e
	}
	if r.session != nil && !r.session.dead.Load() {
		return r.session, nil
	}
	establish := func() (*desktopSession, error) {
		ctx, cancel := context.WithTimeout(requestCtx, 5*time.Second)
		defer cancel()
		a, e := address(r.profile)
		if e != nil {
			return nil, e
		}
		c, e := dialLocal(ctx, a.Socket)
		if e != nil {
			return nil, e
		}
		success := false
		defer func() {
			if !success {
				c.Close()
			}
		}()
		stop := context.AfterFunc(ctx, func() { c.Close() })
		defer stop()
		data, _ := marshal(map[string]any{"token": a.Token, "method": "mcp:session"})
		data = append(data, '\n')
		if _, e = c.Write(data); e != nil {
			return nil, e
		}
		line, e := bufio.NewReader(io.LimitReader(c, 4097)).ReadBytes('\n')
		if e != nil {
			return nil, e
		}
		if len(line) > 4096 {
			return nil, fmt.Errorf("Invalid Desktop connection response")
		}
		var response struct {
			Result struct {
				Connected bool   `json:"connected"`
				CallerID  string `json:"callerId"`
			} `json:"result"`
			Error map[string]any `json:"error"`
		}
		if e = json.Unmarshal(line, &response); e != nil {
			return nil, e
		}
		if !response.Result.Connected || response.Result.CallerID == "" {
			if response.Error != nil {
				return nil, &bridgeError{response.Error}
			}
			return nil, fmt.Errorf("Invalid Desktop connection response")
		}
		if !stop() && ctx.Err() != nil {
			return nil, ctx.Err()
		}
		cancel() // Only the lifecycle handshake has the five-second deadline.
		sessionCtx, sessionCancel := context.WithCancel(r.ctx)
		s := &desktopSession{conn: c, id: response.Result.CallerID, ctx: sessionCtx, cancel: sessionCancel}
		go func() { io.Copy(io.Discard, c); s.close() }()
		if _, e = r.request(requestCtx, "mcp:register-caller", map[string]any{"clientInfo": info}, s.id); e != nil {
			s.close()
			return nil, e
		}
		if s.dead.Load() {
			return nil, fmt.Errorf("Plasmic closed before MCP registered")
		}
		success = true
		return s, nil
	}
	s, e := establish()
	if e != nil {
		return nil, &bridgeError{map[string]any{"message": "Start Plasmic, then call the tool again to reconnect.", "name": "Error", "cause": detail(e), "code": "DESKTOP_UNAVAILABLE", "operationExecuted": false}}
	}
	r.session = s
	return s, nil
}
func (r *desktopRPC) call(ctx context.Context, name string, input any, info any) (any, error) {
	s, e := r.getSession(ctx, info)
	if e != nil {
		return nil, e
	}
	if e = ctx.Err(); e != nil {
		return nil, e
	}
	callCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	stop := context.AfterFunc(s.ctx, cancel)
	defer stop()
	return r.request(callCtx, name, input, s.id)
}
func (r *desktopRPC) request(ctx context.Context, name string, input any, callerID string) (any, error) {
	if e := ctx.Err(); e != nil {
		return nil, transportError(e, false)
	}
	a, e := address(r.profile)
	if e != nil {
		return nil, transportError(e, false)
	}
	ctx, cancel := context.WithTimeout(ctx, 150*time.Second)
	defer cancel()
	c, e := dialLocal(ctx, a.Socket)
	if e != nil {
		return nil, transportError(e, false)
	}
	defer c.Close()
	stop := context.AfterFunc(ctx, func() { c.Close() })
	defer stop()
	data, e := marshal(map[string]any{"token": a.Token, "method": name, "input": input, "callerId": callerID})
	if e != nil {
		return nil, e
	}
	data = append(data, '\n')
	n, e := c.Write(data)
	if e != nil {
		return nil, transportError(e, n > 0)
	}
	if n != len(data) {
		return nil, transportError(io.ErrShortWrite, true)
	}
	body, e := io.ReadAll(io.LimitReader(c, 32*1024*1024+1))
	if e != nil {
		return nil, transportError(e, true)
	}
	if len(body) > 32*1024*1024 {
		return nil, transportError(fmt.Errorf("Desktop response too large"), true)
	}
	value, e := decodeJSON(body)
	if e != nil {
		return nil, transportError(fmt.Errorf("Desktop connection closed before a response: %w", e), true)
	}
	m := fields(value)
	if payload := fields(m["error"]); payload != nil {
		return nil, &bridgeError{payload}
	}
	return m["result"], nil
}
