// Quench tests. Batches use temporary actors and restore the settings they change.
import { StressManager, STRESS_CONFIG } from "../stress-manager.js";
import { ItemHandler } from "../item-handler.js";
import { StressRestDialog } from "../rest-dialog.js";
import { renderStressCard } from "../chat-card.js";
import {
    CAMP_SETTING, GM_ENV_SETTING, actorEnvironment, getActorEnvironmentOverride, setActorEnvironment, envLevel
} from "../environment.js";

const MODULE_ID = STRESS_CONFIG.MODULE_ID;
const PREFIX = "[Quench] Stress";

async function makeActor(data = {}) {
    return Actor.implementation.create({ name: `${PREFIX} ${foundry.utils.randomID(4)}`, type: "character", ...data });
}

async function withSettings(values, fn) {
    const old = Object.fromEntries(Object.keys(values).map(k => [k, game.settings.get(MODULE_ID, k)]));
    try {
        for (const [k, v] of Object.entries(values)) await game.settings.set(MODULE_ID, k, v);
        return await fn();
    } finally {
        for (const [k, v] of Object.entries(old)) await game.settings.set(MODULE_ID, k, v);
    }
}

function waitForHook(name, timeout = 3000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { Hooks.off(name, id); reject(new Error(`${name} not fired`)); }, timeout);
        const id = Hooks.once(name, (...args) => { clearTimeout(timer); resolve(args); });
    });
}

async function waitForApp(id, timeout = 1500) {
    for (let waited = 0; waited <= timeout; waited += 50) {
        const app = foundry.applications.instances.get(id);
        if (app) return app;
        await new Promise(r => setTimeout(r, 50));
    }
    return undefined;
}

