/* ===========================[ START: main.js (scheduler core + settings) ]=========================== */
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { exec } = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

/* ---------- Window creators ---------- */
let settingsWin = null;

function createWindow() {
	const win = new BrowserWindow({
		width: 1000,
		height: 600,
		webPreferences: { nodeIntegration: true, contextIsolation: false },
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
		width: 860,
		height: 720,
		resizable: true,
		title: "File Janitor — Settings",
		webPreferences: { nodeIntegration: true, contextIsolation: false },
	});
	settingsWin.loadFile(path.join(__dirname, "settings.html"));
	settingsWin.on("closed", () => (settingsWin = null));
	return settingsWin;
}

/* ---------- App lifecycle ---------- */
app.whenReady().then(createWindow);
app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => app.quit());

/* ---------- Scheduler IPC ---------- */
const TASK_NAME = "FileJanitor_AutoRun";

ipcMain.handle("scheduler:createSelf", async () => {
	try {
		const targetExe = process.execPath;
		const START_TIME = "17:00";
		const cmd = `schtasks /Create /SC DAILY /ST ${START_TIME} /TN "${TASK_NAME}" /TR "${targetExe}" /F`;
		const { stdout, stderr } = await execAsync(cmd);
		if (stderr && stderr.trim()) return { ok: false, message: stderr.trim() };
		return { ok: true, message: `Task created.\n${stdout.trim()}` };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

// ipcMain.handle("scheduler:runSelf", async () =>
// 	runCommand(`schtasks /Run /TN "${TASK_NAME}"`, "Task run successfully")
// );
ipcMain.handle("scheduler:deleteSelf", async () =>
	runCommand(
		`schtasks /Delete /TN "${TASK_NAME}" /F`,
		"Task deleted successfully"
	)
);
ipcMain.handle("scheduler:viewSelf", async () =>
	runCommand(
		`schtasks /Query /TN "${TASK_NAME}" /V /FO LIST`,
		"Task details fetched"
	)
);

async function execAsync(cmd) {
	return new Promise((resolve, reject) => {
		exec(cmd, { windowsHide: true }, (err, stdout, stderr) =>
			err ? reject(err) : resolve({ stdout, stderr })
		);
	});
}
async function runCommand(cmd, msg) {
	try {
		const { stdout, stderr } = await execAsync(cmd);
		if (stderr && stderr.trim()) return { ok: false, message: stderr.trim() };
		return { ok: true, message: `${msg}\n${stdout.trim()}` };
	} catch (e) {
		return { ok: false, message: e.message };
	}
}

/* ---------- Settings persistence ---------- */
function getSettingsPath() {
	const dir = app.getPath("userData");
	return path.join(dir, "settings.json");
}
function defaultSettings() {
	return {
		folders: ["", "", ""],
		quarantineFolder: "",
		extensions: [".pdf", ".docx"],
	};
}
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
async function loadSettings() {
	const file = getSettingsPath();
	try {
		const raw = await fsp.readFile(file, "utf8");
		return sanitizeSettings(JSON.parse(raw));
	} catch {
		return defaultSettings();
	}
}
async function saveSettings(payload) {
	const safe = sanitizeSettings(payload || {});
	fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
	await fsp.writeFile(getSettingsPath(), JSON.stringify(safe, null, 2), "utf8");
	return safe;
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
		return { ok: true, data: await loadSettings() };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});
ipcMain.handle("settings:save", async (_e, p) => {
	try {
		return { ok: true, data: await saveSettings(p) };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});
ipcMain.handle("dialog:pickDirectory", async () => {
	const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
	return {
		canceled: res.canceled,
		path: res.canceled ? null : res.filePaths[0] || null,
	};
});

/* ---------- File Scanner ---------- */
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
async function getFileStatSafe(p) {
	try {
		return await fsp.stat(p);
	} catch {
		return null;
	}
}
function hasAllowedExtension(p, set) {
	return set.has(path.extname(p).toLowerCase());
}
ipcMain.handle("scan:run", async () => {
	try {
		const s = await loadSettings();
		const folders = (s.folders || []).filter(Boolean);
		const extSet = new Set(normalizeExtensions(s.extensions || []));
		if (!folders.length)
			return { ok: false, message: "No scan folders configured." };
		if (!extSet.size)
			return { ok: false, message: "No extensions configured in Settings." };

		let foldersScanned = 0,
			filesMatched = 0,
			totalSizeBytes = 0;
		const sample = [];
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
				if (sample.length < 10)
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

/* =====================[ STEP-7.1 — Quarantine logging foundation ]===================== */
function getQuarantineFolderSyncValue(str) {
	return (typeof str === "string" ? str.trim() : "") || "";
}
async function getQuarantineFolder() {
	const s = await loadSettings();
	return getQuarantineFolderSyncValue(s.quarantineFolder);
}
function getQuarantineLogPath(q) {
	return path.join(q, "quarantine_log.json");
}
async function safeEnsureDir(d) {
	try {
		await fsp.mkdir(d, { recursive: true });
	} catch {}
}
async function readQuarantineLog(f) {
	try {
		const raw = await fsp.readFile(f, "utf8");
		const d = JSON.parse(raw);
		return Array.isArray(d) ? d : [];
	} catch {
		return [];
	}
}
async function writeQuarantineLog(f, d) {
	try {
		await fsp.writeFile(f, JSON.stringify(d, null, 2), "utf8");
	} catch {}
}
async function appendQuarantineLog(q, e) {
	await safeEnsureDir(q);
	const logFile = getQuarantineLogPath(q);
	const data = await readQuarantineLog(logFile);
	data.push(e);
	await writeQuarantineLog(logFile, data);
}
function toExtSubfolder(ext) {
	return (ext || "").replace(/^\./, "") || "unknown";
}
async function safeUniqueTarget(dir, base) {
	const target = path.join(dir, base);
	try {
		await fsp.access(target);
		const { name, ext } = path.parse(base);
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		return path.join(dir, `${name}__${stamp}${ext}`);
	} catch {
		return target;
	}
}

/* ---- Protected path safety ---- */
const PROTECTED_DIRS = [
	"c:\\windows",
	"c:\\program files",
	"c:\\program files (x86)",
	"c:\\users\\public",
];
function isProtectedPath(filePath) {
	const lower = filePath.toLowerCase();
	return PROTECTED_DIRS.some((dir) => lower.startsWith(dir));
}

/* ---- Core move function ---- */
async function moveToQuarantineAndLog(srcPath) {
	const st = await getFileStatSafe(srcPath);
	if (!st?.isFile()) throw new Error("Source not found or not a file.");
	if (isProtectedPath(srcPath)) throw new Error("Protected system path.");

	const qFolder = await getQuarantineFolder();
	if (!qFolder) throw new Error("Quarantine folder not configured.");
	await safeEnsureDir(qFolder);

	const ext = path.extname(srcPath).toLowerCase();
	const destDir = path.join(qFolder, toExtSubfolder(ext));
	await safeEnsureDir(destDir);

	const destPath = await safeUniqueTarget(destDir, path.basename(srcPath));
	await fsp.rename(srcPath, destPath);

	await appendQuarantineLog(qFolder, {
		path: destPath,
		movedAt: new Date().toISOString(),
		size: st.size || 0,
	});
	return { destPath };
}

/* ---- Primary + alias IPC handlers ---- */
ipcMain.handle("cleanup:moveToQuarantine", async (_e, p) => {
	try {
		const res = await moveToQuarantineAndLog(p);
		return { ok: true, message: `Moved to Quarantine: ${res.destPath}` };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

// ✅ Backward compatibility for older renderer calls
ipcMain.handle("cleanup:moveFile", async (_e, p) => {
	try {
		const res = await moveToQuarantineAndLog(p);
		return { ok: true, message: `Moved to Quarantine: ${res.destPath}` };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

// ✅ Delete single file safely
ipcMain.handle("cleanup:deleteFile", async (_e, p) => {
	try {
		if (isProtectedPath(p))
			return { ok: false, message: "Protected system path." };
		await fsp.unlink(p);
		return { ok: true, message: `Deleted: ${p}` };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

/* =======================[ STEP-7.2 – Quarantine Review Window ]======================= */
let quarantineWin = null;
function createQuarantineWindow() {
	if (quarantineWin && !quarantineWin.isDestroyed())
		return quarantineWin.focus();
	quarantineWin = new BrowserWindow({
		width: 860,
		height: 700,
		title: "File Janitor — Quarantine Review",
		webPreferences: { nodeIntegration: true, contextIsolation: false },
	});
	quarantineWin.loadFile(path.join(__dirname, "quarantine.html"));
	quarantineWin.on("closed", () => (quarantineWin = null));
	return quarantineWin;
}
ipcMain.handle("quarantine:openWindow", async () => {
	try {
		createQuarantineWindow();
		return { ok: true };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});
ipcMain.handle("quarantine:scanOld", async () => {
	try {
		const qFolder = await getQuarantineFolder();
		if (!qFolder)
			return { ok: false, message: "No quarantine folder configured." };

		const logFile = getQuarantineLogPath(qFolder);
		const log = await readQuarantineLog(logFile);
		const aged = [];
		const now = Date.now();
		const THRESHOLD = 30;

		for (const entry of log) {
			try {
				const moved = new Date(entry.movedAt);
				const age = Math.floor((now - moved) / (1000 * 60 * 60 * 24));
				if (age >= THRESHOLD) {
					const st = await getFileStatSafe(entry.path);
					if (!st) continue;
					aged.push({ ...entry, ageDays: age });
				}
			} catch {}
		}
		return { ok: true, data: aged };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

/* =======================[ STEP-7.3 – Quarantine Deletion & Log Update ]======================= */
ipcMain.handle("quarantine:deleteFiles", async (_e, arr) => {
	try {
		if (!Array.isArray(arr) || !arr.length)
			return { ok: false, message: "No files provided." };
		const qFolder = await getQuarantineFolder();
		if (!qFolder)
			return { ok: false, message: "No quarantine folder configured." };
		const logFile = getQuarantineLogPath(qFolder);
		const log = await readQuarantineLog(logFile);
		let deleted = 0;
		for (const p of arr) {
			try {
				if (isProtectedPath(p)) continue;
				await fsp.unlink(p);
				deleted++;
			} catch {}
		}
		const remaining = log.filter((e) => !arr.includes(e.path));
		await writeQuarantineLog(logFile, remaining);
		return { ok: true, message: `Deleted ${deleted} file(s).` };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});
ipcMain.handle("quarantine:openFolder", async () => {
	try {
		const qFolder = await getQuarantineFolder();
		if (!qFolder)
			return { ok: false, message: "No quarantine folder configured." };
		await shell.openPath(qFolder);
		return { ok: true };
	} catch (e) {
		return { ok: false, message: e.message };
	}
});

/* ===========================[ END: main.js ]============================= */
