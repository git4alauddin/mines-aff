import test from "node:test";
import assert from "node:assert/strict";
import {mountDraggableWidget} from "../js/draggable-widget.js";

function fixture(options = {}) {
    const view = new EventTarget();
    const page = new EventTarget();
    page.defaultView = view;
    let time = 0, timerId = 0;
    const timers = new Map();
    view.setTimeout = (callback, delay) => {const id=++timerId;timers.set(id,{callback,at:time+delay});return id;};
    view.clearTimeout = id => timers.delete(id);
    function advance(ms) {time+=ms;for(const [id,timer] of [...timers])if(timer.at<=time){timers.delete(id);timer.callback();}}
    Object.assign(view, {innerWidth: 390, innerHeight: 844});
    const viewport = new EventTarget();
    Object.assign(viewport, {width: 390, height: 844, offsetLeft: 0, offsetTop: 0});
    view.visualViewport = viewport;
    const button = new EventTarget();
    const attributes = new Map();
    const captures = new Set();
    Object.assign(button, {
        ownerDocument: page, hidden: false, disabled: false, isConnected: true,
        style: {left: "", top: "", right: "", bottom: ""},
        setAttribute: (key, value) => attributes.set(key, value),
        removeAttribute: key => attributes.delete(key),
        setPointerCapture: id => captures.add(id),
        hasPointerCapture: id => captures.has(id),
        releasePointerCapture: id => captures.delete(id),
        getBoundingClientRect: () => ({left: parseFloat(button.style.left) || 315, top: parseFloat(button.style.top) || 769, width: 58, height: 58}),
    });
    const controller = mountDraggableWidget(button, options);
    button.click = () => click(0);
    let opens = 0;
    button.addEventListener("click", () => opens++);
    function pointer(type, x, y, options = {}) {
        const event = Object.assign(new Event(type, {cancelable: true}), {
            pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, clientX: x, clientY: y, ...options,
        });
        button.dispatchEvent(event);
        if (type === "pointerup" || type === "pointercancel") captures.delete(event.pointerId);
        return event;
    }
    function click(detail = 1, options = {}) {
        const event = Object.assign(new Event("click", {cancelable: true}), {detail, ...options});
        button.dispatchEvent(event);
        return event;
    }
    return {button, view, page, viewport, attributes, captures, controller, pointer, click, advance, get opens() {return opens;}};
}

test("small pointer movement remains a click; a drag moves without opening", () => {
    const state = fixture();
    state.pointer("pointerdown", 344, 798);
    state.pointer("pointermove", 346, 799);
    state.pointer("pointerup", 346, 799);
    assert.equal(state.click().defaultPrevented, false);
    assert.equal(state.opens, 1);
    assert.equal(state.button.style.left, "");
    state.pointer("pointerdown", 344, 798);
    assert.equal(state.captures.has(1), true);
    assert.equal(state.pointer("pointermove", 200, 400).defaultPrevented, true);
    assert.equal(state.button.style.left, "171px");
    assert.equal(state.button.style.top, "371px");
    state.pointer("pointerup", 200, 400);
    assert.equal(state.captures.size, 0);
    assert.equal(state.attributes.has("data-dragging"), false);
    assert.equal(state.click().defaultPrevented, true);
    assert.equal(state.opens, 1);
    state.pointer("pointerdown", 200, 400);
    state.pointer("pointerup", 200, 400);
    state.click();
    assert.equal(state.opens, 2, "a new tap opens normally after dragging");
    state.controller.destroy();
});

test("drag positions clamp at every edge and follow viewport resize and keyboard offsets", () => {
    const state = fixture();
    state.pointer("pointerdown", 344, 798);
    state.pointer("pointermove", -500, -500);
    assert.equal(state.button.style.left, "16px");
    assert.equal(state.button.style.top, "16px");
    state.pointer("pointermove", 2000, 2000);
    state.pointer("pointerup", 2000, 2000);
    assert.equal(state.button.style.left, "316px");
    assert.equal(state.button.style.top, "770px");
    Object.assign(state.viewport, {width: 320, height: 400});
    state.view.dispatchEvent(new Event("resize"));
    assert.equal(state.button.style.left, "246px");
    assert.equal(state.button.style.top, "326px");
    Object.assign(state.viewport, {offsetLeft: 300, offsetTop: 350});
    state.viewport.dispatchEvent(new Event("scroll"));
    assert.equal(state.button.style.left, "316px");
    assert.equal(state.button.style.top, "366px");
    state.controller.destroy();
});

