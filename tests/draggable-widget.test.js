import test from "node:test";
import assert from "node:assert/strict";
import {mountDraggableWidget} from "../js/draggable-widget.js";

function fixture(options = {}) {
    const view = new EventTarget();
    Object.assign(view, {innerWidth: 390, innerHeight: 844});
    const viewport = new EventTarget();
    Object.assign(viewport, {width: 390, height: 844, offsetLeft: 0, offsetTop: 0});
    view.visualViewport = viewport;
    const button = new EventTarget();
    const attributes = new Map();
    const captures = new Set();
    Object.assign(button, {
        ownerDocument: {defaultView: view}, hidden: false, disabled: false,
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
    function click(detail = 1) {
        const event = Object.assign(new Event("click", {cancelable: true}), {detail});
        button.dispatchEvent(event);
        return event;
    }
    return {button, view, viewport, attributes, captures, controller, pointer, click, get opens() {return opens;}};
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

test("touch taps activate once even when a browser delays or omits its compatibility click", () => {
    const state = fixture();
    const touch = {pointerType: "touch"};
    state.pointer("pointerdown", 344, 798, touch);
    state.pointer("pointermove", 200, 400, touch);
    state.pointer("pointerup", 200, 400, touch);
    assert.equal(state.opens, 0);
    state.pointer("pointerdown", 200, 400, touch);
    state.pointer("pointerup", 200, 400, touch);
    assert.equal(state.opens, 1, "a tap works even without a native click");
    assert.equal(state.click().defaultPrevented, true);
    assert.equal(state.opens, 1, "a later compatibility click must not activate twice");
    state.pointer("pointerdown", 200, 400, touch);
    state.pointer("pointerup", 200, 400, touch);
    assert.equal(state.opens, 2);
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
