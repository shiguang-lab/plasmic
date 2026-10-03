const { randomBytes, createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const SCHEME = 'plasmic-desktop';
const CALLBACK = `${SCHEME}://oauth/google/callback`;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
class DesktopGoogleLogin {
  constructor({ userData, session, studioOrigin }) {
    this.file = path.join(userData, 'pending-google-login.json');
    this.session = session;
    this.studioOrigin = studioOrigin;
    if (fs.existsSync(this.file)) {
      try {
        const pending = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        const target = new URL(pending.returnUrl);
        if (!TOKEN.test(pending.state) || !TOKEN.test(pending.verifier) || !Number.isFinite(pending.expiresAt) || target.origin !== studioOrigin || target.pathname.startsWith('/desktop/')) throw new Error();
        if (pending.expiresAt > Date.now()) this.pending = pending;
        else this.clear();
      } catch { this.clear(); }
    }
  }
  clear() { this.pending = undefined; fs.rmSync(this.file, { force: true }); }
  async start({ returnUrl, openBrowser, signal, onAuthorizationUrl }) {
    if (signal?.aborted) throw new Error('Desktop sign-in was cancelled');
    const target = new URL(returnUrl);
    if (target.origin !== this.studioOrigin || target.pathname.startsWith('/desktop/')) throw new Error('Invalid sign-in destination');
    this.pending = {
      verifier: randomBytes(32).toString('base64url'),
      state: randomBytes(32).toString('base64url'),
      returnUrl, expiresAt: Date.now() + 10 * 60_000,
    };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.pending), { mode: 0o600 });
    fs.chmodSync(this.file, 0o600);
    const finished = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
    finished.catch(() => {});
    const abort = () => this.reject?.(new Error('Desktop sign-in was cancelled'));
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => this.reject?.(new Error('登录等待已超时，请重新登录。')), 10 * 60_000);
    try {
      const url = new URL('/api/v1/auth/google', this.studioOrigin);
      url.searchParams.set('desktop', '1');
      url.searchParams.set('desktopState', this.pending.state);
      url.searchParams.set('challenge', createHash('sha256').update(this.pending.verifier).digest('base64url'));
      onAuthorizationUrl?.(url.toString());
      await openBrowser(url.toString());
      return await finished;
    } catch (error) {
      if (signal?.reason !== 'window-closed') this.clear();
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      this.resolve = this.reject = undefined;
    }
  }
  async handle(url) {
    const callback = new URL(url);
    if (callback.protocol !== `${SCHEME}:` || callback.hostname !== 'oauth' || callback.pathname !== '/google/callback' || callback.port || callback.username || callback.password || callback.hash) throw new Error('Invalid desktop callback');
    const pending = this.pending;
    if (!pending || pending.expiresAt <= Date.now()) { this.clear(); throw new Error('该登录请求已过期，请在应用中重新登录。'); }
    if (callback.searchParams.get('state') !== pending.state) throw new Error('登录回调与当前请求不匹配，请使用最新的授权页面。');
    if (this.exchanging) return;
    const error = callback.searchParams.get('error');
    const code = callback.searchParams.get('code');
    if (error || !TOKEN.test(code || '')) {
      const failure = new Error(error ? 'Google 授权未完成或已过期，请重新登录。' : 'Invalid desktop login code');
      this.clear(); this.reject?.(failure); throw failure;
    }
    this.exchanging = true;
    try {
      const options = { bypassCustomProtocolHandlers: true, credentials: 'include' };
      const csrfResponse = await this.session.fetch(this.studioOrigin + '/api/v1/auth/csrf', options);
      if (!csrfResponse.ok) throw new Error('Cannot connect to the NAS login service');
      const { csrf } = await csrfResponse.json();
      const exchange = await this.session.fetch(this.studioOrigin + '/api/v1/auth/desktop/google/exchange', {
        ...options, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Origin: this.studioOrigin },
        body: JSON.stringify({ code, verifier: pending.verifier }),
      });
      if (!exchange.ok || !(await exchange.json()).status) throw new Error('登录码已失效，请在应用中重新登录。');
      this.clear(); this.resolve?.(pending.returnUrl);
      return pending.returnUrl;
    } catch (error) {
      this.clear(); this.reject?.(error); throw error;
    } finally { this.exchanging = false; }
  }
}
module.exports = { DesktopGoogleLogin, SCHEME, CALLBACK };
