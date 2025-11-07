/* =======================[ START: renderer.js (Renderer IPC & UI Logic) ]======================= */
/*
   🧭 Purpose:
   This script runs in the Renderer process (BrowserWindow web page).
   It sends commands to main.js via IPC to:
   - Manage Windows Task Scheduler tasks (create, run, delete, view)
   - Open the Settings window
   - Trigger folder scans (Step-4)

   🔷 IPC Map
   ┌───────────────────────┬────────────────────────────┐
   │ Button ID             │ IPC Channel               │
   ├───────────────────────┼────────────────────────────┤
   │ createBtn             │ scheduler:createSelf       │
   │ runBtn                │ scheduler:runSelf          │
   │ deleteBtn             │ scheduler:deleteSelf       │
   │ viewBtn               │ scheduler:viewSelf         │
   │ settingsBtn           │ settings:open              │
   │ scanBtn               │ scan:run                   │
   └───────────────────────┴────────────────────────────┘
*/

const { ipcRenderer } = require("electron");
const path = require("path");

/* ======================= ⚙️ SECTION: Scheduler Controls ======================= */

/** Create scheduled task (11 PM daily) */
document.getElementById("createBtn")?.addEventListener("click", async () => {
	try {
		const res = await ipcRenderer.invoke("scheduler:createSelf");
		alert(res.ok ? `✅ ${res.message}` : `❌ ${res.message}`);
	} catch (e) {
		alert(`❌ Error creating task: ${e.message}`);
	}
});

/** Run scheduled task manually */
document.getElementById("runBtn")?.addEventListener("click", async () => {
	try {
		const res = await ipcRenderer.invoke("scheduler:runSelf");
		alert(res.ok ? `▶️ ${res.message}` : `❌ ${res.message}`);
	} catch (e) {
		alert(`❌ Error running task: ${e.message}`);
	}
});

/** Delete existing scheduled task */
document.getElementById("deleteBtn")?.addEventListener("click", async () => {
	try {
		const res = await ipcRenderer.invoke("scheduler:deleteSelf");
		alert(res.ok ? `🗑️ ${res.message}` : `❌ ${res.message}`);
	} catch (e) {
		alert(`❌ Error deleting task: ${e.message}`);
	}
});

/** View details of current scheduled task */
document.getElementById("viewBtn")?.addEventListener("click", async () => {
	try {
		const res = await ipcRenderer.invoke("scheduler:viewSelf");
		alert(res.ok ? `📄 ${res.message}` : `❌ ${res.message}`);
	} catch (e) {
		alert(`❌ Error viewing task: ${e.message}`);
	}
});

/* ======================= 🧰 SECTION: Settings Window ======================= */

/** Opens the dedicated Settings window (Step-3) */
document.getElementById("settingsBtn")?.addEventListener("click", async () => {
	try {
		const res = await ipcRenderer.invoke("settings:open");
		if (!res?.ok) {
			alert(`❌ Failed to open Settings: ${res?.message || "Unknown error"}`);
		}
	} catch (e) {
		alert(`❌ Error opening Settings: ${e.message}`);
	}
});

/* ======================= 🔍 SECTION: File Scanner Preview (Step-4) ======================= */

/**
 * Triggers a recursive folder scan (configured in settings).
 * Displays a compact summary + first 10 sample file paths.
 */

/* ======================= 🪞 SECTION: Review-First Workflow (Step-5) ======================= */
/*
   Displays scanned files in a table-like list with:
   - Checkbox (for later actions)
   - File name
   - Path
   - Modified date
   - Size in MB

   Uses same backend data returned by scan:run (main.js).
*/

const resultsDiv = document.getElementById("scanResults");
const rescanBtn = document.getElementById("rescanBtn");

/** Helper to format bytes into MB */
function formatBytes(bytes) {
	if (isNaN(bytes)) return "0 MB";
	return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

/** Helper to format ISO timestamp */
function formatDate(isoStr) {
	try {
		return new Date(isoStr).toLocaleString();
	} catch {
		return isoStr || "";
	}
}

/** Render the list of files as an HTML table */
function renderScanResults(data) {
	if (!resultsDiv) return;
	resultsDiv.innerHTML = ""; // clear old content

	const { foldersScanned, filesMatched, totalSizeBytes, sample } = data;
	if (!sample || !sample.length) {
		resultsDiv.innerHTML = `<em>No matching files found.</em>`;
		return;
	}

	// Summary
	const summary = document.createElement("div");
	summary.innerHTML = `
		<p>📁 Folders scanned: <strong>${foldersScanned}</strong> |
		🗂️ Files matched: <strong>${filesMatched}</strong> |
		💾 Total size: <strong>${formatBytes(totalSizeBytes)}</strong></p>
	`;
	resultsDiv.appendChild(summary);

	// Create header row
	const table = document.createElement("table");
	table.style.width = "100%";
	table.style.borderCollapse = "collapse";
	table.style.fontSize = "13px";

	const header = document.createElement("tr");
	header.innerHTML = `
		<th style="border-bottom:1px solid #ccc; text-align:left;">Select</th>
		<th style="border-bottom:1px solid #ccc; text-align:left;">File Name</th>
		<th style="border-bottom:1px solid #ccc; text-align:left;">Path</th>
		<th style="border-bottom:1px solid #ccc; text-align:left;">Modified</th>
		<th style="border-bottom:1px solid #ccc; text-align:right;">Size</th>
	`;
	table.appendChild(header);

	// Populate rows
	for (const item of sample) {
		const tr = document.createElement("tr");
		tr.innerHTML = `
			<td><input type="checkbox" class="fileCheck" /></td>
			<td>${path.basename(item.path)}</td>
			<td>${item.path}</td>
			<td>${formatDate(item.modified)}</td>
			<td style="text-align:right;">${formatBytes(item.size)}</td>
		`;
		table.appendChild(tr);
	}

	resultsDiv.appendChild(table);
}

/** Runs scan and displays results */
async function runScanAndRender() {
	try {
		resultsDiv.innerHTML = `<em>Scanning...</em>`;
		const res = await ipcRenderer.invoke("scan:run");
		if (!res?.ok) {
			resultsDiv.innerHTML = `<span style="color:red;">❌ ${
				res?.message || "Scan failed."
			}</span>`;
			return;
		}
		renderScanResults(res.data);
	} catch (e) {
		resultsDiv.innerHTML = `<span style="color:red;">❌ Error: ${e.message}</span>`;
	}
}
// Unified Step-5 Scan Handler (matches Rescan behavior)
document.getElementById("scanBtn")?.addEventListener("click", runScanAndRender);
/** Re-run the scan when "Rescan" button is clicked */
rescanBtn?.addEventListener("click", runScanAndRender);

// Optional: auto-run when first loaded (comment out if you prefer manual start)
// runScanAndRender();

/* =======================[ END: renderer.js ]========================= */