test("an embedded button uses parent coordinates and stays within resized bounds", () => {
    const bounds = {left: 100, top: 200, width: 250, height: 300};
    const state = fixture({boundsElement: {getBoundingClientRect: () => bounds}});
    state.pointer('pointerdown', 344, 798);
    state.pointer('pointermove', 200, 400);
    assert.equal(state.button.style.left, '71px');
    assert.equal(state.button.style.top, '171px');
    state.pointer('pointermove', -500, -500);
    assert.equal(state.button.style.left, '16px');
    assert.equal(state.button.style.top, '16px');
    state.pointer('pointermove', 2000, 2000);
    state.pointer('pointerup', 2000, 2000);
    assert.equal(state.button.style.left, '176px');
    assert.equal(state.button.style.top, '226px');
    Object.assign(bounds, {left: 300, top: 400, width: 180, height: 180});
    state.view.dispatchEvent(new Event('resize'));
    assert.equal(state.button.style.left, '16px');
    assert.equal(state.button.style.top, '26px');
    state.controller.destroy();
});

test("cancelled drags release capture and keyboard activation keeps working", () => {
    const state = fixture();
    state.pointer("pointerdown", 344, 798);
    state.pointer("pointermove", 200, 400, {pointerId: 2});
    assert.equal(state.button.style.left, "");
    state.pointer("pointermove", 200, 400);
    state.pointer("pointercancel", 0, 0);
    assert.equal(state.button.style.left, "171px");
    assert.equal(state.captures.size, 0);
    assert.equal(state.click(0).defaultPrevented, false);
    assert.equal(state.opens, 1);
    state.pointer("pointerdown", 200, 400);
    state.view.dispatchEvent(new Event("blur"));
    assert.equal(state.attributes.has("data-drag-pressed"), false);
    assert.equal(state.captures.size, 0);
    state.controller.destroy();
});

test("touch taps wait for the browser click and do not open a modal during pointerup", () => {
    const state = fixture();
    const touch = {pointerType: "touch"};
    state.pointer("pointerdown", 344, 798, touch);
    state.pointer("pointermove", 200, 400, touch);
    state.pointer("pointerup", 200, 400, touch);
    assert.equal(state.opens, 0);
    state.pointer("pointerdown", 200, 400, touch);
    const released = state.pointer("pointerup", 200, 400, touch);
    assert.equal(state.opens, 0, 'pointerup must not synthesize a second click');
    assert.equal(released.defaultPrevented, false);
    assert.equal(state.click(1, touch).defaultPrevented, false);
    assert.equal(state.opens, 1);
    state.pointer("pointerdown", 200, 400, touch);
    state.pointer("pointerup", 200, 400, touch);
    assert.equal(state.opens, 1);
    state.click(0, touch);
    assert.equal(state.opens, 2);
    state.controller.destroy();
});

test('phone finger jitter stays a tap while a deliberate drag suppresses pointer clicks with detail zero', () => {
    const state = fixture(), touch = {pointerType:'touch'};
    state.pointer('pointerdown',344,798,touch);
    state.pointer('pointermove',349,803,touch);
    state.pointer('pointerup',349,803,touch);
    assert.equal(state.button.style.left,'');
    state.click(1,touch);
    assert.equal(state.opens,1);
    state.pointer('pointerdown',344,798,touch);
    state.pointer('pointermove',300,700,touch);
    state.pointer('pointerup',300,700,touch);
    assert.equal(state.click(0,{pointerType:'touch',pointerId:1}).defaultPrevented,true);
    assert.equal(state.opens,1);
    state.click(0);
    assert.equal(state.opens,2,'keyboard activation still works');
    state.controller.destroy();
});

test('native tap cancels the delayed fallback so a modal opens only once', () => {
    const state=fixture(),touch={pointerType:'touch'};
    state.pointer('pointerdown',344,798,touch);state.pointer('pointerup',344,798,touch);
    state.click(1,touch);
    assert.equal(state.opens,1);
    state.advance(500);
    assert.equal(state.opens,1);
    state.controller.destroy();
});

test('an omitted post-drag click has a fallback and its late backdrop click is suppressed', () => {
    const state=fixture(),touch={pointerType:'touch'};
    state.pointer('pointerdown',344,798,touch);state.pointer('pointermove',200,400,touch);state.pointer('pointerup',200,400,touch);
    state.pointer('pointerdown',200,400,touch);state.pointer('pointerup',200,400,touch);
    assert.equal(state.opens,0);
    state.advance(180);
    assert.equal(state.opens,1);
    const late=Object.assign(new Event('click',{cancelable:true}),{detail:1,pointerType:'touch',pointerId:1,clientX:200,clientY:400});
    state.page.dispatchEvent(late);
    assert.equal(late.defaultPrevented,true,'a late native click must not close the newly opened modal');
    state.advance(1000);assert.equal(state.opens,1);
    state.controller.destroy();
});

