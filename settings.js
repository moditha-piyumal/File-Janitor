/* =======================[ START: settings.js (Settings window logic) ]======================= */
const { ipcRenderer } = require("electron");

// Inputs
const folderInputs = [
	document.getElementById("folder1"),
	document.getElementById("folder2"),
	document.getElementById("folder3"),
];
const quarantineInput = document.getElementById("quarantine");
const extsInput = document.getElementById("exts");

// Buttons
document
	.getElementById("browse1")
	.addEventListener("click", () => pickInto(folderInputs[0]));
document
	.getElementById("browse2")
	.addEventListener("click", () => pickInto(folderInputs[1]));
document
	.getElementById("browse3")
	.addEventListener("click", () => pickInto(folderInputs[2]));
document
	.getElementById("browseQ")
	.addEventListener("click", () => pickInto(quarantineInput));

document.getElementById("saveBtn").addEventListener("click", onSave);
document.getElementById("reloadBtn").addEventListener("click", loadSettings);

async function pickInto(inputEl) {
	const res = await ipcRenderer.invoke("dialog:pickDirectory");
	if (!res.canceled && res.path) {
		inputEl.value = res.path;
	}
}

function collectPayload() {
	const folders = folderInputs.map((i) => (i.value || "").trim());
	const quarantineFolder = (quarantineInput.value || "").trim();
	// Accept either ".pdf,.docx" or "pdf, docx"
	const extRaw = (extsInput.value || "").trim();
	return {
		folders,
		quarantineFolder,
		extensions: extRaw.length ? extRaw.split(",") : [], // normalized in main
	};
}

async function onSave() {
	const payload = collectPayload();
	const res = await ipcRenderer.invoke("settings:save", payload);
	if (res?.ok) {
		alert("✅ Settings saved.");
	} else {
		alert(`❌ Failed to save settings: ${res?.message || "Unknown error"}`);
	}
}

async function loadSettings() {
	const res = await ipcRenderer.invoke("settings:load");
	if (!res?.ok) {
		alert(`❌ Failed to load settings: ${res?.message || "Unknown error"}`);
		return;
	}
	const { folders, quarantineFolder, extensions } = res.data || {};
	(folders || []).forEach((val, i) => {
		if (folderInputs[i]) folderInputs[i].value = val || "";
	});
	quarantineInput.value = quarantineFolder || "";
	extsInput.value = (extensions || []).join(",");
}

// Auto-load on open
loadSettings();
/* =======================[ END: settings.js ]======================= */
