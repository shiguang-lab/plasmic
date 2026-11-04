import json,re,hashlib,sys
from pathlib import Path
from eval_evidence import codegen_inputs, preserved_codegen_files, semantic_review, SEMANTIC_INDICES
p=Path(sys.argv[1]);repo=Path(__file__).resolve().parents[3];cases=json.loads((repo/'ai/plasmic/evals/evals.json').read_text())['evals'];model=json.loads((p/'model-fixtures.json').read_text());verification=json.loads((p/'artifact-verification.json').read_text())
def log(run,name):
 f=run/name;return [json.loads(line) for line in f.read_text().splitlines()] if f.exists() else []
def digest(f):return hashlib.sha256(f.read_bytes()).hexdigest()
def replay_verdict(run):
 run_id=run.relative_to(p/'iteration-1').as_posix()
 matches=[r for r in verification if r.get('id')==run_id and r.get('kind')=='editor-replay']
 if len(matches)!=1:return False,'Missing unique replay evidence for this run; rerun verify-artifacts.mjs.'
 record=matches[0]
 inputs=['model-fixtures.json',(run/'calls.jsonl').relative_to(p).as_posix()]
 verifiers=['ai/plasmic/evals/verify-artifacts.mjs','ai/plasmic/evals/replay-edits.test.ts','scripts/prepare-plasmic-evals.mjs']
 evidence=[(run/'verification'/name).relative_to(p).as_posix() for name in ('replay.json','replay.log')]
 try:
  current=lambda base,files:{name:digest(base/name) for name in files}
  valid=(record.get('stable') is True and record.get('inputs')==current(p,inputs)
         and record.get('verifiers')==current(repo,verifiers) and record.get('evidence')==current(p,evidence))
 except OSError:valid=False
 checks=record.get('checks',[])
 passed=valid and len(checks)==1 and checks[0].get('status')==0
 return passed,('Current run replay passed; trace, fixture, verifier and replay/log hashes match.' if passed else 'Replay failed or evidence is missing/stale; rerun verify-artifacts.mjs for the current trace and fixtures.')
def codegen_verdict(run):
 try:
  matches=[r for r in verification if r.get('id')==run.relative_to(p/'iteration-1').as_posix() and r.get('kind')=='codegen']
  if len(matches)!=1:return False,False
  record=matches[0]
  verifiers=['ai/plasmic/evals/verify-artifacts.mjs','ai/plasmic/evals/eval_evidence.py','ai/plasmic/evals/Orders.test.tsx']
  evidence=[(run/'verification'/name).relative_to(p).as_posix() for name in ('Orders.test.tsx','vitest.config.mjs','behavior.log','typecheck.log','behavior-results.json')]
  if record.get('stable') is not True or record.get('inputs')!=codegen_inputs(p,run) or record.get('verifiers')!={name:digest(repo/name) for name in verifiers} or record.get('evidence')!={name:digest(p/name) for name in evidence}:return False,False
  checks=record.get('checks')
  if not isinstance(checks,list) or len(checks)!=2 or {check.get('kind') for check in checks}!={'behavior','typecheck'} or any(type(check.get('status')) is not int for check in checks):return False,False
  statuses={check['kind']:check['status'] for check in checks}
  behavior=json.loads((run/'verification/behavior-results.json').read_text())
  behavior_ok=(statuses['behavior']==0 and behavior.get('success') is True and behavior.get('numTotalTests')==3 and behavior.get('numPassedTests')==3 and behavior.get('numFailedTests')==0 and behavior.get('numPendingTests')==0)
  return behavior_ok,statuses['typecheck']==0
 except (OSError,ValueError,KeyError,TypeError):return False,False
