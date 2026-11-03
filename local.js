import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import worker from "./worker.js";

const env = { ADDONS: readFileSync("addons.txt", "utf8") };
createServer(async (req, res) => {
  const r = await worker.fetch(
    new Request(`http://localhost:7000${req.url}`, { method: req.method }),
    env
  );
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(await r.text());
}).listen(7000, () => console.log("Rodando em http://localhost:7000"));
