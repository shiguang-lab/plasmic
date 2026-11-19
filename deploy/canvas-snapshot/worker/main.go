package main

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"regexp"
	"runtime/debug"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/chromedp/chromedp"
)

type worker struct {
	dir, upstream, local string
	secret               []byte
	origins              map[string]bool
	cache                map[string]manifest
	busy                 sync.Mutex
	browser              context.Context
	stopBrowser          context.CancelFunc
	idle                 *time.Timer
	lastRender           time.Time
}

func (w *worker) openBrowser() error {
	if w.browser != nil {
		select {
		case <-chromedp.FromContext(w.browser).Browser.LostConnection:
			w.stopBrowser()
			w.browser = nil
		default:
			return nil
		}
	}
	// Browser traffic outside the explicit fetch handler fails closed; the only
	// directly reachable origin is the loopback static-file relay. CDP uses pipes.
	opts := append(chromedp.DefaultExecAllocatorOptions[:], chromedp.ExecPath("/opt/chrome-headless-shell/chrome-headless-shell"),
		chromedp.Flag("remote-debugging-pipe", true), chromedp.Flag("no-sandbox", true), chromedp.ProxyServer(w.local),
		chromedp.Flag("disable-background-networking", true), chromedp.Flag("force-webrtc-ip-handling-policy", "disable_non_proxied_udp"))
	alloc, stop := chromedp.NewExecAllocator(context.Background(), opts...)
	browser, closeBrowser := chromedp.NewContext(alloc)
	if err := chromedp.Do(browser); err != nil {
		closeBrowser()
		stop()
		return err
	}
	w.browser = browser
	w.stopBrowser = func() { closeBrowser(); stop() }
	return nil
}

// Keep the shell warm across the save debounce. Jobs that only reuse a cover
// do not extend the lifetime of the browser.
func (w *worker) releaseWhenIdle() {
	const grace = 2 * time.Minute
	w.lastRender = time.Now()
	if w.idle != nil {
		w.idle.Stop()
	}
	w.idle = time.AfterFunc(grace, func() {
		w.busy.Lock()
		defer w.busy.Unlock()
		if w.browser != nil && time.Since(w.lastRender) >= grace {
			w.stopBrowser()
			w.browser = nil
			// Large saved models and screenshot buffers are no longer needed.
			debug.FreeOSMemory()
		}
	})
}

var coverPath = regexp.MustCompile(`^/covers/([A-Za-z0-9_-]{1,128})$`)

func (w *worker) ServeHTTP(res http.ResponseWriter, req *http.Request) {
	parts := coverPath.FindStringSubmatch(req.URL.Path)
	if req.Method != "POST" || parts == nil {
		http.NotFound(res, req)
		return
	}
	if !w.busy.TryLock() {
		http.Error(res, "busy", 409)
		return
	}
	defer w.busy.Unlock()
	ctx, cancel := context.WithTimeout(req.Context(), 180*time.Second)
	defer cancel()
	result, err := w.generate(ctx, parts[1])
	if err != nil {
		log.Printf("cover %s: %v", parts[1], err)
		http.Error(res, "capture failed", 500)
		return
	}
	res.Header().Set("Content-Type", "application/json")
	json.NewEncoder(res).Encode(result)
}
func service() error {
	secret, err := os.ReadFile("/run/secrets/snapshot-key")
	if err != nil {
		return err
	}
	secret = bytes.TrimSpace(secret)
	decoded, err := hex.DecodeString(string(secret))
	if err != nil || len(decoded) != 32 {
		return errors.New("invalid snapshot credential")
	}
	upstream, err := url.Parse(os.Getenv("STUDIO_ORIGIN"))
	if err != nil || upstream.Host == "" || (upstream.Scheme != "http" && upstream.Scheme != "https") || upstream.User != nil || upstream.Path != "" {
		return errors.New("invalid Studio origin")
	}
	if err = loadCodec(); err != nil {
		return err
	}
	local, err := loopback(upstream)
	if err != nil {
		return err
	}
	w := &worker{dir: "/covers", local: local, upstream: upstream.String(), secret: secret, origins: map[string]bool{upstream.String(): true}, cache: map[string]manifest{}}
	for _, o := range strings.Split(os.Getenv("STUDIO_ASSET_ORIGINS"), ",") {
		w.origins[strings.TrimSpace(o)] = true
	}
	sock := "/jobs/screenshot.sock"
	if err = os.Remove(sock); err != nil && !os.IsNotExist(err) {
		return err
	}
	l, err := net.Listen("unix", sock)
	if err != nil {
		return err
	}
	defer l.Close()
	if err = os.Chmod(sock, 0600); err != nil {
		return err
	}
	server := &http.Server{Handler: w, ReadHeaderTimeout: 5 * time.Second}
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer cancel()
	go func() { <-ctx.Done(); server.Close() }()
	err = server.Serve(l)
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return fmt.Errorf("worker socket: %w", err)
}
func main() {
	if err := service(); err != nil {
		log.Fatal(err)
	}
}
