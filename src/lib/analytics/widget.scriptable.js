// Becky's sites: a home screen widget for Scriptable (scriptable.app), from beckyschmidt.me/admin/widget.
// Shows today's visitors. For the last 7 days instead, long-press the widget, tap Edit Widget, and type 7d
// as the Parameter.

const SITE = "__SITE__";
const KEY = "__KEY__";

const range = (args.widgetParameter || "").trim().toLowerCase() === "7d" ? "7d" : "today";
const fm = FileManager.local();
const cached = (name) => fm.joinPath(fm.cacheDirectory(), `becky-sites-${name}`);

const color = (light, dark) => Color.dynamic(new Color(light), new Color(dark));
const TEXT = color("#000000", "#ffffff");
const MUTED = color("#6e6e73", "#8e8e93");
const UP = color("#248a3d", "#30d158");
const DOWN = color("#d70015", "#ff453a");
const RULE = color("#d1d1d6", "#38383a");

/** The numbers, saved after each fetch so the widget still shows the last ones when the phone is offline. */
async function load() {
    const path = cached(`${range}.json`);
    try {
        const request = new Request(`${SITE}/api/widget?range=${range}`);
        request.headers = { Authorization: `Bearer ${KEY}` };
        request.timeoutInterval = 20;
        const data = await request.loadJSON();
        if (request.response.statusCode !== 200) throw new Error(data.error || `HTTP ${request.response.statusCode}`);
        data.fetched = Date.now();
        fm.writeString(path, JSON.stringify(data));
        return { data, offline: false };
    } catch (error) {
        if (fm.fileExists(path)) return { data: JSON.parse(fm.readString(path)), offline: true };
        throw error;
    }
}

/** Each site's icon, fetched once a week. */
async function icon(site) {
    const path = cached(`icon-${site.id}.png`);
    const fresh = fm.fileExists(path) && Date.now() - fm.modificationDate(path).getTime() < 7 * 86_400_000;
    if (!fresh) {
        try {
            fm.writeImage(path, await new Request(site.icon).loadImage());
        } catch {}
    }
    return fm.fileExists(path) ? fm.readImage(path) : null;
}

/** Visitors per hour (today) or per day (7 days) as small bars in the site's color; empty ones as a dash. */
function bars(values, accent) {
    const width = values.length > 12 ? 3 : 9;
    const gap = values.length > 12 ? 1 : 3;
    const height = 14;
    const ctx = new DrawContext();
    ctx.size = new Size(values.length * (width + gap) - gap, height);
    ctx.opaque = false;
    ctx.respectScreenScale = true;
    const max = Math.max(...values, 1);
    values.forEach((v, i) => {
        const h = v ? Math.max(2, (v / max) * height) : 1;
        ctx.setFillColor(v ? new Color(accent || "#8e8e93") : new Color("#8e8e93", 0.4));
        ctx.fillRect(new Rect(i * (width + gap), height - h, width, h));
    });
    return ctx.getImage();
}

function addText(stack, value, { font = Font.systemFont(13), textColor = TEXT } = {}) {
    const text = stack.addText(value);
    text.font = font;
    text.textColor = textColor;
    text.lineLimit = 1;
    return text;
}

function trend(stack, change) {
    // A fixed width keeps the arrows in a column.
    const cell = stack.addStack();
    cell.size = new Size(40, 0);
    if (change !== null) {
        const arrow = change > 0 ? "↑" : change < 0 ? "↓" : "";
        addText(cell, `${arrow}${Math.abs(change)}%`, {
            font: Font.systemFont(11),
            textColor: change > 0 ? UP : change < 0 ? DOWN : MUTED,
        });
    }
    cell.addSpacer();
}

/** Icon, name (unless the widget is small), visitors and their change. */
function siteRow(parent, site, image, { name }) {
    const row = parent.addStack();
    row.centerAlignContent();
    if (image) {
        const img = row.addImage(image);
        img.imageSize = new Size(16, 16);
        img.cornerRadius = 4;
    } else {
        const dot = row.addStack();
        dot.size = new Size(16, 16);
        dot.cornerRadius = 4;
        dot.backgroundColor = new Color(site.accent || "#8e8e93");
    }
    row.addSpacer(8);
    if (name) addText(row, site.name).minimumScaleFactor = 0.8;
    row.addSpacer();
    addText(row, site.visitors.toLocaleString("en-US"), { font: Font.semiboldSystemFont(13) });
    row.addSpacer(6);
    trend(row, site.change);
    return row;
}

function header(widget, data, offline, note) {
    const head = widget.addStack();
    addText(head, data.label, { font: Font.semiboldSystemFont(11) });
    head.addSpacer();
    const time = new DateFormatter();
    time.useShortTimeStyle();
    const when = time.string(new Date(data.fetched));
    addText(head, [note, offline ? `offline · ${when}` : when].filter(Boolean).join(" · "), {
        font: Font.systemFont(11),
        textColor: MUTED,
    });
    widget.addSpacer(8);
}

async function build() {
    const family = config.widgetFamily || "large";
    const widget = new ListWidget();
    widget.backgroundColor = color("#ffffff", "#1c1c1e");
    widget.setPadding(14, 16, 14, 16);
    widget.url = `${SITE}/admin?range=${range}`;
    widget.refreshAfterDate = new Date(Date.now() + 15 * 60_000);

    let loaded;
    try {
        loaded = await load();
    } catch (error) {
        addText(widget, "Couldn't load your sites", { font: Font.semiboldSystemFont(13) });
        widget.addSpacer(4);
        addText(widget, String(error.message || error), { font: Font.systemFont(11), textColor: MUTED }).lineLimit = 3;
        return widget;
    }
    const { data, offline } = loaded;
    const images = await Promise.all(data.sites.map(icon));

    if (family.startsWith("accessory")) {
        // Lock screen: the total across all sites.
        const total = data.sites.reduce((sum, s) => sum + s.visitors, 0);
        addText(widget, `${total.toLocaleString("en-US")} visitors`, { font: Font.semiboldSystemFont(14) });
        addText(widget, data.label, { font: Font.systemFont(12) });
        return widget;
    }

    if (family === "small" || family === "medium") {
        header(widget, data, offline, family === "medium" ? "visitors" : null);
        data.sites.forEach((site, i) => {
            if (i) widget.addSpacer(5);
            siteRow(widget, site, images[i], { name: family === "medium" });
        });
        widget.addSpacer();
        return widget;
    }

    // Large (and iPad's extra large): each site also gets its key action and its bars.
    header(widget, data, offline, "visitors");
    data.sites.forEach((site, i) => {
        if (i) {
            widget.addSpacer();
            const rule = widget.addStack();
            rule.size = new Size(0, 0.5);
            rule.backgroundColor = RULE;
            rule.addSpacer();
            widget.addSpacer();
        }
        siteRow(widget, site, images[i], { name: true });
        widget.addSpacer(3);
        const detail = widget.addStack();
        detail.bottomAlignContent();
        detail.addSpacer(24);
        addText(detail, site.goal || "", { font: Font.systemFont(11), textColor: MUTED });
        detail.addSpacer();
        detail.addImage(bars(site.bars, site.accent));
    });
    return widget;
}

const widget = await build();
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();
