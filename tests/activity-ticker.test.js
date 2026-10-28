import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {getActivityItems} from "../js/activity-content.js";
import {mountActivityTicker} from "../js/activity-ticker.js";
import {config} from "../js/config.js";

const html = await readFile(new URL("../registration.html", import.meta.url), "utf8");
const fixedItems = getActivityItems({random: () => 0});

function fixture({reduced = false, random = () => 0} = {}) {
    const page = new EventTarget();
    page.hidden = false;
    const motion = new EventTarget();
    motion.matches = reduced;
    const frames = new Map();
    let id = 0;
    let now = 0;
    page.defaultView = {
        matchMedia: () => motion,
        requestAnimationFrame(callback) {
            frames.set(++id, callback);
            return id;
        },
        cancelAnimationFrame(frameId) {
            frames.delete(frameId);
        },
    };
    const nodes = new Map();
    for (const match of html.matchAll(/<[a-z][a-z0-9-]*\b([^>]*)>/gi)) {
        for (const attribute of match[1].matchAll(/\b(data-activity-[a-z-]+)(?=\s|=|$)/g)) {
            const node = new EventTarget();
            const attributes = new Map();
            node.setAttribute = (key, value) => attributes.set(key, value);
            node.getAttribute = (key) => attributes.get(key);
            node.textContent = "";
            nodes.set(attribute[1], node);
        }
    }
    const root = nodes.get("data-activity-ticker");
    assert.ok(root, "real wrapper includes the ticker");
    root.ownerDocument = page;
    root.dataset = {};
    root.style = {
        setProperty(key, value) {
            this[key] = value;
        }
    };
    root.querySelector = (selector) => nodes.get(selector.slice(1, -1));
    root.contains = (node) => [...nodes.values()].includes(node);
    const ticker = mountActivityTicker(root, {settings: {...config, activityIntervalMs: 1000}, random});
    return {
        root, page, motion, frames, ticker,
        node: (name) => nodes.get(`data-activity-${name}`),
        tick(count = 1) {
            for (let n = 0; n < count; n++) {
                now += 100;
                const pending = [...frames.values()];
                frames.clear();
                for (const callback of pending) callback(now);
            }
        },
    };
}

function dispatch(target, type, properties = {}) {
    target.dispatchEvent(Object.assign(new Event(type), properties));
}

test("activity uses deposit, withdrawal, and win with masked IDs and currency amounts", () => {
    const items = getActivityItems({random: () => 0});
    assert.deepEqual([...new Set(items.map((item) => item.kind))], ["deposit", "withdrawal", "win"]);
    assert.deepEqual([...new Set(items.map((item) => item.secondary))], ["Deposit", "Withdrawal", "Win"]);
    assert.ok(new Set(items.map((item) => item.value)).size > 1);
    assert.ok(new Set(items.map((item) => item.primary)).size > 1);
    assert.ok(items.every((item) => /^\*{4}\d{2}$/.test(item.primary)));
    assert.ok(items.every((item) => /^₹[\d,]+$/.test(item.value)));
});

test("20 shuffled fictional usernames retain their masked IDs and avatars without adjacent repeats", () => {
    const first = getActivityItems({random: () => 0});
    const second = getActivityItems({random: () => 0.999999, previousUsername: first.at(-1).username});
    assert.equal(first.length, 20);
    assert.equal(new Set(first.map(item => item.username)).size, 20);
    const identifiers = new Map(first.map(item => [item.username, item.primary]));
    const avatars = new Map(first.map(item => [item.username, item.avatar]));
    assert.equal(new Set(avatars.values()).size, 9);
    assert.equal(new Set(identifiers.values()).size, 20);
    assert.notDeepEqual(first.map(item => item.username), second.map(item => item.username));
    for (const item of second) {
        assert.equal(item.primary, identifiers.get(item.username));
        assert.equal(item.avatar, avatars.get(item.username));
    }
    const combined = [...first, ...second];
    for (let index = 1; index < combined.length; index++) {
        assert.notEqual(combined[index].username, combined[index - 1].username);
    }
    const boundary = getActivityItems({random: () => 0, previousUsername: first[0].username});
    assert.notEqual(boundary[0].username, first[0].username, "a repeat at a loop boundary is skipped");
});

