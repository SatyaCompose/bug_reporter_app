// src/types.ts — Shared TypeScript interfaces

export interface ScreenshotAttachment {
  name: string; // original filename e.g. "bug-screenshot.png"
  mimeType: string; // e.g. "image/png"
  base64: string; // raw base64 string (no data: prefix)
}

export interface BugReportPayload {
  sprintNumber: string;
  releaseDate: string;
  title: string;
  reportedBy: string;
  assignee: string;
  pageURL: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  description: string;
  screenshots: ScreenshotAttachment[]; // array of image objects
  videoURL?: string;
}

export interface BugReport {
  id: string;
  sprintNumber: string;
  releaseDate: string;
  title: string;
  reportedBy: string;
  assignee: string;
  pageURL: string;
  priority: string;
  status: string;
  description: string;
  screenshots: string; // stored as comma-separated names in doc, returned as string
  videoURL: string;
  submittedAt: string;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  docUrl?: string;
}

export interface BugsApiResponse {
  success: boolean;
  bugs: BugReport[];
  message?: string;
}

export interface DashboardFilters {
  sprint?: string;
  status?: string;
  priority?: string;
  assignee?: string;
}
