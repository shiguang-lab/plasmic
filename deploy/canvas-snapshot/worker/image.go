package main

import (
	"bytes"
	"errors"
	"image"
	"image/draw"
	"image/png"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"unsafe"

	"github.com/ebitengine/purego"
)

var compress func(*byte, int32, int32, int32, *unsafe.Pointer) uintptr
var freeWebP func(unsafe.Pointer)
var canvas = image.Rect(0, 0, 640, 360)

func loadCodec() error {
	handle, err := purego.Dlopen("libwebp.so.7", purego.RTLD_NOW|purego.RTLD_LOCAL)
	if err != nil {
		return err
	}
	purego.RegisterLibFunc(&compress, handle, "WebPEncodeLosslessRGBA")
	purego.RegisterLibFunc(&freeWebP, handle, "WebPFree")
	return nil
}
func decodeScreenshot(b []byte) (image.Image, error) {
	cfg, err := png.DecodeConfig(bytes.NewReader(b))
	if err != nil || cfg.Width != 640 || cfg.Height != 360 {
		return nil, errors.New("invalid screenshot")
	}
	return png.Decode(bytes.NewReader(b))
}
func encode(im image.Image) ([]byte, error) {
	rgba := image.NewNRGBA(canvas)
	draw.Draw(rgba, canvas, im, image.Point{}, draw.Src)
	var ptr unsafe.Pointer
	n := compress(&rgba.Pix[0], 640, 360, int32(rgba.Stride), &ptr)
	runtime.KeepAlive(rgba)
	if n == 0 {
		return nil, errors.New("WebP encoding failed")
	}
	defer freeWebP(ptr)
	return bytes.Clone(unsafe.Slice((*byte)(ptr), n)), nil
}
func publish(dir, name string, data []byte) error {
	f, err := os.CreateTemp(dir, ".cover-")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(data); err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if err = os.Rename(f.Name(), filepath.Join(dir, name)); err != nil {
		return err
	}
	d, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}
func prune(dir, id string, revision int) {
	files, _ := filepath.Glob(filepath.Join(dir, id+"-*.webp"))
	type item struct {
		n int
		p string
	}
	var older []item
	for _, p := range files {
		s := strings.TrimSuffix(strings.TrimPrefix(filepath.Base(p), id+"-"), ".webp")
		n, err := strconv.Atoi(s)
		if err == nil && n < revision {
			older = append(older, item{n, p})
		}
	}
	sort.Slice(older, func(i, j int) bool { return older[i].n > older[j].n })
	for i := 1; i < len(older); i++ {
		os.Remove(older[i].p)
	}
}
