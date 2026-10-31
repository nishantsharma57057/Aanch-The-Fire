import express from 'express';
import {resolve} from 'node:path';
import {api} from '../worker/api.js';

export function createApp(env, {staticDir = resolve('dist/client')} = {}) {
  const base = new URL(env.APP_URL);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('APP_URL must be an origin, e.g. https://yourdomain.com');
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.get('/api/health', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try { await env.DB.prepare('SELECT COUNT(*) AS count FROM bookings').first(); res.json({ok: true}); }
    catch { res.status(503).json({ok: false}); }
  });
  app.use('/api', express.raw({type: () => true, limit: '25kb'}));
  app.use('/api', async (req, res) => {
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        // Never trust caller-supplied hosting identity or proxy authority headers.
        if (name.startsWith('oai-authenticated-user-') || ['host', 'forwarded', 'x-forwarded-host', 'x-forwarded-proto', 'content-length', 'connection'].includes(name)) continue;
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const requestUrl = new URL(base.origin);
      // Assigning pathname prevents a // URL from overriding the canonical authority.
      const original = new URL(req.originalUrl, 'http://local.invalid');
      requestUrl.pathname = original.pathname;
      requestUrl.search = original.search;
      const request = new Request(requestUrl, {method: req.method, headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body});
      const response = await api(request, env);
      for (const [name, value] of response.headers) if (name !== 'set-cookie') res.setHeader(name, value);
      const cookies = response.headers.getSetCookie();
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
      res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error('HTTP adapter failed:', error.name);
      res.status(503).json({error: 'Service unavailable. Please try again.'});
    }
  });
  app.use(express.static(staticDir, {dotfiles: 'deny', index: 'index.html', setHeaders(res, file) {
    res.setHeader('Cache-Control', file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=60');
  }}));
  // This app uses #/ routes; arbitrary source paths must never fall back to source files.
  app.use((_req, res) => res.status(404).send('Not found'));
  app.use((error, _req, res, _next) => {
    const status = error.type === 'entity.too.large' ? 413 : 400;
    res.status(status).json({error: status === 413 ? 'Request is too large.' : 'Invalid request.'});
  });
  return app;
}
