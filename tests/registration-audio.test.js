import test from "node:test";
import assert from "node:assert/strict";
import {mountRegistrationAudio} from "../js/registration-audio.js";

const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture({play = () => Promise.resolve(), hidden = false} = {}) {
    const page = new EventTarget();
    page.hidden = hidden;
    const audio = new EventTarget();
    let plays = 0;
    let pauses = 0;
    audio.play = () => { plays++; return play(); };
    audio.pause = () => { pauses++; };
    const toolbar = {dataset: {}, hidden: true};
    const button = new EventTarget();
    const dialogStop = new EventTarget();
    const status = {};
    const close = new EventTarget();
    const claim = new EventTarget();
    const nodes = {"registration-audio": audio, "guidance-toolbar": toolbar,
        "guidance-toggle": button, "guidance-stop": dialogStop, "guidance-status": status,
        "dismiss-deposit": close, "deposit-claim": claim};
    page.querySelector = selector => nodes[selector.slice(6, -1)];
    const guidance = mountRegistrationAudio(page);
    return {page, audio, toolbar, button, dialogStop, status, close, claim, guidance,
        get plays() { return plays; }, get pauses() { return pauses; }};
}

test("entry stays silent; Close starts playback synchronously and ending offers manual replay", async () => {
    const state = fixture();
    assert.equal(state.plays, 0);
    state.close.dispatchEvent(new Event("click"));
    assert.equal(state.plays, 1);
    await flush();
    assert.equal(state.toolbar.hidden, false);
    assert.equal(state.toolbar.dataset.state, "playing");
    assert.equal(state.button.textContent, "Stop guidance");
    assert.equal(state.dialogStop.hidden, false, "stop remains available in the modal");
    state.audio.dispatchEvent(new Event("ended"));
    assert.equal(state.button.textContent, "Replay guidance");
    assert.equal(state.dialogStop.hidden, true);
    assert.equal(state.plays, 1);
    state.audio.currentTime = 5;
    state.button.dispatchEvent(new Event("click"));
    await flush();
    assert.equal(state.plays, 2);
    assert.equal(state.audio.currentTime, 0);
    state.dialogStop.dispatchEvent(new Event("click"));
    assert.equal(state.toolbar.dataset.state, "ready");
    assert.equal(state.pauses, 1);
    state.guidance.destroy();
});

test("denied playback keeps a working manual fallback without automatic retries", async () => {
    let blocked = true;
    const state = fixture({play: () => blocked
        ? Promise.reject(new DOMException("User activation required", "NotAllowedError")) : Promise.resolve()});
    state.claim.dispatchEvent(new Event("click"));
    await flush();
    assert.equal(state.toolbar.dataset.state, "blocked");
    assert.equal(state.button.textContent, "Play guidance");
    assert.equal(state.button.disabled, false);
    assert.match(state.status.textContent, /Tap Play guidance/);
    assert.equal(state.plays, 1);
    blocked = false;
    state.button.dispatchEvent(new Event("click"));
    await flush();
    assert.equal(state.plays, 2);
    assert.equal(state.toolbar.dataset.state, "playing");
    state.guidance.destroy();
});

test("hiding or leaving stops pending audio and stale promises cannot restart its state", async () => {
    let resolvePlay;
    const state = fixture({play: () => new Promise(resolve => { resolvePlay = resolve; })});
    state.claim.dispatchEvent(new Event("click"));
    assert.equal(state.toolbar.dataset.state, "loading");
    state.page.hidden = true;
    state.page.dispatchEvent(new Event("visibilitychange"));
    assert.equal(state.pauses, 1);
    resolvePlay();
    await flush();
    assert.equal(state.toolbar.dataset.state, "ready");
    state.page.hidden = false;
    state.page.dispatchEvent(new Event("visibilitychange"));
    assert.equal(state.plays, 1, "returning to the tab never replays the clip");
    state.button.dispatchEvent(new Event("click"));
    state.guidance.destroy();
    resolvePlay();
    await flush();
    assert.equal(state.toolbar.dataset.state, "loading", "destroyed UI is not updated");
    const plays = state.plays;
    const pauses = state.pauses;
    state.button.dispatchEvent(new Event("click"));
    state.dialogStop.dispatchEvent(new Event("click"));
    state.close.dispatchEvent(new Event("click"));
    state.claim.dispatchEvent(new Event("click"));
    state.audio.dispatchEvent(new Event("error"));
    state.page.hidden = true;
    state.page.dispatchEvent(new Event("visibilitychange"));
    assert.equal(state.plays, plays);
    assert.equal(state.pauses, pauses, "cleanup releases every handler");
});

test("Claim starts guidance synchronously once; repeated popup actions never restart it", async () => {
    const state = fixture();
    const click = new Event("click", {cancelable: true});
    state.claim.dispatchEvent(click);
    assert.equal(state.plays, 1, "play runs inside the gesture, before its promise resolves");
    assert.equal(click.defaultPrevented, false, "audio leaves Claim navigation intact");
    state.close.dispatchEvent(new Event("click"));
    state.claim.dispatchEvent(new Event("click"));
    assert.equal(state.plays, 1, "rapid popup actions do not overlap playback");
    await flush();
    state.audio.currentTime = 3;
    state.close.dispatchEvent(new Event("click"));
    assert.equal(state.audio.currentTime, 3, "playing guidance is not rewound");
    state.audio.dispatchEvent(new Event("ended"));
    state.claim.dispatchEvent(new Event("click"));
    assert.equal(state.plays, 1, "reopening and claiming does not replay finished guidance");
    state.guidance.destroy();
});

test("manual playback consumes the initial guidance; modified Claim clicks do not start it", async () => {
    const state = fixture();
    state.claim.dispatchEvent(Object.assign(new Event("click"), {ctrlKey: true}));
    const prevented = new Event("click", {cancelable: true});
    prevented.preventDefault();
    state.claim.dispatchEvent(prevented);
    assert.equal(state.plays, 0);
    state.button.dispatchEvent(new Event("click"));
    await flush();
    state.dialogStop.dispatchEvent(new Event("click"));
    state.close.dispatchEvent(new Event("click"));
    state.claim.dispatchEvent(new Event("click"));
    assert.equal(state.plays, 1);
    state.guidance.destroy();
});

test("hidden entry waits for a click; missing or undecodable audio fails gracefully", async () => {
    const state = fixture({hidden: true, play: () => Promise.reject(new DOMException("Cannot decode", "NotSupportedError"))});
    assert.equal(state.plays, 0);
    state.button.dispatchEvent(new Event("click"));
    await flush();
    assert.equal(state.toolbar.dataset.state, "error");
    assert.equal(state.button.disabled, true);
    assert.equal(state.button.textContent, "Audio unavailable");
    assert.match(state.status.textContent, /unavailable/);
    state.guidance.destroy();
});

