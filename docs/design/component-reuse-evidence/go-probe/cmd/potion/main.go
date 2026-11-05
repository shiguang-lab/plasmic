package main

import (
	"context"
	"fmt"
	potion "github.com/trengrj/go-potion"
	"plasmic-embedding-probe/internal/probe"
)

type engine struct {
	model *potion.Potion
	key   string
}

func newEngine(c probe.Config) (probe.Engine, error) {
	choices := map[string]potion.Model{"potion8": potion.BASE8M, "potionMulti": potion.MULTILINGUAL128M}
	key, ok := choices[c.Model]
	if !ok {
		return nil, fmt.Errorf("Unknown Potion model")
	}
	m, err := potion.New(context.Background(), key)
	if err != nil {
		return nil, err
	}
	return &engine{m, c.Model}, nil
}
func (e *engine) Metadata() map[string]any {
	return map[string]any{"library": "go-potion v0.1.2", "commit": "c3ca68d3e5dfcc54226acc597c19ddbcc8caef9f", "backend": "pure Go, mmap-backed F32 weights", "maxTokens": nil, "pooling": "token mean + L2 normalization", "tokenizer": "native Go WordPiece or Unigram", "limitation": "Library has no token cap option; uses same raw document fragments without token truncation. Not a same-model replacement for Bekko."}
}
func (e *engine) Tokens(text string) ([]int, error)          { return e.model.Tokenize(text) }
func (e *engine) Encode(texts []string) ([][]float32, error) { return e.model.EncodeMany(texts) }
func (e *engine) Close() error                               { return e.model.Close() }
func main()                                                  { probe.Run(newEngine) }
