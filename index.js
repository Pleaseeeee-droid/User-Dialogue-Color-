import { eventSource, event_types, saveChat, chat } from "../../../script.js";
import { extension_settings, saveSettingsDebounced } from "../../extensions.js";

const EXT_NAME = "user-dialogue-color";

const DEFAULT_SETTINGS = {
    enabled: true,
    color: "#FF6B6B",
    savedColors: ["#FF6B6B","#FF69B4","#FFD700","#6BFFB8","#6BB5FF","#C084FC"],
};

function initSettings() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = Object.assign({}, DEFAULT_SETTINGS);
    }
}

function S() {
    return extension_settings[EXT_NAME];
}

function colorize(text, color) {
    return text.replace(/"([^"]+)"/g, `<font color="${color}">"$1"</font>`);
}

function onMessageSent() {
    try {
        if (!S().enabled) return;
        if (!chat || chat.length === 0) return;

        for (let i = chat.length - 1; i >= 0; i--) {
            if (!chat[i].is_user) continue;
            const msg = chat[i];
            const updated = colorize(msg.mes, S().color);
            if (updated === msg.mes) break;
            msg.mes = updated;
            $(`.mes[mesid="${i}"] .mes_text`).html(updated);
            saveChat();
            break;
        }
    } catch (e) {
        console.error(`[${EXT_NAME}] error:`, e);
    }
}

function renderSwatches() {
    const $el = $(`#${EXT_NAME}-swatches`).empty();
    S().savedColors.forEach((hex, i) => {
        const active = hex === S().color;
        $el.append(`<div class="${EXT_NAME}-swatch"
            data-color="${hex}" data-index="${i}" title="${hex}"
            style="width:30px;height:30px;border-radius:50%;background:${hex};
                   cursor:pointer;display:inline-block;margin:2px;
                   border:3px solid ${active ? "#fff" : "transparent"};
                   box-shadow:0 0 0 1.5px #666;"></div>`);
    });
}

function setColor(hex) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
    S().color = hex;
    $(`#${EXT_NAME}-picker`).val(hex);
    $(`#${EXT_NAME}-hex`).val(hex);
    $(`#${EXT_NAME}-preview`).attr("color", hex);
    renderSwatches();
    saveSettingsDebounced();
}

function buildUI() {
    const s = S();
    const html = `
<div class="inline-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
        <b>🎨 User Dialogue Color</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content">
        <label class="checkbox_label">
            <input type="checkbox" id="${EXT_NAME}-enabled" ${s.enabled ? "checked" : ""}/>
            &nbsp;Enable dialogue colorization
        </label>
        <hr>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;">
            <input type="color" id="${EXT_NAME}-picker" value="${s.color}"
                   style="width:44px;height:34px;border:none;padding:2px;cursor:pointer;border-radius:4px;"/>
            <input type="text" id="${EXT_NAME}-hex" value="${s.color}"
                   class="text_pole" maxlength="7"
                   style="width:90px;font-family:monospace;"/>
            <button id="${EXT_NAME}-save" class="menu_button">Save Color</button>
        </div>
        <div id="${EXT_NAME}-swatches" style="margin:6px 0;min-height:36px;"></div>
        <small style="opacity:.6;">Right-click a swatch to remove it</small>
        <div style="margin-top:10px;padding:8px;background:rgba(0,0,0,.3);border-radius:6px;">
            Preview: <font id="${EXT_NAME}-preview" color="${s.color}">"Hello there!"</font>
        </div>
    </div>
</div>`;

    $("#extensions_settings").append(html);
    renderSwatches();

    $(`#${EXT_NAME}-enabled`).on("change", function () {
        S().enabled = this.checked;
        saveSettingsDebounced();
    });

    $(`#${EXT_NAME}-picker`).on("input", function () {
        $(`#${EXT_NAME}-hex`).val(this.value);
        $(`#${EXT_NAME}-preview`).attr("color", this.value);
    }).on("change", function () {
        setColor(this.value);
    });

    $(`#${EXT_NAME}-hex`).on("change", function () {
        let v = this.value.trim();
        if (!v.startsWith("#")) v = "#" + v;
        setColor(v);
    });

    $(`#${EXT_NAME}-save`).on("click", function () {
        let v = $(`#${EXT_NAME}-hex`).val().trim();
        if (!v.startsWith("#")) v = "#" + v;
        if (!/^#[0-9A-Fa-f]{6}$/.test(v)) return;
        if (!S().savedColors.includes(v)) S().savedColors.push(v);
        setColor(v);
    });

    $(document).on("click", `.${EXT_NAME}-swatch`, function () {
        setColor($(this).data("color"));
    });

    $(document).on("contextmenu", `.${EXT_NAME}-swatch`, function (e) {
        e.preventDefault();
        const idx = +$(this).data("index");
        const colors = S().savedColors;
        if (colors.length <= 1) return;
        colors.splice(idx, 1);
        if (S().color === $(this).data("color")) setColor(colors[0]);
        renderSwatches();
        saveSettingsDebounced();
    });
}

jQuery(async () => {
    try {
        initSettings();
        buildUI();
        eventSource.on(event_types.MESSAGE_SENT, onMessageSent);
        console.log(`[${EXT_NAME}] loaded ✓`);
    } catch (e) {
        console.error(`[${EXT_NAME}] failed to load:`, e);
    }
});    }
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

        // Save chat if the function is available
        if (typeof window.saveChat === "function") window.saveChat();
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
});    }
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
