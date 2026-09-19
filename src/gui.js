//################################
// GUI
// Adds elements like buttons to control the bot
//################################

var guiDiv = document.createElement("div");
var guiSpan = document.createElement("span");
var startButton = document.createElement("button");
var aimodeCombobox = document.createElement("select");
var autorunCheckbox = document.createElement("input");
var roomCombobox = document.createElement("select");
var currentActionOutput = document.createElement("input");
var debugButton = document.createElement("button");
var hideButton = document.createElement("button");
var hintsButton = document.createElement("button");
var startupNotice = document.createElement("div");

// Floating, draggable hint panel (shown in HELP mode)
var hintPanelDiv = document.createElement("div");
var hintPanelHeader = document.createElement("div");
var hintPanelContent = document.createElement("div");
var hintPanelCloseButton = document.createElement("button");

function initGui() {
	if (guiDiv.isConnected) {
		return;
	}
	// Diagnostics must remain visible even when the game API never loads.
	if (document.body == null) {
		document.addEventListener("DOMContentLoaded", initGui, { once: true });
		return;
	}

	guiDiv.style.position = "absolute";
	guiDiv.style.zIndex = "100001"; //On top of the game
	guiDiv.style.left = "0px";
	guiDiv.style.top = "0px";
	guiDiv.style.width = "100%";
	guiDiv.style.textAlign = "center";
	guiDiv.style.fontSize = "20px";

	guiSpan.style.backgroundColor = "rgba(255,255,255,0.5)";
	guiSpan.style.padding = "5px";

	startButton.innerHTML = "Start Bot";
	if (AUTORUN && !startupError) {
		startButton.innerHTML = "Stop Bot";
	}
	startButton.disabled = !startupFinished || Boolean(startupError);
	startButton.style.marginRight = "15px";
	startButton.onclick = function () {
		toggleRun();
	};
	guiSpan.appendChild(startButton);

	refreshAIMode();
	aimodeCombobox.style.marginRight = "15px";
	aimodeCombobox.onchange = function() {
		aiModeChange();
	};
	guiSpan.appendChild(aimodeCombobox);

	autorunCheckbox.type = "checkbox";
	autorunCheckbox.id = "autorun";
	autorunCheckbox.disabled = Boolean(startupError);
	autorunCheckbox.onclick = function () {
		autorunCheckboxClick();
	};
	if (window.localStorage.getItem("alphajongAutorun") == "true") {
		autorunCheckbox.checked = true;
	}
	guiSpan.appendChild(autorunCheckbox);
	var checkboxLabel = document.createElement("label");
	checkboxLabel.htmlFor = "autorun";
	checkboxLabel.appendChild(document.createTextNode('Autostart'));
	checkboxLabel.style.marginRight = "15px";
	guiSpan.appendChild(checkboxLabel);

	refreshRoomSelection();

	roomCombobox.style.marginRight = "15px";
	roomCombobox.onchange = function () {
		roomChange();
	};

	guiSpan.appendChild(roomCombobox);

	currentActionOutput.readOnly = "true";
	currentActionOutput.size = "20";
	currentActionOutput.style.marginRight = "15px";
	if (!currentActionOutput.value) {
		showCrtActionMsg("Waiting for Mahjong Soul.");
	}
	guiSpan.appendChild(currentActionOutput);

	debugButton.innerHTML = "Debug";
	debugButton.onclick = function () {
		showDebugString();
	};
	if (DEBUG_BUTTON) {
		guiSpan.appendChild(debugButton);
	}

	hintsButton.innerHTML = "Hints";
	hintsButton.style.marginRight = "15px";
	hintsButton.title = "Show/Hide the HELP mode hint panel";
	hintsButton.onclick = function () {
		hintPanelDiv.style.display = hintPanelDiv.style.display === "none" ? "block" : "none";
	};
	guiSpan.appendChild(hintsButton);

	hideButton.innerHTML = "Hide GUI";
	hideButton.onclick = function () {
		toggleGui();
	};
	guiSpan.appendChild(hideButton);

	guiDiv.appendChild(guiSpan);
	startupNotice.setAttribute("role", "status");
	startupNotice.style.cssText = "max-width: 640px; margin: 8px auto; padding: 10px; " +
		"background: #30251b; color: #fff; border: 1px solid #d3a45e; border-radius: 5px; " +
		"font: 14px/1.5 sans-serif; text-align: left; white-space: normal;";
	startupNotice.hidden = !startupNotice.textContent;
	guiDiv.appendChild(startupNotice);
	document.body.appendChild(guiDiv);

	// Build and attach the floating hint panel
	initHintPanel();

	guiDiv.style.display = "block";
}

