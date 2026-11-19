package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"

	"code.dny.dev/ssrf"
	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/fetch"
	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
)

var internal = &http.Client{Timeout: 60 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
var public = &http.Client{Timeout: 10 * time.Second, Transport: &http.Transport{DialContext: (&net.Dialer{Timeout: 8 * time.Second, Control: ssrf.New(ssrf.WithAnyPort()).Safe}).DialContext, MaxIdleConnsPerHost: 4}, CheckRedirect: func(r *http.Request, via []*http.Request) error {
	if len(via) >= 8 || r.URL.User != nil || (r.URL.Scheme != "http" && r.URL.Scheme != "https") {
		return errors.New("invalid public redirect")
	}
	return nil
}}

func assetPath(u *url.URL) bool {
	return path.Clean(u.Path) == u.Path && u.RawPath == "" && !strings.Contains(u.Path, "\\") && (strings.HasPrefix(u.Path, "/static/") || strings.HasPrefix(u.Path, "/assets/") || strings.HasPrefix(u.Path, "/canvas-snapshot-assets/static/"))
}

// Map only the worker's outbound request. Chrome keeps the document's original resource URL.
func (w *worker) assetURL(u *url.URL) (string, bool) {
	if upstream, ok := w.assetUpstreams[u.Scheme+"://"+u.Host]; ok && assetPath(u) {
		return upstream + u.RequestURI(), true
	}
	return u.String(), false
}

// Only static files are exposed on loopback. Private HTML and the saved model
// are fulfilled exclusively for the job's main frame, never by this server.
func loopback(upstream *url.URL) (string, error) {
	l, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		return "", err
	}
	proxy := &httputil.ReverseProxy{Rewrite: func(p *httputil.ProxyRequest) {
		p.SetURL(upstream)
		p.Out.Header = make(http.Header)
		for _, name := range []string{"Accept", "Range", "Origin", "User-Agent"} {
			if value := p.In.Header.Get(name); value != "" {
				p.Out.Header.Set(name, value)
			}
		}
	}}
	server := &http.Server{ReadHeaderTimeout: 5 * time.Second, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.IsAbs() || r.Host != l.Addr().String() || (r.Method != "GET" && r.Method != "HEAD") || !assetPath(r.URL) {
			http.NotFound(w, r)
			return
		}
		proxy.ServeHTTP(w, r)
	})}
	go server.Serve(l)
	return "http://" + l.Addr().String(), nil
}

type resource struct {
	headers http.Header
	data    []byte
	status  int
}

func readResponse(c *http.Client, r *http.Request, limit int64) (resource, error) {
	resp, err := c.Do(r)
	if err != nil {
		return resource{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 && resp.StatusCode < 400 {
		return resource{}, errors.New("unexpected redirect")
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil || int64(len(data)) > limit {
		return resource{}, errors.New("resource read failed or too large")
	}
	return resource{resp.Header, data, resp.StatusCode}, nil
}
func (w *worker) private(ctx context.Context, p string, id string) (resource, error) {
	exp := strconv.FormatInt(time.Now().Unix()+240, 10)
	sig := hmac.New(sha256.New, w.secret)
	fmt.Fprintf(sig, "%s.%s", id, exp)
	r, err := http.NewRequestWithContext(ctx, "GET", w.upstream+p, nil)
	if err != nil {
		return resource{}, err
	}
	r.Header.Set("Authorization", "Bearer "+exp+"."+hex.EncodeToString(sig.Sum(nil)))
	res, err := readResponse(internal, r, 256<<20)
	if err == nil && res.status != 200 {
		err = fmt.Errorf("snapshot HTTP %d", res.status)
	}
	return res, err
}

type freshness struct {
	mu    sync.Mutex
	until time.Time
}

func (f *freshness) limit(t time.Time) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if t.Before(f.until) {
		f.until = t
	}
}
func (f *freshness) expiry() time.Time { f.mu.Lock(); defer f.mu.Unlock(); return f.until }
func freshUntil(h http.Header) time.Time {
	age, _ := strconv.Atoi(h.Get("Age"))
	ttl := 0
	for _, v := range strings.Split(strings.ToLower(h.Get("Cache-Control")), ",") {
		v = strings.TrimSpace(v)
		if v == "no-cache" || v == "no-store" {
			return time.Time{}
		}
		if s, ok := strings.CutPrefix(v, "max-age="); ok {
			ttl, _ = strconv.Atoi(s)
		}
	}
	if ttl <= age {
		return time.Time{}
	}
	return time.Now().Add(time.Duration(min(ttl-age, 300)) * time.Second)
}
func (w *worker) route(ctx context.Context, e *fetch.EventRequestPaused, main cdp.FrameID, p string, doc, model resource, f *freshness) {
	fail := func() {
		_, _ = chromedp.Call(ctx, fetch.FailRequest, fetch.FailRequestParams{RequestID: e.RequestID, ErrorReason: network.ErrorReasonBlockedByClient})
	}
	u, err := url.Parse(e.Request.URL)
	if err != nil || u.User != nil || (e.Request.Method != "GET" && e.Request.Method != "HEAD") {
		fail()
		return
	}
	origin := u.Scheme + "://" + u.Host
	var res resource
	switch {
	case origin == w.local && e.FrameID == main && e.RedirectedRequestID == "" && (u.RequestURI() == p || u.RequestURI() == p+"/model"):
		res = doc
		if u.Path != p {
			res = model
		}
	case e.ResourceType == network.ResourceTypeDocument && !(origin == w.local && u.Path == "/static/host.html" && e.FrameID != main):
		fail()
		return
	case origin == w.local && assetPath(u):
		_, _ = chromedp.Call(ctx, fetch.ContinueRequest, fetch.ContinueRequestParams{RequestID: e.RequestID})
		return
	default:
		target, trusted := w.assetURL(u)
		if !trusted {
			switch e.ResourceType {
			case network.ResourceTypeImage, network.ResourceTypeMedia, network.ResourceTypeFont, network.ResourceTypeStylesheet, network.ResourceTypeTextTrack:
			default:
				fail()
				return
			}
			if u.Scheme != "http" && u.Scheme != "https" {
				fail()
				return
			}
		}
		r, err := http.NewRequestWithContext(ctx, e.Request.Method, target, nil)
		if err != nil {
			fail()
			return
		}
		for k, v := range e.Request.Headers {
			switch strings.ToLower(k) {
			case "accept", "user-agent", "range", "origin":
				r.Header.Set(k, fmt.Sprint(v))
			}
		}
		client := public
		if trusted {
			client = internal
		}
		limit := int64(32 << 20)
		if trusted {
			limit = 256 << 20
		}
		res, err = readResponse(client, r, limit)
		if err != nil {
			f.limit(time.Time{})
			fail()
			return
		}
		if !trusted || !strings.HasPrefix(u.Path, "/static/") {
			f.limit(freshUntil(res.headers))
		}
		if res.status >= 400 {
			f.limit(time.Time{})
		}
	}
	var headers []*fetch.HeaderEntry
	for _, k := range []string{"Content-Type", "Content-Range", "Accept-Ranges", "Access-Control-Allow-Origin", "Cross-Origin-Resource-Policy", "Cache-Control", "Referrer-Policy", "X-Content-Type-Options", "X-Frame-Options"} {
		if v := res.headers.Get(k); v != "" {
			headers = append(headers, &fetch.HeaderEntry{Name: k, Value: v})
		}
	}
	_, _ = chromedp.Call(ctx, fetch.FulfillRequest, fetch.FulfillRequestParams{RequestID: e.RequestID, ResponseCode: int64(res.status), ResponseHeaders: headers, Body: res.data})
}
