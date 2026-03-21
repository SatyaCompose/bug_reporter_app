# 🐛 Bug Report Form — Vercel + Google Docs

A mobile-responsive bug report form that auto-creates a **new Google Doc per sprint** when submitted.

---

## 📁 Project Structure

```
bug-report/
├── public/
│   └── index.html       ← The form (HTML/CSS/JS)
├── api/
│   └── submit.js        ← Vercel serverless proxy
├── Code.gs              ← Google Apps Script (paste into script.google.com)
├── vercel.json          ← Vercel routing config
├── package.json
└── README.md
```

---

## 🚀 Deploy in 3 Phases

---

### Phase 1 — Google Apps Script

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
6. Click **Deploy** → authorize permissions → copy the **Web App URL**

> ⚠️ Every time you edit Code.gs, create a **New Deployment** (not "Manage existing") to get a fresh working URL.

---

### Phase 2 — Vercel Deploy

#### Option A — Vercel CLI (recommended)
```bash
npm i -g vercel
cd bug-report
vercel
# Follow prompts → deploy!
```

#### Option B — GitHub + Vercel Dashboard
1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. Framework preset: **Other**
4. Root directory: `./` (or wherever bug-report folder is)
5. Click **Deploy**

---

### Phase 3 — Set Environment Variable in Vercel

After deploying, add your Apps Script URL as an env var:

1. Vercel Dashboard → your project → **Settings → Environment Variables**
2. Add:
   - **Name:** `APPS_SCRIPT_URL`
   - **Value:** `https://script.google.com/macros/s/YOUR.../exec`
   - Environment: **Production** ✓ (and Preview if needed)
3. Click **Save** → go to **Deployments** → **Redeploy** (so the env var takes effect)

---

## ✅ Test It

1. Open your Vercel URL
2. Fill in the form with Sprint # e.g. `14` and a Release Date
3. Submit → check your Google Drive folder
4. A new doc named **`Sprint-14 Bug Reports (Release 2026-03-28)`** will appear!
5. Each subsequent submission to the same sprint **appends** to the existing doc

---

## 🔁 How Sprint Docs Work

| Scenario | Result |
|---|---|
| First bug for Sprint 14 | New doc created: `Sprint-14 Bug Reports (Release ...)` |
| Second bug for Sprint 14 | Appended to the existing Sprint-14 doc |
| First bug for Sprint 15 | New doc created: `Sprint-15 Bug Reports (Release ...)` |

---

## 🌍 Env Variables Reference

| Variable | Where | Description |
|---|---|---|
| `APPS_SCRIPT_URL` | Vercel | Your deployed Google Apps Script web app URL |

---

## 📱 Mobile Support

- Fully responsive down to 320px
- Touch-optimized pill selectors
- File upload works on iOS & Android
- Safe area insets for notched phones# bug_reporter_app