function toggleGui() {
	if (guiDiv.style.display == "block") {
		guiDiv.style.display = "none";
	}
	else {
		guiDiv.style.display = "block";
	}
}

function showDebugString() {
	alert("If you notice a bug while playing please go to the correct turn in the replay (before the bad discard), press this button, copy the Debug String from the textbox and include it in your issue on github.");
	if (isInGame()) {
		setData();
		showCrtActionMsg(getDebugString());
	}
}

function aiModeChange() {
	decisionEpoch++;
	oldOps = "";
	window.localStorage.setItem("alphajongAIMode", aimodeCombobox.value);
	MODE = parseInt(aimodeCombobox.value);

	setAutoCallWin(run && MODE === AIMODE.AUTO);
}

function roomChange() {
	window.localStorage.setItem("alphajongRoom", roomCombobox.value);
	ROOM = roomCombobox.value;
}

function hideButtonClick() {
	guiDiv.style.display = "none";
}

function autorunCheckboxClick() {
	if (autorunCheckbox.checked) {
		window.localStorage.setItem("alphajongAutorun", "true");
		AUTORUN = true;
	}
	else {
		roomCombobox.disabled = true;
		window.localStorage.setItem("alphajongAutorun", "false");
		AUTORUN = false;
	}
	refreshRoomSelection();
}

// Refresh the AI mode
function refreshAIMode() {
	aimodeCombobox.innerHTML = AIMODE_NAME[MODE];
	for (let i = 0; i < AIMODE_NAME.length; i++) {
		var option = document.createElement("option");
		option.text = AIMODE_NAME[i];
		option.value = i;
		aimodeCombobox.appendChild(option);
	}
	aimodeCombobox.value = MODE;
}

// Refresh the contents of the Room Selection Combobox with values appropiate for the rank
function refreshRoomSelection() {
	roomCombobox.innerHTML = ""; // Clear old entries
	var rooms = getRooms();
	if (rooms == null || typeof rooms.forEach != 'function') {
		roomCombobox.appendChild(new Option("Waiting for rooms...", ""));
		roomCombobox.disabled = true;
		return;
	}
	rooms.forEach(function (room) {
		if (isInRank(room.id) && room.mode != 0) { // Rooms with mode = 0 are 1 Game only, not sure why they are in the code but not selectable in the UI...
			var option = document.createElement("option");
			option.text = getRoomName(room);
			option.value = room.id;
			roomCombobox.appendChild(option);
		}
	});
	roomCombobox.value = ROOM;
	roomCombobox.disabled = !AUTORUN || Boolean(startupError);
}

function showStartupNotice(message) {
	startupNotice.textContent = message;
	startupNotice.hidden = !message;
}

// Show msg to currentActionOutput
function showCrtActionMsg(msg) {
	currentActionOutput.value = msg;
}

// Show a HELP-mode strategy hint in the floating hint panel
function showCrtStrategyMsg(msg) {
	showingStrategy = true;
	hintPanelContent.textContent = msg;
	hintPanelDiv.style.display = "block";
}

function clearCrtStrategyMsg() {
	showingStrategy = false;
	hintPanelContent.textContent = "";
}

