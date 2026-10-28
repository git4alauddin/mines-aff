/** Add pointer dragging without consuming normal mouse, touch, or keyboard clicks. */
globalThis.mountDraggableWidget = function mountDraggableWidget(button, {boundsElement} = {}) {
    const view = button.ownerDocument.defaultView;
    const viewport = view.visualViewport;
    const originalPosition = Object.fromEntries(["left", "top", "right", "bottom"].map(key => [key, button.style[key]]));
    let gesture;
    let position;
    let size;
    let suppressClick = false;

    function measure() {
        const rect = button.getBoundingClientRect();
        if (rect.width && rect.height) size = {width: rect.width, height: rect.height};
        return rect;
    }

    function place(x, y) {
        const bounds = boundsElement?.getBoundingClientRect();
        const left = bounds?.left ?? viewport?.offsetLeft ?? 0;
        const top = bounds?.top ?? viewport?.offsetTop ?? 0;
        const width = bounds?.width ?? viewport?.width ?? view.innerWidth;
        const height = bounds?.height ?? viewport?.height ?? view.innerHeight;
        const minX = left + Math.min(16, Math.max(0, (width - size.width) / 2));
        const minY = top + Math.min(16, Math.max(0, (height - size.height) / 2));
        position = {
            x: Math.max(minX, Math.min(x, left + width - size.width - (minX - left))),
            y: Math.max(minY, Math.min(y, top + height - size.height - (minY - top))),
        };
        button.style.left = `${position.x - (bounds?.left ?? 0)}px`;
        button.style.top = `${position.y - (bounds?.top ?? 0)}px`;
        button.style.right = "auto";
        button.style.bottom = "auto";
    }

    function start(event) {
        if (gesture || button.hidden || button.disabled || event.button !== 0 || event.isPrimary === false) return;
        suppressClick = false;
        button.setAttribute("data-drag-pressed", "true");
        const rect = measure();
        gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, dragged: false};
        button.setPointerCapture(event.pointerId);
    }

    function move(event) {
        if (!gesture || event.pointerId !== gesture.id) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (!gesture.dragged && Math.hypot(dx, dy) < 6) return;
        gesture.dragged = true;
        button.setAttribute("data-dragging", "true");
        place(gesture.left + dx, gesture.top + dy);
        event.preventDefault();
    }

    function finish(event) {
        if (!gesture || (event && event.pointerId !== gesture.id)) return;
        if (event?.type === "pointerup") move(event);
        const previous = gesture;
        gesture = undefined;
        suppressClick = previous.dragged;
        button.removeAttribute("data-drag-pressed");
        button.removeAttribute("data-dragging");
        // Pointer-up releases capture natively, preserving touch click synthesis.
        if (event?.type !== "pointerup" && button.hasPointerCapture(previous.id)) button.releasePointerCapture(previous.id);
        if (event?.type === "pointerup" && event.pointerType === "touch" && !previous.dragged) {
            // Some browsers swallow the first compatibility click after a touch drag.
            // Activate a tap once here and suppress any later native pointer click.
            suppressClick = true;
            event.preventDefault();
            button.click();
        }
    }

    function click(event) {
        // Keyboard activation has detail=0 and should always keep working.
        if (!suppressClick || event.detail === 0) return;
        suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    function resize() {
        finish();
        if (!position) return;
        measure();
        place(position.x, position.y);
    }

    function blur() { finish(); }

    button.setAttribute("data-draggable-floating", "true");
    button.addEventListener("pointerdown", start);
    button.addEventListener("pointermove", move);
    button.addEventListener("pointerup", finish);
    button.addEventListener("pointercancel", finish);
    button.addEventListener("lostpointercapture", finish);
    button.addEventListener("click", click, {capture: true});
    view.addEventListener("resize", resize);
    view.addEventListener("blur", blur);
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    return {
        destroy() {
            finish();
            button.removeAttribute("data-draggable-floating");
            Object.assign(button.style, originalPosition);
            button.removeEventListener("pointerdown", start);
            button.removeEventListener("pointermove", move);
            button.removeEventListener("pointerup", finish);
            button.removeEventListener("pointercancel", finish);
            button.removeEventListener("lostpointercapture", finish);
            button.removeEventListener("click", click, {capture: true});
            view.removeEventListener("resize", resize);
            view.removeEventListener("blur", blur);
            viewport?.removeEventListener("resize", resize);
            viewport?.removeEventListener("scroll", resize);
        },
    };
};
