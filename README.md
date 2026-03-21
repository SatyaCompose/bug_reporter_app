# Bug Report System — Vercel + Google Docs

A bug reporting system with a submission form and live dashboard. Bug reports are saved to **Google Docs per sprint**, with full status and assignee management from the dashboard.

---

## Features

- Submit bug reports with title, description, priority, assignee, screenshots, and video URL
- Auto-creates a new Google Doc per sprint; subsequent bugs in the same sprint are appended
- Live dashboard at `/dashboard.html` — view, filter, and update all bug reports
- Update bug status (Open → In Progress → Resolved → Closed) directly from the dashboard
- Update assignee inline from the dashboard
- Charts for status and priority breakdowns
- Mobile-responsive form and dashboard

---

## Project Structure

```
bug-report/
├── public/
│   ├── index.html          ← Bug submission form
│   └── dashboard.html      ← Bug dashboard (view, filter, update)
├── api/
│   ├── submit.ts           ← Vercel serverless: handles new bug submissions
│   ├── bugs.ts             ← Vercel serverless: fetches all bugs from Google Docs
│   └── update.ts           ← Vercel serverless: updates status or assignee
├── src/
│   ├── env.ts              ← Environment variable loading & validation
│   └── types.ts            ← Shared TypeScript interfaces
├── Code.gs                 ← Google Apps Script (paste into script.google.com)
├── server.ts               ← Local dev server (mimics Vercel routing)
├── vercel.json             ← Vercel routing config
├── tsconfig.json
├── package.json
└── README.md
```

---

## Setup

### Step 1 — Google Apps Script

1. Open [script.google.com](https://script.google.com) → **New Project**
2. Paste the full contents of `Code.gs`
3. **Create a Google Drive folder** to store sprint docs → copy its ID from the URL:
   ```
   https://drive.google.com/drive/folders/👉 THIS_IS_YOUR_FOLDER_ID 👈
   ```
4. Replace `YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE` in `Code.gs` with your folder ID
5. Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Authorize permissions → copy the **Web App URL**

> Every time you edit `Code.gs`, create a **New Deployment** (not "Manage existing") to get a fresh working URL.

---

### Step 2 — Local Development

1. Clone/copy this project and install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:
   ```
   APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_ID/exec
   PORT=3001
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Open in browser:
   - Form: `http://localhost:3001/index.html`
   - Dashboard: `http://localhost:3001/dashboard.html`

---

### Step 3 — Deploy to Vercel

#### Option A — Vercel CLI
```bash
npm i -g vercel
vercel
```

#### Option B — GitHub + Vercel Dashboard
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. Framework preset: **Other**
4. Click **Deploy**

#### Set Environment Variable
After deploying, add the Apps Script URL:

1. Vercel Dashboard → your project → **Settings → Environment Variables**
2. Add:
   - **Name:** `APPS_SCRIPT_URL`
   - **Value:** `https://script.google.com/macros/s/YOUR_ID/exec`
   - Environment: **Production** (and Preview if needed)
3. Click **Save** → **Deployments** → **Redeploy**

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/submit` | Submit a new bug report |
| `GET` | `/api/bugs` | Fetch all bugs (supports `?sprint=`, `?status=`, `?priority=`, `?assignee=` filters) |
| `POST` | `/api/update` | Update a bug's status or assignee |

---

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `APPS_SCRIPT_URL` | Yes | Google Apps Script Web App URL | — |
| `PORT` | No | Local dev server port | `3001` |

---

## How Sprint Docs Work

| Scenario | Result |
|----------|--------|
| First bug for Sprint 14 | New doc created: `Sprint-14 Bug Reports (Release ...)` |
| Second bug for Sprint 14 | Appended to the existing Sprint-14 doc |
| First bug for Sprint 15 | New doc created: `Sprint-15 Bug Reports (Release ...)` |

---

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start local dev server on `localhost:3001` |
| `npm run build` | Compile TypeScript |
| `npm run typecheck` | Type-check without emitting files |
| `npm run deploy` | Deploy to Vercel production |