// Create, style and append the floating hint panel
function initHintPanel() {
	var savedPosStr = window.localStorage.getItem("alphajongHintPos");
	var savedPos = null;
	try {
		var parsedPos = savedPosStr !== null ? JSON.parse(savedPosStr) : null;
		if (parsedPos && Number.isFinite(parsedPos.left) && Number.isFinite(parsedPos.top)) savedPos = parsedPos;
	}
	catch { /* Ignore invalid saved layout data. */ }

	hintPanelDiv.style.position = "fixed";
	hintPanelDiv.style.zIndex = "100002";
	hintPanelDiv.style.minWidth = "230px";
	hintPanelDiv.style.maxWidth = "min(560px, 90vw)";
	hintPanelDiv.style.backgroundColor = "rgba(24,24,24,0.88)";
	hintPanelDiv.style.borderRadius = "7px";
	hintPanelDiv.style.boxShadow = "0 3px 14px rgba(0,0,0,0.6)";
	hintPanelDiv.style.overflow = "hidden";
	hintPanelDiv.style.display = "none";
	hintPanelDiv.style.left = (savedPos ? savedPos.left : 20) + "px";
	hintPanelDiv.style.top = (savedPos ? savedPos.top : 60) + "px";

	// Title bar (drag handle)
	hintPanelHeader.style.backgroundColor = "rgba(50,110,190,0.92)";
	hintPanelHeader.style.color = "white";
	hintPanelHeader.style.padding = "4px 8px";
	hintPanelHeader.style.cursor = "move";
	hintPanelHeader.style.userSelect = "none";
	hintPanelHeader.style.fontSize = "13px";
	hintPanelHeader.style.display = "flex";
	hintPanelHeader.style.justifyContent = "space-between";
	hintPanelHeader.style.alignItems = "center";

	var headerTitle = document.createElement("span");
	headerTitle.textContent = "AlphaJong Hints";
	hintPanelHeader.appendChild(headerTitle);

	hintPanelCloseButton.textContent = "\u00d7"; // ×
	hintPanelCloseButton.style.background = "none";
	hintPanelCloseButton.style.border = "none";
	hintPanelCloseButton.style.color = "white";
	hintPanelCloseButton.style.cursor = "pointer";
	hintPanelCloseButton.style.fontSize = "18px";
	hintPanelCloseButton.style.lineHeight = "1";
	hintPanelCloseButton.style.padding = "0 2px";
	hintPanelCloseButton.onclick = function () {
		hintPanelDiv.style.display = "none";
	};
	hintPanelHeader.appendChild(hintPanelCloseButton);
	hintPanelDiv.appendChild(hintPanelHeader);

	// Content area
	hintPanelContent.style.padding = "8px 12px";
	hintPanelContent.style.color = "white";
	hintPanelContent.style.fontSize = "16px";
	hintPanelContent.style.whiteSpace = "normal";
	hintPanelContent.style.fontFamily = "sans-serif";
	hintPanelDiv.appendChild(hintPanelContent);

	document.body.appendChild(hintPanelDiv);

	makeDraggable(hintPanelDiv, hintPanelHeader);
}

// Make an element draggable by holding its handle; saves position to localStorage
function makeDraggable(element, handle) {
	handle.addEventListener("mousedown", function (e) {
		e.preventDefault();
		var dragStartX = e.clientX;
		var dragStartY = e.clientY;
		var elemStartLeft = parseInt(element.style.left, 10) || 0;
		var elemStartTop = parseInt(element.style.top, 10) || 0;

		function onMouseMove(e) {
			element.style.left = (elemStartLeft + e.clientX - dragStartX) + "px";
			element.style.top = (elemStartTop + e.clientY - dragStartY) + "px";
		}

		function onMouseUp() {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
			window.localStorage.setItem("alphajongHintPos", JSON.stringify({
				left: parseInt(element.style.left, 10),
				top: parseInt(element.style.top, 10)
			}));
		}

		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
	});
}
