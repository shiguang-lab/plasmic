import argparse
import datetime
import importlib.metadata
import json
from pathlib import Path
import platform
import resource
import sys
import time
from evaluation import evaluate

parser=argparse.ArgumentParser();parser.add_argument('--data',required=True);parser.add_argument('--mode',choices=['quality','resources'],required=True);parser.add_argument('--output',required=True);parser.add_argument('--repeat',type=int,default=1)
args=parser.parse_args();root=Path(__file__).resolve().parent
def phase(name):
 print(json.dumps({'event':'phase','phase':name,'osMaxRssBytes':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}),flush=True)
 assert sys.stdin.readline(),'Observer closed input'
phase('baseline');start=time.perf_counter()
from litert_lm import Backend,EmbeddingEngine
from litert_lm.embedding_engine import EmbeddingOptions,InputOverflowStrategy
runtime_import_ms=(time.perf_counter()-start)*1000;phase('imported')
spec=json.loads((root/'models.json').read_text())['litert']
start=time.perf_counter()
engine=EmbeddingEngine(str(root/'models'/spec['file']),backend=Backend.CPU(thread_count=2),max_input_length=512)
load_ms=(time.perf_counter()-start)*1000;phase('loaded')
options=EmbeddingOptions(normalize=True,input_overflow_strategy=InputOverflowStrategy.TRUNCATE,output_size=768)
def encode(texts):return [r.embedding for r in engine.compute_embedding_batch(texts,options=options)]
report=evaluate(encode,args.data,args.mode,phase)
report['summary'].update({'model':spec,'runtime':'litert-lm-api '+importlib.metadata.version('litert-lm-api'),'python':sys.version,'platform':platform.platform(),
 'date':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mode':args.mode,'repeat':args.repeat,'device':'CPU only','threads':2,'maxInputSignature':512,
 'runtimeImportMs':runtime_import_ms,'localLoadMs':load_ms,'timing':'Direct Python API: input text formatting, native tokenization/inference, copying output and L2 normalization. No HTTP.',
 'inputHandling':'Native insert-special-tokens default; InputOverflowStrategy.TRUNCATE. Text-only 270M model, no vision/audio encoder.',
 'limitations':['Frozen manually labeled pilot, no independent holdout.','Different quantization and tokenizer/runtime from ONNX q4; equal token budget does not prove identical encoded input.','Not actual Studio/MCP or other platforms.']})
phase('finished');Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
engine.close();print(json.dumps({'event':'done'}),flush=True)
