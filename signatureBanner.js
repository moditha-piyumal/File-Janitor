// 🩸💀 Signature Banner Module
// ---------------------------------------------------------
// Automatically adds Moditha Piyumal's signature banner
// to any Electron-rendered HTML window.
// ---------------------------------------------------------

function addSignatureBanner() {
	// Check if already exists (prevents duplicates)
	if (document.getElementById("signatureBanner")) return;

	const footer = document.createElement("footer");
	footer.id = "signatureBanner";
	footer.innerHTML = `
		🩸💀 This software was made by
		<strong>Moditha Piyumal</strong>,
		also known as
		<strong>Elpitiya Sworn Translator</strong>,
		a Freelance Developer! 💀🩸
	`;

	Object.assign(footer.style, {
		position: "fixed",
		bottom: "0",
		left: "0",
		width: "100%",
		textAlign: "center",
		background: "rgba(0, 0, 0, 0.75)",
		color: "#ccc",
		fontSize: "0.9em",
		padding: "6px 10px",
		borderTop: "1px solid rgba(255, 255, 255, 0.1)",
		zIndex: "9999",
		backdropFilter: "blur(3px)",
		transition: "opacity 0.3s ease",
		lineHeight: "1.4em",
	});

	footer.querySelectorAll("strong").forEach((s) => (s.style.color = "#8be9fd"));

	footer.addEventListener("mouseenter", () => (footer.style.opacity = "0.9"));
	footer.addEventListener("mouseleave", () => (footer.style.opacity = "1"));

	document.body.appendChild(footer);
}

// Run when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", addSignatureBanner);
} else {
	addSignatureBanner();
}
