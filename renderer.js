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
