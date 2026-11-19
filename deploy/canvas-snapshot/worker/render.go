package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"math"
	"os"
	"path/filepath"
	"time"

	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/fetch"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
	"golang.org/x/image/webp"
)

type board struct {
	ID                       string
	Arena                    int
	Left, Top, Width, Height float64
	Key                      string
}

func (b board) rect() image.Rectangle {
	return image.Rect(int(math.Floor(b.Left)), int(math.Floor(b.Top)), int(math.Ceil(b.Left+b.Width)), int(math.Ceil(b.Top+b.Height)))
}
func (b board) reusable(old board) bool {
	return b.Key != "" && b.Key == old.Key && b.Width == old.Width && b.Height == old.Height &&
		b.Left-old.Left == math.Trunc(b.Left-old.Left) && b.Top-old.Top == math.Trunc(b.Top-old.Top) && b.rect().Size() == old.rect().Size()
}

type manifest struct {
	exact, file, checksum string
	textScope, textDigest string
	revision              int
	boards                []board
	until                 time.Time
	complete              bool
}
type result struct {
	ProjectID   string `json:"projectId"`
	Revision    int    `json:"revision"`
	Boards      int    `json:"boards"`
	Rendered    int    `json:"rendered"`
	Reused      int    `json:"reused"`
	Unavailable int    `json:"unavailableImages"`
	Name        string `json:"name"`
	Elapsed     int64  `json:"elapsedMs"`
}

func (w *worker) remember(id string, m manifest) {
	if len(w.cache) >= 64 {
		for k, v := range w.cache {
			if !time.Now().Before(v.until) {
				delete(w.cache, k)
			}
		}
		if len(w.cache) >= 64 {
			for k := range w.cache {
				delete(w.cache, k)
				break
			}
		}
	}
	w.cache[id] = m
}

