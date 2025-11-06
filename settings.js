/* =======================[ START: settings.js (Settings Window Logic) ]======================= */
const { ipcRenderer } = require("electron");

/*
   🧭 Purpose:
   Controls the Settings window (Step-3 of File Janitor plan).
   Allows user to:
     - Choose up to 3 scan folders
     - Set quarantine folder
     - Specify file extensions to track
     - Save / Reload preferences via IPC
*/

/* ======================= 🎛️ SECTION: UI ELEMENT REFERENCES ======================= */

// Folder path input fields (3 slots)
const folderInputs = [
	document.getElementById("folder1"),
	document.getElementById("folder2"),
	document.getElementById("folder3"),
];

// Quarantine folder & extensions field
const quarantineInput = document.getElementById("quarantine");
const extsInput = document.getElementById("exts");

/* ======================= 🎛️ SECTION: UI EVENT BINDINGS ======================= */

// Folder pickers
document
	.getElementById("browse1")
	?.addEventListener("click", () => pickInto(folderInputs[0]));
document
	.getElementById("browse2")
	?.addEventListener("click", () => pickInto(folderInputs[1]));
document
	.getElementById("browse3")
	?.addEventListener("click", () => pickInto(folderInputs[2]));
document
	.getElementById("browseQ")
	?.addEventListener("click", () => pickInto(quarantineInput));

// Save & Reload
document.getElementById("saveBtn")?.addEventListener("click", onSave);
document.getElementById("reloadBtn")?.addEventListener("click", loadSettings);

/* ======================= 💾 SECTION: IPC HANDLERS ======================= */

/** Opens a folder selection dialog and fills the chosen path */
async function pickInto(inputEl) {
	try {
		const res = await ipcRenderer.invoke("dialog:pickDirectory");
		if (!res.canceled && res.path) inputEl.value = res.path;
	} catch (e) {
		alert(`❌ Failed to pick directory: ${e.message}`);
	}
}

/** Collects all input values into a single payload object */
function collectPayload() {
	const folders = folderInputs.map((i) => (i.value || "").trim());
	const quarantineFolder = (quarantineInput.value || "").trim();
	const extRaw = (extsInput.value || "").trim();
	return {
		folders,
		quarantineFolder,
		extensions: extRaw.length ? extRaw.split(",") : [], // normalized later in main.js
	};
}

/** Sends payload to main process for saving */
async function onSave() {
	try {
		const payload = collectPayload();
		const res = await ipcRenderer.invoke("settings:save", payload);
		alert(
			res?.ok
				? "✅ Settings saved."
				: `❌ Failed: ${res?.message || "Unknown error"}`
		);
	} catch (e) {
		alert(`❌ Error saving settings: ${e.message}`);
	}
}

/** Fetches current settings and populates fields */
async function loadSettings() {
	try {
		const res = await ipcRenderer.invoke("settings:load");
		if (!res?.ok) {
			alert(`❌ Failed to load settings: ${res?.message || "Unknown error"}`);
			return;
		}
		const { folders, quarantineFolder, extensions } = res.data || {};

		// Clear old values first
		folderInputs.forEach((input) => (input.value = ""));
		quarantineInput.value = "";
		extsInput.value = "";

		// Apply loaded data
		(folders || []).forEach((val, i) => {
			if (folderInputs[i]) folderInputs[i].value = val || "";
		});
		quarantineInput.value = quarantineFolder || "";
		extsInput.value = (extensions || []).join(",");
	} catch (e) {
		alert(`❌ Error loading settings: ${e.message}`);
	}
}

/* ======================= 🧩 SECTION: INITIALIZATION ======================= */

// Auto-load settings when window opens
loadSettings();

/* =======================[ END: settings.js ]======================= */
