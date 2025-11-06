/* =======================[ START: renderer.js (IPC sender) ]======================= */
// We are in the Renderer process (the BrowserWindow's web page).
// We'll use Electron's IPC (inter-process communication) to ask main.js
// to create a scheduled task via Windows Task Scheduler.

const { ipcRenderer } = require("electron"); // exposes IPC from renderer to main

// 1) Get the button from the DOM
const scheduleBtn = document.getElementById("scheduleBtn");

// 2) When the user clicks the button, request scheduling from main
scheduleBtn.addEventListener("click", async () => {
	// Ask main process to create (or replace) a scheduled task
	// The channel name 'scheduler:createSelf' must match main.js
	const res = await ipcRenderer.invoke("scheduler:createSelf", {
		// Payload left empty for now; main.js will use defaults
	});

	// 3) Provide simple feedback to the user
	if (res?.ok) {
		alert(`Success: ${res.message}`);
	} else {
		alert(`Error: ${res?.message || "Unknown error"}`);
	}
});
/* =======================[ END: renderer.js (IPC sender) ]========================= */
