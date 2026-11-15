import { STRESS_CONFIG } from "./stress-manager.js";

// Item flag that overrides detection: "food" | "drink" | "heal" | "none".
export const REST_KIND_FLAG = "restKind";

// Whole-word matching that also works with accented letters (\b does not, e.g. "água").
const words = list => new RegExp(`(?<!\\p{L})(?:${list.join("|")})(?!\\p{L})`, "iu");

const DRINK_RE = words([
    "água", "agua", "water", "drink", "bebida", "suco", "juice", "cerveja", "beer", "vinho", "wine", "ale", "mead",
    "hidromel", "cantil", "waterskin", "wineskin", "odre", "wasser", "bier", "wein", "tea", "chá", "cha", "saft",
    "milk", "leite", "met", "grog", "rum", "whisky", "whiskey", "café", "coffee", "infusão"
]);
const HEAL_NAME_RE = words([
    "healer'?s? kit", "kit de curandeiro", "kit do curandeiro", "kit médico", "medkit", "healer",
    "curandeiro", "bandage", "bandages", "bandagem", "bandagens", "atadura", "ataduras"
]);
const BANDAGE_RE = words(["bandage", "bandages", "bandagem", "bandagens", "atadura", "ataduras"]);

export class ItemHandler {
    /** @returns {"food"|"drink"|"heal"|"none"} */
    static restKind(item) {
        const flagged = item.getFlag(STRESS_CONFIG.MODULE_ID, REST_KIND_FLAG);
        if (flagged) return flagged;
        if (item.type !== "consumable") return "none";

        const subtype = item.system.type?.value;
        if (subtype === "food") return DRINK_RE.test(item.name) ? "drink" : "food";

        // Only items that actually heal count: a Potion of Climbing is not a healing item.
        const healsHp = item.system.activities?.some?.(a => a.type === "heal") ?? false;
        if (healsHp || HEAL_NAME_RE.test(item.name)) return "heal";
        return "none";
    }

    static itemsOfKind(actor, kind) {
        return actor.items.filter(i => ItemHandler.restKind(i) === kind && ItemHandler.hasSupply(i));
    }

    // As in dnd5e, only items destroyed when empty move on to the next unit; a Waterskin just stays empty.
    static hasSupply(item) {
        const qty = item?.system.quantity || 0;
        if (qty <= 0) return false;
        const { max, value, autoDestroy } = ItemHandler.#uses(item);
        return max === 0 || value > 0 || (autoDestroy && qty > 1);
    }

    static isBandage(item) {
        return BANDAGE_RE.test(item?.name ?? "");
    }

    /**
     * Pays in the smallest coin through dnd5e's CurrencyManager, which only makes change from larger
     * coins (0.5 gp from a purse of gold would fail otherwise).
     * @returns {Promise<boolean>} false when the actor cannot afford it.
     */
    static async payCurrency(actor, amount, denomination) {
        if (!(amount > 0)) return true;
        const currencies = CONFIG.DND5E.currencies;
        const CurrencyManager = dnd5e.applications?.CurrencyManager;
        if (CurrencyManager?.getActorCurrencyUpdates && currencies?.[denomination]) {
            const [smallest, { conversion: smallestConv }] = Object.entries(currencies)
                .sort(([, a], [, b]) => b.conversion - a.conversion)[0];
            const units = Math.round(amount * smallestConv / currencies[denomination].conversion);
            if (units <= 0) return true;
            const { remainder, item, ...updates } = CurrencyManager.getActorCurrencyUpdates(actor, units, smallest);
            if (remainder > 0 && !remainder.almostEqual(0)) return false;
            await actor.update(updates);
            return true;
        }
        return ItemHandler._payCurrencyFallback(actor, amount, denomination);
    }

    // Fallback when CurrencyManager is not available.
    static async _payCurrencyFallback(actor, amount, denomination) {
        const rates = Object.fromEntries(Object.entries(CONFIG.DND5E.currencies).map(([k, v]) => [k, v.conversion]));
        // Whole copper pieces, to avoid floating point drift.
        const unit = d => Math.round(Math.max(...Object.values(rates)) / rates[d]);
        const purse = { ...actor.system.currency };
        let owed = Math.round(amount * unit(denomination));
        const total = Object.entries(purse).reduce((t, [d, q]) => t + (q || 0) * (unit(d) || 0), 0);
        if (total < owed) return false;

        const order = Object.keys(rates).filter(d => d in purse).sort((a, b) => unit(a) - unit(b));
        for (const d of order) {
            const take = Math.min(purse[d] || 0, Math.floor(owed / unit(d)));
            purse[d] -= take;
            owed -= take * unit(d);
        }
        if (owed > 0) {
            // Break the smallest coin that covers the rest and return change in the smallest coin.
            const d = order.find(x => (purse[x] || 0) > 0 && unit(x) >= owed);
            purse[d] -= 1;
            purse[order[0]] = (purse[order[0]] || 0) + (unit(d) - owed) / unit(order[0]);
        }
        await actor.update({ "system.currency": purse });
        return true;
    }

    static async consume(actor, itemId, { silent = true } = {}) {
        if (!itemId) return null;

        const item = actor.items.get(itemId);
        if (!item) return null;

        const { max, value, autoDestroy } = ItemHandler.#uses(item);
        const qty = item.system.quantity || 0;
        if (qty <= 0) {
            ui.notifications.warn(game.i18n.format("STRESS.Warn.NoMoreItem", { name: item.name }));
            return null;
        }

        // Out of uses: a stack destroyed when empty opens its next unit, anything else is empty.
        if (max > 0 && value <= 0) {
            if (autoDestroy && qty > 1) {
                await item.update({ "system.quantity": qty - 1, "system.uses.spent": 0 });
                return item;
            }
            ui.notifications.warn(game.i18n.format("STRESS.Warn.ItemEmpty", { name: item.name }));
            return null;
        }

        // Without activities, item.use() would only post a card.
        if (!(item.system.activities?.size > 0)) {
            await ItemHandler.#spendOne(item);
            return item;
        }

        // Food, drink and bandages are used silently; potions keep their card for the heal roll.
        const before = ItemHandler.#spendState(item);
        const usage = await item.use({}, { configure: false }, silent ? { create: false } : {});
        if (!usage) return null;
        // An activity that consumes nothing would make the meal free.
        const live = actor.items.get(item.id);
        if (live && ItemHandler.#spendState(live) === before) await ItemHandler.#spendOne(live);
        return item;
    }

    static #uses(item) {
        const uses = item.system.uses || {};
        return { max: parseInt(uses.max) || 0, value: parseInt(uses.value) || 0, autoDestroy: !!uses.autoDestroy };
    }

    static #spendState(item) {
        return `${item.system.quantity ?? 0}:${item.system.uses?.spent ?? 0}`;
    }

    // One charge for items with uses, otherwise one unit, like dnd5e's own consumption.
    static async #spendOne(item) {
        const { max, autoDestroy } = ItemHandler.#uses(item);
        const qty = item.system.quantity || 0;

        if (max > 0) {
            const spent = (item.system.uses.spent || 0) + 1;
            if (spent < max || !autoDestroy) return item.update({ "system.uses.spent": Math.min(spent, max) });
            if (qty > 1) return item.update({ "system.quantity": qty - 1, "system.uses.spent": 0 });
            return item.delete();
        }

        if (qty > 1) return item.update({ "system.quantity": qty - 1 });
        if (autoDestroy) return item.delete();
        return item.update({ "system.quantity": 0 });
    }
}
