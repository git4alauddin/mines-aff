/** Start guidance once from Close or Claim; keep manual playback and replay available. */
export function mountRegistrationAudio(page) {
    const audio = page.querySelector("[data-registration-audio]");
    const toolbar = page.querySelector("[data-guidance-toolbar]");
    const button = page.querySelector("[data-guidance-toggle]");
    const dialogStop = page.querySelector("[data-guidance-stop]");
    const status = page.querySelector("[data-guidance-status]");
    const popupActions = [page.querySelector("[data-dismiss-deposit]"), page.querySelector("[data-deposit-claim]")];
    let state = "ready";
    let requestId = 0;
    let destroyed = false;
    let hasStarted = false;

    function render(next) {
        state = next;
        toolbar.dataset.state = next;
        const active = next === "playing" || next === "loading";
        button.textContent = active ? "Stop guidance" : next === "ended" ? "Replay guidance"
            : next === "error" ? "Audio unavailable" : "Play guidance";
        button.disabled = next === "error";
        dialogStop.hidden = !active;
        status.textContent = next === "blocked" ? "Tap Play guidance to hear the registration instructions."
            : next === "error" ? "Voice guidance is unavailable."
                : next === "playing" ? "Registration guidance is playing."
                    : next === "ended" ? "Registration guidance finished." : "";
    }

    function stop() {
        requestId++;
        audio.pause();
        if (!destroyed) render("ready");
    }

    async function play() {
        hasStarted = true;
        const request = ++requestId;
        render("loading");
        try {
            audio.currentTime = 0;
            await audio.play();
            if (!destroyed && request === requestId) render("playing");
        } catch (error) {
            if (!destroyed && request === requestId) {
                hasStarted = false;
                render(error.name === "NotAllowedError" ? "blocked" : "error");
            }
        }
    }

    function popupAction(event) {
        if (destroyed || hasStarted || page.hidden || state === "error" || event.defaultPrevented
            || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        // Call play inside the click handler, before any asynchronous work loses user activation.
        void play();
    }

    function toggle() {
        if (state === "playing" || state === "loading") stop();
        else void play();
    }

    function ended() {
        requestId++;
        render("ended");
    }

    function failed() {
        stop();
        render("error");
    }

    function visibilityChanged() {
        if (page.hidden && (state === "playing" || state === "loading")) stop();
    }

    button.addEventListener("click", toggle);
    popupActions.forEach(action => action.addEventListener("click", popupAction));
    dialogStop.addEventListener("click", stop);
    audio.addEventListener("ended", ended);
    audio.addEventListener("error", failed);
    page.addEventListener("visibilitychange", visibilityChanged);
    toolbar.hidden = false;
    render("ready");
    if (audio.error) failed();

    return {
        destroy() {
            destroyed = true;
            stop();
            button.removeEventListener("click", toggle);
            popupActions.forEach(action => action.removeEventListener("click", popupAction));
            dialogStop.removeEventListener("click", stop);
            audio.removeEventListener("ended", ended);
            audio.removeEventListener("error", failed);
            page.removeEventListener("visibilitychange", visibilityChanged);
        },
    };
}

