/**
 * CleanShot page behavior: input, controls, crop/redact/pick modes, undo,
 * export. Wires the markup in src/pages/cleanshot.astro to the pure modules
 * (render.ts, analyze.ts, backgrounds.ts). Client-only.
 */
import { PRESETS, DEFAULT_PRESET, findPreset, type Background } from "./backgrounds";
import {
    SIZES,
    DEFAULT_SIZE,
    PADDINGS,
    RADII,
    SHADOWS,
    FRAMES,
    REDACT_STYLES,
    ANNOTATION_COLORS,
    annotationUnit,
    textSize,
    textFont,
    render,
    redact,
    drawBackground,
    exportScale,
    baseSize,
    layout,
    type Rect,
    type RenderState,
    type Padding,
    type Radius,
    type Shadow,
    type Frame,
    type RedactStyle,
    type Annotation,
    type AnnotationColor,
} from "./render";
import { analyze } from "./analyze";
import { createButton } from "@starwind-ui/runtime/button";

const MAX_BYTES = 50 * 1024 * 1024;
const STORAGE_KEY = "cleanshot:settings";
const HISTORY = 20;
const FORMATS = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" } as const;
type Format = keyof typeof FORMATS;
const SCALES = { "1": 1, "2": 2, "3": 3 } as const;

/** Look settings: remembered across visits. */
interface Settings {
    background: string;
    size: string;
    picked: string | null;
    padding: Padding;
    radius: Radius;
    shadow: Shadow;
    frame: Frame;
    redact: RedactStyle;
    tool: "arrow" | "text";
    color: AnnotationColor;
    format: Format;
    scale: keyof typeof SCALES;
}

const DEFAULTS: Settings = {
    background: DEFAULT_PRESET,
    size: DEFAULT_SIZE,
    picked: null,
    padding: "m",
    radius: "m",
    shadow: "soft",
    frame: "outline",
    redact: "box",
    tool: "arrow",
    color: "red",
    format: "png",
    scale: "2",
};

/** Which values each toggle group accepts (also validates saved settings). */
const VALID: Record<Exclude<keyof Settings, "picked">, readonly string[]> = {
    background: PRESETS.map((p) => p.id),
    size: SIZES.map((s) => s.id),
    padding: Object.keys(PADDINGS),
    radius: Object.keys(RADII),
    shadow: Object.keys(SHADOWS),
    frame: FRAMES,
    redact: REDACT_STYLES,
    tool: ["arrow", "text"],
    color: Object.keys(ANNOTATION_COLORS),
    format: Object.keys(FORMATS),
    scale: Object.keys(SCALES),
};
type GroupKey = keyof typeof VALID;

type Mode = "normal" | "crop" | "redact" | "annotate" | "pick";

