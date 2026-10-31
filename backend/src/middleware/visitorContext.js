import { AsyncLocalStorage } from 'node:async_hooks';

// Who triggered the current request, kept for the duration of the request so
// code deep in the call stack (the MySwitzerland call logger) can read it
// without threading it through every function.
const storage = new AsyncLocalStorage();

export const getVisitor = () => storage.getStore();

const header = (req, name) => {
  const value = req.get(name);
  return value ? value.slice(0, 300) : undefined;
};

// Two ways a request reaches the backend:
// - Through Cloudflare and nginx (browser or bot calling /api directly):
//   Cloudflare's own headers are present and are used as-is.
// - From the SSR server on the internal Docker network while it renders a
//   page: no Cloudflare headers, so the SSR interceptor passes the page
//   visitor's details in x-visitor-* headers. These are only read when the
//   Cloudflare headers are absent, so a client can't override them by
//   sending x-visitor-* itself through Cloudflare.
export const visitorContext = () => (req, res, next) => {
  const cfIp = header(req, 'cf-connecting-ip');
  const visitor = cfIp
    ? {
        via: 'api',
        ip: cfIp,
        country: header(req, 'cf-ipcountry'),
        asn: header(req, 'x-cf-asn'),
        ua: header(req, 'user-agent'),
      }
    : {
        via: req.get('x-visitor-page') ? 'ssr' : 'internal',
        ip: header(req, 'x-visitor-ip'),
        country: header(req, 'x-visitor-country'),
        asn: header(req, 'x-visitor-asn'),
        ua: header(req, 'x-visitor-ua'),
        page: header(req, 'x-visitor-page'),
      };
  visitor.route = req.originalUrl.slice(0, 300);
  storage.run(visitor, next);
};
