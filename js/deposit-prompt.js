import {config} from "./config.js";

/** Mount on an authorized host page; showing it does not authenticate an account. */
export function mountDepositPrompt(dialog, settings = config) {
    if (!Number.isFinite(settings.minimumDeposit) || settings.minimumDeposit <= 0) {
        throw new RangeError("A positive minimum deposit is required.");
    }
    const formatter = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: settings.depositCurrency,
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
    });
    const amount = formatter.format(settings.minimumDeposit);
    dialog.querySelectorAll("[data-deposit-amount]").forEach((element) => {
        element.textContent = amount;
    });
    dialog.querySelector("[data-deposit-currency]").textContent = settings.depositCurrency === "INR"
        ? "INDIAN RUPEES · INR" : settings.depositCurrency;
    dialog.querySelector("[data-deposit-currency-code]").textContent = settings.depositCurrency;
    dialog.querySelector("[data-deposit-minimum-label]").textContent = `${amount} MINIMUM`;

    const claim = dialog.querySelector("[data-deposit-claim]");
    claim.href = settings.depositUrl;
    const dismiss = dialog.querySelector("[data-dismiss-deposit]");
    const copySection = dialog.querySelector("[data-copy-code-section]");
    const copyButton = dialog.querySelector("[data-copy-code-demo]");
    const copyLabel = dialog.querySelector("[data-copy-code-label]");
    const copyIcon = dialog.querySelector("[data-copy-code-icon]");
    const copyCheck = dialog.querySelector("[data-copy-code-check]");
    const copyText = {...config.copyCodeDemo, ...settings.copyCodeDemo};
    if (copyButton) {
        dialog.querySelector("[data-copy-code-heading]").textContent = copyText.heading;
        dialog.querySelector("[data-copy-code-caption]").textContent = copyText.caption;
    }
    let copyTimer;
    let hasClaimed = false;
    if (copySection) copySection.hidden = true;

    function recordClaim(event) {
        if (!dialog.open || event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        // This records a Claim click only, not a completed deposit.
        hasClaimed = true;
    }

    function resetCopyDemo() {
        clearTimeout(copyTimer);
        copyTimer = undefined;
        if (!copyButton) return;
        copyButton.disabled = false;
        copyLabel.textContent = copyText.buttonText;
        copyIcon.hidden = false;
        copyCheck.hidden = true;
    }

    function playCopyDemo() {
        if (!dialog.open || copySection?.hidden || copyTimer !== undefined) return;
        copyButton.disabled = true;
        copyLabel.textContent = copyText.loadingText;
        // Visual feedback only: no access code is read or copied.
        copyTimer = setTimeout(() => {
            copyLabel.textContent = copyText.completeText;
            copyIcon.hidden = true;
            copyCheck.hidden = false;
            copyButton.disabled = false;
            copyTimer = setTimeout(resetCopyDemo, 1800);
        }, 600);
    }

    function onDialogClose() {
        // Ignore a queued close event if the dialog has already reopened.
        if (!dialog.open) resetCopyDemo();
    }

    resetCopyDemo();

    function close() {
        resetCopyDemo();
        if (dialog.open) dialog.close();
    }

    function backdropClick(event) {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }

    dismiss.addEventListener("click", close);
    dialog.addEventListener("click", backdropClick);
    dialog.addEventListener("close", onDialogClose);
    copyButton?.addEventListener("click", playCopyDemo);
    claim.addEventListener("click", recordClaim);

    return {
        show() {
            if (!dialog.open) {
                resetCopyDemo();
                if (copySection) copySection.hidden = !hasClaimed;
                dialog.showModal();
                dialog.querySelector("[data-deposit-heading]").focus();
            }
        },
        close,
        destroy() {
            close();
            dismiss.removeEventListener("click", close);
            dialog.removeEventListener("click", backdropClick);
            dialog.removeEventListener("close", onDialogClose);
            copyButton?.removeEventListener("click", playCopyDemo);
            claim.removeEventListener("click", recordClaim);
        },
    };
}