export function initCleanShot() {
    const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
    const empty = $<HTMLElement>("[data-empty]");
    const loaded = $<HTMLElement>("[data-loaded]");
    const stage = $<HTMLElement>("[data-stage]");
    const preview = $<HTMLCanvasElement>("[data-preview]");
    const overlay = $<HTMLElement>("[data-overlay]");
    const sizeNote = $<HTMLElement>("[data-size-note]");
    // One status line per state (empty and loaded); messages go to both.
    const statuses = document.querySelectorAll<HTMLElement>("[data-status]");
    const fileInput = $<HTMLInputElement>("[data-file]");
    const shareBtn = $<HTMLButtonElement>("[data-share]");
    const undoBtn = $<HTMLButtonElement>("[data-undo]");
    const redoBtn = $<HTMLButtonElement>("[data-redo]");
    const toolbar = $<HTMLElement>("[data-toolbar]");
    const modeBar = $<HTMLElement>("[data-modebar]");
    const modeHint = $<HTMLElement>("[data-mode-hint]");
    const modeReset = $<HTMLButtonElement>("[data-mode-reset]");
    const redactStyles = $<HTMLElement>("[data-redact-styles]");
    const annotateTools = $<HTMLElement>("[data-annotate-tools]");
    // Text annotations use the site's own font.
    const fontFamily = getComputedStyle(document.body).fontFamily;
    const groups = new Map<GroupKey, HTMLElement>();
    document.querySelectorAll<HTMLElement>("[data-group]").forEach((g) => groups.set(g.dataset.group as GroupKey, g));

    // --- State ------------------------------------------------------------

    const settings: Settings = { ...DEFAULTS, ...loadSettings() };

    /** The current screenshot. Crop and redactions belong to it. */
    const doc = {
        image: null as ImageBitmap | null,
        crop: { x: 0, y: 0, w: 1, h: 1 } as Rect,
        autoCrop: { x: 0, y: 0, w: 1, h: 1 } as Rect,
        redactions: [] as Rect[],
        annotations: [] as Annotation[],
        match: findPreset("match").background,
        dark: false,
    };

    let mode: Mode = "normal";
    /** While picking: the color under the pointer, previewed live. */
    let hover: string | null = null;
    /** The background to go back to if picking is cancelled with nothing picked. */
    let beforePick = settings.background;
    /** True while the UI is being synced to state (ignore the change events it fires). */
    let syncing = false;
    /** The annotation selected in annotate mode (index into doc.annotations). */
    let selected: number | null = null;
    /** The text annotation being typed, if any. */
    let editing: { index: number; el: HTMLElement } | null = null;

    function loadSettings(): Partial<Settings> {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
            const out: Partial<Settings> = {};
            for (const key of Object.keys(VALID) as GroupKey[]) {
                if (VALID[key].includes(saved[key])) (out as Record<string, unknown>)[key] = saved[key];
            }
            if (typeof saved.picked === "string" && /^#[0-9a-f]{6}$/i.test(saved.picked)) out.picked = saved.picked;
            return out;
        } catch {
            return {};
        }
    }

    function persist() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    function background(id = settings.background): Background {
        if (id === "match") return doc.match;
        if (id === "picked") {
            const color = hover ?? settings.picked;
            return color ? { kind: "solid", color } : findPreset(id).background;
        }
        return findPreset(id).background;
    }

    function renderState(): RenderState {
        return {
            background: background(),
            size: SIZES.find((s) => s.id === settings.size)!,
            padding: settings.padding,
            radius: settings.radius,
            shadow: settings.shadow,
            frame: settings.frame,
            dark: doc.dark,
            annotations: doc.annotations,
            unit: doc.image ? annotationUnit(doc.image.width, doc.image.height) : 1,
            font: fontFamily,
            skip: editing?.index,
        };
    }

    // Redacted copy of the source, rebuilt only when the boxes change.
    let redactedKey = "";
    let redacted: CanvasImageSource | null = null;
    function source(): CanvasImageSource {
        if (!doc.redactions.length) return doc.image!;
        const key = JSON.stringify([settings.redact, doc.redactions]);
        if (key !== redactedKey || !redacted) {
            redacted = redact(doc.image!, doc.redactions, settings.redact);
            redactedKey = key;
        }
        return redacted;
    }

    // --- Undo -------------------------------------------------------------

    const past: string[] = [];
    const future: string[] = [];
    const snapshot = () =>
        JSON.stringify({ settings, crop: doc.crop, redactions: doc.redactions, annotations: doc.annotations });

    /** Record `before` as an undo step if anything changed since. */
    function record(before: string) {
        if (snapshot() === before) return;
        past.push(before);
        if (past.length > HISTORY) past.shift();
        future.length = 0;
        updateHistoryButtons();
    }

    function restore(snap: string) {
        const s = JSON.parse(snap);
        Object.assign(settings, s.settings);
        doc.crop = s.crop;
        doc.redactions = s.redactions;
        doc.annotations = s.annotations;
        selected = null;
        syncControls();
        persist();
        drawSwatches();
        draw();
        updateHistoryButtons();
    }

    function undo() {
        const prev = past.pop();
        if (!prev) return;
        future.push(snapshot());
        restore(prev);
    }

    function redo() {
        const next = future.pop();
        if (!next) return;
        past.push(snapshot());
        restore(next);
    }

    // Starwind's button controller owns the disabled state (and swallows
    // clicks while disabled), so go through it rather than setting .disabled.
    function updateHistoryButtons() {
        createButton(undoBtn).setDisabled(!past.length);
        createButton(redoBtn).setDisabled(!future.length);
    }

    undoBtn.addEventListener("click", undo);
    redoBtn.addEventListener("click", redo);

    // --- Input ------------------------------------------------------------

    async function load(file: File | Blob | null | undefined) {
        if (!file) return;
        if (!file.type.startsWith("image/")) return say("That isn't an image. Try a PNG, JPEG or WebP.");
        if (file.size > MAX_BYTES) return say("That image is over 50 MB. Try a smaller one.");
        let image: ImageBitmap;
        try {
            image = await createImageBitmap(file);
        } catch {
            return say("This browser can't open that image. Try a PNG or JPEG.");
        }
        const a = analyze(image, image.width, image.height);
        setMode("normal");
        doc.image?.close();
        Object.assign(doc, { image, crop: a.crop, autoCrop: a.crop, redactions: [], annotations: [], match: a.match, dark: a.dark });
        selected = null;
        redacted = null;
        past.length = future.length = 0;
        updateHistoryButtons();
        empty.hidden = true;
        loaded.hidden = false;
        say("");
        drawSwatches();
        draw();
    }

    document.addEventListener("paste", (e) => {
        const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
        if (item) {
            e.preventDefault();
            load(item.getAsFile());
        }
    });
    document.querySelectorAll<HTMLInputElement>("[data-slot=dropzone] input[type=file]").forEach((input) =>
        input.addEventListener("change", () => load(input.files?.[0])),
    );
    fileInput.addEventListener("change", () => {
        load(fileInput.files?.[0]);
        fileInput.value = "";
    });
    $("[data-replace]").addEventListener("click", () => fileInput.click());

    // Dropping a new image anywhere replaces the current one.
    document.addEventListener("dragover", (e) => {
        if (!loaded.hidden) e.preventDefault();
    });
    document.addEventListener("drop", (e) => {
        if (loaded.hidden) return;
        e.preventDefault();
        load(e.dataTransfer?.files[0]);
    });

    // A Paste button for phones and browsers where ⌘V isn't handy.
    $("[data-paste]").addEventListener("click", async () => {
        try {
            for (const item of await navigator.clipboard.read()) {
                const type = item.types.find((t) => t.startsWith("image/"));
                if (type) return load(await item.getType(type));
            }
            say("There's no image on your clipboard.");
        } catch {
            say("Your browser blocked that. Press ⌘V or Ctrl+V instead.");
        }
    });

    // --- Controls ---------------------------------------------------------

    for (const [key, group] of groups) {
        group.addEventListener("starwind:value-change", (e) => {
            const d = (e as CustomEvent).detail;
            if (syncing) return;
            // Single-select: clicking the selected item again would clear the
            // group, so keep it pressed.
            const again = !d.value.length;
            if (again) d.cancel();
            const id: string = again ? d.toggleValue : d.value[0];

            if (key === "background" && id === "picked") {
                if (!again) {
                    beforePick = settings.background;
                    const before = snapshot();
                    settings.background = id;
                    record(before);
                }
                setMode("pick");
            } else {
                if (again) return;
                if (key === "background" && mode === "pick") setMode("normal");
                const before = snapshot();
                (settings as unknown as Record<string, string>)[key] = id;
                // A new color also recolors the selected arrow or text.
                if (key === "color" && selected !== null) {
                    doc.annotations = doc.annotations.map((a, i) =>
                        i === selected ? { ...a, color: ANNOTATION_COLORS[settings.color] } : a,
                    );
                }
                if (key === "color" && editing) editing.el.style.color = ANNOTATION_COLORS[settings.color];
                record(before);
                if (key === "size") drawSwatches();
                if (key === "tool") updateHint();
            }
            persist();
            draw();
        });
    }

    function select(key: GroupKey, id: string) {
        const item = groups.get(key)?.querySelector<HTMLElement>(`[data-slot=toggle-group-item][data-value="${id}"]`);
        if (item && item.getAttribute("aria-pressed") !== "true") item.click();
    }

    /** Make every toggle group show the current settings. */
    function syncControls() {
        syncing = true;
        for (const key of groups.keys()) select(key, String(settings[key]));
        syncing = false;
    }
    // Wait a frame so the toggle-group controllers exist.
    requestAnimationFrame(syncControls);

    // --- Modes: crop, redact, pick ----------------------------------------

    const HINTS: Record<Exclude<Mode, "normal" | "annotate">, string> = {
        crop: "Drag the edges or corners to crop.",
        redact: "Drag over anything private.",
        pick: "Click the screenshot to pick a color.",
    };

    function updateHint() {
        if (mode === "normal") modeHint.textContent = "";
        else if (mode === "annotate") modeHint.textContent = settings.tool === "arrow" ? "Drag to draw an arrow." : "Click to add text.";
        else modeHint.textContent = HINTS[mode];
        overlay.dataset.tool = settings.tool;
    }

    function setMode(next: Mode) {
        if (mode === "pick" && next !== "pick") hover = null;
        if (mode === "annotate" && next !== "annotate") {
            commitText();
            selected = null;
        }
        mode = next;
        const active = mode !== "normal";
        toolbar.hidden = active;
        modeBar.hidden = !active;
        updateHint();
        modeReset.hidden = mode === "pick";
        redactStyles.hidden = mode !== "redact";
        annotateTools.hidden = mode !== "annotate";
        modeReset.textContent = mode === "redact" || mode === "annotate" ? "Clear all" : "Reset";
        overlay.hidden = mode !== "crop" && mode !== "redact" && mode !== "annotate";
        overlay.dataset.mode = mode;
        preview.style.cursor = mode === "pick" ? "crosshair" : "";
        draw();
    }

    $("[data-crop]").addEventListener("click", () => setMode("crop"));
    $("[data-redact]").addEventListener("click", () => setMode("redact"));
    for (const tool of ["arrow", "text"] as const) {
        $(`[data-${tool}]`).addEventListener("click", () => {
            if (settings.tool !== tool) {
                settings.tool = tool;
                persist();
                syncControls();
            }
            setMode("annotate");
        });
    }
    $("[data-mode-done]").addEventListener("click", () => setMode("normal"));
    modeReset.addEventListener("click", () => {
        const before = snapshot();
        if (mode === "crop") doc.crop = { ...doc.autoCrop };
        if (mode === "redact") doc.redactions = [];
        if (mode === "annotate") {
            doc.annotations = [];
            selected = null;
        }
        record(before);
        draw();
    });

    function cancelPick() {
        setMode("normal");
        // Nothing picked yet: go back to the background they had before.
        if (!settings.picked) {
            settings.background = beforePick;
            syncControls();
            persist();
            draw();
        }
    }

    // Canvas pixel <-> CSS pixel within the overlay/preview.
    const toCanvas = (clientX: number, clientY: number) => {
        const box = preview.getBoundingClientRect();
        return {
            x: ((clientX - box.left) / box.width) * preview.width,
            y: ((clientY - box.top) / box.height) * preview.height,
        };
    };
    const pct = (v: number, of: number) => `${(v / of) * 100}%`;

    /** Where the screenshot's pixels land on the preview canvas, in canvas px. */
    const imageRect = () => layout(renderState(), doc.crop, preview.width, preview.height).image;

    /** Canvas point -> source-image point (normal/redact view). */
    function canvasToSource(p: { x: number; y: number }) {
        const im = imageRect();
        return {
            x: doc.crop.x + ((p.x - im.x) / im.w) * doc.crop.w,
            y: doc.crop.y + ((p.y - im.y) / im.h) * doc.crop.h,
            inside: p.x >= im.x && p.y >= im.y && p.x < im.x + im.w && p.y < im.y + im.h,
        };
    }

    // Pick from image ------------------------------------------------------

    const sampler = document.createElement("canvas");
    sampler.width = sampler.height = 1;
    const samplerCtx = sampler.getContext("2d", { willReadFrequently: true })!;

    function colorAt(e: MouseEvent): string | null {
        if (!doc.image) return null;
        const s = canvasToSource(toCanvas(e.clientX, e.clientY));
        if (!s.inside) return null;
        samplerCtx.clearRect(0, 0, 1, 1);
        samplerCtx.drawImage(source(), Math.floor(s.x), Math.floor(s.y), 1, 1, 0, 0, 1, 1);
        const [r, g, b] = samplerCtx.getImageData(0, 0, 1, 1).data;
        return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    }

    preview.addEventListener("pointermove", (e) => {
        if (mode !== "pick") return;
        const color = colorAt(e);
        if (color === hover) return;
        hover = color;
        draw();
    });
    preview.addEventListener("pointerleave", () => {
        if (mode !== "pick" || !hover) return;
        hover = null;
        draw();
    });
    preview.addEventListener("click", (e) => {
        if (mode !== "pick") return;
        const color = colorAt(e);
        if (!color) return;
        const before = snapshot();
        settings.picked = color;
        record(before);
        setMode("normal");
        persist();
        drawSwatches();
        draw();
    });

    // Crop -----------------------------------------------------------------

    function drawCropOverlay() {
        const img = doc.image!;
        const c = doc.crop;
        overlay.innerHTML = "";
        const box = document.createElement("div");
        box.className = "crop-box";
        box.dataset.handle = "move";
        Object.assign(box.style, {
            left: pct(c.x, img.width),
            top: pct(c.y, img.height),
            width: pct(c.w, img.width),
            height: pct(c.h, img.height),
        });
        for (const h of ["n", "s", "e", "w", "ne", "nw", "se", "sw"]) {
            const handle = document.createElement("span");
            handle.className = `crop-handle crop-${h}`;
            handle.dataset.handle = h;
            box.append(handle);
        }
        overlay.append(box);
    }

    // Shared helpers for the redact and annotate overlays ------------------

    /** Client point -> source-image point. */
    const clientToSource = (x: number, y: number) => canvasToSource(toCanvas(x, y));

    /** Source rect -> CSS position (percent of the overlay), clipped to the crop. */
    function sourceRectToPct(r: Rect) {
        const im = imageRect();
        const x0 = Math.max(r.x, doc.crop.x);
        const y0 = Math.max(r.y, doc.crop.y);
        const x1 = Math.min(r.x + r.w, doc.crop.x + doc.crop.w);
        const y1 = Math.min(r.y + r.h, doc.crop.y + doc.crop.h);
        if (x1 <= x0 || y1 <= y0) return null;
        const s = im.w / doc.crop.w;
        return {
            left: pct(im.x + (x0 - doc.crop.x) * s, preview.width),
            top: pct(im.y + (y0 - doc.crop.y) * s, preview.height),
            width: pct((x1 - x0) * s, preview.width),
            height: pct((y1 - y0) * s, preview.height),
        };
    }

    /** Source point -> CSS position (percent of the overlay). */
    function sourcePointToPct(x: number, y: number) {
        const im = imageRect();
        const s = im.w / doc.crop.w;
        return { left: pct(im.x + (x - doc.crop.x) * s, preview.width), top: pct(im.y + (y - doc.crop.y) * s, preview.height) };
    }

    /** CSS pixels per source pixel in the preview. */
    function cssPerSource() {
        const im = imageRect();
        return (im.w / doc.crop.w) * (preview.getBoundingClientRect().width / preview.width);
    }

    function removeButton(label: string, onRemove: () => void) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "redact-remove";
        remove.setAttribute("aria-label", label);
        remove.textContent = "×";
        remove.addEventListener("pointerdown", (e) => e.stopPropagation());
        remove.addEventListener("click", onRemove);
        return remove;
    }

    function addHandles(box: HTMLElement, handles: string[]) {
        for (const h of handles) {
            const handle = document.createElement("span");
            handle.className = `crop-handle crop-${h}`;
            handle.dataset.handle = h;
            box.append(handle);
        }
    }

    // Redact ---------------------------------------------------------------

    function drawRedactOverlay() {
        overlay.innerHTML = "";
        doc.redactions.forEach((r, i) => {
            const pos = sourceRectToPct(r);
            if (!pos) return;
            const box = document.createElement("div");
            box.className = "redact-box";
            box.dataset.index = String(i);
            box.dataset.handle = "move";
            Object.assign(box.style, pos);
            addHandles(box, ["n", "s", "e", "w", "ne", "nw", "se", "sw"]);
            box.append(
                removeButton("Remove this redaction", () => {
                    const before = snapshot();
                    doc.redactions = doc.redactions.filter((_, j) => j !== i);
                    record(before);
                    draw();
                }),
            );
            overlay.append(box);
        });
    }

    // Annotate -------------------------------------------------------------

    function measureText(a: Extract<Annotation, { kind: "text" }>) {
        const unit = annotationUnit(doc.image!.width, doc.image!.height);
        const size = textSize(unit);
        samplerCtx.font = textFont(size, fontFamily);
        return { w: samplerCtx.measureText(a.text).width, h: size * 1.2, size };
    }

    /** The topmost annotation under a source point, if any. */
    function hitTest(p: { x: number; y: number }): number | null {
        const tol = 8 / cssPerSource();
        for (let i = doc.annotations.length - 1; i >= 0; i--) {
            const a = doc.annotations[i];
            if (a.kind === "arrow") {
                if (distanceToSegment(p, a) <= tol + arrowHalfWidth()) return i;
            } else {
                const m = measureText(a);
                if (p.x >= a.x - tol && p.x <= a.x + m.w + tol && p.y >= a.y - tol && p.y <= a.y + m.h + tol) return i;
            }
        }
        return null;
    }

    const arrowHalfWidth = () => (annotationUnit(doc.image!.width, doc.image!.height) * 4) / 2;

    function deleteSelected() {
        if (selected === null) return;
        const before = snapshot();
        const i = selected;
        doc.annotations = doc.annotations.filter((_, j) => j !== i);
        selected = null;
        record(before);
        draw();
    }

    function drawAnnotateOverlay() {
        // Keep the live text editor; rebuild everything else.
        overlay.querySelectorAll(":scope > :not([data-text-editor])").forEach((el) => el.remove());
        if (selected === null || !doc.annotations[selected]) return;
        const a = doc.annotations[selected];
        if (a.kind === "arrow") {
            for (const [h, x, y] of [["a1", a.x1, a.y1], ["a2", a.x2, a.y2]] as const) {
                const dot = document.createElement("span");
                dot.className = "arrow-handle";
                dot.dataset.handle = h;
                Object.assign(dot.style, sourcePointToPct(x, y));
                overlay.append(dot);
            }
            const mid = document.createElement("div");
            mid.className = "arrow-remove";
            Object.assign(mid.style, sourcePointToPct((a.x1 + a.x2) / 2, (a.y1 + a.y2) / 2));
            mid.append(removeButton("Remove this arrow", deleteSelected));
            overlay.append(mid);
        } else if (!editing) {
            const m = measureText(a);
            const pos = sourceRectToPct({ x: a.x, y: a.y, w: m.w, h: m.h });
            if (!pos) return;
            const box = document.createElement("div");
            box.className = "text-box";
            box.dataset.handle = "move";
            Object.assign(box.style, pos);
            box.append(removeButton("Remove this text", deleteSelected));
            overlay.append(box);
        }
    }

    /** Start typing a text annotation: a new one at a point, or an existing one. */
    function openTextEditor(index: number) {
        commitText();
        const a = doc.annotations[index] as Extract<Annotation, { kind: "text" }>;
        const el = document.createElement("span");
        el.dataset.textEditor = "";
        el.contentEditable = "plaintext-only";
        el.className = "text-editor";
        el.textContent = a.text;
        const size = measureText(a).size * cssPerSource();
        Object.assign(el.style, sourcePointToPct(a.x, a.y), {
            color: a.color,
            font: textFont(size, fontFamily),
        });
        el.addEventListener("pointerdown", (e) => e.stopPropagation());
        el.addEventListener("keydown", (e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
                e.preventDefault();
                commitText();
            } else if (e.key === "Escape") {
                e.preventDefault();
                commitText(true);
            }
        });
        el.addEventListener("blur", () => commitText());
        editing = { index, el };
        selected = index;
        overlay.append(el);
        draw();
        // Focus after the pointer events that opened it have finished.
        requestAnimationFrame(() => {
            el.focus();
            getSelection()?.selectAllChildren(el);
        });
    }

    /** Save (or, with `cancel`, drop) the text being typed. Empty text removes the annotation. */
    let editBefore = "";
    function commitText(cancel = false) {
        if (!editing) return;
        const { index, el } = editing;
        editing = null;
        el.remove();
        const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        const a = doc.annotations[index];
        if (a?.kind === "text") {
            if (cancel || !text) {
                // Cancelling a brand-new text, or leaving it empty, removes it.
                if (!text || !a.text) {
                    doc.annotations = doc.annotations.filter((_, j) => j !== index);
                    selected = null;
                }
            } else {
                doc.annotations = doc.annotations.map((x, j) => (j === index ? { ...a, text } : x));
            }
        }
        record(editBefore);
        draw();
    }

    // Drag handling: crop, redact (draw, move, resize), annotate --------

    let drag: {
        before: string;
        start: { x: number; y: number };
        /** Source point where the drag started. */
        startSrc: { x: number; y: number };
        handle: string;
        startCrop: Rect;
        /** Redaction or annotation being edited, and its state before the drag. */
        index?: number;
        orig?: Rect | Annotation;
        draft?: HTMLElement;
    } | null = null;

    let lastDown: { index: number | null; time: number } = { index: null, time: 0 };

    overlay.addEventListener("pointerdown", (e) => {
        if (!doc.image || (mode !== "crop" && mode !== "redact" && mode !== "annotate")) return;
        const target = e.target as HTMLElement;
        const handle = target.closest<HTMLElement>("[data-handle]")?.dataset.handle ?? "";
        const src = clientToSource(e.clientX, e.clientY);
        if (mode === "crop" && !handle) return;
        const base = { before: snapshot(), start: { x: e.clientX, y: e.clientY }, startSrc: src, handle, startCrop: { ...doc.crop } };

        if (mode === "redact") {
            const box = target.closest<HTMLElement>("[data-index]");
            if (box) {
                const index = Number(box.dataset.index);
                drag = { ...base, index, orig: { ...doc.redactions[index] } };
            } else {
                if (!src.inside) return;
                drag = { ...base, draft: document.createElement("div") };
                drag.draft!.className = "redact-box redact-draft";
                overlay.append(drag.draft!);
            }
        } else if (mode === "annotate") {
            commitText();
            const hit = hitTest(src);
            // Second click on the same text within a moment: edit it. (The
            // overlay is rebuilt on every click, so the browser's dblclick
            // never fires here.)
            const now = performance.now();
            const again = hit !== null && lastDown.index === hit && now - lastDown.time < 450;
            lastDown = { index: hit, time: now };
            if (again && doc.annotations[hit!].kind === "text") {
                e.preventDefault();
                editBefore = base.before;
                openTextEditor(hit!);
                return;
            }
            if (handle && selected !== null) {
                // Dragging an arrow end or the selected text.
                drag = { ...base, index: selected, orig: { ...doc.annotations[selected] } };
            } else {
                if (hit !== null) {
                    selected = hit;
                    drag = { ...base, handle: "move", index: hit, orig: { ...doc.annotations[hit] } };
                    syncColorTo(doc.annotations[hit].color);
                    draw();
                } else if (!src.inside) {
                    selected = null;
                    draw();
                    return;
                } else if (settings.tool === "arrow") {
                    const color = ANNOTATION_COLORS[settings.color];
                    doc.annotations = [...doc.annotations, { kind: "arrow", x1: src.x, y1: src.y, x2: src.x, y2: src.y, color }];
                    selected = doc.annotations.length - 1;
                    drag = { ...base, handle: "a2", index: selected, orig: { ...doc.annotations[selected] } };
                } else {
                    // Text: place it at the click, slightly up so the caret sits on the pointer.
                    e.preventDefault();
                    editBefore = base.before;
                    const color = ANNOTATION_COLORS[settings.color];
                    const size = textSize(annotationUnit(doc.image.width, doc.image.height));
                    doc.annotations = [...doc.annotations, { kind: "text", x: src.x, y: src.y - size * 0.6, text: "", color }];
                    openTextEditor(doc.annotations.length - 1);
                    return;
                }
            }
        }
        e.preventDefault();
        overlay.setPointerCapture(e.pointerId);
    });

    overlay.addEventListener("pointermove", (e) => {
        if (!drag || !doc.image) return;
        const box = overlay.getBoundingClientRect();
        const src = clientToSource(e.clientX, e.clientY);
        const dx = src.x - drag.startSrc.x;
        const dy = src.y - drag.startSrc.y;
        const W = doc.image.width;
        const H = doc.image.height;

        if (mode === "crop") {
            const k = W / box.width;
            doc.crop = resizeRect(drag.startCrop, drag.handle, (e.clientX - drag.start.x) * k, (e.clientY - drag.start.y) * k, W, H, Math.max(16, Math.min(W, H) * 0.05));
            drawCropOverlay();
        } else if (mode === "redact" && drag.index !== undefined) {
            const r = resizeRect(drag.orig as Rect, drag.handle, dx, dy, W, H, 6);
            doc.redactions = doc.redactions.map((x, i) => (i === drag!.index ? r : x));
            draw();
        } else if (mode === "redact" && drag.draft) {
            const x0 = Math.min(e.clientX, drag.start.x) - box.left;
            const y0 = Math.min(e.clientY, drag.start.y) - box.top;
            Object.assign(drag.draft.style, {
                left: pct(x0, box.width),
                top: pct(y0, box.height),
                width: pct(Math.abs(e.clientX - drag.start.x), box.width),
                height: pct(Math.abs(e.clientY - drag.start.y), box.height),
            });
        } else if (mode === "annotate" && drag.index !== undefined) {
            const o = drag.orig as Annotation;
            let next: Annotation;
            if (o.kind === "arrow") {
                if (drag.handle === "a1") next = { ...o, x1: src.x, y1: src.y };
                else if (drag.handle === "a2") next = { ...o, x2: src.x, y2: src.y };
                else next = { ...o, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy };
            } else {
                next = { ...o, x: o.x + dx, y: o.y + dy };
            }
            doc.annotations = doc.annotations.map((x, i) => (i === drag!.index ? next : x));
            draw();
        }
    });

    const endDrag = (e: PointerEvent) => {
        if (!drag) return;
        if (mode === "redact" && drag.draft && Math.abs(e.clientX - drag.start.x) > 4 && Math.abs(e.clientY - drag.start.y) > 4) {
            const a = drag.startSrc;
            const b = clientToSource(e.clientX, e.clientY);
            const c = doc.crop;
            const x0 = Math.max(c.x, Math.min(a.x, b.x));
            const y0 = Math.max(c.y, Math.min(a.y, b.y));
            const x1 = Math.min(c.x + c.w, Math.max(a.x, b.x));
            const y1 = Math.min(c.y + c.h, Math.max(a.y, b.y));
            if (x1 - x0 >= 2 && y1 - y0 >= 2) {
                doc.redactions = [...doc.redactions, { x: Math.floor(x0), y: Math.floor(y0), w: Math.ceil(x1 - x0), h: Math.ceil(y1 - y0) }];
            }
        }
        // A click without a drag doesn't make an arrow.
        if (mode === "annotate" && drag.index !== undefined) {
            const a = doc.annotations[drag.index];
            if (a?.kind === "arrow" && Math.hypot(a.x2 - a.x1, a.y2 - a.y1) * cssPerSource() < 8) {
                doc.annotations = doc.annotations.filter((_, j) => j !== drag!.index);
                selected = null;
            }
        }
        record(drag.before);
        drag = null;
        draw();
    };
    overlay.addEventListener("pointerup", endDrag);
    overlay.addEventListener("pointercancel", endDrag);

    /** Show a selected annotation's color in the color chips (without recording a change). */
    function syncColorTo(hex: string) {
        const id = (Object.keys(ANNOTATION_COLORS) as AnnotationColor[]).find((k) => ANNOTATION_COLORS[k] === hex);
        if (!id || id === settings.color) return;
        settings.color = id;
        persist();
        syncControls();
    }

    // --- Drawing ----------------------------------------------------------

    function draw() {
        if (!doc.image) return;
        const rs = renderState();
        // Render the preview at the size it's shown, so it stays sharp and fast.
        const shown = stage.clientWidth * devicePixelRatio;

        if (mode === "crop") {
            // The whole screenshot, so there's something to crop back out to.
            const img = doc.image;
            preview.width = Math.round(shown);
            preview.height = Math.round((shown * img.height) / img.width);
            preview.getContext("2d")!.drawImage(source(), 0, 0, preview.width, preview.height);
            drawCropOverlay();
        } else {
            render(preview, rs, source(), doc.crop, shown / baseSize(rs, doc.crop).width);
            if (mode === "redact") drawRedactOverlay();
            if (mode === "annotate") drawAnnotateOverlay();
        }
        preview.setAttribute(
            "aria-label",
            `Preview: screenshot on a ${findPreset(settings.background).name} background, ${rs.size.label}`,
        );

        const base = baseSize(rs, doc.crop);
        const { scale, clamped } = exportScale(rs, doc.crop, SCALES[settings.scale]);
        const w = Math.round(base.width * scale);
        const h = Math.round(base.height * scale);
        sizeNote.textContent = `${w} × ${h} · ${rs.size.use}${clamped ? " · reduced to fit the 8192 px limit" : ""}`;
    }

    function drawSwatches() {
        const rs = renderState();
        document.querySelectorAll<HTMLCanvasElement>("[data-swatch]").forEach((c) => {
            const ctx = c.getContext("2d")!;
            ctx.clearRect(0, 0, c.width, c.height);
            const id = c.dataset.swatch!;
            if (id === "picked") {
                ctx.fillStyle = settings.picked ?? "#e7e5e4";
                ctx.fillRect(0, 0, c.width, c.height);
                const icon = c.parentElement!.querySelector<SVGElement>("[data-dropper-icon]")!;
                icon.style.color = settings.picked && luminance(settings.picked) < 0.5 ? "#fff" : "#1c1917";
                return;
            }
            const bg = background(id);
            if (bg.kind === "transparent") {
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.fillStyle = "#e7e5e4";
                for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) ctx.fillRect(x * 12, y * 12, 12, 12);
                return;
            }
            // Dots and glass need the canvas-to-swatch ratio to look right.
            if ((bg.kind === "dots" || bg.kind === "glass") && doc.image) {
                const big = document.createElement("canvas");
                const base = baseSize(rs, doc.crop);
                big.width = 192;
                big.height = Math.round((192 * base.height) / base.width);
                drawBackground(big.getContext("2d")!, bg, big.width, big.height, source(), doc.crop);
                const side = Math.min(big.width, big.height);
                ctx.drawImage(big, (big.width - side) / 2, (big.height - side) / 2, side, side, 0, 0, c.width, c.height);
                return;
            }
            drawBackground(ctx, bg, c.width, c.height);
        });
    }

    new ResizeObserver(() => draw()).observe(stage);
    drawSwatches();

    // --- Export -----------------------------------------------------------

    function exportBlob(type: string = FORMATS[settings.format]): Promise<Blob> {
        setMode("normal");
        const rs = renderState();
        const { scale } = exportScale(rs, doc.crop, SCALES[settings.scale]);
        const matte = type === "image/jpeg" ? "#fff" : undefined;
        const c = render(document.createElement("canvas"), rs, source(), doc.crop, scale, matte);
        return new Promise((resolve, reject) =>
            c.toBlob((b) => (b ? resolve(b) : reject(new Error("export failed"))), type, 0.92),
        );
    }

    function filename() {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const ext = settings.format === "jpeg" ? "jpg" : settings.format;
        return `screenshot-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.${ext}`;
    }

    async function download() {
        if (!doc.image) return;
        const url = URL.createObjectURL(await exportBlob());
        const a = document.createElement("a");
        a.href = url;
        a.download = filename();
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function copy() {
        if (!doc.image) return;
        try {
            // Clipboards take PNG only. Safari needs the Promise passed
            // straight into ClipboardItem.
            await navigator.clipboard.write([new ClipboardItem({ "image/png": exportBlob("image/png") })]);
            say("Copied. Paste it into your post.");
        } catch {
            await download();
            say("Couldn't copy here, so it downloaded instead.");
        }
    }

    async function share() {
        const blob = await exportBlob();
        try {
            await navigator.share({ files: [new File([blob], filename(), { type: blob.type })] });
        } catch {
            /* dismissed */
        }
    }

    $("[data-copy]").addEventListener("click", copy);
    $("[data-download]").addEventListener("click", download);
    shareBtn.addEventListener("click", share);
    // Share only where the native sheet can take an image (mostly mobile).
    const probe = new File([new Blob()], "x.png", { type: "image/png" });
    shareBtn.hidden = !(matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [probe] }));

    // --- Keyboard ---------------------------------------------------------

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && mode !== "normal") {
            if (mode === "pick") cancelPick();
            else if (mode === "annotate" && selected !== null) {
                selected = null;
                draw();
            } else setMode("normal");
            return;
        }
        if ((e.key === "Delete" || e.key === "Backspace") && mode === "annotate" && selected !== null && !editing) {
            e.preventDefault();
            deleteSelected();
            return;
        }
        if (!(e.metaKey || e.ctrlKey) || !doc.image) return;
        if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
        const key = e.key.toLowerCase();
        if (key === "z") {
            e.preventDefault();
            e.shiftKey ? redo() : undo();
        } else if (key === "c" && !getSelection()?.toString()) {
            e.preventDefault();
            copy();
        } else if (key === "s") {
            e.preventDefault();
            download();
        }
    });

    let sayTimer: number | undefined;
    function say(text: string) {
        statuses.forEach((s) => (s.textContent = text));
        clearTimeout(sayTimer);
        if (text) sayTimer = window.setTimeout(() => statuses.forEach((s) => (s.textContent = "")), 4000);
    }
}

