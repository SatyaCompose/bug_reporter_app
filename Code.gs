// ================================================================
// GOOGLE APPS SCRIPT — Bug Report System v3
// QA Account | Auto-share | Status + Assignee Updates
// ================================================================
// SETUP:
// 1. Sign in to script.google.com with QA's Google account
// 2. Paste this file → replace FOLDER_ID below
// 3. Deploy → New Deployment → Web App
//    - Execute as: Me  (QA's account)
//    - Who has access: Anyone
// 4. Copy Web App URL → set APPS_SCRIPT_URL in Vercel / .env
// ================================================================

const FOLDER_ID = "YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE"; // 🔁 Replace this

// ── Router ─────────────────────────────────────────────────────
function doGet(e) {
  try {
    const bugs = getAllBugs({
      sprint:   e?.parameter?.sprint   || null,
      status:   e?.parameter?.status   || null,
      priority: e?.parameter?.priority || null,
      assignee: e?.parameter?.assignee || null,
    });
    return jsonResponse({ success: true, bugs });
  } catch (err) {
    Logger.log("doGet error: " + err.toString());
    return jsonResponse({ success: false, message: err.toString() });
  }
}

function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const action = data.action || "submit";
    Logger.log("doPost action: " + action);

    if (action === "submit")            return handleSubmit(data);
    if (action === "update_status")     return handleUpdateField(data, "status");
    if (action === "update_assignee")   return handleUpdateField(data, "assignee");
    if (action === "update_pr")         return handleUpdateField(data, "pr");
    if (action === "update_developer")  return handleUpdateField(data, "developer");

    return jsonResponse({ success: false, message: "Unknown action: " + action });
  } catch (err) {
    Logger.log("doPost error: " + err.toString());
    return jsonResponse({ success: false, message: err.toString() });
  }
}

// ── POST submit ────────────────────────────────────────────────
function handleSubmit(data) {
  // Block empty or TBD release dates server-side
  const releaseDate = (data.releaseDate || "").trim();
  if (!releaseDate || releaseDate === "TBD" || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    return jsonResponse({ success: false, message: "Invalid or missing releaseDate. Must be YYYY-MM-DD." });
  }
  const docUrl = saveToSprintDoc(data);
  return jsonResponse({ success: true, docUrl });
}

// ── POST update_status / update_assignee / update_pr ───────────
function handleUpdateField(data, field) {
  const { bugId, sprintNumber, newStatus, newAssignee, newPrURL, newDeveloper } = data;
  const newValue = field === "status" ? newStatus : field === "assignee" ? newAssignee : field === "developer" ? newDeveloper : (newPrURL || "");

  Logger.log("handleUpdateField: field=" + field + " bugId=" + bugId + " sprint=" + sprintNumber + " value=" + newValue);

  if (!bugId || !sprintNumber) {
    return jsonResponse({ success: false, message: "Missing bugId or sprintNumber" });
  }
  // PR can be cleared (empty string is valid); other fields must have a value
  if (field !== "pr" && !newValue) {
    return jsonResponse({ success: false, message: "Missing new value for field: " + field });
  }

  if (field === "status") {
    const VALID = ["Open", "In Progress", "Resolved", "No Fix Required", "Completed"];
    if (!VALID.includes(newValue)) {
      return jsonResponse({ success: false, message: "Invalid status: " + newValue });
    }
  }

  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files  = folder.getFilesByType(MimeType.GOOGLE_DOCS);
  let updated  = false;

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    // Match Sprint-1, Sprint-12 etc.
    const sprintMatch = name.match(/^Sprint-(\d+)\s/);
    if (!sprintMatch || sprintMatch[1] !== String(sprintNumber)) continue;

    Logger.log("Checking doc: " + name);
    const doc = DocumentApp.openById(file.getId());
    updated   = updateFieldInDoc(doc, bugId, field, newValue);
    if (updated) {
      Logger.log("Updated " + field + " in doc: " + name);
      break;
    }
  }

  if (!updated) {
    return jsonResponse({ success: false, message: "Bug " + bugId + " not found in Sprint-" + sprintNumber + " docs." });
  }

  return jsonResponse({ success: true, message: field + " updated to: " + newValue });
}

