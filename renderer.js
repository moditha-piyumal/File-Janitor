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
document.getElementById("scanBtn")?.addEventListener("click", async () => {
	try {
		const res = await ipcRenderer.invoke("scan:run");
		if (!res?.ok) {
			alert(`❌ Scan failed: ${res?.message || "Unknown error"}`);
			return;
		}

		const { foldersScanned, filesMatched, totalSizeBytes, sample } = res.data;
		const mb = (totalSizeBytes / (1024 * 1024)).toFixed(2);

		let msg =
			`✅ Scan completed\n` +
			`📁 Folders scanned: ${foldersScanned}\n` +
			`🗂️ Files matched: ${filesMatched}\n` +
			`💾 Total size: ${mb} MB`;

		if (sample?.length) {
			msg +=
				`\n\nFirst few results:\n- ` + sample.map((s) => s.path).join("\n- ");
		}
		alert(msg);
	} catch (e) {
		alert(`❌ Error during scan: ${e.message}`);
	}
});

/* =======================[ END: renderer.js ]========================= */
