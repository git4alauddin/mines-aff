import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {mountDepositPrompt} from "../js/deposit-prompt.js";
import {config} from "../js/config.js";

const html = await readFile(new URL("../registration.html", import.meta.url), "utf8");
const markup = html.match(/<dialog\b[\s\S]*?<\/dialog>/)[0];

// A small dialog API fixture reads the real markup, so missing bindings fail.
class Element extends EventTarget {
    constructor(attributes = "") {
        super();
        this.attributes = attributes;
        this.textContent = "";
    }

    focus() {
        this.focused = true;
    }
}

function dialogFixture(source = markup) {
    const elements = [...source.matchAll(/<[a-z][a-z0-9-]*\b([^>]*)>/gi)].map((match) => new Element(match[1]));
    const dialog = new Element();
    dialog.open = false;
    dialog.showCount = 0;
    dialog.querySelectorAll = (selector) => {
        const attribute = selector.slice(1, -1);
        return elements.filter((element) => new RegExp(`(?:^|\\s)${attribute}(?:\\s|=|$)`).test(element.attributes));
    };
    dialog.querySelector = (selector) => dialog.querySelectorAll(selector)[0] ?? null;
    dialog.showModal = () => {
        dialog.open = true;
        dialog.showCount++;
    };
    dialog.close = () => {
        dialog.open = false;
    };
    dialog.getBoundingClientRect = () => ({left: 10, top: 10, right: 410, bottom: 610});
    return dialog;
}

test("the real popup markup displays the configured INR amount and wallet destination", () => {
    const dialog = dialogFixture();
    mountDepositPrompt(dialog);
    assert.equal(dialog.open, false);
    assert.ok(dialog.querySelectorAll("[data-deposit-amount]").length >= 2);
    for (const amount of dialog.querySelectorAll("[data-deposit-amount]")) assert.equal(amount.textContent, "₹1,000");
    assert.equal(dialog.querySelector("[data-deposit-minimum-label]").textContent, "₹1,000 MINIMUM");
    assert.equal(dialog.querySelector("[data-deposit-currency]").textContent, "INDIAN RUPEES · INR");
    assert.equal(dialog.querySelector("[data-deposit-claim]").href, "https://www.dmfirst0.com/#/wallet/Recharge");
});

test("the registration wrapper popup mounts with the configured amount and wallet destination", async () => {
    const landing = await readFile(new URL("../registration.html", import.meta.url), "utf8");
    const dialog = dialogFixture(landing.match(/<dialog\b[\s\S]*?<\/dialog>/)[0]);
    const prompt = mountDepositPrompt(dialog);
    assert.equal(dialog.querySelector("[data-deposit-amount]").textContent, "₹1,000");
    assert.equal(dialog.querySelector("[data-deposit-claim]").href, config.depositUrl);
    prompt.show();
    assert.equal(dialog.open, true);
    prompt.destroy();
});


test("showing is explicit and repeat calls cannot open duplicate dialogs", () => {
    const dialog = dialogFixture();
    const prompt = mountDepositPrompt(dialog);
    prompt.show();
    prompt.show();
    assert.equal(dialog.open, true);
    assert.equal(dialog.showCount, 1);
    assert.equal(dialog.querySelector("[data-deposit-heading]").focused, true);
    dialog.querySelector("[data-dismiss-deposit]").dispatchEvent(new Event("click"));
    assert.equal(dialog.open, false);
    prompt.show();
    assert.equal(dialog.showCount, 2);
    prompt.destroy();
});

test("clicking inside stays open, while clicking outside dismisses without navigation", () => {
    const dialog = dialogFixture();
    const prompt = mountDepositPrompt(dialog);
    prompt.show();
    dialog.dispatchEvent(Object.assign(new Event("click"), {clientX: 100, clientY: 100}));
    assert.equal(dialog.open, true);
    dialog.dispatchEvent(Object.assign(new Event("click"), {clientX: 500, clientY: 100}));
    assert.equal(dialog.open, false);
    prompt.destroy();
});

test("the popup amount comes from configuration and invalid amounts are rejected", () => {
    const dialog = dialogFixture();
    mountDepositPrompt(dialog, {...config, minimumDeposit: 1250});
    assert.equal(dialog.querySelector("[data-deposit-amount]").textContent, "₹1,250");
    assert.equal(dialog.querySelector("[data-deposit-minimum-label]").textContent, "₹1,250 MINIMUM");
    assert.throws(() => mountDepositPrompt(dialog, {...config, minimumDeposit: null}), RangeError);
    assert.throws(() => mountDepositPrompt(dialog, {...config, minimumDeposit: -500}), RangeError);
});



test('copy simulation has no password and only shows timed feedback', context => {
  context.mock.timers.enable({apis:['setTimeout']});
  const dialog=dialogFixture();
  const prompt=mountDepositPrompt(dialog);
  prompt.show(); dialog.querySelector('[data-deposit-claim]').dispatchEvent(new Event('click')); prompt.close(); prompt.show();
  assert.equal(dialog.querySelector('[data-copy-code-value]'),null);
  assert.equal(config.copyCodeDemo.code,undefined);
  const button=dialog.querySelector('[data-copy-code-demo]'), label=dialog.querySelector('[data-copy-code-label]');
  button.dispatchEvent(new Event('click'));
  assert.equal(button.disabled,true);
  assert.equal(label.textContent,config.copyCodeDemo.loadingText);
  context.mock.timers.tick(600);
  assert.equal(label.textContent,config.copyCodeDemo.completeText);
  assert.equal(dialog.querySelector('[data-copy-code-check]').hidden,false);
  context.mock.timers.tick(1800);
  assert.equal(label.textContent,config.copyCodeDemo.buttonText);
  prompt.destroy();
});
test('closing during the copy simulation cancels pending completion', context => {
  context.mock.timers.enable({apis:['setTimeout']});
  const dialog=dialogFixture(), prompt=mountDepositPrompt(dialog);
  prompt.show(); dialog.querySelector('[data-deposit-claim]').dispatchEvent(new Event('click')); prompt.close(); prompt.show();
  dialog.querySelector('[data-copy-code-demo]').dispatchEvent(new Event('click'));
  prompt.close(); prompt.show();
  context.mock.timers.tick(2400);
  assert.equal(dialog.querySelector('[data-copy-code-label]').textContent,config.copyCodeDemo.buttonText);
  assert.equal(dialog.querySelector('[data-copy-code-check]').hidden,true);
  prompt.destroy();
});
