// api/update.ts — Vercel Serverless Function
// Updates status, assignee, or prURL of a bug in the Google Doc
//
// Body: { field: "status"|"assignee"|"pr", bugId, sprintNumber, newStatus?, newAssignee?, newPrURL? }

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAppsScriptUrl } from "../src/env";

const VALID_STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;

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
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  const APPS_SCRIPT_URL = getAppsScriptUrl();
  if (!APPS_SCRIPT_URL) {
    res
      .status(500)
      .json({ success: false, message: "APPS_SCRIPT_URL is not set." });
    return;
  }

  const { field, bugId, sprintNumber, newStatus, newAssignee, newPrURL } = req.body as {
    field: "status" | "assignee" | "pr";
    bugId: string;
    sprintNumber: string;
    newStatus?: string;
    newAssignee?: string;
    newPrURL?: string;
  };

  // Validate
  if (!bugId?.trim()) {
    res.status(400).json({ success: false, message: "Missing bugId" });
    return;
  }
  if (!sprintNumber?.trim()) {
    res.status(400).json({ success: false, message: "Missing sprintNumber" });
    return;
  }
  if (!field) {
    res
      .status(400)
      .json({ success: false, message: "Missing field (status|assignee|pr)" });
    return;
  }

  if (field === "status") {
    if (
      !newStatus ||
      !VALID_STATUSES.includes(newStatus as (typeof VALID_STATUSES)[number])
    ) {
      res
        .status(400)
        .json({
          success: false,
          message: `Invalid status. Must be: ${VALID_STATUSES.join(", ")}`,
        });
      return;
    }
  }

  if (field === "assignee") {
    if (!newAssignee?.trim()) {
      res.status(400).json({ success: false, message: "Missing newAssignee" });
      return;
    }
  }

  if (field === "pr" && newPrURL && newPrURL.trim()) {
    try { new URL(newPrURL.trim()); } catch {
      res.status(400).json({ success: false, message: "Invalid PR URL" });
      return;
    }
  }

  try {
    const action = field === "status" ? "update_status" : field === "assignee" ? "update_assignee" : "update_pr";
    const payload = { action, bugId, sprintNumber, newStatus, newAssignee, newPrURL };

    console.log(
      `[update] ${action} | bug=${bugId} | sprint=${sprintNumber} | value=${newStatus ?? newAssignee ?? newPrURL}`,
    );

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const rawText = await response.text();
    console.log("[update] Apps Script response:", rawText.slice(0, 200));

    let data: { success: boolean; message?: string };
    try {
      data = JSON.parse(rawText);
    } catch {
      data = {
        success: false,
        message: `Non-JSON response: ${rawText.slice(0, 100)}`,
      };
    }

    res.status(200).json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[update] Error:", message);
    res.status(500).json({ success: false, message });
  }
}
