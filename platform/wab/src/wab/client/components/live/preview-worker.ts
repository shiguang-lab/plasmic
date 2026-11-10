/** The Studio bundle may execute inside the canvas origin. Keep the emitted
 * worker URL intact, but start it through a blob belonging to this origin. */
export class PreviewWorker {
  readonly worker: Worker;
  readonly release: () => void;
  constructor(url: URL, options: WorkerOptions) {
  const bootstrap = url.origin === location.origin ? undefined : URL.createObjectURL(
    new Blob([`importScripts(${JSON.stringify(url.href)});`], { type: "application/javascript" }),
  );
  const release = () => { if (bootstrap) { URL.revokeObjectURL(bootstrap); } };
  this.release = release;
  try {
    this.worker = new Worker(bootstrap ?? url, options);
  } catch (error) {
    release();
    throw error;
  }
  }
}