test("profiles keep the 16 male / 4 female ratio and use the supplied matching DPs", async () => {
    const items = getActivityItems();
    assert.equal(items.filter(item => item.gender === "male").length, 16);
    assert.equal(items.filter(item => item.gender === "female").length, 4);
    const femaleFiles = new Set(["img_4.png", "img_6.png", "img_8.png"]);
    const files = new Set();
    for (const item of items) {
        const filename = item.avatar.split("/").at(-1);
        assert.match(filename, /^img(?:_[1-8])?\.png$/);
        assert.equal(femaleFiles.has(filename), item.gender === "female", item.username);
        files.add(item.avatar);
    }
    for (const path of files) {
        const bytes = await readFile(new URL(`../${path}`, import.meta.url));
        assert.ok(bytes.length > 0, `${path} exists`);
    }
});

test("sample amounts include both range endpoints and only use 500-rupee steps", () => {
    const reachable = {deposit: new Set(), withdrawal: new Set(), win: new Set()};
    const ranges = {deposit: [500, 2000], withdrawal: [30000, 70000], win: [10000, 30000]};
    for (let sample = 0; sample <= 100; sample++) {
        const items = getActivityItems({random: () => sample / 101});
        for (const item of items) {
            const [minimum, maximum] = ranges[item.kind];
            assert.ok(item.amount >= minimum && item.amount <= maximum);
            assert.equal(item.amount % 500, 0);
            reachable[item.kind].add(item.amount);
        }
    }
    assert.deepEqual([...reachable.deposit], [500, 1000, 1500, 2000]);
    assert.deepEqual([...reachable.withdrawal], Array.from({length: 81}, (_, index) => 30000 + index * 500));
    assert.deepEqual([...reachable.win], Array.from({length: 41}, (_, index) => 10000 + index * 500));
});

test("each new rotation samples fresh amounts and pausing keeps the displayed amount stable", () => {
    let calls = 0;
    const drawsPerLoop = fixedItems.length * 2 - 1;
    const nextItems = getActivityItems({random: () => 0.999999, previousUsername: fixedItems.at(-1).username});
    const state = fixture({random: () => calls++ < drawsPerLoop ? 0 : 0.999999});
    assert.equal(state.node("value").textContent, "₹500");
    dispatch(state.root, "pointerenter", {pointerType: "mouse"});
    state.tick(50);
    assert.equal(calls, drawsPerLoop);
    assert.equal(state.node("value").textContent, "₹500");
    dispatch(state.root, "pointerleave");
    state.tick(fixedItems.length * 10 + 1);
    assert.equal(state.node("primary").textContent, nextItems[0].primary);
    assert.equal(state.node("username").textContent, nextItems[0].username);
    assert.equal(state.node("value").textContent, "₹2,000");
    assert.equal(state.node("sample").hidden, false);
    state.tick(10);
    assert.equal(state.node("secondary").textContent, "Withdrawal");
    assert.equal(state.node("value").textContent, "₹70,000");
    state.tick(10);
    assert.equal(state.node("secondary").textContent, "Win");
    assert.equal(state.node("value").textContent, "₹30,000");
    state.ticker.destroy();
});