// ── Update a specific field in the bug's metadata table ────────
function updateFieldInDoc(doc, bugId, field, newValue) {
  const body = doc.getBody();
  const n    = body.getNumChildren();

  // Cell background colours
  const statusColors   = { "Open":"#dbeafe", "In Progress":"#fef3c7", "Resolved":"#d1fae5", "No Fix Required":"#f1f5f9", "Completed":"#dcfce7" };
  const priorityColors = { "Low":"#d1fae5", "Medium":"#fef3c7", "High":"#ffedd5", "Critical":"#fee2e2" };

  // Row key to look for
  const targetKey = field === "status" ? "status" : field === "assignee" ? "assignee" : field === "developer" ? "developer" : "prurl";

  for (let i = 0; i < n; i++) {
    const child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.TABLE) continue;

    const table = child.asTable();
    let thisBugId = null;

    // Find Bug ID in this table
    for (let r = 0; r < table.getNumRows(); r++) {
      const k = table.getCell(r, 0).getText().trim().toLowerCase().replace(/\s+/g, "");
      const v = table.getCell(r, 1).getText().trim();
      if (k === "bugid") { thisBugId = v; break; }
    }

    if (thisBugId !== bugId) continue;

    // Found the right table — update the target field
    let foundRow = false;
    for (let r = 0; r < table.getNumRows(); r++) {
      const k = table.getCell(r, 0).getText().trim().toLowerCase().replace(/\s+/g, "");
      if (k === targetKey) {
        table.getCell(r, 1).setText(newValue);
        if (field === "status"    && statusColors[newValue]) table.getCell(r, 1).setBackgroundColor(statusColors[newValue]);
        if (field === "assignee")  table.getCell(r, 1).setBackgroundColor("#f8f9fa");
        if (field === "developer") table.getCell(r, 1).setBackgroundColor("#f0fff4");
        if (field === "pr")        table.getCell(r, 1).setBackgroundColor("#f0f4ff");
        foundRow = true;
        break;
      }
    }
    // Developer row may not exist on older bugs — append it to the table
    if (!foundRow && field === "developer") {
      const newRow = table.appendTableRow();
      newRow.appendTableCell("Developer")
            .editAsText().setBold(true).setForegroundColor("#374151");
      newRow.getCell(0).setBackgroundColor("#f1f3f9");
      newRow.appendTableCell(newValue).setBackgroundColor("#f0fff4");
      foundRow = true;
    }
    // PR row may not exist on older bugs — append it to the table
    if (!foundRow && field === "pr") {
      const newRow = table.appendTableRow();
      newRow.appendTableCell("PR URL")
            .editAsText().setBold(true).setForegroundColor("#374151");
      newRow.getCell(0).setBackgroundColor("#f1f3f9");
      newRow.appendTableCell(newValue).setBackgroundColor("#f0f4ff");
      foundRow = true;
    }
    if (foundRow) { doc.saveAndClose(); return true; }
  }
  return false;
}

// ── Read all bugs ──────────────────────────────────────────────
function getAllBugs(filters) {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files  = folder.getFilesByType(MimeType.GOOGLE_DOCS);
  const bugs   = [];

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    if (!name.startsWith("Sprint-")) continue;

    const sprintMatch  = name.match(/Sprint-(\d+)/);
    const releaseMatch = name.match(/Release\s+([\d-]+)/);
    const sprintNumber = sprintMatch  ? sprintMatch[1]  : "?";
    const releaseDate  = releaseMatch ? releaseMatch[1] : "?";

    if (filters.sprint && filters.sprint !== sprintNumber) continue;

    const docUrl = "https://docs.google.com/document/d/" + file.getId() + "/edit";
    const doc    = DocumentApp.openById(file.getId());
    const docBugs = parseDocForBugs(doc, sprintNumber, releaseDate);
    // Attach docUrl to every bug so the dashboard can link directly to it
    docBugs.forEach(function(b) { b.docUrl = docUrl; });
    bugs.push(...docBugs);
  }

  return bugs.filter(b => {
    if (filters.status   && b.status   !== filters.status)   return false;
    if (filters.priority && b.priority !== filters.priority) return false;
    if (filters.assignee && !b.assignee.toLowerCase().includes(filters.assignee.toLowerCase())) return false;
    return true;
  });
}

