import {config} from "./config.js";
import {playAccessSequence} from "./animations.js";
import {mountDepositPrompt} from "./deposit-prompt.js";
import {mountDepositWidget} from "./deposit-widget.js";

export function schedulePromotion(delayMs, callback) {
    return playAccessSequence({
        timing: {fillMs: Math.max(1, delayMs), holdMs: 0, unlockMs: 0},
        onUpdate() {
        },
        onComplete: callback,
    });
}

/** Own the promotional layer; do not inspect DmFirst's document or account state. */
export function mountRegistrationFlow(page, settings = config, schedule = schedulePromotion) {
    const frame = page.querySelector("#dmfirst-frame");
    const dialog = page.querySelector("#deposit-dialog");
    const widget = page.querySelector("[data-deposit-widget]");
    const claim = dialog.querySelector("[data-deposit-claim]");
    const prompt = mountDepositPrompt(dialog, settings);
    const floating = mountDepositWidget(dialog, widget, prompt);
    let destroyed = false;
    let waitingDialog;

    function showPromotion() {
        if (destroyed) return;
        const activeDialog = page.querySelector("dialog[open]");
        if (activeDialog && activeDialog !== dialog) {
            waitingDialog = activeDialog;
            waitingDialog.addEventListener("close", resumePromotion, {once: true});
            return;
        }
        floating.show();
    }

    function resumePromotion() {
        waitingDialog = null;
        showPromotion();
    }

    if (frame.getAttribute("src") !== settings.registerUrl) frame.src = settings.registerUrl;
    // A marketing delay, not an indication that registration succeeded.
    const cancelPromotion = schedule(settings.popupDelayMs, showPromotion);

    function cancelPendingPromotion() {
        cancelPromotion();
        waitingDialog?.removeEventListener("close", resumePromotion);
        waitingDialog = null;
    }

    function claimClicked(event) {
        if (event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        cancelPendingPromotion();
        prompt.close();
        frame.src = settings.depositUrl;
        frame.title = "DmFirst wallet recharge";
    }

    claim.addEventListener("click", claimClicked);
    return {
        destroy() {
            destroyed = true;
            cancelPendingPromotion();
            claim.removeEventListener("click", claimClicked);
            floating.destroy();
            prompt.destroy();
        },
    };
}
