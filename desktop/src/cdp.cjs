async function sendCdp(contents, method, params = {}) {
  const api = contents.debugger;
  if (!api.isAttached()) api.attach("1.3");
  return api.sendCommand(method, params);
}
module.exports = { sendCdp };