test('a new physical gesture or keyboard click is not blocked by a prior tap fallback', () => {
    const state=fixture(),touch={pointerType:'touch'};
    state.pointer('pointerdown',344,798,touch);state.pointer('pointerup',344,798,touch);state.advance(180);
    state.page.dispatchEvent(new Event('pointerdown'));
    const next=Object.assign(new Event('click',{cancelable:true}),{detail:1,pointerType:'touch',pointerId:1,clientX:344,clientY:798});
    state.page.dispatchEvent(next);assert.equal(next.defaultPrevented,false);
    state.click(0);assert.equal(state.opens,2);
    state.controller.destroy();
});

test('cancellation, hidden controls, and teardown cannot deliver deferred activations', () => {
    for(const mode of ['cancel','hidden','destroy']){
        const state=fixture(),touch={pointerType:'touch'};
        state.pointer('pointerdown',344,798,touch);
        if(mode==='cancel')state.pointer('pointercancel',344,798,touch);
        else{state.pointer('pointerup',344,798,touch);if(mode==='hidden')state.button.hidden=true;else state.controller.destroy();}
        state.advance(500);assert.equal(state.opens,0,mode);
        if(mode!=='destroy')state.controller.destroy();
    }
});

test('browser toolbar resize does not cancel an in-progress tap', () => {
    const state=fixture(), touch={pointerType:'touch'};
    state.pointer('pointerdown',344,798,touch);
    state.viewport.height=780;
    state.viewport.dispatchEvent(new Event('resize'));
    assert.equal(state.attributes.has('data-drag-pressed'),true);
    state.pointer('pointerup',344,798,touch);
    state.click(1,touch);
    assert.equal(state.opens,1);
    assert.equal(state.attributes.has('data-drag-pressed'),false);
    state.controller.destroy();
});

test('capture rejection falls back to window events and cancellation never activates', () => {
    const state=fixture(), touch={pointerType:'touch'};
    state.button.setPointerCapture=()=>{throw new Error('No active pointer');};
    state.pointer('pointerdown',344,798,touch);
    const outside=(type,x,y)=>state.view.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{pointerId:1,pointerType:'touch',clientX:x,clientY:y}));
    outside('pointermove',200,400);outside('pointerup',200,400);
    assert.equal(state.button.style.left,'171px');
    assert.equal(state.click(1,touch).defaultPrevented,true);
    state.pointer('pointerdown',200,400,touch);
    state.pointer('pointercancel',200,400,touch);
    assert.equal(state.click(1,touch).defaultPrevented,true);
    assert.equal(state.opens,0);
    state.controller.destroy();
});

test('dragging respects safe-area insets on all sides', () => {
    const state=fixture();
    state.view.getComputedStyle=()=>({getPropertyValue:key=>({'--floating-safe-top':'44px','--floating-safe-right':'30px','--floating-safe-bottom':'34px','--floating-safe-left':'20px'}[key])});
    state.pointer('pointerdown',344,798);
    state.pointer('pointermove',-500,-500);
    assert.equal(state.button.style.left,'20px');assert.equal(state.button.style.top,'44px');
    state.pointer('pointermove',2000,2000);state.pointer('pointerup',2000,2000);
    assert.equal(state.button.style.left,'302px');assert.equal(state.button.style.top,'752px');
    state.controller.destroy();
});

test("hidden, secondary, and disabled controls cannot drag; cleanup restores positions", () => {
    const state = fixture();
    state.button.hidden = true;
    state.pointer("pointerdown", 344, 798);
    state.button.hidden = false;
    state.button.disabled = true;
    state.pointer("pointerdown", 344, 798);
    state.button.disabled = false;
    state.pointer("pointerdown", 344, 798, {button: 2});
    state.pointer("pointerdown", 344, 798, {isPrimary: false});
    state.pointer("pointermove", 200, 400);
    assert.equal(state.button.style.left, "");
    state.pointer("pointerdown", 344, 798);
    state.pointer("pointermove", 200, 400);
    state.controller.destroy();
    assert.equal(state.captures.size, 0);
    assert.equal(state.attributes.size, 0);
    assert.deepEqual(state.button.style, {left: "", top: "", right: "", bottom: ""});
    state.pointer("pointerdown", 344, 798);
    state.pointer("pointermove", 0, 0);
    state.view.dispatchEvent(new Event("resize"));
    assert.equal(state.button.style.left, "");
    assert.equal(state.click().defaultPrevented, false);
});
