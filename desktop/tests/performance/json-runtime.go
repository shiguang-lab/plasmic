// Standalone diagnostic, not a production bridge or draft-store implementation.
package main

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"encoding/json"
	"io"
	"os"
)

func main() {
	in, out := bufio.NewReader(os.Stdin), bufio.NewWriter(os.Stdout)
	if _, err := out.Write([]byte{'R'}); err != nil {
		panic(err)
	}
	if err := out.Flush(); err != nil {
		panic(err)
	}
	for {
		var size uint32
		if err := binary.Read(in, binary.BigEndian, &size); err == io.EOF {
			return
		} else if err != nil {
			panic(err)
		}
		if size > 64*1024*1024 {
			panic("fixture exceeds limit")
		}
		body := make([]byte, size)
		if _, err := io.ReadFull(in, body); err != nil {
			panic(err)
		}
		decoder := json.NewDecoder(bytes.NewReader(body))
		decoder.UseNumber()
		var value any
		if err := decoder.Decode(&value); err != nil {
			panic(err)
		}
		var buffer bytes.Buffer
		encoder := json.NewEncoder(&buffer)
		encoder.SetEscapeHTML(false)
		if err := encoder.Encode(value); err != nil {
			panic(err)
		}
		result := bytes.TrimSuffix(buffer.Bytes(), []byte{'\n'})
		if err := binary.Write(out, binary.BigEndian, uint32(len(result))); err != nil {
			panic(err)
		}
		if _, err := out.Write(result); err != nil {
			panic(err)
		}
		if err := out.Flush(); err != nil {
			panic(err)
		}
	}
}
