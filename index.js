// ============================================================
//  User Dialogue Color — SillyTavern Extension
//  Wraps "quoted dialogue" in user messages with <font color>
// ============================================================

import { eventSource, event_types, saveChat } from "../../../script.js";
import {
    extension_settings,
    getContext,
    saveSettingsDebounced,
} from "../../extensions.js";

// ── Constants ──────────────────────────────────────────────
const EXT_NAME = "user-dialogue-color";

// Default settings loaded on first install
const DEFAULT_SETTINGS = {
    enabled: true,
    color: "#FF6B6B",                                     // active color
    savedColors: [                                         // preloaded palette
        "#FF6B6B",  // coral red
        "#FF69B4",  // hot pink
        "#FFD700",  // gold
        "#6BFFB8",  // mint green
        "#6BB5FF",  // sky blue
        "#C084FC",  // purple
        "#FFA07A",  // light salmon
        "#00CED1",  // dark turquoise
    ],
};

// ── Settings helpers ───────────────────────────────────────
function initSettings() {
    // Create settings block if it doesn't exist yet
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = structuredClone(DEFAULT_SETTINGS);
    }
    // Fill in any keys added in future updates
    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
        if (extension_settings[EXT_NAME][key] === undefined) {
            extension_settings[EXT_NAME][key] = val;
        }
    }
}

const getSettings = () => extension_settings[EXT_NAME];

// ── Core logic: wrap "quoted text" with <font color> tags ──
function colorizeDialogue(text, color) {
    // Match anything inside "double quotes"
    // Skips text that's already wrapped (avoids double-processing)
    return text.replace(
        /"([^"]+)"/g,
        (match, inner) => `<font color="${color}">"${inner}"</font>`
    );
}

// Called every time the user sends a message
function onMessageSent() {
    const settings = getSettings();
    if (!settings.enabled) return;

    const context = getContext();
    const chat    = context.chat;
    if (!chat || chat.length === 0) return;

    // Find the most recently sent user message
    for (let i = chat.length - 1; i >= 0; i--) {
        const msg = chat[i];
        if (!msg.is_user) continue;                       // skip AI messages

        const original  = msg.mes;
        const colorized = colorizeDialogue(original, settings.color);

        if (colorized === original) break;                // nothing to change

        msg.mes = colorized;

        // Refresh the rendered bubble in the chat window
        const $bubble = $(`.mes[mesid="${i}"] .mes_text`);
        if ($bubble.length) $bubble.html(colorized);

        saveChat();                                        // persist to file
        break;
    }
}

// ── Settings panel UI ──────────────────────────────────────
function buildSettingsHTML() {
    return `
<div id="${EXT_NAME}-settings">
    <div class="inline-drawer">

        <div class="inline-drawer-toggle inline-drawer-header">
            <b>🎨 User Dialogue Color</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>

        <div class="inline-drawer-content">

            <!-- Enable / disable toggle -->
            <label class="checkbox_label" style="margin-bottom:10px;">
                <input type="checkbox" id="${EXT_NAME}-enabled" />
                &nbsp;Enable dialogue colorization
            </label>

            <!-- Active color row -->
            <div style="margin-bottom:10px;">
                <small style="opacity:.7;">Active color — applies to &quot;quoted text&quot; in your messages</small>
                <div style="display:flex; align-items:center; gap:8px; margin-top:6px; flex-wrap:wrap;">
                    <input  type="color"
                            id="${EXT_NAME}-colorpicker"
                            title="Pick a color"
                            style="width:44px; height:34px; cursor:pointer; border:none; padding:2px; border-radius:4px;" />
                    <input  type="text"
                            id="${EXT_NAME}-hexinput"
                            placeholder="#FF6B6B"
                            maxlength="7"
                            class="text_pole"
                            style="width:88px; font-family:monospace;" />
                    <button id="${EXT_NAME}-apply-btn"  class="menu_button" title="Apply hex input">Apply</button>
                    <button id="${EXT_NAME}-save-btn"   class="menu_button" title="Save to palette">💾 Save</button>
                </div>
            </div>

            <!-- Saved color swatches -->
            <div>
                <small style="opacity:.7;">Saved colors &nbsp;<em style="opacity:.6;">(right-click to delete)</em></small>
                <div id="${EXT_NAME}-swatches"
                     style="display:flex; flex-wrap:wrap; gap:7px; margin-top:7px; min-height:36px;">
                </div>
            </div>

            <!-- Live preview -->
            <div style="margin-top:12px; padding:8px 10px; background:rgba(0,0,0,.25); border-radius:6px;">
                <small style="opacity:.7;">Preview:</small>
                <p id="${EXT_NAME}-preview" style="margin:4px 0 0; font-size:.95em;">
                    She smiled. <font id="${EXT_NAME}-preview-text">"Hello there!"</font> she said.
                </p>
            </div>

        </div><!-- /.inline-drawer-content -->
    </div><!-- /.inline-drawer -->
</div>
    `;
}

