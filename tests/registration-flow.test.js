import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {mountRegistrationFlow} from "../js/registration-flow.js";
import {config} from "../js/config.js";

const html = await readFile(new URL("../registration.html", import.meta.url), "utf8");

class Element extends EventTarget {
    constructor(attributes, page) {
        super();
        this.attributes = attributes;
        this.ownerDocument = page;
        this.hidden = /(?:^|\s)hidden(?:\s|$)/.test(attributes);
        this.href = this.getAttribute("href");
        this.src = this.getAttribute("src");
        this.open = false;
        this.textContent = "";
    }

    getAttribute(name) {
        return this.attributes.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1] ?? null;
    }

    focus() {
        this.focused = true;
    }

    getBoundingClientRect() {
        return {left: 10, top: 10, right: 410, bottom: 610, width: 400, height: 600};
    }

    showModal() {
        this.open = true;
    }

    close() {
        if (!this.open) return;
        this.open = false;
        this.dispatchEvent(new Event("close"));
    }
}

// Reads bindings from the actual wrapper; no browser success is inferred here.
function fixture() {
    const page = {defaultView: {matchMedia: () => ({matches: true})}};

    function elements(source) {
        return [...source.matchAll(/<[a-z][a-z0-9-]*\b([^>]*)>/gi)].map((match) => new Element(match[1], page));
    }

    function query(nodes, selector) {
        if (selector === "dialog[open]") return nodes.filter(node => node.open);
        if (selector.startsWith("#")) return nodes.filter((node) => node.getAttribute("id") === selector.slice(1));
        const attribute = selector.slice(1, -1);
        return nodes.filter((node) => new RegExp(`(?:^|\\s)${attribute}(?:\\s|=|$)`).test(node.attributes));
    }

    const nodes = elements(html);
    // The Mines preview mounts this dialog dynamically before the promotion timer fires.
    nodes.push(new Element('id="predictionDialog"', page));
    page.querySelector = (selector) => query(nodes, selector)[0] ?? null;
    const dialog = page.querySelector("#deposit-dialog");
    const children = elements(html.match(/<dialog\b[\s\S]*?<\/dialog>/)[0]);
    dialog.querySelector = (selector) => query(children, selector)[0] ?? null;
    dialog.querySelectorAll = (selector) => query(children, selector);
    let callback;
    let cancelled = false;
    let delay;
    const schedule = (ms, action) => {
        delay = ms;
        callback = action;
        return () => {
            cancelled = true;
        };
    };
    const flow = mountRegistrationFlow(page, config, schedule);
    return {
        page, dialog, flow,
        frame: page.querySelector("#dmfirst-frame"),
        widget: page.querySelector("[data-deposit-widget]"),
        claim: dialog.querySelector("[data-deposit-claim]"),
        firePromotion() {
            if (!cancelled) callback();
        },
        get delay() {
            return delay;
        },
        get cancelled() {
            return cancelled;
        },
    };
}

function click(element, properties = {}) {
    const event = Object.assign(new Event("click", {cancelable: true}), {button: 0, ...properties});
    element.dispatchEvent(event);
    return event;
}

test("wrapper retains the referral and waits for the configured delay before showing the popup", () => {
    const state = fixture();
    assert.equal(state.frame.src, config.registerUrl);
    assert.equal(state.dialog.open, false);
    assert.equal(state.delay, config.popupDelayMs);
    state.firePromotion();
    assert.equal(state.dialog.open, true);
    assert.equal(state.frame.src, config.registerUrl);
    state.flow.destroy();
});

test("dismissal reveals the circular widget, which reopens details without wallet navigation", () => {
    const state = fixture();
    state.firePromotion();
    state.dialog.close();
    assert.equal(state.widget.hidden, false);
    assert.equal(state.frame.src, config.registerUrl);
    click(state.widget);
    assert.equal(state.dialog.open, true);
    assert.equal(state.widget.hidden, true);
    state.flow.destroy();
});

test("only an ordinary Claim click requests wallet recharge in the existing iframe", () => {
    const state = fixture();
    state.firePromotion();
    const event = click(state.claim);
    assert.equal(event.defaultPrevented, true);
    assert.equal(state.frame.src, config.depositUrl);
    assert.equal(state.dialog.open, false);
    assert.equal(state.widget.hidden, false);
    state.flow.destroy();
});

test("modified Claim clicks preserve the browser's link behavior", () => {
    const state = fixture();
    state.firePromotion();
    const event = click(state.claim, {ctrlKey: true});
    assert.equal(event.defaultPrevented, false);
    assert.equal(state.frame.src, config.registerUrl);
    assert.equal(state.dialog.open, true);
    state.flow.destroy();
});

test("copy section stays hidden until Claim, then appears on later popup visits", () => {
    const state = fixture();
    const section = state.dialog.querySelector("[data-copy-code-section]");
    assert.equal(section.hidden, true);
    state.firePromotion();
    assert.equal(section.hidden, true);
    click(state.dialog.querySelector("[data-dismiss-deposit]"));
    click(state.widget);
    assert.equal(section.hidden, true, "closing and reopening alone must not unlock it");
    const prevented = new Event("click", {cancelable: true});
    prevented.preventDefault();
    state.claim.dispatchEvent(prevented);
    click(state.claim, {ctrlKey: true});
    state.dialog.close();
    click(state.widget);
    assert.equal(section.hidden, true, "cancelled and modified clicks must not unlock it");
    click(state.claim);
    assert.equal(state.dialog.open, false);
    assert.equal(section.hidden, true, "visibility changes only on the next visit");
    click(state.widget);
    assert.equal(section.hidden, false);
    assert.equal(state.frame.src, config.depositUrl);
    state.dialog.close();
    click(state.widget);
    assert.equal(section.hidden, false);
    state.flow.destroy();
    const fresh = fixture();
    fresh.firePromotion();
    assert.equal(fresh.dialog.querySelector("[data-copy-code-section]").hidden, true);
    fresh.flow.destroy();
});

test("cleanup cancels the delayed popup and releases the floating control", () => {
    const state = fixture();
    state.flow.destroy();
    assert.equal(state.cancelled, true);
    state.firePromotion();
    assert.equal(state.dialog.open, false);
    click(state.widget);
    assert.equal(state.dialog.open, false);
});

test("automatic deposit promotion waits for another dialog and cleanup cancels the wait", () => {
    const state = fixture();
    const other = state.page.querySelector("#predictionDialog");
    other.showModal();
    state.firePromotion();
    assert.equal(state.dialog.open, false, "the two modals must not stack");
    other.close();
    assert.equal(state.dialog.open, true, "promotion resumes after dismissal");
    state.flow.destroy();

    const cancelled = fixture();
    const waiting = cancelled.page.querySelector("#predictionDialog");
    waiting.showModal();
    cancelled.firePromotion();
    cancelled.flow.destroy();
    waiting.close();
    assert.equal(cancelled.dialog.open, false, "teardown removes the deferred promotion");
});
