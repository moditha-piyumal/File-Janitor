/* ===========================[ START: main.js (scheduler core) ]=========================== */
const { app, BrowserWindow, ipcMain } = require("electron");
const { exec } = require("child_process");
const path = require("path");

// 1) Create a basic BrowserWindow to show our single-button UI
function createWindow() {
	const win = new BrowserWindow({
		width: 700,
		height: 450,
		webPreferences: {
			nodeIntegration: true, // OK for tiny prototype; we'll harden later
			contextIsolation: false, // simplifies IPC for this step
		},
	});

	win.loadFile(path.join(__dirname, "index.html"));
}

// 2) App ready => create window
app.whenReady().then(createWindow);

// 3) Re-create on macOS dock click (standard template)
app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 4) Quit app when last window closes (keeps prototype simple)
app.on("window-all-closed", () => {
	app.quit();
});

// ------------------------ Scheduler IPC handler ------------------------
// Heart of Step 1 (Plan says: test real Task Scheduler before the rest).
ipcMain.handle("scheduler:createSelf", async (_evt, _payload) => {
	try {
		// 4.1) Path to the current executable.
		// - Dev: this is electron.exe
		// - Packaged: this is your app's installed .exe (exactly what we need to test)
		const targetExe = process.execPath;

		// 4.2) Stable, recognizable task name
		const TASK_NAME = "FileJanitor_AutoRun";

		// 4.3) Start time in 24-hour format (HH:MM)
		const START_TIME = "23:00"; // 11 PM

		// 4.4) Build the schtasks command
		// /Create   -> create task
		// /SC DAILY -> run daily
		// /ST hh:mm -> start time
		// /TN name  -> task name
		// /TR path  -> program to run (our app exe)
		// /F        -> force update if task exists
		const cmd = `schtasks /Create /SC DAILY /ST ${START_TIME} /TN "${TASK_NAME}" /TR "${targetExe}" /F`;

		// 4.5) Run the command hidden so no console flashes
		const { stdout, stderr } = await execAsync(cmd);

		// 4.6) If Windows printed to stderr, treat as error
		if (stderr && stderr.trim().length > 0) {
			return { ok: false, message: `schtasks error: ${stderr.trim()}` };
		}

		// 4.7) Success message we’ll show in the renderer
		return {
			ok: true,
			message: `Task "${TASK_NAME}" created. Output: ${stdout.trim()}`,
		};
	} catch (err) {
		// 4.8) Any thrown error -> bubble to UI
		return { ok: false, message: `Failed: ${err.message}` };
	}
});

const TASK_NAME = "FileJanitor_AutoRun";

ipcMain.handle("scheduler:runSelf", async () => {
	return await runCommand(
		`schtasks /Run /TN "${TASK_NAME}"`,
		"Task run successfully"
	);
});

ipcMain.handle("scheduler:deleteSelf", async () => {
	return await runCommand(
		`schtasks /Delete /TN "${TASK_NAME}" /F`,
		"Task deleted successfully"
	);
});

ipcMain.handle("scheduler:viewSelf", async () => {
	return await runCommand(
		`schtasks /Query /TN "${TASK_NAME}" /V /FO LIST`,
		"Task details fetched"
	);
});

// Helper: run a command and wrap it in {ok,message}
async function runCommand(cmd, successMsg) {
	try {
		const { stdout, stderr } = await execAsync(cmd);
		if (stderr && stderr.trim().length > 0)
			return { ok: false, message: stderr.trim() };
		return { ok: true, message: `${successMsg}\n${stdout.trim()}` };
	} catch (err) {
		return { ok: false, message: err.message };
	}
}

// Utility: Promise wrapper for child_process.exec so we can await it
function execAsync(command) {
	return new Promise((resolve, reject) => {
		exec(command, { windowsHide: true }, (error, stdout, stderr) => {
			if (error) reject(error);
			else resolve({ stdout, stderr });
		});
	});
}
/* ===========================[ END: main.js (scheduler core) ]============================= */
