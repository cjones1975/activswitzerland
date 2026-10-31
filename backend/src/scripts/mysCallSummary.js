// Summarises the MySwitzerland call log (utils/mysCallLog.js) read from stdin.
// Each logged line is one call, i.e. one unit of MySwitzerland quota used.
//
// On the server (Node is inside the container, so nothing to install):
//   docker logs --since 24h activswitzerland_backend 2>&1 \
//     | docker exec -i activswitzerland_backend node src/scripts/mysCallSummary.js
//
// Optional argument: how many rows per table (default 15).
import { createInterface } from 'node:readline';

const TOP = Number(process.argv[2]) || 15;

const calls = [];
const lines = createInterface({ input: process.stdin });
for await (const line of lines) {
  const start = line.indexOf('{"type":"mys_call"');
  if (start === -1) continue;
  try {
    calls.push(JSON.parse(line.slice(start)));
  } catch {
    // Truncated or interleaved line; skip it.
  }
}

if (calls.length === 0) {
  console.log('No MySwitzerland call lines found.');
  process.exit(0);
}

const countBy = (keyOf) => {
  const counts = new Map();
  for (const call of calls) {
    const key = keyOf(call) ?? '(none)';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

const table = (title, keyOf, limit = TOP) => {
  const rows = countBy(keyOf);
  console.log(`\n${title}`);
  for (const [key, count] of rows.slice(0, limit)) {
    const share = ((count / calls.length) * 100).toFixed(1).padStart(5);
    console.log(`  ${String(count).padStart(6)}  ${share}%  ${key}`);
  }
  if (rows.length > limit) console.log(`  … ${rows.length - limit} more`);
};

// "/v1/destinations/<id>?lang=…" → "/v1/destinations/:id", so endpoints group together.
const endpoint = (call) => call.call?.split('?')[0].replace(/\/v1\/(\w+)\/[^/]+$/, '/v1/$1/:id');
const hour = (call) => call.t?.slice(0, 13).replace('T', ' ') + ':00Z';
const uaShort = (call) => call.ua?.slice(0, 120);

const first = calls[0].t;
const last = calls[calls.length - 1].t;
console.log(`MySwitzerland calls: ${calls.length}  (${first} → ${last})`);

table('By status (and upstream message)', (c) => (c.msg ? `${c.status} ${c.msg}` : String(c.status)));
table('By how the request arrived (ssr = page render, api = direct /api call)', (c) => c.via);
table('By endpoint', endpoint);
table('By hour (UTC)', hour, 48);
table('By network (ASN; needs the optional Cloudflare header)', (c) => c.asn);
table('By country', (c) => c.country);
table('By visitor IP', (c) => c.ip);
table('By user agent', uaShort);
table('By page being rendered (ssr only)', (c) => (c.via === 'ssr' ? c.page : undefined));
