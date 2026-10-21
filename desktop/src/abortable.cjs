// Guard each awaited step, so an expired operation cannot resume and send input.
function abortable(signal, start) {
  if (!signal) return start();
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve().then(() => {
      signal.throwIfAborted();
      return start();
    }).then((value) => {
      signal.throwIfAborted();
      resolve(value);
    }).catch(reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
module.exports = { abortable };