// ── Parse doc into bug objects ─────────────────────────────────
function parseDocForBugs(doc, sprintNumber, releaseDate) {
  const body = doc.getBody();
  const n    = body.getNumChildren();
  const bugs = [];
  let current = null;

  for (let i = 0; i < n; i++) {
    const child = body.getChild(i);
    const type  = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      const para    = child.asParagraph();
      const heading = para.getHeading();
      const text    = para.getText().trim();

      if (heading === DocumentApp.ParagraphHeading.HEADING1 && text.length > 0) {
        if (current) bugs.push(current);
        const idMatch    = text.match(/\[id:([a-f0-9-]+)\]/);
        const cleanTitle = text.replace(/^🔴\s*/, "").replace(/\s*\[id:[^\]]+\]/, "").trim();
        current = {
          id: idMatch ? idMatch[1] : Utilities.getUuid(),
          sprintNumber, releaseDate,
          title: cleanTitle,
          reportedBy:"", assignee:"", developer:"", priority:"", status:"",
          pageURL:"", videoURL:"", prURL:"", description:"", screenshots:"", submittedAt:"",
        };
      }

      if (heading === DocumentApp.ParagraphHeading.HEADING2 && current) {
        const label = text.toLowerCase();
        if (label === "description" && i+1 < n) {
          const nx = body.getChild(i+1);
          if (nx.getType() === DocumentApp.ElementType.PARAGRAPH)
            current.description = nx.asParagraph().getText().trim();
        }
        if (label === "video" && i+1 < n) {
          const nx = body.getChild(i+1);
          if (nx.getType() === DocumentApp.ElementType.PARAGRAPH)
            current.videoURL = nx.asParagraph().getText().trim();
        }
        if (label === "screenshots" && i+1 < n) {
          const lines = [];
          for (let j = i+1; j < n; j++) {
            const nx = body.getChild(j);
            if (nx.getType() !== DocumentApp.ElementType.PARAGRAPH) break;
            const t = nx.asParagraph().getText().trim();
            if (!t) break;
            if (t.startsWith("📎")) lines.push(t.replace(/^📎\s*/, ""));
            else if (t.startsWith("•")) lines.push(t.replace(/^•\s*/, ""));
          }
          current.screenshots = lines.join(", ");
        }
      }
    }

    if (type === DocumentApp.ElementType.TABLE && current) {
      const table = child.asTable();
      for (let r = 0; r < table.getNumRows(); r++) {
        const k = table.getCell(r, 0).getText().trim().toLowerCase().replace(/\s+/g, "");
        const v = table.getCell(r, 1).getText().trim();
        switch (k) {
          case "reportedby":  current.reportedBy  = v; break;
          case "assignee":    current.assignee    = v; break;
          case "developer":   current.developer   = v; break;
          case "priority":    current.priority    = v; break;
          case "status":      current.status      = v; break;
          case "pageurl":     current.pageURL     = v; break;
          case "videourl":    current.videoURL    = v; break;
          case "prurl":       current.prURL       = v !== "—" ? v : ""; break;
          case "submittedat": current.submittedAt = v; break;
        }
      }
    }
  }

  if (current) bugs.push(current);
  return bugs;
}

// ── Save bug to sprint doc ─────────────────────────────────────
function saveToSprintDoc(data) {
  const sprintNum   = String(data.sprintNumber || "?").trim();
  const releaseDate = String(data.releaseDate  || "").trim();
  const docName     = "Sprint-" + sprintNum + " Bug Reports (Release " + releaseDate + ")";

  const folder = DriveApp.getFolderById(FOLDER_ID);
  let   doc    = findDocByName(folder, docName);
  if (!doc) doc = createSprintDoc(folder, docName, sprintNum, releaseDate);

  appendBugReport(doc, data);
  return doc.getUrl();
}

function findDocByName(folder, name) {
  const files = folder.getFilesByName(name);
  return files.hasNext() ? DocumentApp.openById(files.next().getId()) : null;
}

function createSprintDoc(folder, docName, sprintNum, releaseDate) {
  const doc  = DocumentApp.create(docName);
  const body = doc.getBody();
  const file = DriveApp.getFileById(doc.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  // Anyone with link = Commenter
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.COMMENT);

  body.appendParagraph("🐛  Sprint #" + sprintNum + " — Bug Reports")
      .setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph("Release: " + releaseDate + "   ·   Created: " + now() + "   ·   Owner: QA")
      .setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
  body.appendHorizontalRule();
  body.appendParagraph("");
  doc.saveAndClose();
  return DocumentApp.openById(doc.getId());
}

