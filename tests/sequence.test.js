import test from "node:test";
import assert from "node:assert/strict";
import {getSequenceState} from "../js/animations.js";
import {config} from "../js/config.js";

const timing = config.sequence;
const unlockStart = timing.fillMs + timing.holdMs;
const redirectAt = unlockStart + timing.unlockMs;

test("the lock stays closed and redirection is disabled while the bar fills", () => {
    assert.deepEqual(getSequenceState(0, timing), {progress: 0, stage: "locked", redirectReady: false});
    const almostDone = getSequenceState(timing.fillMs - 1, timing);
    assert.ok(almostDone.progress < 100);
    assert.equal(almostDone.stage, "locked");
    assert.equal(almostDone.redirectReady, false);
});
test("100% is briefly held before redirecting directly", () => {
    assert.deepEqual(getSequenceState(timing.fillMs, timing), {progress: 100, stage: "complete", redirectReady: false});
    assert.equal(getSequenceState(unlockStart - 1, timing).stage, "complete");
    assert.deepEqual(getSequenceState(unlockStart, timing), {progress: 100, stage: "unlocked", redirectReady: true});
});
test("redirection waits until the entire lock-opening interval finishes", () => {
    assert.equal(getSequenceState(redirectAt - 1, timing).redirectReady, false);
    assert.deepEqual(getSequenceState(redirectAt, timing), {progress: 100, stage: "unlocked", redirectReady: true});
    assert.equal(getSequenceState(redirectAt + 1000, timing).progress, 100);
});
test("progress never goes backwards or leaves its accessible bounds", () => {
    let previous = 0;
    for (let elapsed = -100; elapsed <= redirectAt + 100; elapsed += 17) {
        const {progress} = getSequenceState(elapsed, timing);
        assert.ok(progress >= previous && progress <= 100);
        previous = progress;
    }
});
test("the registration destination preserves the exact referral invitation", () => {
    const destination = new URL(config.registerUrl);
    assert.equal(destination.origin, "https://www.dmfirst0.com");
    assert.equal(destination.hash, "#/register?invitationCode=93458117528");
});
