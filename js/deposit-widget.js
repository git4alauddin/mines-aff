/** A host-owned dialog that minimizes into its circular deposit-information control. */
export function mountDepositWidget(dialog, widget, prompt) {
    const page = widget.ownerDocument;
    let bounds;
    let ghost;
    let animation;
    let destroyed = false;

    function clearAnimation() {
        animation?.cancel();
        ghost?.remove();
    }

    function show() {
        if (destroyed) return;
        clearAnimation();
        widget.hidden = true;
        prompt.show();
        bounds = dialog.getBoundingClientRect();
    }

    function minimize() {
        if (destroyed) return;
        widget.hidden = false;
        const reduced = page.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
        if (!bounds || reduced || typeof widget.animate !== "function") return;
        const target = widget.getBoundingClientRect();
        clearAnimation();
        const panel = page.createElement("div");
        panel.className = "deposit-minimize-ghost";
        panel.textContent = "₹";
        panel.setAttribute("aria-hidden", "true");
        page.body.append(panel);
        ghost = panel;
        animation = panel.animate([
            {
                left: `${bounds.left}px`,
                top: `${bounds.top}px`,
                width: `${bounds.width}px`,
                height: `${bounds.height}px`,
                borderRadius: "4px",
                opacity: .5
            },
            {
                left: `${target.left}px`,
                top: `${target.top}px`,
                width: `${target.width}px`,
                height: `${target.height}px`,
                borderRadius: "50%",
                opacity: 0
            },
        ], {duration: 420, easing: "cubic-bezier(.2,.75,.25,1)", fill: "both"});
        animation.finished.then(() => panel.remove()).catch(() => {
        });
    }

    widget.addEventListener("click", show);
    dialog.addEventListener("close", minimize);
    return {
        show,
        destroy() {
            destroyed = true;
            clearAnimation();
            widget.removeEventListener("click", show);
            dialog.removeEventListener("close", minimize);
        },
    };
}

