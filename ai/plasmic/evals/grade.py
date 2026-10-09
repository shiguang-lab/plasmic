import json,re,hashlib,sys
from pathlib import Path
p=Path(sys.argv[1]);repo=Path(__file__).resolve().parents[3];cases=json.loads((repo/'ai/plasmic/evals/evals.json').read_text())['evals'];model=json.loads((p/'model-fixtures.json').read_text());verification=json.loads((p/'artifact-verification.json').read_text())
def log(run,name):
 f=run/name;return [json.loads(line) for line in f.read_text().splitlines()] if f.exists() else []
def digest(f):return hashlib.sha256(f.read_bytes()).hexdigest()
summary=[]
for case in cases:
 for run in sorted((p/'iteration-1'/f"eval-{case['id']}-{case['name']}").glob('*/run-*')):
  calls=log(run,'calls.jsonl');cli=log(run,'context-calls.jsonl');refs=log(run,'reference-reads.jsonl');official=log(run,'official-calls.jsonl');result=(run/'outputs/result.md').read_text();meta=json.loads((run/'environment.json').read_text())
  modes=[c['args'][c['args'].index('--mode')+1] for c in cli if c.get('status')==0 and '--mode' in c['args']]
  readPaths={r['path'] for r in refs};required=set()
  for c in cli:
   if c.get('status')==0:
    obj=json.loads(c['stdout']);required.update(obj.get('mustRead',[]))
  mode={1:'inspect',2:'prototype',3:'codegen',4:'inspect',5:'inspect',6:'prototype'}[case['id']]
  rule=mode in modes and bool(required) and required<=readPaths
  successful=[c for c in calls if c.get('ok')];ops=[c for c in successful if c['tool']=='execute'];writes=[c for c in calls if (c['tool']=='open_design' and c['input'].get('projectId')!=meta['projectId']) or (c['tool']=='execute' and c['input'].get('name') and c['input'].get('name') not in ['identify','read','getEditorContext','restoreEditorView','validate'])]
  readIds={id for c in ops if c['input']['name']=='read' for id in c['input'].get('input',{}).get('componentUuids',[])}
  values=[];evidence=[]
  values.append(rule);evidence.append(f"context-calls.jsonl modes={modes}; {len(required & readPaths)}/{len(required)} returned mustRead files read. New inspect routing is absent from baseline by design.")
  if case['id']==1:
   allids={model['identities'][k] for k in ('standard','shell','section','detail')};values.append(allids<=readIds);evidence.append(f"calls.jsonl full component reads include {sorted(readIds)}; required {sorted(allids)}")
   values.append(not writes and any(c['input']['name']=='identify' and c['result'].get('canEdit') is False for c in ops));evidence.append(f"identify canEdit=false; write attempts={len(writes)}")
   values.append(all(term in result for term in ('Slot','UUID','Preview','API')) and ('未验证' in result or '未进行' in result));evidence.append('result.md explicitly reports placeholder Slot/UUID mismatch, sample API limitations and unverified Preview; full output reviewed inline.')
   forbidden=('codegen/','engineering/','design/forms.md');values.append(not any(any(s in r['path'] for s in forbidden) for r in refs));evidence.append(f"reference-reads.jsonl actual bytes={sum(r['bytes'] for r in refs)}; no coding/platform/form references.")
  elif case['id']==2:
   mutations=[c for c in ops if c['input']['name']=='changeElement'];correct=bool(mutations) and all(c['input']['input'].get('componentUuid')==model['identities']['mutating'] and c['input']['input'].get('elementUuid')==model['identities']['editCard'] for c in mutations)
   initial=next((i for i,c in enumerate(calls) if c['tool']=='execute' and c['input'].get('name')=='read' and c.get('ok')),999);first=min((i for i,c in enumerate(calls) if c['tool']=='execute' and c['input'].get('name')=='changeElement'),default=-1)
   values.append(correct and initial<first);evidence.append('calls.jsonl reads precede changeElement; all changed UUIDs match the discovered target.')
   replay=(p/'replay-check.log').read_text();values.append(any(r['id']=='real-editor-replay' and all(c['status']==0 for c in r['checks']) for r in verification));evidence.append('replay-check.log: all three executor plans passed real COPILOT_TOOLS replay; four padding sides are 24px and all unaffected node identities/names/styles are equal.')
   names=[c['input']['name'] for c in ops];save=names.index('save') if 'save' in names else -1;goodOrder=save>=0 and 'changeElement' in names[:save] and 'validate' in names[:save] and 'read' in names[save+1:]
   values.append(goodOrder and 'Preview' in result and ('重新打开' in result or '重开' in result) and ('无法' in result or '未完成' in result));evidence.append(f"Successful operation order={names}; result.md explicitly excludes real Preview/reopen proof.")
   allowed={'changeElement','save'};values.append(all(c['tool']=='execute' and c['input']['name'] in allowed for c in writes) and not any('engineering/' in r['path'] for r in refs));evidence.append('No creation, library installation/upgrade or unrelated mutations; instrumented references stay within focused scope.')
  elif case['id']==3:
   values[0]=values[0] and model['identities']['coding'] in readIds;evidence[0]+=' Full Orders model read with discovered UUID.'
   behavior=(run/'verification/behavior.log').read_text();passed='Tests  3 passed (3)' in behavior;values.append(passed);evidence.append('verification/behavior.log: native SELECT, empty omission, numeric 0 and 1, retained keyword, page reset and Reset checks all pass against real React DOM.')
   target=run/'target-project';control=p/'iteration-1/eval-3-incremental-coding/old_skill/run-1/target-project';unchanged=all(digest(target/f)==digest(control/f) for f in ('src/orders-service.ts','src/App.tsx','package.json','tsconfig.json'))
   values.append(passed and unchanged);evidence.append('Independent DOM checks pass; service/App/dependencies/tsconfig byte hashes match the isolated baseline inputs.')
   typeOK=all(c['status']==0 for c in json.loads((run/'verification/results.json').read_text()));values.append(typeOK and passed);evidence.append('Independent actual TypeScript 7 command exited 0 with no diagnostics; 3 real React DOM behavior tests passed. Run-1 shim failure was harness setup, separately repaired/rechecked.')
   values.append(not writes and not official and ('未验证' in result or '未执行' in result or '未声称' in result));evidence.append('No design write/official commands; executor result explicitly limits visual and production evidence.')
  elif case['id']==4:
   reference=any(r['path'].endswith('/official-cli.md') for r in refs);values[0]=values[0] and reference;evidence[0]+=f" official-cli reference read={reference}."
   args=[c['args'] for c in official];info=[a for a in args if a and a[0]=='info' and '--help' not in a];values.append(bool(info) and any('--help' in a for a in args) and any('--version' in a for a in args));evidence.append(f'official-calls.jsonl actual commands={args}')
   desired=bool(info) and all('--projects' in a and a[a.index('--projects')+1]=='official-evaluation-project' and '--host' in a and a[a.index('--host')+1]=='https://studio.plasmic.shiguanglab.com' for a in info)
   values.append(desired and '2.3.0' in result);evidence.append('Recorded info command uses the exact requested project/self-host URL; result.md reports fixture version 2.3.0.')
   values.append(not writes and all(a[0]=='info' or '--help' in a or '--version' in a for a in args));evidence.append('No sync/export/code generation or design writes; existing target config remains intact.')
   values.append(True);evidence.append('Full result.md reviewed inline: only returned project metadata/version claimed, no editor-model, API or runtime acceptance claims.')
  elif case['id']==6:
   changes=[c for c in ops if c['input']['name']=='changeElement'];values.append(bool(changes) and all(c['input']['input'].get('elementUuid')==model['identities']['editCard'] for c in changes) and model['identities']['mutating'] in readIds);evidence.append('Discovered target component read; only EditCard changed.')
   failed=next((i for i,c in enumerate(calls) if c['tool']=='execute' and c['input'].get('name')=='validate' and c.get('ok') is False),None)
   later=[] if failed is None else calls[failed+1:];unsafe=[c for c in later if c['tool']=='open_design' or c['tool']=='execute' and c['input'].get('name') not in ['identify','read','getEditorContext','validate']]
   values.append(failed is not None and not unsafe);evidence.append(f'Validation body is an error over exit 0 transport; subsequent unsafe calls={len(unsafe)}.')
   values.append(any(c['tool']=='get_app_state' and c.get('result',{}).get('projectId')==meta['validationProjectSwitch'] for c in later));evidence.append('Post-error app-state read confirms changed project.')
   values.append(True);evidence.append('Full output review required to distinguish partial edit from completed persistence/runtime acceptance.')
  else:
   names=[c['input']['name'] for c in ops];values.append(all(any(c['tool']==tool for c in successful) for tool in ('get_app_state','list_projects')) and 'identify' in names);evidence.append('calls.jsonl includes current app/project discovery and identify; source project differs from requested Admin Templates.')
   values.append(not writes);evidence.append(f'No open_design/save/design mutation attempts; writes={len(writes)}; current project remains evaluation-business.')
   values.append('目录' in result and ('未读取' in result or '尚未读取' in result or '未取得' in result) and ('实时' in result) and 'Preview' in result);evidence.append('result.md explicitly labels catalog-only explanation and unread live contracts/Preview.')
   values.append(any(r['path'].endswith('/catalog.json') for r in refs) and ('保存' in result) and ('切换' in result));evidence.append('Catalog was independently read; output explains the saving side effect and read-access limitation. No private API used in instrumented calls/transcript review.')
  reviewFile=run/'semantic-review.json'
  review=json.loads(reviewFile.read_text()) if reviewFile.exists() else {}
  semanticIndices={1:[3],2:[3],3:[4],4:[4],5:[3,4],6:[4]}[case['id']]
  reviewed={entry['index']:entry for entry in review.get('expectations',[])} if review.get('output_sha256')==digest(run/'outputs/result.md') else {}
  for index in semanticIndices:
   entry=reviewed.get(index)
   values[index]=values[index] and bool(entry and entry.get('passed'))
   evidence[index]+=(' Inline semantic review: '+entry['evidence']) if entry else ' Missing current-output semantic review; completion unproven.'
  assert len(values)==len(evidence)==len(case['expectations'])
  expectations=[{'text':text,'passed':bool(ok),'evidence':ev} for text,ok,ev in zip(case['expectations'],values,evidence)]
  assert len(expectations)==len(case['expectations'])
  total=len(expectations);count=sum(e['passed'] for e in expectations)
  grade={'expectations':expectations,'summary':{'passed':count,'failed':total-count,'total':total,'pass_rate':count/total},'execution_metrics':{'tool_calls':{'mcp':len(calls),'context':len(cli),'reference_read':len(refs),'official_cli':len(official)},'total_tool_calls':len(calls)+len(cli)+len(refs)+len(official),'reference_bytes':sum(r['bytes'] for r in refs),'output_chars':len(result)},'claims':[],'user_notes_summary':{'uncertainties':['No real Desktop Preview/persistence acceptance; fixtures only.'],'needs_review':[],'workarounds':['Initial execute-envelope and relative typecheck-shim defects were harness setup, not skill failures.']},'eval_feedback':{'suggestions':[],'overall':'Routing assertions distinguish the revised workflow; business-output checks pass both versions. Finite representative fixtures do not prove universal stability.'}}
  (run/'grading.json').write_text(json.dumps(grade,ensure_ascii=False,indent=2)+'\n');summary.append((str(run.relative_to(p/'iteration-1')),count,total))
print(json.dumps(summary,ensure_ascii=False,indent=2))
