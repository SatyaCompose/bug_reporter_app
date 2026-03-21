// src/env.ts — Loads and validates environment variables
//
// REQUIRED ENV VARIABLES:
// ┌─────────────────────┬──────────────────────────────────────────────────────┐
// │ Variable            │ Description                                          │
// ├─────────────────────┼──────────────────────────────────────────────────────┤
// │ APPS_SCRIPT_URL     │ Your deployed Google Apps Script Web App URL.        │
// │                     │ Get it from: script.google.com → Deploy → Web App    │
// │                     │ Format: https://script.google.com/macros/s/.../exec  │
// └─────────────────────┴──────────────────────────────────────────────────────┘
//
// OPTIONAL ENV VARIABLES:
// ┌─────────────────────┬──────────────────────────────────────────────────────┐
// │ Variable            │ Description                          │ Default       │
// ├─────────────────────┼──────────────────────────────────────┼───────────────┤
// │ PORT                │ Local dev server port                │ 3001          │
// └─────────────────────┴──────────────────────────────────────┴───────────────┘
//
// HOW TO SET THEM:
//   Local dev  → copy .env.example to .env and fill in values
//   Vercel     → Dashboard → Project → Settings → Environment Variables

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export interface Env {
  APPS_SCRIPT_URL: string;
  PORT: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `\n\u274c Missing required environment variable: ${name}\n` +
        `   \u2192 For local dev: add it to your .env file\n` +
        `   \u2192 For Vercel:    Dashboard \u2192 Settings \u2192 Environment Variables\n`,
    );
  }
  return value.trim();
}

function optionalEnv(name: string, fallback: string): string {
  return (process.env[name] ?? fallback).trim();
}

function validateScriptUrl(url: string): void {
  const pattern = /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/;
  if (!pattern.test(url)) {
    console.warn(
      `\n\u26a0\ufe0f  APPS_SCRIPT_URL looks incorrect.\n` +
        `   Expected: https://script.google.com/macros/s/YOUR_ID/exec\n` +
        `   Got: ${url}\n`,
    );
  }
}

export function loadEnv(): Env {
  const APPS_SCRIPT_URL = requireEnv("APPS_SCRIPT_URL");
  validateScriptUrl(APPS_SCRIPT_URL);

  const portStr = optionalEnv("PORT", "3001");
  const PORT = parseInt(portStr, 10);
  if (isNaN(PORT)) throw new Error(`PORT must be a number, got: "${portStr}"`);

  return { APPS_SCRIPT_URL, PORT };
}

export function getAppsScriptUrl(): string | null {
  return process.env.APPS_SCRIPT_URL?.trim() || null;
}
