import {config} from "./config.js";
import {getActivityItems} from "./activity-content.js";

export function mountActivityTicker(root, {settings = config, random = Math.random} = {}) {
    const page = root.ownerDocument;
    const view = page.defaultView;
    const motion = view.matchMedia("(prefers-reduced-motion: reduce)");
    let items = getActivityItems({settings, random});
    const periodMs = Math.max(1000, Number(settings.activityIntervalMs) || 4000);
    const fadeMs = Math.min(360, periodMs / 4);
    const gapMs = Math.min(240, periodMs / 10);
    const select = (attribute) => root.querySelector(`[${attribute}]`);
    const primary = select("data-activity-primary");
    const secondary = select("data-activity-secondary");
    const username = select("data-activity-username");
    const avatar = select("data-activity-avatar-image");
    const value = select("data-activity-value");
    let index = 0;
    let elapsed = 0;
    let previous = null;
    let frameId;
    let hovered = false;
    let focused = false;
    let destroyed = false;

    root.dataset.mode = "demo";
    root.style.setProperty("--activity-transition-duration", `${fadeMs}ms`);
    select("data-activity-sample").textContent = "Sample";
    select("data-activity-sample").hidden = false;
    select("data-activity-note").textContent = "Demo activity. All displayed users and transactions are fictional preview examples.";

    function renderItem() {
        const item = items[index];
        primary.textContent = item.primary;
        secondary.textContent = item.secondary;
        username.textContent = item.username;
        if (avatar.getAttribute("src") !== item.avatar) avatar.setAttribute("src", item.avatar);
        value.textContent = item.value;
        root.dataset.kind = item.kind;
        root.setAttribute("aria-label", `Demo activity, fictional example: ${item.username}, ${item.primary} ${item.secondary}, ${item.value}`);
    }

    function running() {
        return !destroyed && !hovered && !focused && !page.hidden && !motion.matches;
    }

    function frame(now) {
        if (!running()) return;
        if (previous !== null) elapsed += Math.min(now - previous, 100);
        previous = now;
        if (elapsed >= periodMs) {
            elapsed %= periodMs;
            index = (index + 1) % items.length;
            if (index === 0) items = getActivityItems({settings, random, previousUsername: items.at(-1).username});
            renderItem();
        }
        root.dataset.phase = elapsed < fadeMs ? "entering"
            : elapsed >= periodMs - gapMs ? "away"
                : elapsed >= periodMs - gapMs - fadeMs ? "exiting" : "visible";
        frameId = view.requestAnimationFrame(frame);
    }

    function sync() {
        view.cancelAnimationFrame(frameId);
        previous = null;
        root.dataset.paused = String(!running());
        // Keep the complete card readable whenever a visitor pauses or focuses it.
        if (!running()) root.dataset.phase = "visible";
        if (running()) frameId = view.requestAnimationFrame(frame);
    }

    function pointerEnter(event) {
        if (event.pointerType !== "touch") {
            hovered = true;
            sync();
        }
    }

    function pointerLeave() {
        hovered = false;
        sync();
    }

    function focusIn() {
        focused = true;
        sync();
    }

    function focusOut(event) {
        focused = !!event.relatedTarget && root.contains(event.relatedTarget);
        sync();
    }

    root.addEventListener("pointerenter", pointerEnter);
    root.addEventListener("pointerleave", pointerLeave);
    root.addEventListener("focusin", focusIn);
    root.addEventListener("focusout", focusOut);
    page.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    renderItem();
    sync();

    return {
        destroy() {
            destroyed = true;
            view.cancelAnimationFrame(frameId);
            root.removeEventListener("pointerenter", pointerEnter);
            root.removeEventListener("pointerleave", pointerLeave);
            root.removeEventListener("focusin", focusIn);
            root.removeEventListener("focusout", focusOut);
            page.removeEventListener("visibilitychange", sync);
            motion.removeEventListener("change", sync);
        },
    };
}

