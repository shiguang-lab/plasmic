package probe

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"math"
	"os"
	"runtime"
	"runtime/debug"
	"sort"
	"syscall"
	"time"
)

type Document struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Text string `json:"text"`
}
type Case struct {
	ID       string   `json:"id"`
	Intent   string   `json:"intent"`
	Expected []string `json:"expected"`
}
type Data struct {
	Corpus []Document `json:"corpus"`
	Cases  []Case     `json:"cases"`
}
type Config struct {
	Model, Mode, DataPath, Output, ModelPath, ORTLibrary, Backend string
	Repeat                                                        int
	Handshake                                                     bool
}
type Engine interface {
	Encode([]string) ([][]float32, error)
	Tokens(string) ([]int, error)
	Close() error
	Metadata() map[string]any
}
type Factory func(Config) (Engine, error)
type Ranking struct {
	ID    string  `json:"id"`
	Score float64 `json:"score"`
}
type Result struct {
	Case
	Rank *int      `json:"rank"`
	Top5 []Ranking `json:"top5"`
}
type Sample struct {
	CaseID     string  `json:"caseId"`
	Characters int     `json:"characters"`
	MS         float64 `json:"ms"`
}

func Check(err error) {
	if err != nil {
		panic(err)
	}
}
func Millis(t time.Time) float64 { return float64(time.Since(t)) / float64(time.Millisecond) }
func Emit(value any)             { b, err := json.Marshal(value); Check(err); fmt.Println(string(b)) }
func normalize(v []float32) ([]float32, bool) {
	out := append([]float32(nil), v...)
	norm := float64(0)
	for _, n := range out {
		if math.IsNaN(float64(n)) || math.IsInf(float64(n), 0) {
			panic("Non-finite embedding")
		}
		norm += float64(n) * float64(n)
	}
	if norm == 0 {
		return out, false
	}
	norm = math.Sqrt(norm)
	for i := range out {
		out[i] = float32(float64(out[i]) / norm)
	}
	return out, true
}
func Run(factory Factory) {
	runtime.GOMAXPROCS(2)
	cfg := Config{}
	flag.StringVar(&cfg.Model, "model", "", "Model key")
	flag.StringVar(&cfg.Mode, "mode", "quality", "quality or resources")
	flag.StringVar(&cfg.DataPath, "data", "data.json", "Frozen corpus path")
	flag.StringVar(&cfg.Output, "output", "result.json", "Result file")
	flag.StringVar(&cfg.ModelPath, "model-path", "", "Prepared local model directory")
	flag.StringVar(&cfg.ORTLibrary, "ort-library", "", "Directory with libonnxruntime.dylib")
	flag.StringVar(&cfg.Backend, "backend", "ort", "Hugot backend: ort or go")
	flag.IntVar(&cfg.Repeat, "repeat", 1, "Fresh-process repetition")
	flag.BoolVar(&cfg.Handshake, "handshake", false, "Pause at each memory phase for external observer")
	flag.Parse()
	if cfg.Mode != "quality" && cfg.Mode != "resources" {
		panic("Invalid mode")
	}
	input, err := os.ReadFile(cfg.DataPath)
	Check(err)
	var data Data
	Check(json.Unmarshal(input, &data))
	digest := sha256.Sum256(input)
	stdin := bufio.NewReader(os.Stdin)
	phase := func(name string) {
		var mem runtime.MemStats
		runtime.ReadMemStats(&mem)
		var usage syscall.Rusage
		Check(syscall.Getrusage(syscall.RUSAGE_SELF, &usage))
		Emit(map[string]any{"event": "phase", "phase": name, "goHeapAlloc": mem.HeapAlloc, "goSysBytes": mem.Sys, "osMaxRssBytes": usage.Maxrss})
		if cfg.Handshake {
			_, err := stdin.ReadString('\n')
			Check(err)
		}
	}
	phase("baseline")
	start := time.Now()
	engine, err := factory(cfg)
	Check(err)
	loadMS := Millis(start)
	defer func() { Check(engine.Close()) }()
	phase("loaded")
	query := func(text string) string {
		if cfg.Model == "bge" {
			return "为这个句子生成表示以用于检索相关文章：" + text
		}
		if cfg.Model == "gemma" {
			return "task: search result | query: " + text
		}
		return text
	}
	passage := func(d Document) string {
		if cfg.Model == "gemma" {
			return "title: " + d.Name + " | text: " + d.Text
		}
		return d.Text
	}
	encode := func(texts []string) [][]float32 {
		v, err := engine.Encode(texts)
		Check(err)
		if len(v) != len(texts) {
			panic("Invalid batch size")
		}
		for i := range v {
			v[i], _ = normalize(v[i])
		}
		return v
	}
	index := func() [][]float32 {
		vectors := make([][]float32, 0, len(data.Corpus))
		for i := 0; i < len(data.Corpus); i += 4 {
			end := min(i+4, len(data.Corpus))
			texts := make([]string, end-i)
			for j := i; j < end; j++ {
				texts[j-i] = passage(data.Corpus[j])
			}
			vectors = append(vectors, encode(texts)...)
		}
		return vectors
	}
	info, _ := debug.ReadBuildInfo()
	mods := []map[string]string{}
	if info != nil {
		for _, m := range info.Deps {
			mods = append(mods, map[string]string{"path": m.Path, "version": m.Version, "sum": m.Sum})
		}
	}
	summary := map[string]any{"modelKey": cfg.Model, "mode": cfg.Mode, "repeat": cfg.Repeat, "date": time.Now().UTC().Format(time.RFC3339Nano),
		"goVersion": runtime.Version(), "goos": runtime.GOOS, "goarch": runtime.GOARCH, "gomaxprocs": runtime.GOMAXPROCS(0), "logicalCPUs": runtime.NumCPU(),
		"corpusSha256": hex.EncodeToString(digest[:]), "metadata": engine.Metadata(), "localLoadMs": loadMS, "buildDependencies": mods,
		"execution":   "New compiled Go process, local prepared assets only; OS disk cache not cleared. CPU only.",
		"limitations": []string{"Manually authored frozen pilot set; no independent labels or holdout.", "Not real Studio/MCP/Electron interaction or total scan latency.", "No BM25, hybrid retrieval, reranker or calibrated abstention threshold.", "Fresh-process setup excludes compilation and network download."}}
	report := map[string]any{"summary": summary}
	if cfg.Mode == "quality" {
		start = time.Now()
		corpus := index()
		summary["indexMs"] = Millis(start)
		phase("indexed")
		results := []Result{}
		hits := map[int]int{1: 0, 3: 0, 5: 0}
		mrr := float64(0)
		positive := 0
		zeroQueries := 0
		tokenIDs := make(map[string][]int)
		maxTokens := 0
		over512 := 0
		for _, d := range data.Corpus {
			ids, err := engine.Tokens(passage(d))
			Check(err)
			tokenIDs["doc:"+d.ID] = ids
			maxTokens = max(maxTokens, len(ids))
			if len(ids) > 512 {
				over512++
			}
		}
		referenceVectors := make(map[string][]float32)
		for i, item := range data.Cases {
			v := encode([]string{query(item.Intent)})[0]
			_, nonzero := normalize(v)
			ids, err := engine.Tokens(query(item.Intent))
			Check(err)
			tokenIDs["query:"+item.ID] = ids
			ranking := []Ranking{}
			if nonzero {
				for j, other := range corpus {
					if len(v) != len(other) {
						panic("Embedding dimension mismatch")
					}
					score := float64(0)
					for k, n := range v {
						score += float64(n) * float64(other[k])
					}
					ranking = append(ranking, Ranking{data.Corpus[j].ID, score})
				}
				sort.SliceStable(ranking, func(i, j int) bool { return ranking[i].Score > ranking[j].Score })
			} else {
				zeroQueries++
			}
			var rank *int
			for j, r := range ranking {
				found := false
				for _, expected := range item.Expected {
					if expected == r.ID {
						found = true
						break
					}
				}
				if found {
					value := j + 1
					rank = &value
					break
				}
			}
			if len(item.Expected) > 0 {
				positive++
				if rank != nil {
					mrr += 1 / float64(*rank)
					for n := range hits {
						if *rank <= n {
							hits[n]++
						}
					}
				}
			}
			results = append(results, Result{item, rank, ranking[:min(5, len(ranking))]})
			if i < 10 {
				referenceVectors["query:"+item.ID] = v
			}
		}
		for i := 0; i < min(4, len(data.Corpus)); i++ {
			referenceVectors["doc:"+data.Corpus[i].ID] = corpus[i]
		}
		pair := []string{query(data.Cases[0].Intent), passage(data.Corpus[0])}
		batch := encode(pair)
		maxDifference := float64(0)
		for i, text := range pair {
			single := encode([]string{text})[0]
			for j, n := range single {
				maxDifference = math.Max(maxDifference, math.Abs(float64(n)-float64(batch[i][j])))
			}
		}
		summary["documentCount"] = len(data.Corpus)
		summary["positiveCases"] = positive
		summary["negativeOrOutOfScopeCases"] = len(data.Cases) - positive
		summary["hitAt1"] = hits[1]
		summary["hitAt3"] = hits[3]
		summary["hitAt5"] = hits[5]
		summary["mrr"] = mrr / float64(positive)
		summary["zeroQueryVectors"] = zeroQueries
		summary["maxDocumentTokens"] = maxTokens
		summary["documentsOver512Tokens"] = over512
		summary["maxBatchDifference"] = maxDifference
		report["results"] = results
		report["tokenIds"] = tokenIDs
		report["referenceVectors"] = referenceVectors
	} else {
		cases := []Case{}
		for _, c := range data.Cases {
			if len(c.Expected) > 0 && len(cases) < 10 {
				cases = append(cases, c)
			}
		}
		run := func(c Case) [][]float32 { return encode([]string{query(c.Intent)}) }
		start = time.Now()
		first := run(cases[0])
		summary["firstInferenceMs"] = Millis(start)
		summary["dimensions"] = len(first[0])
		run(cases[1])
		samples := []Sample{}
		for i := 0; i < 30; i++ {
			c := cases[i%len(cases)]
			start = time.Now()
			run(c)
			samples = append(samples, Sample{c.ID, len([]rune(c.Intent)), Millis(start)})
		}
		phase("queried")
		times := []float64{}
		for _, s := range samples {
			times = append(times, s.MS)
		}
		sort.Float64s(times)
		summary["warmP50Ms"] = times[14]
		summary["warmP95Ms"] = times[28]
		summary["warmMaxMs"] = times[len(times)-1]
		start = time.Now()
		vectors := index()
		summary["indexMs"] = Millis(start)
		summary["indexDocuments"] = len(vectors)
		phase("indexed")
		runtime.KeepAlive(vectors)
		report["samples"] = samples
	}
	phase("finished")
	bytes, err := json.MarshalIndent(report, "", "  ")
	Check(err)
	Check(os.WriteFile(cfg.Output, append(bytes, '\n'), 0644))
	Emit(map[string]any{"event": "done", "output": cfg.Output})
}
