package main

import (
	"context"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/modelcontextprotocol/go-sdk/jsonrpc"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/santhosh-tekuri/jsonschema/v6"
)

// Generated from the same registration metadata used by Desktop. There is no
// independently maintained Go tool schema or second persisted contract.
//
//go:embed generated.json
var manifestJSON []byte

type manifest struct {
	Version                string            `json:"version"`
	Instructions           string            `json:"instructions"`
	Tools                  []*mcp.Tool       `json:"tools"`
	RawTools               []json.RawMessage `json:"-"`
	EditorMethods          []string          `json:"editorMethods"`
	Styles                 map[string]any    `json:"styles"`
	PublishedSkill         map[string]any    `json:"publishedSkill"`
	LocalSkillInstructions string            `json:"localSkillInstructions"`
	ProtocolVersions       []string          `json:"protocolVersions"`
}
type bridge struct {
	data       manifest
	rpc        *desktopRPC
	results    *resultStore
	mu         sync.Mutex
	validators map[string]*jsonschema.Schema
}

func (b *bridge) routing(name string, args map[string]any) error {
	find := func(name string) *mcp.Tool {
		for _, t := range b.data.Tools {
			if t.Name == name {
				return t
			}
		}
		return nil
	}
	var msg string
	recovery := []any{}
	if name == "execute" && find(str(args["name"])) != nil {
		n := str(args["name"])
		msg = fmt.Sprintf("Call top-level %s directly, not as an execute editor operation. Use the parameters from execute.input; management tools do not require editor context.", n)
		input := args["input"]
		if input == nil {
			input = map[string]any{}
		}
		recovery = append(recovery, map[string]any{"tool": n, "arguments": input})
	} else if find(name) == nil && contains(b.data.EditorMethods, name) {
		tool := "execute"
		var input any = map[string]any{"name": name, "input": args}
		if name == "executeBatch" {
			tool = "execute_batch"
			input = args
		}
		msg = fmt.Sprintf("%s is a native editor operation. Call %s instead.", name, tool)
		recovery = append(recovery, map[string]any{"tool": tool, "arguments": input})
	} else if name == "get_app_state" {
		if ns, ok := args["toolNames"].([]any); ok {
			misplaced := []string{}
			for _, n := range ns {
				if t := find(str(n)); t != nil {
					misplaced = append(misplaced, str(n))
					required := fields(t.InputSchema)["required"]
					if required == nil {
						required = []any{}
					}
					recovery = append(recovery, map[string]any{"tool": n, "requiresInput": required})
				}
			}
			if len(misplaced) > 0 {
				msg = strings.Join(misplaced, ", ") + " are top-level Desktop tools. Their schemas come from MCP tools/list; get_app_state.toolNames accepts only native editor operations from availableEditorTools."
			}
		}
	}
	if msg != "" {
		return &bridgeError{map[string]any{"message": msg, "name": "Error", "code": "INVALID_TOOL_ROUTE", "operationExecuted": false, "recovery": recovery}}
	}
	return nil
}
func contains(ss []string, s string) bool {
	for _, x := range ss {
		if x == s {
			return true
		}
	}
	return false
}
func (b *bridge) validate(name string, args map[string]any) error {
	b.mu.Lock()
	schema := b.validators[name]
	if schema == nil {
		var tool *mcp.Tool
		for _, t := range b.data.Tools {
			if t.Name == name {
				tool = t
				break
			}
		}
		if tool == nil {
			b.mu.Unlock()
			return fmt.Errorf("Unknown desktop tool")
		}
		compiler := jsonschema.NewCompiler()
		compiler.DefaultDraft(jsonschema.Draft7)
		url := "urn:plasmic:" + name
		e := compiler.AddResource(url, tool.InputSchema)
		if e == nil {
			schema, e = compiler.Compile(url)
		}
		if e != nil {
			b.mu.Unlock()
			return e
		}
		b.validators[name] = schema
	}
	b.mu.Unlock()
	if e := schema.Validate(plain(args)); e != nil {
		hint := ""
		if name == "execute" {
			hint = ` Expected envelope: {"name":"read","input":{"collection":"components"}}; native fields belong inside input. Design mutations require input.reviewContext with purpose describing the entire edit and customOnly:true only when the user explicitly requires implementation without existing registered components; otherwise pass false. Read the native input schema with get_app_state.`
		}
		if name == "get_app_state" {
			hint = ` Example: {"toolNames":["read","insertHtml"]}.`
		}
		return fmt.Errorf("%s: %s.%s", name, e, hint)
	}
	return nil
}
func (b *bridge) call(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	started := time.Now()
	name := req.Params.Name
	var args map[string]any
	var arguments any
	if len(req.Params.Arguments) > 0 {
		v, e := decodeJSON(req.Params.Arguments)
		if e != nil {
			return b.fail(e), nil
		}
		args = fields(v)
		arguments = v
		if args == nil {
			return nil, &jsonrpc.Error{Code: jsonrpc.CodeInvalidParams, Message: "arguments must be an object"}
		}
	}
	if args == nil {
		args = map[string]any{}
		arguments = args
	}
	work := func() (any, error) {
		if e := b.routing(name, args); e != nil {
			return nil, e
		}
		if name == "execute" && args["input"] == nil {
			args["input"] = map[string]any{}
		}
		if e := b.validate(name, args); e != nil {
			return nil, &bridgeError{map[string]any{"message": e.Error(), "code": "INVALID_TOOL_INPUT", "operationExecuted": false}}
		}
		switch name {
		case "read_result":
			return b.results.read(args)
		case "get_style":
			id := str(args["id"])
			if id == "" {
				return b.data.Styles["list"], nil
			}
			v, ok := fields(b.data.Styles["values"])[id]
			if !ok {
				return nil, fmt.Errorf("Unknown style")
			}
			return v, nil
		case "read_skill":
			return b.readSkill(args)
		default:
			var info any = map[string]any{}
			if p := req.Session.InitializeParams(); p != nil {
				info = p.ClientInfo
			}
			return b.rpc.call(ctx, name, arguments, info)
		}
	}
	value, e := work()
	var result *mcp.CallToolResult
	if e != nil {
		result = b.fail(e)
	} else {
		if name == "reference_browser" {
			value = browserOutput(str(args["action"]), value)
		}
		m := fields(value)
		if name == "export_code" {
			if files, ok := m["files"].([]any); ok {
				m["fileCount"] = len(files)
				m["files"] = b.results.retain(files)
			}
		}
		var image []byte
		mime := ""
		if contains([]string{"get_screenshot", "read_image", "capture_browser", "generate_image", "reference_browser", "design_reference", "preview"}, name) && str(m["data"]) != "" {
			image, _ = base64.StdEncoding.DecodeString(str(m["data"]))
			mime = str(m["mimeType"])
			delete(m, "data")
		}
		if _, ok := m["svg"].(string); ok && name != "read_result" {
			m["svg"] = b.results.retain(m["svg"])
		} else if _, ok := m["html"].(string); ok {
			m["html"] = b.results.retain(m["html"])
		}
		result = b.results.output(value)
		if image != nil {
			result.Content = append(result.Content, &mcp.ImageContent{Data: image, MIMEType: mime})
		}
	}
	b.metrics(name, args, result, started)
	return result, nil
}
func (b *bridge) fail(err error) *mcp.CallToolResult {
	d := detail(err)
	if _, ok := d["stack"]; !ok {
		d["stack"] = str(d["name"]) + ": " + str(d["message"]) + "\n" + string(debug.Stack())
	}
	code := str(d["code"])
	msg := "Tool call failed."
	switch code {
	case "INVALID_TOOL_ROUTE", "INTERACTIVE_CANVAS_TARGET_REQUIRED", "INTERACTIVE_CANVAS_TARGET_UNAVAILABLE":
		msg = str(d["message"])
	case "CONTEXT_MISMATCH":
		msg = "Switch to the required editor context."
	case "PREVIEW_TARGET_BLOCKED":
		msg = "The target is covered by another element."
	case "PREVIEW_TIMEOUT":
		msg = "Preview timed out."
	case "PREVIEW_RUNTIME_ERROR":
		msg = "Preview runtime error: " + str(d["message"])
	default:
		if strings.HasPrefix(code, "PREVIEW_") {
			msg = "Preview operation failed."
		}
	}
	return b.results.failure(msg, d)
}
func (b *bridge) metrics(name string, args map[string]any, result *mcp.CallToolResult, started time.Time) {
	file := os.Getenv("PLASMIC_MCP_METRICS")
	if file == "" {
		return
	}
	input, _ := marshal(args)
	wire, _ := marshal(resultWire(result))
	textBytes, imageBytes := 0, 0
	for _, c := range result.Content {
		switch x := c.(type) {
		case *mcp.TextContent:
			textBytes += len(x.Text)
		case *mcp.ImageContent:
			imageBytes += len(x.Data)
		}
	}
	row := map[string]any{"time": time.Now().UTC().Format("2006-01-02T15:04:05.000Z"), "tool": name, "inputBytes": len(input), "wireBytes": len(wire), "textBytes": textBytes, "imageBytes": imageBytes, "ms": time.Since(started).Milliseconds(), "failed": result.IsError}
	if name == "execute" {
		row["operation"] = args["name"]
	}
	data, _ := marshal(row)
	b.mu.Lock()
	defer b.mu.Unlock()
	f, e := os.OpenFile(file, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if e == nil {
		defer f.Close()
		f.Write(append(data, '\n'))
	}
}

// Preserve the existing explicit isError:false field on successful calls.
type toolResult struct {
	mcp.ResultBase
	Content []map[string]any `json:"content"`
	IsError bool             `json:"isError"`
}
type toolListResult struct {
	mcp.ResultBase
	Tools []json.RawMessage `json:"tools"`
}

func main() {
	if e := run(); e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
}
func run() (err error) {
	var data manifest
	if e := json.Unmarshal(manifestJSON, &data); e != nil {
		return e
	}
	var raw struct {
		Tools []json.RawMessage `json:"tools"`
	}
	if e := json.Unmarshal(manifestJSON, &raw); e != nil {
		return e
	}
	data.RawTools = raw.Tools
	if len(os.Args) == 2 && os.Args[1] == "--version" {
		v, _ := marshal(map[string]any{"version": data.Version, "go": runtime.Version(), "platform": platform(), "arch": architecture()})
		fmt.Println(string(v))
		return nil
	}
	for _, arg := range os.Args[1:] {
		if arg != "--mcp" {
			return fmt.Errorf("Unsupported MCP argument")
		}
	}
	profile := os.Getenv("PLASMIC_DESKTOP_PROFILE")
	if profile == "" {
		home, e := os.UserHomeDir()
		if e != nil {
			return e
		}
		base := os.Getenv("XDG_CONFIG_HOME")
		switch runtime.GOOS {
		case "darwin":
			base = filepath.Join(home, "Library", "Application Support")
		case "windows":
			base = os.Getenv("APPDATA")
			if base == "" {
				base = filepath.Join(home, "AppData", "Roaming")
			}
		default:
			if base == "" {
				base = filepath.Join(home, ".config")
			}
		}
		profile = filepath.Join(base, "Plasmic Desktop")
	}
	log := newLifecycleLog(profile)
	log("process.start", map[string]any{"version": data.Version, "platform": platform(), "arch": architecture()})
	defer func() {
		fields := map[string]any{"code": 0}
		if err != nil {
			fields["code"] = 1
			fields["error"] = err.Error()
		}
		log("process.exit", fields)
	}()
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	rpc := &desktopRPC{profile: profile, ctx: ctx, log: log}
	b := &bridge{data: data, rpc: rpc, results: newResultStore(), validators: map[string]*jsonschema.Schema{}}
	defer func() { cancel(); rpc.close(); b.results.close() }()
	server := mcp.NewServer(&mcp.Implementation{Name: "plasmic-desktop", Version: data.Version}, &mcp.ServerOptions{Instructions: data.Instructions, Capabilities: &mcp.ServerCapabilities{Tools: &mcp.ToolCapabilities{}}, SupportedProtocolVersions: []string{"2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"}})
	server.AddReceivingMiddleware(func(next mcp.MethodHandler) mcp.MethodHandler {
		return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
			switch method {
			case "tools/list":
				return &toolListResult{Tools: data.RawTools}, nil
			case "tools/call":
				r, e := b.call(ctx, req.(*mcp.CallToolRequest))
				if e != nil {
					return nil, e
				}
				return &toolResult{Content: resultWire(r)["content"].([]map[string]any), IsError: r.IsError}, nil
			case "initialize":
				result, e := next(ctx, method, req)
				if e == nil {
					p := req.GetParams().(*mcp.InitializeParams)
					if contains(data.ProtocolVersions, p.ProtocolVersion) {
						result.(*mcp.InitializeResult).ProtocolVersion = p.ProtocolVersion
					}
				}
				return result, e
			default:
				if method == "ping" || strings.HasPrefix(method, "notifications/") {
					return next(ctx, method, req)
				}
				// The SDK also implements discovery APIs outside this bridge's contract.
				return nil, &jsonrpc.Error{Code: jsonrpc.CodeMethodNotFound, Message: "Method not found"}
			}
		}
	})
	err = runStdio(ctx, server, os.Stdin, os.Stdout, log)
	if ctx.Err() != nil {
		log("process.signal", nil)
		return nil
	}
	return err
}
func platform() string {
	if runtime.GOOS == "windows" {
		return "win32"
	}
	return runtime.GOOS
}
func architecture() string {
	if runtime.GOARCH == "amd64" {
		return "x64"
	}
	return runtime.GOARCH
}
