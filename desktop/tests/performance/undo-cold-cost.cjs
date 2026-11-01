// Payload/cost probe, not a cold-history implementation. The real undo log is
// retained throughout, and only private diagnostic output is written.
const fs = require("node:fs");
const path = require("node:path");
const { connectStudioCdp } = require("./undo-studio.cjs");
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.run = async ({ frame, win, task, variant }) => {
  const run = source => frame.executeJavaScript(source);
  const cdp = await connectStudioCdp(win);
  const report = { variant, samples: [], mainMemory: [], scope: "Deleted subtree payload only, not complete undo records, model/selection replay, account storage or a production memory saving" };
  const output = path.join(task, `undo-cold-${process.env.PERF_RUN_ID || "cost"}.json`);
  async function collect(label) {
    await cdp("Runtime.discardConsoleEntries");
    for (let i=0;i<2;i++) { await cdp("HeapProfiler.collectGarbage");await sleep(100); }
    report.samples.push({label,heap:await cdp("Runtime.getHeapUsage")});
  }
  try {
    await run("__undoGrowth.setup('subtree')");
    await run("__undoGrowth.advance(10)");
    await run("studioCtx.clearUndoLog();studioCtx.createViewStateUndoRecord();__undoGrowth.resetCounter();true");
    await run("__undoGrowth.advance(600)");
    await run("studioCtx.awaitStudioReady()");
    await collect("history-held");
    report.mainMemory.push({label:"before-transfer",...process.memoryUsage()});
    const transferStart=performance.now();
    const {payload,...encoded} = await run("__undoColdEncode()");
    report.encodeAndTransferWallMs=performance.now()-transferStart;
    report.encoded=encoded;
    report.mainMemory.push({label:"payload-received",...process.memoryUsage()});
    await collect("serialized-held");
    const requireStart=performance.now();
    const {gzipSync,gunzipSync}=require("node:zlib");
    report.zlibRequireMs=performance.now()-requireStart;
    const utf8Start=performance.now();
    const bytes=Buffer.from(payload);
    report.utf8Ms=performance.now()-utf8Start;
    const compressStart=performance.now(),compressed=gzipSync(bytes);
    report.gzipMs=performance.now()-compressStart;
    const inflateStart=performance.now(),inflated=gunzipSync(compressed);
    report.gunzipMs=performance.now()-inflateStart;
    if (!inflated.equals(bytes)) throw Error("Compression round trip changed bytes");
    report.jsonBytes=bytes.length;report.gzipBytes=compressed.length;
    report.mainMemory.push({label:"buffers-held",...process.memoryUsage()});
    const writeStart=performance.now();
    fs.writeFileSync(path.join(task, `cold-${process.env.PERF_RUN_ID || "cost"}.json.gz`),compressed,{mode:0o600});
    report.cachedFilesystemWriteMs=performance.now()-writeStart;
    report.decoded=await run("__undoColdDecode()");
    report.mainMemory.push({label:"after-decode",...process.memoryUsage()});
    await collect("decoded-held");
    await run("delete window.__undoColdPayload;delete window.__undoColdDecoded;true");
    await collect("temporary-roots-released");
    report.final=await run("({records:studioCtx.undoLog._log.length,model:__undoGrowth.state(),errors:__perf.errors})");
    if(report.encoded.roots!==300||report.decoded.roots!==300||report.final.records!==601||report.final.errors.length) throw Error("Cold payload fixture mismatch");
  } catch(error) {report.error=String(error?.stack||error);throw error;}
  finally {fs.writeFileSync(output,JSON.stringify(report,null,2),{mode:0o600});}
  return report;
};
