const UA = "Mozilla/5.0";
const TIMEOUT = 8000;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json; charset=utf-8",
};
const MANIFEST = {
  id: "community.agregador",
  version: "0.1.0",
  name: "Agregador",
  description: "Junta vários addons e ordena por qualidade",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  catalogs: [],
};

function scan(t) {
  t = t.toLowerCase();
  if (/2160|4k|\buhd\b/.test(t)) return 2160;
  if (/1440|\b2k\b|\bqhd\b/.test(t)) return 1440;
  if (/1080|\bfhd\b|full ?hd/.test(t)) return 1080;
  if (/720/.test(t)) return 720;
  if (/\bcam\b|camrip|telesync/.test(t)) return 100;
  if (/\bhd\b/.test(t)) return 720;
  if (/480|\bsd\b/.test(t)) return 480;
  return 0;
}
function qualityOf(s) {
  return scan(s.name || "") || scan(`${s.title || ""} ${s.description || ""}`);
}

async function fromAddon(base, type, id) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const r = await fetch(`${base}/stream/${type}/${id}.json`, {
      headers: { "User-Agent": UA },
      signal: ctl.signal,
    });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j.streams) ? j.streams : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: CORS });

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const path = new URL(request.url).pathname;
    if (path === "/manifest.json") return json(MANIFEST);

    const m = path.match(/^\/stream\/([^/]+)\/(.+)\.json$/);
    if (!m) return json({ error: "not found" }, 404);
    const [, type, id] = m;

    const bases = (env.ADDONS || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((u) => u.replace(/\/manifest\.json$/, "").replace(/\/$/, ""));

    const lists = await Promise.all(bases.map((b) => fromAddon(b, type, id)));
    const seen = new Set();
    const streams = lists
      .flat()
      .filter((s) => {
        const k = s.url || s.infoHash;
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => qualityOf(b) - qualityOf(a));

    return json({ streams });
  },
};
