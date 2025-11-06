/* =======================[ START: renderer.js (IPC sender) ]======================= */
// We are in the Renderer process (the BrowserWindow's web page).
// We'll use Electron's IPC (inter-process communication) to ask main.js
// to create a scheduled task via Windows Task Scheduler.
const { ipcRenderer } = require("electron");

document.getElementById("createBtn").addEventListener("click", async () => {
	const res = await ipcRenderer.invoke("scheduler:createSelf");
	alert(res.ok ? `✅ ${res.message}` : `❌ ${res.message}`);
});

document.getElementById("runBtn").addEventListener("click", async () => {
	const res = await ipcRenderer.invoke("scheduler:runSelf");
	alert(res.ok ? `▶️ ${res.message}` : `❌ ${res.message}`);
});

document.getElementById("deleteBtn").addEventListener("click", async () => {
	const res = await ipcRenderer.invoke("scheduler:deleteSelf");
	alert(res.ok ? `🗑️ ${res.message}` : `❌ ${res.message}`);
});

document.getElementById("viewBtn").addEventListener("click", async () => {
	const res = await ipcRenderer.invoke("scheduler:viewSelf");
	alert(res.ok ? `📄 ${res.message}` : `❌ ${res.message}`);
});

// NEW: Open Settings window
const settingsBtn = document.getElementById("settingsBtn");
if (settingsBtn) {
	settingsBtn.addEventListener("click", async () => {
		const res = await ipcRenderer.invoke("settings:open");
		if (!res?.ok) {
			alert(`❌ Failed to open Settings: ${res?.message || "Unknown error"}`);
		}
	});
}
/* =======================[ END: renderer.js ]========================= */
// PREVIEW SCAN (skeleton)
const scanBtn = document.getElementById("scanBtn");
if (scanBtn) {
	scanBtn.addEventListener("click", async () => {
		const res = await ipcRenderer.invoke("scan:run");
		if (!res?.ok) {
			alert(`❌ Scan failed: ${res?.message || "Unknown error"}`);
			return;
		}
		const { foldersScanned, filesMatched, totalSizeBytes, sample } = res.data;
		const mb = (totalSizeBytes / (1024 * 1024)).toFixed(2);
		let msg = `✅ Scan completed\n📁 Folders scanned: ${foldersScanned}\n🗂️ Files matched: ${filesMatched}\n💾 Total size: ${mb} MB`;
		if (sample?.length) {
			msg +=
				`\n\nFirst few results:\n- ` + sample.map((s) => s.path).join("\n- ");
		}
		alert(msg);
	});
}
