// server.ts — Local development server
// Mimics Vercel routing: serves public/ as static + proxies /api/submit
//
// Usage:
//   npm run dev
//
// Requires .env file with:
//   APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_ID/exec

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { loadEnv } from "./src/env";
import type { BugReportPayload, ApiResponse } from "./src/types";

// Load .env — warn but don't crash if APPS_SCRIPT_URL missing yet
let env: ReturnType<typeof loadEnv>;
try {
  env = loadEnv();
} catch (err) {
  console.warn("\n⚠️  " + (err instanceof Error ? err.message : String(err)));
  console.warn(
    "   The form UI will still load. API calls will return an error until you set APPS_SCRIPT_URL.\n",
  );
  env = { APPS_SCRIPT_URL: "", PORT: parseInt(process.env.PORT ?? "3001", 10) };
}

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

// ── /api/submit handler ────────────────────────────────────────
async function handleSubmit(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  const raw = await readBody(req);

  let body: BugReportPayload;
  try {
    body = JSON.parse(raw) as BugReportPayload;
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: false,
        message: "Invalid JSON body",
      } satisfies ApiResponse),
    );
    return;
  }

  try {
    const response = await fetch(env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "follow",
    });

    const text = await response.text();
    let data: ApiResponse;
    try {
      data = JSON.parse(text) as ApiResponse;
    } catch {
      data = { success: true };
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, message } satisfies ApiResponse));
  }
}

// ── Static file handler ────────────────────────────────────────
function serveStatic(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): void {
  const urlPath =
    req.url === "/" || !req.url ? "/index.html" : req.url.split("?")[0];
  const filePath = path.join(__dirname, "public", urlPath);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback → index.html
      fs.readFile(path.join(__dirname, "public", "index.html"), (e, d) => {
        if (e) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(d);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] ?? "text/plain" });
    res.end(data);
  });
}

// ── Helpers ────────────────────────────────────────────────────
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// ── Server ─────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/api/submit")) {
    handleSubmit(req, res).catch((err: unknown) => {
      console.error("Unhandled error in handleSubmit:", err);
      res.writeHead(500);
      res.end("Internal server error");
    });
  } else if (req.url?.startsWith("/api/update")) {
    handleProxy(req, res, "update").catch((err: unknown) => {
      console.error("Unhandled error in handleProxy(update):", err);
      res.writeHead(500);
      res.end("Internal server error");
    });
  } else if (req.url?.startsWith("/api/bugs")) {
    handleBugs(req, res).catch((err: unknown) => {
      console.error("Unhandled error in handleBugs:", err);
      res.writeHead(500);
      res.end("Internal server error");
    });
  } else {
    serveStatic(req, res);
  }
});

server.listen(env.PORT, () => {
  console.log(`
🐛  Bug Report dev server
    URL  → http://localhost:${env.PORT}
    Form → http://localhost:${env.PORT}/index.html
    API  → http://localhost:${env.PORT}/api/submit

    APPS_SCRIPT_URL → ${env.APPS_SCRIPT_URL}
  `);
});

// ── /api/bugs handler (proxy to Apps Script GET) ───────────────
async function handleBugs(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const urlObj = new URL(req.url ?? "/api/bugs", `http://localhost`);
  const params = urlObj.searchParams.toString();
  const url = `${env.APPS_SCRIPT_URL}${params ? "?" + params : ""}`;

  try {
    const response = await fetch(url, { redirect: "follow" });
    const data = await response.json();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, bugs: [], message }));
  }
}

// ── Generic POST proxy (for /api/update) ───────────────────────
async function handleProxy(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  _route: string,
): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const raw = await readBody(req);

  try {
    // Mirror what api/update.ts does: add the `action` field Apps Script expects.
    const parsed = JSON.parse(raw) as {
      field: "status" | "assignee";
      bugId: string;
      sprintNumber: string;
      newStatus?: string;
      newAssignee?: string;
    };
    const action =
      parsed.field === "status" ? "update_status" : "update_assignee";
    const payload = { action, ...parsed };

    const response = await fetch(env.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });
    const data = await response.json();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, message }));
  }
}
