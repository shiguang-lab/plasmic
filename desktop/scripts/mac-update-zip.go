// Repack the signed app.asar ZIP entry for differential updates. All other
// entries keep their compressed bytes, Unix modes and symlink contents.
package main

import (
	"archive/zip"
	"bytes"
	"compress/flate"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
)

type asarEntry struct {
	Files  map[string]asarEntry `json:"files"`
	Offset *int64               `json:"offset,string"`
}

// ASAR offsets are relative to the end of its two Chromium pickle records.
func boundaries(data []byte) ([]int, error) {
	if len(data) < 16 {
		return nil, fmt.Errorf("truncated ASAR")
	}
	payload := 8 + int64(binary.LittleEndian.Uint32(data[4:8]))
	headerEnd := 16 + int64(binary.LittleEndian.Uint32(data[12:16]))
	if headerEnd > payload || payload > int64(len(data)) {
		return nil, fmt.Errorf("invalid ASAR header lengths")
	}
	var root asarEntry
	if err := json.Unmarshal(data[16:headerEnd], &root); err != nil {
		return nil, err
	}
	if root.Files == nil {
		return nil, fmt.Errorf("missing ASAR file table")
	}
	ends := []int{int(payload), len(data)}
	var visit func(asarEntry) error
	visit = func(entry asarEntry) error {
		if entry.Offset != nil {
			if *entry.Offset < 0 || *entry.Offset > int64(len(data))-payload {
				return fmt.Errorf("invalid packed file offset")
			}
			ends = append(ends, int(payload+*entry.Offset))
		}
		for _, child := range entry.Files {
			if err := visit(child); err != nil {
				return err
			}
		}
		return nil
	}
	if err := visit(root); err != nil {
		return nil, err
	}
	sort.Ints(ends)
	return ends, nil
}

func writeASAR(out *zip.Writer, file *zip.File) error {
	in, err := file.Open()
	if err != nil {
		return err
	}
	defer in.Close()
	data, err := io.ReadAll(in) // also validates the original ZIP CRC
	if err != nil {
		return err
	}
	ends, err := boundaries(data)
	if err != nil {
		return err
	}
	var compressed bytes.Buffer
	writer, err := flate.NewWriter(&compressed, 6)
	if err != nil {
		return err
	}
	start := 0
	for _, end := range ends {
		for start < end {
			next := min(start+256*1024, end)
			if _, err := writer.Write(data[start:next]); err != nil {
				return err
			}
			if next < len(data) {
				// Flush emits a non-final, byte-aligned block. Reset forgets
				// the dictionary so unchanged files reproduce identical bytes.
				if err := writer.Flush(); err != nil {
					return err
				}
				writer.Reset(&compressed)
			}
			start = next
		}
	}
	if err := writer.Close(); err != nil {
		return err
	}
	header := file.FileHeader
	header.Method = zip.Deflate
	header.CompressedSize64 = uint64(compressed.Len())
	dest, err := out.CreateRaw(&header)
	if err != nil {
		return err
	}
	_, err = compressed.WriteTo(dest)
	return err
}

func repack(name string) error {
	in, err := zip.OpenReader(name)
	if err != nil {
		return err
	}
	defer in.Close()
	temp, err := os.CreateTemp(filepath.Dir(name), ".update-*.zip")
	if err != nil {
		return err
	}
	defer os.Remove(temp.Name())
	defer temp.Close()
	out := zip.NewWriter(temp)
	if err := out.SetComment(in.Comment); err != nil {
		return err
	}
	count := 0
	for _, file := range in.File {
		if file.Name == "Plasmic.app/Contents/Resources/app.asar" {
			count++
			err = writeASAR(out, file)
		} else {
			err = out.Copy(file)
		}
		if err != nil {
			return err
		}
	}
	if count != 1 {
		return fmt.Errorf("expected one app.asar, found %d", count)
	}
	if err := out.Close(); err != nil {
		return err
	}
	mode, err := os.Stat(name)
	if err != nil {
		return err
	}
	if err := temp.Chmod(mode.Mode().Perm()); err != nil {
		return err
	}
	if err := temp.Close(); err != nil {
		return err
	}
	return os.Rename(temp.Name(), name)
}

func main() {
	if len(os.Args) != 2 {
		log.Fatal("usage: mac-update-zip ARCHIVE.zip")
	}
	if err := repack(os.Args[1]); err != nil {
		log.Fatal(err)
	}
}
