package main

import (
	"context"
	"fmt"
	"github.com/gomlx/go-huggingface/tokenizers/api"
	"github.com/knights-analytics/hugot"
	"github.com/knights-analytics/hugot/backends"
	"github.com/knights-analytics/hugot/options"
	"github.com/knights-analytics/hugot/pipelines"
	"plasmic-embedding-probe/internal/probe"
)

type engine struct {
	session  *hugot.Session
	pipeline *pipelines.FeatureExtractionPipeline
	cfg      probe.Config
}

func newEngine(c probe.Config) (probe.Engine, error) {
	ctx := context.Background()
	var session *hugot.Session
	var err error
	if c.Backend == "ort" {
		session, err = hugot.NewORTSession(ctx, options.WithOnnxLibraryPath(c.ORTLibrary), options.WithIntraOpNumThreads(2), options.WithInterOpNumThreads(1))
	} else {
		session, err = hugot.NewGoSession(ctx)
	}
	if err != nil {
		return nil, err
	}
	filename := "onnx/model_quantized.onnx"
	output := "last_hidden_state"
	if c.Model == "gemma" {
		filename = "onnx/model_q4.onnx"
		output = "sentence_embedding"
	}
	p, err := hugot.NewPipeline(session, hugot.FeatureExtractionConfig{ModelPath: c.ModelPath, OnnxFilename: filename, Name: "component-reuse-probe", Options: []backends.PipelineOption[*pipelines.FeatureExtractionPipeline]{pipelines.WithOutputName(output)}})
	if err != nil {
		session.Destroy()
		return nil, err
	}
	// Match the original tokenizer cap. Preserve tokenizer's own special tokens.
	err = p.Model.Tokenizer.GoTokenizer.Tokenizer.With(api.EncodeOptions{AddSpecialTokens: true, MaxLen: 512})
	if err != nil {
		session.Destroy()
		return nil, err
	}
	return &engine{session, p, c}, nil
}
func (e *engine) Metadata() map[string]any {
	return map[string]any{"library": "hugot v0.8.5", "backend": e.cfg.Backend, "tokenizer": "gomlx/go-huggingface pure Go", "maxTokens": 512, "tokenCapImplementation": "Probe takes first 512 encoded tokens, matching Transformers.js 4.3.2. hftokenizer MaxLen option was not applied by EncodeWithAnnotations in this version.", "pooling": map[bool]string{true: "model sentence_embedding", false: "CLS"}[e.cfg.Model == "gemma"], "intraThreads": 2, "interThreads": 1, "onnxruntimeDylib": "1.30.0, same file as Node probe"}
}
func capPrefix[T any](values []T) []T {
	if len(values) <= 512 {
		return values
	}
	return values[:512]
}
func (e *engine) tokenize(b *backends.PipelineBatch, texts []string) {
	backends.TokenizeInputs(b, e.pipeline.Model.Tokenizer, texts)
	b.MaxSequenceLength = 0
	for i := range b.Input {
		in := &b.Input[i]
		in.TokenIDs = capPrefix(in.TokenIDs)
		in.Tokens = capPrefix(in.Tokens)
		in.TypeIDs = capPrefix(in.TypeIDs)
		in.AttentionMask = capPrefix(in.AttentionMask)
		in.SpecialTokensMask = capPrefix(in.SpecialTokensMask)
		in.Offsets = capPrefix(in.Offsets)
		in.MaxAttentionIndex = len(in.TokenIDs) - 1
		b.MaxSequenceLength = max(b.MaxSequenceLength, len(in.TokenIDs))
	}
}
func (e *engine) Tokens(text string) ([]int, error) {
	b := backends.NewBatch(1)
	e.tokenize(b, []string{text})
	ids := make([]int, len(b.Input[0].TokenIDs))
	for i, n := range b.Input[0].TokenIDs {
		ids[i] = int(n)
	}
	return ids, b.Destroy()
}
func (e *engine) Encode(texts []string) (vectors [][]float32, err error) {
	b := backends.NewBatch(len(texts))
	defer func() {
		if x := b.Destroy(); err == nil {
			err = x
		}
	}()
	e.tokenize(b, texts)
	if err = backends.CreateInputTensors(b, e.pipeline.Model); err != nil {
		return nil, err
	}
	if err = backends.RunSessionOnBatch(context.Background(), b, e.pipeline.BasePipeline); err != nil {
		return nil, err
	}
	// Hugot's default feature pipeline mean-pools. These BGE/Granite models require CLS.
	switch value := b.OutputValues[e.pipeline.OutputIndex].(type) {
	case [][][]float32:
		vectors = make([][]float32, len(value))
		for i, row := range value {
			if len(row) == 0 {
				return nil, fmt.Errorf("Empty token output")
			}
			vectors[i] = append([]float32(nil), row[0]...)
		}
	case [][]float32:
		vectors = value
	default:
		return nil, fmt.Errorf("Unsupported output type %T", value)
	}
	return vectors, nil
}
func (e *engine) Close() error { return e.session.Destroy() }
func main()                    { probe.Run(newEngine) }