function renderSwatches() {
    const settings  = getSettings();
    const $swatches = $(`#${EXT_NAME}-swatches`);
    $swatches.empty();

    settings.savedColors.forEach((hex, i) => {
        const isActive = hex.toLowerCase() === settings.color.toLowerCase();
        $swatches.append(`
            <div class="${EXT_NAME}-swatch"
                 data-color="${hex}"
                 data-index="${i}"
                 title="${hex}"
                 style="
                    width:30px; height:30px; border-radius:50%;
                    background:${hex}; cursor:pointer;
                    border: 3px solid ${isActive ? "#fff" : "transparent"};
                    box-shadow: 0 0 0 1.5px #555;
                    transition: transform .1s;
                 ">
            </div>
        `);
    });
}

function updatePreview(color) {
    $(`#${EXT_NAME}-preview-text`).attr("color", color).css("color", color);
}

function setActiveColor(hex) {
    const norm = normalizeHex(hex);
    if (!norm) return;

    getSettings().color = norm;
    $(`#${EXT_NAME}-colorpicker`).val(norm);
    $(`#${EXT_NAME}-hexinput`).val(norm);
    updatePreview(norm);
    renderSwatches();
    saveSettingsDebounced();
}

function normalizeHex(val) {
    val = val.trim();
    if (!val.startsWith("#")) val = "#" + val;
    return /^#[0-9A-Fa-f]{6}$/.test(val) ? val.toLowerCase() : null;
}

function syncUIToSettings() {
    const settings = getSettings();
    $(`#${EXT_NAME}-enabled`).prop("checked", settings.enabled);
    $(`#${EXT_NAME}-colorpicker`).val(settings.color);
    $(`#${EXT_NAME}-hexinput`).val(settings.color);
    updatePreview(settings.color);
    renderSwatches();
}

function bindEvents() {
    // ── Enable toggle ────────────────────────────────────
    $(`#${EXT_NAME}-enabled`).on("change", function () {
        getSettings().enabled = this.checked;
        saveSettingsDebounced();
    });

    // ── Color picker (native browser picker) ─────────────
    $(`#${EXT_NAME}-colorpicker`).on("input", function () {
        // Live-preview while dragging the picker
        $(`#${EXT_NAME}-hexinput`).val(this.value);
        updatePreview(this.value);
    });
    $(`#${EXT_NAME}-colorpicker`).on("change", function () {
        setActiveColor(this.value);
    });

    // ── Hex text input ────────────────────────────────────
    $(`#${EXT_NAME}-hexinput`).on("input", function () {
        const norm = normalizeHex(this.value);
        if (norm) {
            $(`#${EXT_NAME}-colorpicker`).val(norm);
            updatePreview(norm);
        }
    });

    // ── Apply button ──────────────────────────────────────
    $(`#${EXT_NAME}-apply-btn`).on("click", function () {
        setActiveColor($(`#${EXT_NAME}-hexinput`).val());
    });

    // ── Save button — adds current color to palette ───────
    $(`#${EXT_NAME}-save-btn`).on("click", function () {
        const norm     = normalizeHex($(`#${EXT_NAME}-hexinput`).val());
        const settings = getSettings();
        if (!norm) {
            toastr.warning("Please enter a valid 6-digit hex color.");
            return;
        }
        if (!settings.savedColors.includes(norm)) {
            settings.savedColors.push(norm);
            saveSettingsDebounced();
        }
        setActiveColor(norm);
        toastr.success(`Color ${norm} saved!`);
    });

    // ── Click swatch → set active ─────────────────────────
    $(document).on("click", `.${EXT_NAME}-swatch`, function () {
        setActiveColor($(this).data("color"));
    });

    // ── Right-click swatch → delete from palette ──────────
    $(document).on("contextmenu", `.${EXT_NAME}-swatch`, function (e) {
        e.preventDefault();
        const settings = getSettings();
        const hex      = $(this).data("color");
        const idx      = parseInt($(this).data("index"), 10);

        if (settings.savedColors.length <= 1) {
            toastr.warning("Keep at least one saved color.");
            return;
        }
        settings.savedColors.splice(idx, 1);

        // If we deleted the active color, fall back to first in palette
        if (settings.color === hex) {
            settings.color = settings.savedColors[0];
            $(`#${EXT_NAME}-colorpicker`).val(settings.color);
            $(`#${EXT_NAME}-hexinput`).val(settings.color);
            updatePreview(settings.color);
        }
        renderSwatches();
        saveSettingsDebounced();
        toastr.info(`Removed ${hex} from palette.`);
    });
}

// ── Boot ───────────────────────────────────────────────────
jQuery(async () => {
    initSettings();

    // Inject settings panel into ST's Extensions tab
    $("#extensions_settings").append(buildSettingsHTML());
    syncUIToSettings();
    bindEvents();

    // Hook into the message pipeline
    eventSource.on(event_types.MESSAGE_SENT, onMessageSent);

    console.log(`[${EXT_NAME}] Loaded ✓`);
});
