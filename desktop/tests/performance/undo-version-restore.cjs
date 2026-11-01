// Exercises the real Studio revert action against in-memory offline revisions.
exports.run = async ({ frame, expectedSteps }) => {
  const replaySteps = expectedSteps || 50;
  const boundary = `Later${124 - replaySteps}`;
  return frame.executeJavaScript(`(async()=>{
  const s=studioCtx,component=s.site.components.find(c=>c.name==='UndoInner');
  const id=component.uuid;
  s.dbCtx().maybeObserveComponents([component]);
  await s.changeUnsafe(()=>{component.tplTree.name='SavedCheckpoint'});
  s.needsFullSave=true;await s.save();if(s.saveStatus!=='saved')throw Error('Checkpoint save failed');
  const checkpoint=s.dbCtx().revisionNum;
  await s.refreshRevisions();const revision=s.revisions.find(r=>r.revision===checkpoint);
  if(!revision)throw Error('Saved checkpoint absent from actual revision list');
  const counter=s._changeCounter;
  for(let i=0;i<125;i++)await s.changeUnsafe(()=>{component.tplTree.name='Later'+i});
  await s.awaitEval();await s.awaitStudioReady();
  const records=s.undoLog._log.length;
  if(s._changeCounter-counter!==125)throw Error('Version fixture failed to record every edit: '+(s._changeCounter-counter));
  if(${expectedSteps}>0&&records!==${expectedSteps + 1})throw Error('Version test did not hit undo limit: '+records);
  for(let i=0;i<${replaySteps};i++)await s.undo();await s.awaitEval();await s.awaitStudioReady();
  if(component.tplTree.name!==${JSON.stringify(boundary)}||(${expectedSteps}>0&&s.canUndo()))throw Error('Unexpected retained boundary');
  for(let i=0;i<${replaySteps};i++)await s.redo();await s.awaitEval();await s.awaitStudioReady();
  if(component.tplTree.name!=='Later124')throw Error('Version test redo failed');
  s.needsFullSave=true;await s.save();if(s.saveStatus!=='saved')throw Error('Later state save failed');
  await s.revertTo(revision);await s.awaitEval();await s.awaitStudioReady();
  const restored=s.site.components.find(c=>c.uuid===id);
  if(restored?.tplTree.name!=='SavedCheckpoint')throw Error('Actual revision revert did not restore old model');
  if(s.canUndo()||s.canRedo()||!s.editMode||__perf.errors.length)throw Error('Invalid state after revision restore');
  return {passed:true,laterEdits:125,replayedSteps:${replaySteps},recordsBeforeRestore:records,boundary:${JSON.stringify(boundary)},restored:'SavedCheckpoint',editable:s.editMode,errors:__perf.errors};
})()`);
};