summary=[]
for case in cases:
 for run in sorted((p/'iteration-1'/f"eval-{case['id']}-{case['name']}").glob('*/run-*')):
  calls=log(run,'calls.jsonl');cli=log(run,'context-calls.jsonl');refs=log(run,'reference-reads.jsonl');official=log(run,'official-calls.jsonl');result=(run/'outputs/result.md').read_text();meta=json.loads((run/'environment.json').read_text())
  modes=[c['args'][c['args'].index('--mode')+1] for c in cli if c.get('status')==0 and '--mode' in c['args']]
  readPaths={r['path'] for r in refs};required=set()
  for c in cli:
   if c.get('status')==0:
    obj=json.loads(c['stdout']);required.update(obj.get('mustRead',[]))
  mode={1:'inspect',2:'prototype',3:'codegen',4:'codegen',5:'inspect',6:'prototype'}[case['id']]
  if case['id']==4:
   required=set()
   for c in cli:
    if c.get('status')==0 and '--mode' in c['args'] and c['args'][c['args'].index('--mode')+1]=='codegen':
     resource_root=json.loads(c['stdout']).get('resourceRoot')
     if resource_root:required.update(str(Path(resource_root)/'references'/name) for name in ('guide.md','official-cli.md'))
  rule=mode in modes and bool(required) and required<=readPaths
  successful=[c for c in calls if c.get('ok')];ops=[c for c in successful if c['tool']=='execute'];writes=[c for c in calls if (c['tool']=='open_design' and c['input'].get('projectId')!=meta['projectId']) or (c['tool']=='execute' and c['input'].get('name') and c['input'].get('name') not in ['identify','read','getEditorContext','restoreEditorView','validate'])]
  readIds={id for c in ops if c['input']['name']=='read' for id in c['input'].get('input',{}).get('componentUuids',[])}
  values=[];evidence=[]
  values.append(rule);evidence.append(f"context-calls.jsonl modes={modes}; {len(required & readPaths)}/{len(required)} branch-required files read; official CLI replaces native mustRead with guide and official-cli.")
  if case['id']==1:
   allids={model['identities'][k] for k in ('standard','shell','section','detail')};values.append(allids<=readIds);evidence.append(f"calls.jsonl full component reads include {sorted(readIds)}; required {sorted(allids)}")
   values.append(not writes and any(c['input']['name']=='identify' and c['result'].get('canEdit') is False for c in ops));evidence.append(f"identify canEdit=false; write attempts={len(writes)}")
   values.append(all(term in result for term in ('Slot','UUID','Preview','API')) and ('未验证' in result or '未进行' in result));evidence.append('result.md explicitly reports placeholder Slot/UUID mismatch, sample API limitations and unverified Preview; full output reviewed inline.')
   forbidden=('codegen/','engineering/','compositions/form-layout.md','components/form');values.append(not any(any(s in r['path'] for s in forbidden) for r in refs));evidence.append(f"reference-reads.jsonl actual bytes={sum(r['bytes'] for r in refs)}; no coding/platform/form references.")
  elif case['id']==2:
   mutations=[c for c in ops if c['input']['name']=='changeElement'];correct=bool(mutations) and all(c['input']['input'].get('componentUuid')==model['identities']['mutating'] and c['input']['input'].get('elementUuid')==model['identities']['editCard'] for c in mutations)
   initial=next((i for i,c in enumerate(calls) if c['tool']=='execute' and c['input'].get('name')=='read' and c.get('ok')),999);first=min((i for i,c in enumerate(calls) if c['tool']=='execute' and c['input'].get('name')=='changeElement'),default=-1)
   values.append(correct and initial<first);evidence.append('calls.jsonl reads precede changeElement; all changed UUIDs match the discovered target.')
   replay_passed,replay_evidence=replay_verdict(run);values.append(replay_passed);evidence.append(replay_evidence)
   names=[c['input']['name'] for c in ops];save=names.index('save') if 'save' in names else -1;goodOrder=save>=0 and 'changeElement' in names[:save] and 'validate' in names[:save] and 'read' in names[save+1:]
   values.append(goodOrder and 'Preview' in result and ('重新打开' in result or '重开' in result) and ('无法' in result or '未完成' in result));evidence.append(f"Successful operation order={names}; result.md explicitly excludes real Preview/reopen proof.")
   allowed={'changeElement','save'};values.append(all(c['tool']=='execute' and c['input']['name'] in allowed for c in writes) and not any('engineering/' in r['path'] for r in refs));evidence.append('No creation, library installation/upgrade or unrelated mutations; instrumented references stay within focused scope.')
  elif case['id']==3:
   values[0]=values[0] and model['identities']['coding'] in readIds;evidence[0]+=' Full Orders model read with discovered UUID.'
   passed,typeOK=codegen_verdict(run);values.append(passed);evidence.append('Current run requires three passing React DOM tests plus matching target/input/checker/report hashes; missing or stale evidence is unproven.')
   try:unchanged=preserved_codegen_files(p,run)
   except (OSError,ValueError,KeyError,TypeError):unchanged=False
   values.append(passed and unchanged);evidence.append('Service/App/dependencies/tsconfig are compared with the common original input frozen before any executor ran, never with another executor output.')
   values.append(typeOK and passed);evidence.append('Requires distinct successful typecheck and behavior commands bound to the current run; empty check arrays and old logs are not evidence.')
   values.append(not writes and not official and ('未验证' in result or '未执行' in result or '未声称' in result));evidence.append('No design write/official commands; executor result explicitly limits visual and production evidence.')
  elif case['id']==4:
   reference=any(r['path'].endswith('/official-cli.md') for r in refs);values[0]=values[0] and reference;evidence[0]+=f" official-cli reference read={reference}."
   args=[c['args'] for c in official];info=[a for a in args if a and a[0]=='info' and '--help' not in a];values.append(bool(info) and any('--help' in a for a in args) and any('--version' in a for a in args));evidence.append(f'official-calls.jsonl actual commands={args}')
   desired=bool(info) and all('--projects' in a and a[a.index('--projects')+1]=='official-evaluation-project' and '--host' in a and a[a.index('--host')+1]=='https://plasmic-studio.shiguanglab.com' for a in info)
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
  reviewed,review_error=semantic_review(case,p,run)
  for index in SEMANTIC_INDICES[case['id']]:
   entry=reviewed.get(index)
   values[index]=values[index] and bool(entry and entry['passed'] is True)
   evidence[index]+=(' Inline semantic review: '+entry['evidence']) if entry else ' '+review_error+'; completion unproven.'
  assert len(values)==len(evidence)==len(case['expectations'])
  expectations=[{'text':text,'passed':bool(ok),'evidence':ev} for text,ok,ev in zip(case['expectations'],values,evidence)]
  assert len(expectations)==len(case['expectations'])
  total=len(expectations);count=sum(e['passed'] for e in expectations)
  grade={'expectations':expectations,'summary':{'passed':count,'failed':total-count,'total':total,'pass_rate':count/total},'execution_metrics':{'tool_calls':{'mcp':len(calls),'context':len(cli),'reference_read':len(refs),'official_cli':len(official)},'total_tool_calls':len(calls)+len(cli)+len(refs)+len(official),'reference_bytes':sum(r['bytes'] for r in refs),'output_chars':len(result)},'claims':[],'user_notes_summary':{'uncertainties':['No real Desktop Preview/persistence acceptance; fixtures only.'],'needs_review':[]},'eval_feedback':{'suggestions':[],'overall':'Scores apply only to the recorded run and current rubric; finite fixtures do not establish general reliability or improvement over a baseline.'}}
  (run/'grading.json').write_text(json.dumps(grade,ensure_ascii=False,indent=2)+'\n');summary.append((str(run.relative_to(p/'iteration-1')),count,total))
print(json.dumps(summary,ensure_ascii=False,indent=2))