test("ticker rotates actual wrapper bindings while retaining visible sample disclosure", () => {
    const state = fixture();
    assert.equal(state.node("sample").textContent, "Sample");
    assert.equal(state.node("sample").hidden, false);
    assert.equal(state.node("secondary").textContent, "Deposit");
    assert.equal(state.node("value").textContent, "₹500");
    assert.match(state.node("note").textContent, /fictional/);
    assert.equal(state.node("primary").textContent, fixedItems[0].primary);
    assert.equal(state.node("username").textContent, fixedItems[0].username);
    assert.equal(state.node("avatar-image").getAttribute("src"), fixedItems[0].avatar);
    state.tick(9);
    assert.equal(state.root.dataset.phase, "exiting");
    state.tick();
    assert.equal(state.root.dataset.phase, "away");
    assert.equal(state.node("primary").textContent, fixedItems[0].primary, "the old entry leaves before its replacement arrives");
    state.tick();
    assert.equal(state.root.dataset.phase, "entering");
    assert.equal(state.node("primary").textContent, fixedItems[1].primary);
    assert.equal(state.node("secondary").textContent, "Withdrawal");
    assert.equal(state.node("value").textContent, "₹30,000");
    assert.match(state.root.getAttribute("aria-label"), /fictional example/);
    const expected = [...fixedItems.slice(2), fixedItems[0]];
    for (const item of expected) {
        state.tick(10);
        assert.equal(state.node("primary").textContent, item.primary);
        assert.equal(state.node("username").textContent, item.username);
        assert.equal(state.node("avatar-image").getAttribute("src"), item.avatar);
        assert.equal(state.node("secondary").textContent, item.secondary);
        assert.equal(state.root.dataset.kind, item.kind);
        assert.equal(state.node("value").textContent, item.value);
        assert.equal(state.node("sample").hidden, false, "every example keeps its visible sample label");
        assert.match(state.root.getAttribute("aria-label"), /fictional example/);
        assert.ok(state.root.getAttribute("aria-label").includes(item.username));
    }
    state.ticker.destroy();
});

test("pointer, focus, and visibility pauses preserve independent pause reasons without controls", () => {
    const state = fixture();
    assert.equal(state.node("sample").hidden, false);
    state.tick(4);
    dispatch(state.root, "pointerenter", {pointerType: "mouse"});
    state.tick(20);
    assert.equal(state.node("primary").textContent, fixedItems[0].primary);
    assert.equal(state.frames.size, 0);
    assert.equal(state.root.dataset.phase, "visible");
    dispatch(state.root, "focusin");
    dispatch(state.root, "pointerleave");
    assert.equal(state.frames.size, 0, "focus still pauses after pointer leaves");
    dispatch(state.root, "focusout", {relatedTarget: state.node("primary")});
    assert.equal(state.frames.size, 0, "moving focus within the ticker stays paused");
    dispatch(state.root, "focusout", {relatedTarget: null});
    assert.equal(state.frames.size, 1);
    state.page.hidden = true;
    dispatch(state.page, "visibilitychange");
    state.tick(30);
    assert.equal(state.node("primary").textContent, fixedItems[0].primary);
    assert.equal(state.frames.size, 0);
    state.page.hidden = false;
    dispatch(state.page, "visibilitychange");
    state.tick(8);
    assert.equal(state.node("primary").textContent, fixedItems[1].primary);
    state.ticker.destroy();
});

test("focusing the capsule during its empty gap restores a readable card", () => {
    const state = fixture();
    state.tick(10);
    assert.equal(state.root.dataset.phase, "away");
    dispatch(state.root, "focusin");
    assert.equal(state.root.dataset.phase, "visible");
    assert.equal(state.root.dataset.paused, "true");
    state.tick(20);
    assert.equal(state.node("primary").textContent, fixedItems[0].primary);
    dispatch(state.root, "focusout", {relatedTarget: null});
    state.tick(2);
    assert.equal(state.root.dataset.phase, "entering");
    assert.equal(state.node("primary").textContent, fixedItems[1].primary);
    state.ticker.destroy();
});

test("reduced motion stays static and cleanup cancels frames and event handlers", () => {
    const state = fixture({reduced: true});
    assert.equal(state.frames.size, 0);
    assert.equal(state.root.dataset.paused, "true");
    assert.equal(state.root.dataset.phase, "visible");
    state.tick(40);
    assert.equal(state.node("primary").textContent, fixedItems[0].primary);
    state.motion.matches = false;
    dispatch(state.motion, "change");
    assert.equal(state.frames.size, 1);
    assert.equal(state.root.dataset.paused, "false");
    state.ticker.destroy();
    assert.equal(state.frames.size, 0);
    dispatch(state.page, "visibilitychange");
    dispatch(state.root, "pointerleave");
    dispatch(state.motion, "change");
    assert.equal(state.frames.size, 0);
});

