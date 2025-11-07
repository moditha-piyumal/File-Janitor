/* =======================[ START: quarantine.js (Step-7.3) ]======================= */
const { ipcRenderer } = require("electron");
const path = require("path");

const statusEl = document.getElementById("status");
const resultsDiv = document.getElementById("results");

let currentData = [];

function formatBytes(bytes) {
	return bytes ? (bytes / (1024 * 1024)).toFixed(2) + " MB" : "0 MB";
}

function renderTable(data) {
	resultsDiv.innerHTML = "";
	currentData = data;

	if (!data.length) {
		statusEl.textContent = "✅ No files older than 30 days.";
		return;
	}
	statusEl.textContent = `⚠️ Found ${data.length} file(s) older than 30 days.`;

	const table = document.createElement("table");
	table.innerHTML = `
	<tr>
		<th>Select</th>
		<th>File Name</th>
		<th>Path</th>
		<th>Moved At</th>
		<th>Age (days)</th>
		<th>Size</th>
	</tr>`;

	for (const f of data) {
		const tr = document.createElement("tr");
		tr.innerHTML = `
			<td><input type="checkbox" class="fileCheck"></td>
			<td>${path.basename(f.path)}</td>
			<td>${f.path}</td>
			<td>${new Date(f.movedAt).toLocaleString()}</td>
			<td>${f.ageDays}</td>
			<td>${formatBytes(f.size)}</td>`;
		table.appendChild(tr);
	}
	resultsDiv.appendChild(table);
}

async function loadAgedFiles() {
	statusEl.textContent = "Scanning quarantine log…";
	try {
		const res = await ipcRenderer.invoke("quarantine:scanOld");
		if (!res.ok) {
			statusEl.textContent = "❌ " + (res.message || "Failed to scan");
			resultsDiv.innerHTML = "";
			return;
		}
		renderTable(res.data);
	} catch (e) {
		statusEl.textContent = "❌ Error: " + e.message;
	}
}

function getSelectedPaths() {
	const checks = document.querySelectorAll(".fileCheck:checked");
	const paths = [];
	checks.forEach((c) => {
		const row = c.closest("tr");
		if (row && row.cells[2]) paths.push(row.cells[2].textContent.trim());
	});
	return paths;
}

async function deleteSelected() {
	const targets = getSelectedPaths();
	if (!targets.length) {
		alert("No files selected.");
		return;
	}
	if (!confirm(`Delete ${targets.length} selected file(s)?`)) return;
	const res = await ipcRenderer.invoke("quarantine:deleteFiles", targets);
	alert(res.ok ? `✅ ${res.message}` : `❌ ${res.message}`);
	await loadAgedFiles();
}

async function deleteAll() {
	if (!currentData.length) {
		alert("No aged files to delete.");
		return;
	}
	if (!confirm(`Delete ALL ${currentData.length} aged file(s)?`)) return;
	const allPaths = currentData.map((x) => x.path);
	const res = await ipcRenderer.invoke("quarantine:deleteFiles", allPaths);
	alert(res.ok ? `✅ ${res.message}` : `❌ ${res.message}`);
	await loadAgedFiles();
}

async function openFolder() {
	const res = await ipcRenderer.invoke("quarantine:openFolder");
	if (!res.ok) alert(`❌ ${res.message}`);
}

// Button events
document.getElementById("rescanBtn").addEventListener("click", loadAgedFiles);
document
	.getElementById("deleteSelectedBtn")
	.addEventListener("click", deleteSelected);
document.getElementById("deleteAllBtn").addEventListener("click", deleteAll);
document.getElementById("openFolderBtn").addEventListener("click", openFolder);

// Initial scan
loadAgedFiles();
/* =======================[ END: quarantine.js ]======================= */