// Rounded tiles can contain background pixels around a fractional edge.
// Only disjoint rounded rectangles may be lifted out of a flattened cover.
func disjoint(bs []board) bool {
	for i, b := range bs {
		for _, a := range bs[:i] {
			if b.rect().Overlaps(a.rect()) {
				return false
			}
		}
	}
	return true
}
func (w *worker) generate(ctx context.Context, id string) (result, error) {
	start := time.Now()
	out := result{ProjectID: id}
	p := "/canvas-snapshot/" + id
	doc, err := w.private(ctx, p, id)
	if err != nil {
		return out, err
	}
	model, err := w.private(ctx, p+"/model", id)
	if err != nil {
		return out, err
	}
	m, err := parseInputs(model.data, doc.data)
	if err != nil {
		return out, err
	}
	out.Revision = m.revision
	out.Name = fmt.Sprintf("%s-%d.webp", id, out.Revision)
	old := w.cache[id]
	var previous []byte
	if time.Now().Before(old.until) {
		previous, _ = os.ReadFile(filepath.Join(w.dir, old.file))
		if digest(previous) != old.checksum {
			previous = nil
		}
	}
	if previous != nil && old.complete && old.exact == m.exact {
		out.Boards = len(old.boards)
		out.Reused = out.Boards
		if old.file != out.Name {
			if err := publish(w.dir, out.Name, previous); err != nil {
				return out, err
			}
			old.file = out.Name
			w.remember(id, old)
		}
	} else {
		if err = w.render(ctx, p, doc, model, m, old, previous, &out); err != nil {
			return out, err
		}
	}
	prune(w.dir, id, out.Revision)
	out.Elapsed = time.Since(start).Milliseconds()
	return out, nil
}
func (w *worker) render(ctx context.Context, p string, doc, model resource, m *inputs, old manifest, previous []byte, out *result) error {
	if err := w.openBrowser(); err != nil {
		return err
	}
	job, closeJob := chromedp.NewContext(w.browser, chromedp.WithNewBrowserContext())
	defer closeJob()
	job, cancel := context.WithCancel(job)
	stop := context.AfterFunc(ctx, cancel)
	defer stop()
	defer cancel()
	defer w.releaseWhenIdle()
	if err := chromedp.Do(job, chromedp.EmulateViewport(640, 360)); err != nil {
		return err
	}
	tree, err := chromedp.Call(job, page.GetFrameTree, cdp.Empty{})
	if err != nil {
		return err
	}
	fresh := &freshness{until: time.Now().Add(5 * time.Minute)}
	if err = chromedp.Listen(job, func(ev any) {
		if e, ok := ev.(*fetch.EventRequestPaused); ok {
			go w.route(job, e, tree.FrameTree.Frame.ID, p, doc, model, fresh)
		}
	}); err != nil {
		return err
	}
	if _, err = chromedp.Call(job, fetch.Enable, fetch.EnableParams{}); err != nil {
		return err
	}
	if err = chromedp.Do(job, chromedp.Navigate(w.local+p)); err != nil {
		return err
	}
	state, err := chromedp.Run(job, chromedp.Poll[string]("document.querySelector('#overview')?.dataset.state", chromedp.WithPollingTimeout(120*time.Second)))
	if err != nil {
		return err
	}
	if state != "ready" {
		return errors.New("canvas initialization failed")
	}
	plan, err := chromedp.Run(job, chromedp.Evaluate[struct {
		Revision int
		Boards   []board
	}]("({revision:window.canvasSnapshot.revision,boards:window.canvasSnapshot.boards})"))
	if err != nil {
		return err
	}
	bs := plan.Boards
	out.Boards = len(bs)
	if plan.Revision != m.revision || len(bs) == 0 {
		return errors.New("invalid canvas plan")
	}
	canvasImage := image.NewRGBA(canvas)
	draw.Draw(canvasImage, canvas, &image.Uniform{color.RGBA{232, 233, 239, 255}}, image.Point{}, draw.Src)
	var cached image.Image
	if len(previous) > 0 {
		cached, _ = webp.Decode(bytes.NewReader(previous))
	}
	last := map[string]board{}
	for _, b := range old.boards {
		last[b.ID] = b
	}
	separated := disjoint(bs)
	scope := m.textScope(bs)
	// A cover records the saved design. Preserve the last captured pixels of
	// untouched library boards only across a proven literal-text edit.
	localTextEdit := scope != "" && scope == old.textScope && m.revision > old.revision && m.textDigest != old.textDigest
	allStable := separated && m.stable
	groups := map[int][]int{}
	var order []int
	for i := range bs {
		b := &bs[i]
		if b.Width <= 0 || b.Height <= 0 || !b.rect().In(canvas) || b.rect().Empty() {
			return errors.New("invalid board bounds")
		}
		b.Key = m.key(b.ID)
		if b.Key == "" {
			allStable = false
		}
		prev, exists := last[b.ID]
		if cached != nil && separated && (m.stable || localTextEdit) && exists && b.reusable(prev) {
			draw.Draw(canvasImage, b.rect(), cached, prev.rect().Min, draw.Src)
			out.Reused++
			continue
		}
		if _, ok := groups[b.Arena]; !ok {
			order = append(order, b.Arena)
		}
		groups[b.Arena] = append(groups[b.Arena], i)
	}
	// Flatten overlapping arenas in paint order. Keep the previous screenshot
	// underneath the next arena so transparent shadows and edges blend in Chrome.
	var backdrop []byte
	for _, group := range order {
		indices := groups[group]
		args, _ := json.Marshal(indices)
		if len(backdrop) > 0 {
			css := `document.getElementById("overview").style.backgroundImage="url(data:image/png;base64,` + base64.StdEncoding.EncodeToString(backdrop) + `)"`
			if _, err := chromedp.Run(job, chromedp.Evaluate[string](css)); err != nil {
				return err
			}
		}
		media, err := chromedp.Run(job, chromedp.Evaluate[struct {
			Unavailable int
			Settling    bool
		}]("window.canvasSnapshot.renderBoards("+string(args)+")", chromedp.EvalAwaitPromise))
		if err != nil {
			return err
		}
		shot, err := chromedp.Run(job, chromedp.CaptureScreenshot())
		if err != nil {
			return err
		}
		im, err := decodeScreenshot(shot)
		if err != nil {
			return err
		}
		if !separated && len(order) > 1 {
			backdrop = shot
		}
		if !separated || len(indices) == len(bs) {
			draw.Draw(canvasImage, canvas, im, image.Point{}, draw.Src)
		} else {
			for _, i := range indices {
				r := bs[i].rect()
				draw.Draw(canvasImage, r, im, r.Min, draw.Src)
			}
		}
		out.Rendered += len(indices)
		out.Unavailable += media.Unavailable
		if media.Settling {
			fresh.limit(time.Time{})
		}
	}
	data, err := encode(canvasImage)
	if err != nil {
		return err
	}
	if err = publish(w.dir, out.Name, data); err != nil {
		return err
	}
	until := fresh.expiry()
	if out.Reused > 0 && old.until.Before(until) {
		until = old.until
	}
	if out.Unavailable > 0 || !separated {
		until = time.Time{}
	}
	if !time.Now().Before(until) || (!m.stable && scope == "") {
		delete(w.cache, out.ProjectID)
		return nil
	}
	w.remember(out.ProjectID, manifest{exact: m.exact, textScope: scope, textDigest: m.textDigest, revision: m.revision, file: out.Name, checksum: digest(data), boards: bs, until: until, complete: allStable})
	return nil
}
