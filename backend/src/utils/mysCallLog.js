import axios from 'axios';
import { getVisitor } from '../middleware/visitorContext.js';

// Writes one JSON line per MySwitzerland API call: each line is one unit of
// quota used. Covers every caller (page/API routes and the AI assistant)
// because they all use the global axios instance. Only calls to
// MYS_ENDPOINT are logged; the API key travels in a header and is never logged.
// Summarise with src/scripts/mysCallSummary.js.
const isMysCall = (config) => {
  const endpoint = process.env.MYS_ENDPOINT;
  return Boolean(endpoint && config?.url?.startsWith(endpoint));
};

const callPath = (config) => {
  const url = new URL(config.url);
  for (const [key, value] of Object.entries(config.params ?? {})) {
    url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`.slice(0, 400);
};

const write = (config, status, upstreamMessage) => {
  try {
    const visitor = getVisitor() ?? { via: 'background' };
    const line = {
      type: 'mys_call',
      t: new Date().toISOString(),
      status,
      ms: config.__mysStart ? Date.now() - config.__mysStart : undefined,
      call: callPath(config),
      ...visitor,
    };
    if (upstreamMessage) line.msg = String(upstreamMessage).slice(0, 200);
    console.log(JSON.stringify(line));
  } catch {
    // Logging must never break a request.
  }
};

export const installMysCallLog = () => {
  axios.interceptors.request.use((config) => {
    if (isMysCall(config)) config.__mysStart = Date.now();
    return config;
  });

  axios.interceptors.response.use(
    (response) => {
      if (isMysCall(response.config)) write(response.config, response.status);
      return response;
    },
    (error) => {
      if (isMysCall(error.config)) {
        // MySwitzerland's 429 body says which limit was hit, e.g.
        // {"message":"Limit Exceeded"} vs {"message":"Too Many Requests"}.
        const data = error.response?.data;
        const msg = data?.message ?? (typeof data === 'string' ? data : error.code);
        write(error.config, error.response?.status ?? 0, msg);
      }
      return Promise.reject(error);
    },
  );
};
