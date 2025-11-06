/* ===========================[ START: main.js (scheduler core + settings) ]=========================== */
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { exec } = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

/* ---------- Window creators ---------- */
let settingsWin = null;

function createWindow() {
	const win = new BrowserWindow({
		width: 900, // wide main window (your request from Step-2)
		height: 500,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});
	win.loadFile(path.join(__dirname, "index.html"));
	return win;
}

function createSettingsWindow() {
	if (settingsWin && !settingsWin.isDestroyed()) {
		settingsWin.focus();
		return settingsWin;
	}
	settingsWin = new BrowserWindow({
		width: 720,
		height: 620,
		resizable: true,
		title: "File Janitor — Settings",
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});
	settingsWin.loadFile(path.join(__dirname, "settings.html"));
	settingsWin.on("closed", () => {
		settingsWin = null;
	});
	return settingsWin;
}

/* ---------- App lifecycle ---------- */
app.whenReady().then(createWindow);

app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
	app.quit();
});

/* ---------- Scheduler IPC (unchanged core) ---------- */
// Heart of Step 1 (Plan says: test real Task Scheduler before the rest).
ipcMain.handle("scheduler:createSelf", async (_evt, _payload) => {
	try {
		const targetExe = process.execPath; // dev: electron.exe; packaged: installed app exe
		const TASK_NAME = "FileJanitor_AutoRun";
		const START_TIME = "23:00"; // 11 PM
		const cmd = `schtasks /Create /SC DAILY /ST ${START_TIME} /TN "${TASK_NAME}" /TR "${targetExe}" /F`;
		const { stdout, stderr } = await execAsync(cmd);
		if (stderr && stderr.trim().length > 0) {
			return { ok: false, message: `schtasks error: ${stderr.trim()}` };
		}
		return {
			ok: true,
			message: `Task "${TASK_NAME}" created. Output: ${stdout.trim()}`,
		};
	} catch (err) {
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

function execAsync(command) {
	return new Promise((resolve, reject) => {
		exec(command, { windowsHide: true }, (error, stdout, stderr) => {
			if (error) reject(error);
			else resolve({ stdout, stderr });
		});
	});
}

/* ---------- Settings persistence ---------- */
function getSettingsPath() {
	const dir = app.getPath("userData");
	return path.join(dir, "settings.json");
}

function defaultSettings() {
	return {
		folders: ["", "", ""], // up to 3 folders
		quarantineFolder: "", // optional
		extensions: [".pdf", ".docx"], // normalized with dot + lowercase
	};
}

async function loadSettings() {
	const file = getSettingsPath();
	try {
		const raw = await fsp.readFile(file, "utf8");
		const parsed = JSON.parse(raw);
		return sanitizeSettings(parsed);
	} catch {
		// If missing or invalid, return defaults (and write them lazily on first save)
		return defaultSettings();
	}
}

function sanitizeSettings(s) {
	const d = defaultSettings();
	// folders: ensure array of length 3 (pad/trim)
	let folders = Array.isArray(s.folders) ? s.folders.slice(0, 3) : d.folders;
	while (folders.length < 3) folders.push("");
	// quarantine folder
	const quarantineFolder =
		typeof s.quarantineFolder === "string"
			? s.quarantineFolder
			: d.quarantineFolder;
	// extensions: normalize
	const extensions = normalizeExtensions(s.extensions);
	return { folders, quarantineFolder, extensions };
}

function normalizeExtensions(input) {
	// Accept string (comma-separated) or array
	let arr = [];
	if (typeof input === "string") {
		arr = input.split(","); // we'll trim below
	} else if (Array.isArray(input)) {
		arr = input.slice();
	}
	const cleaned = arr
		.map((x) => String(x).trim().toLowerCase())
		.filter(Boolean)
		.map((x) => (x.startsWith(".") ? x : `.${x}`));
	// de-dupe
	return Array.from(new Set(cleaned));
}

async function saveSettings(payload) {
	const safe = sanitizeSettings(payload || {});
	const file = getSettingsPath();
	// Ensure directory exists
	try {
		fs.mkdirSync(path.dirname(file), { recursive: true });
	} catch {}
	await fsp.writeFile(file, JSON.stringify(safe, null, 2), "utf8");
	return safe;
}

/* ---------- Settings IPC ---------- */
// Open settings window
ipcMain.handle("settings:open", async () => {
	try {
		createSettingsWindow();
		return { ok: true };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

// Load current settings
ipcMain.handle("settings:load", async () => {
	try {
		const data = await loadSettings();
		return { ok: true, data };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

// Save settings
ipcMain.handle("settings:save", async (_evt, payload) => {
	try {
		const saved = await saveSettings(payload);
		return { ok: true, data: saved };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

// Pick a directory (for folder and quarantine selectors)
ipcMain.handle("dialog:pickDirectory", async () => {
	const res = await dialog.showOpenDialog({
		properties: ["openDirectory"],
	});
	return {
		canceled: res.canceled,
		path: res.canceled ? null : res.filePaths[0] || null,
	};
});
/* ===========================[ END: main.js ]============================= */