export function registerQuenchTests(quench) {
    const cleanup = async () => {
        const ids = game.actors.filter(a => a.name.startsWith(PREFIX)).map(a => a.id);
        if (ids.length) await Actor.implementation.deleteDocuments(ids);
    };

    quench.registerBatch(`${MODULE_ID}.stress`, ({ describe, it, assert, after }) => {
        after(cleanup);

        describe("Stress math", () => {
            it("derives exhaustion from stress with the configured ratio", () => {
                const r = StressManager.ratio;
                assert.equal(StressManager.exhaustionFor(0), 0);
                assert.equal(StressManager.exhaustionFor(r - 1), 0);
                assert.equal(StressManager.exhaustionFor(r), 1);
                assert.equal(StressManager.exhaustionFor(9999), StressManager.maxExhaustion);
            });
            it("clamps stress between 0 and the maximum", () => {
                assert.equal(StressManager.clampStress(-5), 0);
                assert.equal(StressManager.clampStress(StressManager.maxStress + 10), StressManager.maxStress);
            });
        });

        describe("Writing stress", () => {
            it("setStress stores the flag and the matching exhaustion", async () => {
                const actor = await makeActor();
                const result = await StressManager.setStress(actor, 5);
                assert.equal(StressManager.getStress(actor), 5);
                assert.equal(StressManager.getExhaustion(actor), StressManager.exhaustionFor(5));
                assert.equal(result.stressGain, 5);
            });
            it("a manual exhaustion change moves stress along", async () => {
                const actor = await makeActor();
                await actor.update({ "system.attributes.exhaustion": 2 });
                assert.equal(StressManager.getStress(actor), 2 * StressManager.ratio);
            });
            it("fires stresspoints-rest.stressChanged with the delta", async () => {
                const actor = await makeActor();
                await StressManager.setStress(actor, 2);
                const fired = waitForHook(`${MODULE_ID}.stressChanged`);
                await StressManager.applyStress(actor, 3);
                const [hookActor, data] = await fired;
                assert.equal(hookActor.id, actor.id);
                assert.equal(data.previous, 2);
                assert.equal(data.stress, 5);
                assert.equal(data.delta, 3);
            });
            it("exposes the public API", () => {
                const api = game.modules.get(MODULE_ID).api;
                for (const fn of ["openGMPanel", "getStress", "setStress", "applyStress", "setCampEnvironment", "setActorEnvironment", "getActorEnvironment"]) {
                    assert.isFunction(api[fn], fn);
                }
            });
        });

        describe("Token bar", () => {
            it("offers attributes.stress as a trackable bar", () => {
                assert.include(CONFIG.Actor.trackableAttributes.character.bar, "attributes.stress");
            });
            it("derives system.attributes.stress from the flag", async () => {
                const actor = await makeActor();
                await StressManager.setStress(actor, 3);
                assert.deepEqual(actor.system.attributes.stress, { value: 3, max: StressManager.maxStress });
            });
            it("editing the bar writes the stress flag", async () => {
                const actor = await makeActor();
                await StressManager.setStress(actor, 1);
                await actor.modifyTokenAttribute("attributes.stress", 2, true, false);
                // The hook writes asynchronously.
                await new Promise(r => setTimeout(r, 300));
                assert.equal(StressManager.getStress(actor), 3);
            });
        });
    }, { displayName: "Stress Points & Rest: stress" });

    quench.registerBatch(`${MODULE_ID}.rest`, ({ describe, it, assert, after }) => {
        after(cleanup);

        describe("Environment", () => {
            it("a character follows the camp unless the GM overrides it", async () => {
                await withSettings({ [CAMP_SETTING]: 14, [GM_ENV_SETTING]: true }, async () => {
                    const actor = await makeActor();
                    assert.equal(actorEnvironment(actor), 14);
                    await setActorEnvironment(actor, 18);
                    assert.equal(getActorEnvironmentOverride(actor), 18);
                    assert.equal(actorEnvironment(actor), 18);
                    await setActorEnvironment(actor, null);
                    assert.isNull(getActorEnvironmentOverride(actor));
                    assert.equal(actorEnvironment(actor), 14);
                });
            });
            it("unknown DCs fall back to a known level", () => {
                assert.equal(envLevel(0).dc, 0);
                assert.isString(envLevel(18).label);
            });
        });

        describe("Purchases", () => {
            it("pays by combining coins without reorganizing the purse", async () => {
                const actor = await makeActor({ system: { currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 1000 } } });
                assert.isTrue(await ItemHandler.payCurrency(actor, 5, "gp"));
                const cur = actor.system.currency;
                assert.equal(cur.cp, 500);
                assert.equal(cur.gp + cur.pp + cur.ep + cur.sp, 0);
            });
            it("handles fractional prices without floating point errors", async () => {
                const actor = await makeActor({ system: { currency: { pp: 0, gp: 1, ep: 0, sp: 0, cp: 0 } } });
                assert.isTrue(await ItemHandler.payCurrency(actor, 0.2, "gp"));
                const cur = actor.system.currency;
                assert.equal((cur.gp * 100) + (cur.sp * 10) + cur.cp, 80);
            });
            it("refuses when the character cannot afford it", async () => {
                const actor = await makeActor({ system: { currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 10 } } });
                assert.isFalse(await ItemHandler.payCurrency(actor, 1, "gp"));
                assert.equal(actor.system.currency.cp, 10);
            });
        });

        describe("Long rest at 0 HP", () => {
            it("is refused without spending anything when the rule is on", async () => {
                await withSettings({ longRestNeedsHp: true }, async () => {
                    const actor = await makeActor({
                        system: { attributes: { hp: { value: 0, max: 20 } } },
                        flags: { [MODULE_ID]: { stress: 4 } }
                    });
                    const [bread] = await actor.createEmbeddedDocuments("Item", [
                        { name: "Bread", type: "consumable", system: { type: { value: "food" }, quantity: 2 } }]);
                    await actor.longRest();
                    assert.isUndefined(await waitForApp(StressRestDialog.idFor(actor), 500), "no rest dialog");
                    assert.equal(actor.system.attributes.hp.value, 0);
                    assert.equal(StressManager.getStress(actor), 4);
                    assert.equal(actor.items.get(bread.id).system.quantity, 2);
                });
            });
            it("opens the rest dialog when the rule is off", async () => {
                await withSettings({ longRestNeedsHp: false }, async () => {
                    const actor = await makeActor({ system: { attributes: { hp: { value: 0, max: 20 } } } });
                    await actor.longRest();
                    const app = await waitForApp(StressRestDialog.idFor(actor));
                    assert.isDefined(app, "rest dialog opened");
                    await app.close();
                });
            });
        });

        describe("Consuming supplies", () => {
            const utility = () => {
                const id = foundry.utils.randomID();
                return { [id]: { _id: id, type: "utility", name: "Eat" } };
            };
            it("spends one unit of an item without activities", async () => {
                const actor = await makeActor();
                const [bread] = await actor.createEmbeddedDocuments("Item", [
                    { name: "Bread", type: "consumable", system: { type: { value: "food" }, quantity: 3 } }]);
                assert.isNotNull(await ItemHandler.consume(actor, bread.id));
                assert.equal(actor.items.get(bread.id).system.quantity, 2);
            });
            it("spends one unit when the item's activity consumes nothing", async () => {
                const actor = await makeActor();
                const [meat] = await actor.createEmbeddedDocuments("Item", [
                    { name: "Meat", type: "consumable", system: { type: { value: "food" }, quantity: 3, activities: utility() } }]);
                assert.isNotNull(await ItemHandler.consume(actor, meat.id));
                assert.equal(actor.items.get(meat.id).system.quantity, 2);
            });
            it("a stack destroyed when empty goes through every use of every unit", async () => {
                const actor = await makeActor();
                const [pie] = await actor.createEmbeddedDocuments("Item", [{
                    name: "Pie", type: "consumable",
                    system: { type: { value: "food" }, quantity: 2, uses: { max: "2", spent: 0, autoDestroy: true }, activities: utility() }
                }]);
                for (let portion = 1; portion <= 4; portion++) {
                    assert.isNotNull(await ItemHandler.consume(actor, pie.id), `portion ${portion}`);
                }
                assert.isUndefined(actor.items.get(pie.id), "the last pie is gone");
            });
            for (const [label, activities] of [["consumes its charges", null], ["consumes nothing", "utility"]]) {
                it(`an emptied Waterskin stays in the inventory (activity ${label})`, async () => {
                    const actor = await makeActor();
                    const id = foundry.utils.randomID();
                    const own = activities ? utility() : { [id]: {
                        _id: id, type: "utility", name: "Drink",
                        consumption: { targets: [{ type: "itemUses", value: "1" }] }
                    } };
                    const [skin] = await actor.createEmbeddedDocuments("Item", [{
                        name: "Waterskin", type: "consumable",
                        system: { type: { value: "food" }, quantity: 1, uses: { max: "4", spent: 0, autoDestroy: false }, activities: own }
                    }]);
                    for (let pint = 1; pint <= 4; pint++) {
                        assert.isNotNull(await ItemHandler.consume(actor, skin.id), `pint ${pint}`);
                    }
                    const empty = actor.items.get(skin.id);
                    assert.isDefined(empty, "not deleted");
                    assert.equal(empty.system.quantity, 1, "still one waterskin");
                    assert.equal(empty.system.uses.value, 0, "empty");
                    assert.isNull(await ItemHandler.consume(actor, skin.id), "nothing to drink");
                    assert.notInclude(ItemHandler.itemsOfKind(actor, "drink"), empty, "not offered at rest");
                });
            }
        });

        describe("Item detection", () => {
            it("recognizes drink, healing and flagged items", async () => {
                const actor = await makeActor();
                await actor.createEmbeddedDocuments("Item", [
                    { name: "Waterskin", type: "consumable", system: { type: { value: "food" } } },
                    { name: "Healer's Kit", type: "consumable" },
                    { name: "Mystery Jar", type: "consumable", flags: { [MODULE_ID]: { restKind: "food" } } },
                    { name: "Potion of Climbing", type: "consumable", system: { type: { value: "potion" } } }
                ]);
                const byName = name => actor.items.getName(name);
                const [water, kit, flagged, potion] = ["Waterskin", "Healer's Kit", "Mystery Jar", "Potion of Climbing"].map(byName);
                assert.equal(ItemHandler.restKind(water), "drink");
                assert.equal(ItemHandler.restKind(kit), "heal");
                assert.equal(ItemHandler.restKind(flagged), "food");
                assert.equal(ItemHandler.restKind(potion), "none");
            });
        });
    }, { displayName: "Stress Points & Rest: rest" });

    quench.registerBatch(`${MODULE_ID}.ui`, ({ describe, it, assert }) => {
        describe("Chat cards", () => {
            it("render from templates with CSS classes, no inline layout styles", async () => {
                const html = await renderStressCard({
                    title: "Test", actorName: "<b>Hero</b>", template: "collapse", data: { stressGain: 2, exhaustionGain: 1 }
                });
                const el = document.createElement("div");
                el.innerHTML = html;
                assert.isNotNull(el.querySelector(".stress-card .stress-card__title"));
                assert.equal(el.querySelector(".stress-card__actor").textContent, "<b>Hero</b>", "actor name is escaped");
                assert.lengthOf(el.querySelectorAll("[style]"), 0);
            });
        });

        describe("Settings", () => {
            it("groups the module settings into sections", async () => {
                const app = new foundry.applications.settings.SettingsConfig();
                await app.render({ force: true });
                try {
                    const tab = app.element.querySelector(`[data-category="${MODULE_ID}"]`);
                    assert.lengthOf(tab.querySelectorAll(".stress-settings-section"), 4);
                    assert.lengthOf(tab.querySelectorAll(":scope > .form-group"), 0, "no setting left outside a section");
                } finally {
                    await app.close();
                }
            });
        });
    }, { displayName: "Stress Points & Rest: interface" });
}
