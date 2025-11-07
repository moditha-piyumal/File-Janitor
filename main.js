/* ===========================[ START: main.js (Scheduler + Settings + Scanner) ]=========================== */
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { exec } = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");

/* ======================== 🧭 SECTION: Window Creation ======================== */
let settingsWin = null;

/** Create the main scheduler window (Step-1 & Step-2) */
function createWindow() {
	const win = new BrowserWindow({
		width: 900,
		height: 500,
		webPreferences: { nodeIntegration: true, contextIsolation: false },
	});
	win.loadFile(path.join(__dirname, "index.html"));
	return win;
}

/** Create the Settings window (Step-3) */
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
		webPreferences: { nodeIntegration: true, contextIsolation: false },
	});
	settingsWin.loadFile(path.join(__dirname, "settings.html"));
	settingsWin.on("closed", () => (settingsWin = null));
	return settingsWin;
}

/* ======================== ⚙️ SECTION: App Lifecycle ======================== */
app.whenReady().then(createWindow);
app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => app.quit());

/* ======================== ⚙️ SECTION: Windows Task Scheduler ======================== */
// Step-1: Test & manage a real Windows Task Scheduler task for File Janitor.

const TASK_NAME = "FileJanitor_AutoRun";

/** Helper: execute a shell command with Promise interface */
function execAsync(command) {
	return new Promise((resolve, reject) => {
		exec(command, { windowsHide: true }, (error, stdout, stderr) => {
			if (error) reject(error);
			else resolve({ stdout, stderr });
		});
	});
}

/** Helper: run schtasks command with unified result format */
async function runCommand(cmd, successMsg) {
	try {
		const { stdout, stderr } = await execAsync(cmd);
		if (stderr && stderr.trim()) return { ok: false, message: stderr.trim() };
		return { ok: true, message: `${successMsg}\n${stdout.trim()}` };
	} catch (err) {
		return { ok: false, message: err.message };
	}
}

/** Create daily 11 PM self-running task */
ipcMain.handle("scheduler:createSelf", async () => {
	try {
		const targetExe = process.execPath;
		const START_TIME = "23:00";
		const cmd = `schtasks /Create /SC DAILY /ST ${START_TIME} /TN "${TASK_NAME}" /TR "${targetExe}" /F`;
		const { stdout, stderr } = await execAsync(cmd);
		if (stderr && stderr.trim())
			return { ok: false, message: `schtasks error: ${stderr.trim()}` };
		return {
			ok: true,
			message: `Task "${TASK_NAME}" created.\n${stdout.trim()}`,
		};
	} catch (err) {
		return { ok: false, message: `Failed: ${err.message}` };
	}
});

/** Run the scheduled task immediately */
ipcMain.handle(
	"scheduler:runSelf",
	async () =>
		await runCommand(
			`schtasks /Run /TN "${TASK_NAME}"`,
			"Task run successfully"
		)
);

/** Delete the scheduled task */
ipcMain.handle(
	"scheduler:deleteSelf",
	async () =>
		await runCommand(
			`schtasks /Delete /TN "${TASK_NAME}" /F`,
			"Task deleted successfully"
		)
);

/** View task details */
ipcMain.handle(
	"scheduler:viewSelf",
	async () =>
		await runCommand(
			`schtasks /Query /TN "${TASK_NAME}" /V /FO LIST`,
			"Task details fetched"
		)
);

/* ======================== 🧰 SECTION: Settings System ======================== */
/** Get path of the local settings.json file */
function getSettingsPath() {
	const dir = app.getPath("userData");
	return path.join(dir, "settings.json");
}

/** Default structure of settings */
function defaultSettings() {
	return {
		folders: ["", "", ""],
		quarantineFolder: "",
		extensions: [".pdf", ".docx"],
	};
}

/** Normalize and de-duplicate extensions (.pdf vs pdf) */
function normalizeExtensions(input) {
	let arr = [];
	if (typeof input === "string") arr = input.split(",");
	else if (Array.isArray(input)) arr = input.slice();

	return Array.from(
		new Set(
			arr
				.map((x) => String(x).trim().toLowerCase())
				.filter(Boolean)
				.map((x) => (x.startsWith(".") ? x : `.${x}`))
		)
	);
}

/** Validate and fill defaults */
function sanitizeSettings(s) {
	const d = defaultSettings();
	let folders = Array.isArray(s.folders) ? s.folders.slice(0, 3) : d.folders;
	while (folders.length < 3) folders.push("");
	const quarantineFolder =
		typeof s.quarantineFolder === "string"
			? s.quarantineFolder
			: d.quarantineFolder;
	const extensions = normalizeExtensions(s.extensions || d.extensions);
	return { folders, quarantineFolder, extensions };
}

/** Load settings.json safely */
async function loadSettings() {
	const file = getSettingsPath();
	try {
		const raw = await fsp.readFile(file, "utf8");
		return sanitizeSettings(JSON.parse(raw));
	} catch {
		return defaultSettings();
	}
}

