package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strconv"
)

// Keep source object order for read_result pagination, including JavaScript's
// integer-key ordering. A plain Go map would change continuation offsets.
type object struct {
	keys   []string
	values map[string]any
}

func decodeJSON(data []byte) (any, error) {
	d := json.NewDecoder(bytes.NewReader(data))
	d.UseNumber()
	var read func() (any, error)
	read = func() (any, error) {
		t, e := d.Token()
		if e != nil {
			return nil, e
		}
		switch t {
		case json.Delim('{'):
			o := &object{values: map[string]any{}}
			for d.More() {
				k, e := d.Token()
				if e != nil {
					return nil, e
				}
				key := k.(string)
				v, e := read()
				if e != nil {
					return nil, e
				}
				if _, ok := o.values[key]; !ok {
					o.keys = append(o.keys, key)
				}
				o.values[key] = v
			}
			_, e = d.Token()
			return o, e
		case json.Delim('['):
			a := []any{}
			for d.More() {
				v, e := read()
				if e != nil {
					return nil, e
				}
				a = append(a, v)
			}
			_, e = d.Token()
			return a, e
		default:
			return t, nil
		}
	}
	v, e := read()
	if e != nil {
		return nil, e
	}
	if _, e = d.Token(); e != io.EOF {
		return nil, fmt.Errorf("Invalid JSON response")
	}
	return v, nil
}
func fields(v any) map[string]any {
	switch x := v.(type) {
	case *object:
		return x.values
	case map[string]any:
		return x
	}
	return nil
}
func keys(v any) []string {
	var ks []string
	switch x := v.(type) {
	case *object:
		for _, k := range x.keys {
			if _, present := x.values[k]; present {
				ks = append(ks, k)
			}
		}
		known := map[string]bool{}
		for _, k := range ks {
			known[k] = true
		}
		extra := []string{}
		for k := range x.values {
			if !known[k] {
				extra = append(extra, k)
			}
		}
		sort.Strings(extra)
		ks = append(ks, extra...)
	case map[string]any:
		for k := range x {
			ks = append(ks, k)
		}
		sort.Strings(ks)
	case []any:
		for i := range x {
			ks = append(ks, strconv.Itoa(i))
		}
	}
	numeric, other := []string{}, []string{}
	for _, k := range ks {
		if n, e := strconv.ParseUint(k, 10, 32); e == nil && n < 4294967295 && strconv.FormatUint(n, 10) == k {
			numeric = append(numeric, k)
		} else {
			other = append(other, k)
		}
	}
	sort.Slice(numeric, func(i, j int) bool {
		a, _ := strconv.ParseUint(numeric[i], 10, 32)
		b, _ := strconv.ParseUint(numeric[j], 10, 32)
		return a < b
	})
	return append(numeric, other...)
}
func (o *object) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	first := true
	for _, k := range keys(o) {
		v, ok := o.values[k]
		if !ok {
			continue
		}
		if !first {
			b.WriteByte(',')
		}
		first = false
		kb, _ := marshal(k)
		vb, e := marshal(v)
		if e != nil {
			return nil, e
		}
		b.Write(kb)
		b.WriteByte(':')
		b.Write(vb)
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}
func marshal(v any) ([]byte, error) {
	var b bytes.Buffer
	e := json.NewEncoder(&b)
	e.SetEscapeHTML(false)
	if err := e.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(b.Bytes(), []byte{'\n'}), nil
}
func at(v any, key string) (any, bool) {
	if a, ok := v.([]any); ok {
		i, e := strconv.Atoi(key)
		if e == nil && i >= 0 && i < len(a) {
			return a[i], true
		}
		return nil, false
	}
	m := fields(v)
	x, ok := m[key]
	return x, ok
}
func str(v any) string { s, _ := v.(string); return s }
func integer(v any, fallback int) int {
	bounded := func(f float64) int {
		maxInt := int(^uint(0) >> 1)
		if f >= float64(maxInt) {
			return maxInt
		}
		if f <= float64(-maxInt-1) {
			return -maxInt - 1
		}
		return int(f)
	}
	switch x := v.(type) {
	case json.Number:
		n, e := strconv.Atoi(string(x))
		if e == nil {
			return n
		}
		f, _ := strconv.ParseFloat(string(x), 64)
		return bounded(f)
	case float64:
		return bounded(x)
	case int:
		return x
	}
	return fallback
}
func propertyKey(v any) string {
	if n, ok := v.(json.Number); ok {
		f, _ := n.Float64()
		if f == 0 {
			return "0"
		}
		if f < 1e21 {
			return strconv.FormatFloat(f, 'f', -1, 64)
		}
		return strconv.FormatFloat(f, 'g', -1, 64)
	}
	return fmt.Sprint(v)
}
func plain(v any) any {
	switch x := v.(type) {
	case map[string]any:
		m := map[string]any{}
		for k, v := range x {
			m[k] = plain(v)
		}
		return m
	case *object:
		m := map[string]any{}
		for k, v := range x.values {
			m[k] = plain(v)
		}
		return m
	case []any:
		a := make([]any, len(x))
		for i, v := range x {
			a[i] = plain(v)
		}
		return a
	}
	return v
}
