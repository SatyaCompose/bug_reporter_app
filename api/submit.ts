// api/submit.ts — Vercel Serverless Function
// Receives bug report (including base64 screenshots) and forwards to Apps Script
//
// ENV VARIABLE NEEDED:
//   APPS_SCRIPT_URL → your Google Apps Script Web App URL

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAppsScriptUrl } from "../src/env";
import type { BugReportPayload, ApiResponse } from "../src/types";

// Increase body size limit to handle base64 image payloads (default is 1mb)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    res
      .status(405)
      .json({
        success: false,
        message: "Method not allowed",
      } satisfies ApiResponse);
    return;
  }

  const APPS_SCRIPT_URL = getAppsScriptUrl();
  if (!APPS_SCRIPT_URL) {
    res.status(500).json({
      success: false,
      message:
        "APPS_SCRIPT_URL environment variable is not set. " +
        "Add it in Vercel Dashboard → Settings → Environment Variables.",
    } satisfies ApiResponse);
    return;
  }

  try {
    const body = req.body as BugReportPayload;

    // Server-side validation
    const required: (keyof BugReportPayload)[] = [
      "sprintNumber",
      "releaseDate",
      "title",
      "reportedBy",
      "assignee",
      "pageURL",
      "priority",
      "status",
      "description",
    ];

    for (const field of required) {
      const val = body[field];
      if (!val || String(val).trim() === "") {
        res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`,
        } satisfies ApiResponse);
        return;
      }
    }

    // Log screenshot count (not content) for debugging
    const screenshotCount = Array.isArray(body.screenshots)
      ? body.screenshots.length
      : 0;
    console.log(
      `[submit] "${body.title}" — Sprint #${body.sprintNumber} — ${screenshotCount} screenshot(s)`,
    );

    // Forward entire payload (including base64 screenshots) to Apps Script
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit", ...body }),
      redirect: "follow",
    });

    const text = await response.text();
    console.log("[submit] Apps Script response:", text.slice(0, 200));

    let data: ApiResponse;
    try {
      data = JSON.parse(text) as ApiResponse;
    } catch {
      data = { success: true, message: "Saved (no JSON response)" };
    }

    res.status(200).json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[submit] Error:", message);
    res.status(500).json({ success: false, message } satisfies ApiResponse);
  }
}
