/** Deterministic sequence: fill completely, hold, unlock, then hand off. */
export function getSequenceState(elapsedMs, timing) {
    const fillEnd = timing.fillMs;
    const unlockStart = fillEnd + timing.holdMs;
    const unlockEnd = unlockStart + timing.unlockMs;
    const fraction = Math.max(0, Math.min(elapsedMs / fillEnd, 1));
    // Reserve 100 for actual completion, including the frame just before the end.
    const progress = fraction === 1 ? 100 : Math.min(99, Math.floor((1 - (1 - fraction) ** 1.35) * 100));
    const stage = elapsedMs < fillEnd ? "locked"
        : elapsedMs < unlockStart ? "complete"
            : elapsedMs < unlockEnd ? "unlocking" : "unlocked";
    return {progress, stage, redirectReady: elapsedMs >= unlockEnd};
}

/** Count visible time so a backgrounded tab never skips the opening scene. */
export function playAccessSequence({timing, onUpdate, onComplete}) {
    let elapsed = 0;
    let previousTime = null;
    let frameId;
    let stopped = false;

    function visibilityChanged() {
        previousTime = null;
    }

    document.addEventListener("visibilitychange", visibilityChanged);

    function stop() {
        stopped = true;
        cancelAnimationFrame(frameId);
        document.removeEventListener("visibilitychange", visibilityChanged);
    }

    function frame(now) {
        if (stopped) return;
        if (!document.hidden) {
            // A stalled frame must not jump past the visible 100% and unlock stages.
            if (previousTime !== null) elapsed += Math.min(now - previousTime, 100);
            previousTime = now;
            const state = getSequenceState(elapsed, timing);
            onUpdate(state);
            if (state.redirectReady) {
                stop();
                onComplete();
                return;
            }
        } else previousTime = null;
        frameId = requestAnimationFrame(frame);
    }

    onUpdate(getSequenceState(0, timing));
    frameId = requestAnimationFrame(frame);
    return stop;
}

/** Low-frame-rate decorative code rain. No network, libraries, or tracking. */
export function startCodeRain(canvas) {
    const context = canvas.getContext("2d");
    if (!context) return () => {
    };
    const glyphs = "01アイウエカキサシスセソタチツテナニヌネノ<>/{}";
    const fontSize = 13;
    let columns = [];
    let width = 0;
    let height = 0;
    let lastDraw = 0;
    let frameId;
    let stopped = false;

    function resize() {
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.round(width * pixelRatio);
        canvas.height = Math.round(height * pixelRatio);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.font = `${fontSize}px monospace`;
        columns = Array.from({length: Math.ceil(width / 21)}, () => Math.random() * -80);
        context.fillStyle = "#020805";
        context.fillRect(0, 0, width, height);
    }

    function draw(now) {
        if (stopped) return;
        if (!document.hidden && now - lastDraw > 80) {
            context.fillStyle = "rgba(2, 8, 5, 0.10)";
            context.fillRect(0, 0, width, height);
            columns.forEach((position, index) => {
                context.fillStyle = index % 7 === 0 ? "#68d96e" : "#247b39";
                context.fillText(glyphs[Math.floor(Math.random() * glyphs.length)], index * 21, position * fontSize);
                columns[index] += .55;
                if (position * fontSize > height && Math.random() > .975) columns[index] = Math.random() * -25;
            });
            lastDraw = now;
        }
        frameId = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    frameId = requestAnimationFrame(draw);
    return () => {
        stopped = true;
        cancelAnimationFrame(frameId);
        window.removeEventListener("resize", resize);
        context.clearRect(0, 0, width, height);
    };
}

