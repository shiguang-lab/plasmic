#!/usr/bin/env python3
"""Summarize provider usage and MCP sizes without retaining message contents.

DS CLI --json traces report usage on status/step_end. MCP metrics contain bytes,
not model tokens. Cumulative input includes cached input across requests, whereas
peak input measures a single request. No tokenizer estimate replaces provider usage.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import subprocess


def session_usage(files):
    """Export only usage metadata; model messages/reasoning never leave Node."""
    reader = r'''
const fs=require('node:fs'),zlib=require('node:zlib');
if(!zlib.zstdDecompressSync)throw Error('Session usage requires Node with Zstandard support');
for(const file of JSON.parse(process.argv[1])){
  const bytes=fs.readFileSync(file);let offset=0;
  while(offset<bytes.length){
    const frame=zlib.zstdDecompressSync(bytes.subarray(offset),{info:true});
    if(!frame.engine.bytesWritten)throw Error('Invalid session frame');
    offset+=frame.engine.bytesWritten;
    for(const line of frame.buffer.toString().split('\n'))if(line){
      const event=JSON.parse(line);
      if(['assistant/message','compaction/summary'].includes(event.type))
        process.stdout.write(JSON.stringify({type:event.type,data:{usage:event.data.usage}})+'\n');
    }
  }
}'''
    result = subprocess.run(['node', '-e', reader, json.dumps([str(p) for p in files])], check=True, capture_output=True, text=True)
    return [json.loads(line) for line in result.stdout.splitlines() if line]


def analyze(trace, metrics, context_budget=None):
    durable = [e.get('data', {}).get('usage') for e in trace if e.get('type') == 'assistant/message' and isinstance(e.get('data', {}).get('usage'), dict)]
    summaries = [e.get('data', {}).get('usage') for e in trace if e.get('type') == 'compaction/summary' and isinstance(e.get('data', {}).get('usage'), dict)]
    primary = durable or [e['usage'] for e in trace if e.get('type') == 'status' and e.get('phase') == 'step_end' and isinstance(e.get('usage'), dict)]
    usage = primary + summaries
    inputs = [sum(u.get(k, 0) for k in ('inputTokens', 'cacheReadTokens', 'cacheWriteTokens')) for u in usage]
    tools = [e for e in metrics if e.get('method') == 'tools/call' or 'tool' in e]
    failures = Counter(e.get('name', e.get('tool', 'unknown')) for e in tools if e.get('isError', e.get('failed', False)))
    peak = max(inputs, default=0)
    return {
        'requests': len(usage), 'peakInputTokens': peak if usage else None,
        'primaryRequests': len(primary), 'summaryRequests': len(summaries),
        'usageCoverage': 'session_primary_and_recorded_summaries' if durable else 'CLI_primary_only',
        'cumulativeInputTokens': sum(inputs) if usage else None,
        'outputTokens': sum(u.get('outputTokens', 0) for u in usage) if usage else None,
        'cacheReadTokens': sum(u.get('cacheReadTokens', 0) for u in usage) if usage else None,
        'recordedCompactions': sum(e.get('type') == 'compaction/summary' for e in trace),
        'mcpCalls': len(tools),
        'largestMcpTextBytes': max((e.get('textBytes', 0) for e in tools), default=0),
        'mcpImageBytes': sum(e.get('imageBytes', 0) for e in tools),
        'failedCallsByTool': dict(failures),
        'contextBudget': context_budget,
        'contextBudgetExceeded': peak > context_budget if context_budget is not None and usage else None,
        'usageAvailable': bool(usage),
        'notMeasured': ['client retained context after compaction', 'model image perception', 'provider usage absent from recorded events'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--trace', type=Path, required=True)
    parser.add_argument('--mcp-metrics', type=Path, required=True)
    parser.add_argument('--context-budget', type=int, help='Actual client/model budget, not an assumed universal limit')
    parser.add_argument('--session-log', type=Path, action='append', help='Persisted DS .zstd log; includes summary usage without printing model content')
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    read = lambda p: [json.loads(line) for line in p.read_text().splitlines() if line.strip()]
    trace = read(args.trace)
    if args.session_log:
        trace.extend(session_usage(args.session_log))
    report = analyze(trace, read(args.mcp_metrics), args.context_budget)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