/** Save settings.json safely */
async function saveSettings(payload) {
	const safe =
		payload && typeof payload === "object"
			? sanitizeSettings(payload)
			: defaultSettings();
	const file = getSettingsPath();
	try {
		fs.mkdirSync(path.dirname(file), { recursive: true });
		await fsp.writeFile(file, JSON.stringify(safe, null, 2), "utf8");
		return safe;
	} catch (err) {
		throw new Error(`Cannot save settings: ${err.message}`);
	}
}

/* ---------- Settings IPC ---------- */
ipcMain.handle("settings:open", async () => {
	try {
		createSettingsWindow();
		return { ok: true };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

ipcMain.handle("settings:load", async () => {
	try {
		const data = await loadSettings();
		return { ok: true, data };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

ipcMain.handle("settings:save", async (_evt, payload) => {
	try {
		const saved = await saveSettings(payload);
		return { ok: true, data: saved };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

/** Directory picker (used by Settings UI) */
ipcMain.handle("dialog:pickDirectory", async () => {
	const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
	return {
		canceled: res.canceled,
		path: res.canceled ? null : res.filePaths[0] || null,
	};
});

/* ======================== 🔍 SECTION: File Scanner Engine (Step-4) ======================== */
/** Windows folders to skip entirely */
const WINDOWS_SKIP_DIRS = new Set([
	"$recycle.bin",
	"system volume information",
	"windows",
	"program files",
	"program files (x86)",
]);

function isProbablyHidden(name) {
	const n = name?.toLowerCase?.() || "";
	return n.startsWith(".") || n.startsWith("~$");
}

function shouldSkipDir(name) {
	const n = name?.toLowerCase?.() || "";
	return isProbablyHidden(n) || WINDOWS_SKIP_DIRS.has(n);
}

/** Async recursive directory walker yielding file paths */
async function* walkDir(root) {
	let dirents;
	try {
		dirents = await fsp.readdir(root, { withFileTypes: true });
	} catch {
		return;
	}
	for (const d of dirents) {
		const full = path.join(root, d.name);
		if (d.isDirectory()) {
			if (!shouldSkipDir(d.name)) yield* walkDir(full);
		} else if (d.isFile()) {
			yield full;
		}
	}
}

/** Safe fs.stat wrapper */
async function getFileStatSafe(p) {
	try {
		return await fsp.stat(p);
	} catch {
		return null;
	}
}

/** Check if file extension is allowed */
function hasAllowedExtension(filePath, extSet) {
	const ext = path.extname(filePath).toLowerCase();
	return extSet.has(ext);
}

/** Run the actual scan */
ipcMain.handle("scan:run", async () => {
	try {
		const s = await loadSettings();
		const folders = (s.folders || []).filter(Boolean);
		const extSet = new Set(normalizeExtensions(s.extensions || []));

		if (!folders.length)
			return {
				ok: false,
				message: "No scan folders configured. Open Settings first.",
			};
		if (!extSet.size)
			return {
				ok: false,
				message: "No file extensions configured. Add them in Settings.",
			};

		let foldersScanned = 0,
			filesMatched = 0,
			totalSizeBytes = 0;
		const sample = [];
		const SAMPLE_MAX = 10;

		for (const root of folders) {
			const stat = await getFileStatSafe(root);
			if (!stat?.isDirectory()) continue;
			foldersScanned++;

			for await (const filePath of walkDir(root)) {
				if (!hasAllowedExtension(filePath, extSet)) continue;
				const st = await getFileStatSafe(filePath);
				if (!st?.isFile()) continue;

				filesMatched++;
				totalSizeBytes += st.size;

				if (sample.length < SAMPLE_MAX)
					sample.push({
						path: filePath,
						size: st.size,
						modified: st.mtime.toISOString(),
					});
			}
		}

		return {
			ok: true,
			data: { foldersScanned, filesMatched, totalSizeBytes, sample },
		};
	} catch (e) {
		return { ok: false, message: e.message };
	}
});
/* ======================== 🧹 SECTION: Cleanup Actions (Step-6) ======================== */
/**
 * Move a file to the configured quarantine folder.
 * Creates subfolders by extension for organization.
 */
ipcMain.handle("cleanup:moveFile", async (_evt, filePath) => {
	try {
		const settings = await loadSettings();
		const qFolder = settings.quarantineFolder;
		if (!qFolder)
			return { ok: false, message: "No quarantine folder set in Settings." };

		const ext = path.extname(filePath).toLowerCase() || "_misc";
		const targetDir = path.join(qFolder, ext.replace(".", ""));
		await fsp.mkdir(targetDir, { recursive: true });

		const fileName = path.basename(filePath);
		const dest = path.join(targetDir, fileName);

		await fsp.rename(filePath, dest);
		return { ok: true, message: `Moved to Quarantine: ${dest}` };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

/** Permanently delete a file (asks renderer for confirmation first) */
ipcMain.handle("cleanup:deleteFile", async (_evt, filePath) => {
	try {
		await fsp.unlink(filePath);
		return { ok: true, message: `Deleted: ${filePath}` };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

/* ===========================[ END: main.js ]============================= */