/** Move or resize a rect by a drag delta (source px), kept inside the image and at least `min` px. */
function resizeRect(start: Rect, handle: string, dx: number, dy: number, W: number, H: number, min: number): Rect {
    let x0 = start.x;
    let y0 = start.y;
    let x1 = start.x + start.w;
    let y1 = start.y + start.h;
    if (handle === "move") {
        const mx = Math.min(Math.max(dx, -x0), W - x1);
        const my = Math.min(Math.max(dy, -y0), H - y1);
        return { x: Math.round(x0 + mx), y: Math.round(y0 + my), w: start.w, h: start.h };
    }
    if (handle.includes("w")) x0 = Math.min(Math.max(0, x0 + dx), x1 - min);
    if (handle.includes("e")) x1 = Math.max(Math.min(W, x1 + dx), x0 + min);
    if (handle.includes("n")) y0 = Math.min(Math.max(0, y0 + dy), y1 - min);
    if (handle.includes("s")) y1 = Math.max(Math.min(H, y1 + dy), y0 + min);
    return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
}

function luminance(hex: string) {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Distance from a point to an arrow's line segment, in source px. */
function distanceToSegment(p: { x: number; y: number }, a: { x1: number; y1: number; x2: number; y2: number }) {
    const dx = a.x2 - a.x1;
    const dy = a.y2 - a.y1;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x1) * dx + (p.y - a.y1) * dy) / len2)) : 0;
    return Math.hypot(p.x - (a.x1 + t * dx), p.y - (a.y1 + t * dy));
}