function appendBugReport(doc, d) {
  const body  = doc.getBody();
  const bugId = Utilities.getUuid();

  body.appendParagraph("🔴  " + (d.title || "Untitled Bug") + " [id:" + bugId + "]")
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);

  const tableData = [
    ["Sprint",       "#" + (d.sprintNumber || "?")],
    ["Release Date", d.releaseDate  || "—"],
    ["Reported By",  d.reportedBy   || "—"],
    ["Assignee",     d.assignee     || "—"],
    ["Developer",    d.developer    || "—"],
    ["Priority",     d.priority     || "—"],
    ["Status",       d.status       || "Open"],
    ["Page URL",     d.pageURL      || "—"],
    ["Video URL",    d.videoURL     || "—"],
    ["PR URL",       "—"],
    ["Submitted At", now()],
    ["Bug ID",       bugId],
  ];

  const table = body.appendTable(tableData);

  for (let i = 0; i < table.getNumRows(); i++) {
    table.getCell(i, 0).setBackgroundColor("#f1f3f9")
         .editAsText().setBold(true).setForegroundColor("#374151");
  }

  const pc = { Low:"#d1fae5", Medium:"#fef3c7", High:"#ffedd5", Critical:"#fee2e2" };
  const sc = { Open:"#dbeafe", "In Progress":"#fef3c7", Resolved:"#d1fae5", "No Fix Required":"#f1f5f9", Completed:"#dcfce7" };
  if (d.priority && pc[d.priority]) table.getCell(5, 1).setBackgroundColor(pc[d.priority]);
  const statusVal = d.status || "Open";
  if (sc[statusVal]) table.getCell(6, 1).setBackgroundColor(sc[statusVal]);

  body.appendParagraph("").setHeading(DocumentApp.ParagraphHeading.NORMAL);
  body.appendParagraph("Description").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(d.description || "No description provided.");

  // Screenshots — embed actual images
  if (d.screenshots && d.screenshots.length > 0) {
    body.appendParagraph("Screenshots").setHeading(DocumentApp.ParagraphHeading.HEADING2);
    const screenshots = Array.isArray(d.screenshots) ? d.screenshots : [];
    if (screenshots.length === 0) {
      String(d.screenshots).split(",").map(s => s.trim()).filter(Boolean)
        .forEach(name => body.appendParagraph("• " + name).setIndentStart(18));
    } else {
      screenshots.forEach(function(ss) {
        try {
          body.appendParagraph("📎 " + ss.name).setIndentStart(18);
          const blob = Utilities.newBlob(Utilities.base64Decode(ss.base64), ss.mimeType, ss.name);
          const imgPara   = body.appendParagraph("");
          const imgInline = imgPara.appendInlineImage(blob);
          const maxWidth  = 500;
          const origW     = imgInline.getWidth();
          const origH     = imgInline.getHeight();
          if (origW > maxWidth) {
            imgInline.setWidth(maxWidth);
            imgInline.setHeight(Math.round((origH / origW) * maxWidth));
          }
          body.appendParagraph("");
        } catch (imgErr) {
          Logger.log("Image insert failed for " + ss.name + ": " + imgErr.toString());
          body.appendParagraph("• " + ss.name + " (upload failed)").setIndentStart(18);
        }
      });
    }
  }

  if (d.videoURL && d.videoURL.trim()) {
    body.appendParagraph("Video").setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(d.videoURL.trim());
  }

  body.appendHorizontalRule();
  body.appendParagraph("");
  doc.saveAndClose();
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function now() {
  return new Date().toLocaleString("en-IN", { timeZone:"Asia/Kolkata", dateStyle:"medium", timeStyle:"short" });
}

// Tests
function testList() { Logger.log(JSON.stringify(getAllBugs({sprint:null,status:null,priority:null,assignee:null}), null, 2)); }
function testUpdateStatus() { Logger.log(JSON.stringify(handleUpdateField({ bugId:"TEST-ID", sprintNumber:"1", newStatus:"Resolved" }, "status"))); }