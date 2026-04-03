// api/bugs.ts — Vercel Serverless Function
// Fetches all bug reports from Google Apps Script (which reads sprint docs)
//
// ENV VARIABLE NEEDED:
//   APPS_SCRIPT_URL → your Google Apps Script Web App URL
//
// Query params forwarded to Apps Script:
//   ?sprint=14&status=Open&priority=High&assignee=dev@team.com

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAppsScriptUrl } from "../src/env";
import type { BugsApiResponse } from "../src/types";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "GET") {
    res
      .status(405)
      .json({ success: false, bugs: [], message: "Method not allowed" });
    return;
  }

  const APPS_SCRIPT_URL = getAppsScriptUrl();
  if (!APPS_SCRIPT_URL) {
    res.status(500).json({
      success: false,
      bugs: [],
      message: "APPS_SCRIPT_URL environment variable is not set.",
    } satisfies BugsApiResponse);
    return;
  }

  try {
    // Forward query params to Apps Script
    const params = new URLSearchParams();
    const { sprint, status, priority, assignee, developer } = req.query;
    if (sprint) params.set("sprint", String(sprint));
    if (status) params.set("status", String(status));
    if (priority) params.set("priority", String(priority));
    if (assignee) params.set("assignee", String(assignee));
    if (developer) params.set("developer", String(developer));

    const url = `${APPS_SCRIPT_URL}${params.toString() ? "?" + params.toString() : ""}`;

    const response = await fetch(url, { redirect: "follow" });
    const data = (await response.json()) as BugsApiResponse;

    res.status(200).json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res
      .status(500)
      .json({ success: false, bugs: [], message } satisfies BugsApiResponse);
  }
}
