/** Add pointer dragging without consuming normal mouse, touch, or keyboard clicks. */
globalThis.mountDraggableWidget = function mountDraggableWidget(button, {boundsElement} = {}) {
    const view = button.ownerDocument.defaultView;
    const page = button.ownerDocument;
    const viewport = view.visualViewport;
    const originalPosition = Object.fromEntries(["left", "top", "right", "bottom"].map(key => [key, button.style[key]]));
    let gesture;
    let position;
    let size;
    let suppressClick = false;
    let resizePending = false;
    let resizeFrame;
    let pendingTap;
    let lateTap;
    let tapCleanupTimer;
    let activatingFallback = false;
    let destroyed = false;

    function pointerClick(event) {
        return event.detail > 0 || !!event.pointerType || (typeof event.pointerId === 'number' && event.pointerId >= 0);
    }

    function clearTap() {
        if (pendingTap) view.clearTimeout?.(pendingTap.timer);
        pendingTap = undefined;
        lateTap = undefined;
        view.clearTimeout?.(tapCleanupTimer);
    }

    function nativeClick(event) {
        if (activatingFallback) return;
        if (lateTap && pointerClick(event)) {
            const samePointer = event.pointerId === lateTap.id && event.pointerId >= 0;
            const samePoint = Math.hypot(event.clientX - lateTap.x, event.clientY - lateTap.y) < 24;
            if (samePointer || samePoint) {
                event.preventDefault();
                event.stopImmediatePropagation();
                clearTap();
                return;
            }
        }
        if (event.target === button) clearTap();
    }

    function awaitNativeTap(event) {
        if (!view.setTimeout) return;
        const tap = {id:event.pointerId, x:event.clientX, y:event.clientY};
        pendingTap = tap;
        // Give the native click first priority. Some mobile engines omit the
        // first click after a drag; only that missing click needs a fallback.
        tap.timer = view.setTimeout(() => {
            if (pendingTap !== tap || destroyed || button.hidden || button.disabled || button.isConnected === false) return;
            pendingTap = undefined;
            lateTap = tap;
            tapCleanupTimer = view.setTimeout(() => {lateTap = undefined;}, 1000);
            activatingFallback = true;
            try {button.click();} finally {activatingFallback = false;}
        }, 180);
    }

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
        const css = bounds ? null : view.getComputedStyle?.(button);
        const inset = side => Math.max(16, Number.parseFloat(css?.getPropertyValue(`--floating-safe-${side}`)) || 0);
        const minX = left + Math.min(inset('left'), Math.max(0, (width - size.width) / 2));
        const minY = top + Math.min(inset('top'), Math.max(0, (height - size.height) / 2));
        const rightGap = Math.min(inset('right'), Math.max(0, (width - size.width) / 2));
        const bottomGap = Math.min(inset('bottom'), Math.max(0, (height - size.height) / 2));
        position = {
            x: Math.max(minX, Math.min(x, left + width - size.width - rightGap)),
            y: Math.max(minY, Math.min(y, top + height - size.height - bottomGap)),
        };
        button.style.left = `${position.x - (bounds?.left ?? 0)}px`;
        button.style.top = `${position.y - (bounds?.top ?? 0)}px`;
        button.style.right = "auto";
        button.style.bottom = "auto";
    }

    function start(event) {
        if (gesture || button.hidden || button.disabled || event.button !== 0 || event.isPrimary === false) return;
        clearTap();
        suppressClick = false;
        button.setAttribute("data-drag-pressed", "true");
        const rect = measure();
        gesture = {id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, dragged: false, slop: event.pointerType === 'mouse' ? 6 : 10};
        // Capture may be unavailable or rejected during a viewport transition.
        // Window listeners below keep that gesture usable without synthetic taps.
        try {button.setPointerCapture?.(event.pointerId);} catch {}
    }

    function move(event) {
        if (!gesture || event.pointerId !== gesture.id) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (!gesture.dragged && Math.hypot(dx, dy) < gesture.slop) return;
        gesture.dragged = true;
        button.setAttribute("data-dragging", "true");
        place(gesture.left + dx, gesture.top + dy);
        // touch-action:none handles touch/pen scrolling without cancelling
        // their compatibility mouse sequence on the following tap.
        if (event.pointerType === 'mouse') event.preventDefault();
    }

    function finish(event) {
        if (!gesture || (event && event.pointerId !== gesture.id)) return;
        if (event?.type === "pointerup") move(event);
        const previous = gesture;
        gesture = undefined;
        suppressClick = previous.dragged || event?.type !== 'pointerup';
        button.removeAttribute("data-drag-pressed");
        button.removeAttribute("data-dragging");
        // Pointer-up releases capture natively, preserving touch click synthesis.
        if (event?.type !== 'pointerup' && button.hasPointerCapture?.(previous.id)) {
            try {button.releasePointerCapture(previous.id);} catch {}
        }
        // A tap uses the browser's native click. Opening a modal from pointerup
        // retargets the following touch click to its backdrop and closes it.
        if (event?.type === 'pointerup' && ['touch','pen'].includes(event.pointerType) && !previous.dragged) awaitNativeTap(event);
        if (resizePending) {
            if (view.requestAnimationFrame) resizeFrame = view.requestAnimationFrame(resize);
            else resize();
        }
    }

    function click(event) {
        // Some touch/pen clicks have detail=0 too; distinguish them from keys.
        if (!activatingFallback) clearTap();
        if (!suppressClick || !pointerClick(event)) return;
        suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    function resize() {
        resizeFrame = undefined;
        if (gesture) {resizePending = true; return;}
        resizePending = false;
        if (!position) return;
        measure();
        place(position.x, position.y);
    }

    function blur() { clearTap(); finish(); }
    function moveOutside(event) {if (event.target !== button) move(event);}
    function finishOutside(event) {if (event.target !== button) finish(event);}

    button.setAttribute("data-draggable-floating", "true");
    button.addEventListener("pointerdown", start);
    button.addEventListener("pointermove", move);
    button.addEventListener("pointerup", finish);
    button.addEventListener("pointercancel", finish);
    button.addEventListener("lostpointercapture", finish);
    button.addEventListener("click", click, {capture: true});
    page.addEventListener?.('pointerdown', clearTap, {capture:true});
    page.addEventListener?.('click', nativeClick, {capture:true});
    view.addEventListener("resize", resize);
    view.addEventListener("blur", blur);
    view.addEventListener('pointermove', moveOutside, {passive:false});
    view.addEventListener('pointerup', finishOutside);
    view.addEventListener('pointercancel', finishOutside);
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    return {
        destroy() {
            destroyed = true;
            clearTap();
            finish();
            if (resizeFrame !== undefined) view.cancelAnimationFrame?.(resizeFrame);
            button.removeAttribute("data-draggable-floating");
            Object.assign(button.style, originalPosition);
            button.removeEventListener("pointerdown", start);
            button.removeEventListener("pointermove", move);
            button.removeEventListener("pointerup", finish);
            button.removeEventListener("pointercancel", finish);
            button.removeEventListener("lostpointercapture", finish);
            button.removeEventListener("click", click, {capture: true});
            page.removeEventListener?.('pointerdown', clearTap, {capture:true});
            page.removeEventListener?.('click', nativeClick, {capture:true});
            view.removeEventListener("resize", resize);
            view.removeEventListener("blur", blur);
            view.removeEventListener('pointermove', moveOutside);
            view.removeEventListener('pointerup', finishOutside);
            view.removeEventListener('pointercancel', finishOutside);
            viewport?.removeEventListener("resize", resize);
            viewport?.removeEventListener("scroll", resize);
        },
    };
};
