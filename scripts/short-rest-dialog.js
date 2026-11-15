import { ItemHandler } from "./item-handler.js";
import { STRESS_CONFIG, esc } from "./stress-manager.js";
import { StressDialogBase } from "./dialog-base.js";
import { postStressCard, tone, logIcon } from "./chat-card.js";

const HP_PATH = "system.attributes.hp.value";

// Short rests in progress, by actor uuid.
// mode: "normal" | "blocked" (no healing item, no hit dice) | "bandage" (hit dice heal half)
const activeRests = new Map();

export class StressShortRestDialog extends StressDialogBase {
    constructor(actor, restConfig = {}) {
        super(actor);
        this.restConfig = restConfig;
    }

    _refreshArgs(restConfig) {
        if (restConfig) this.restConfig = restConfig;
    }

    static DEFAULT_OPTIONS = {
        window: { title: "STRESS.Dialog.ShortRest", icon: "fas fa-campfire" },
        classes: ["stress-short-rest", "dnd5e2"],
        position: { width: 440 },
        form: { handler: StressShortRestDialog.#onSubmit }
    };

    static PARTS = {
        form: { template: "modules/stresspoints-rest/templates/short-rest.hbs" }
    };

    static init() {
        // Without a healing item, stop hit dice before they are rolled.
        Hooks.on("dnd5e.preRollHitDieV2", (config) => {
            if (activeRests.get(config?.subject?.uuid)?.mode !== "blocked") return;
            ui.notifications.warn(game.i18n.localize("STRESS.Warn.HitDiceNeedHealer"));
            return false;
        });

        // Bandages: halve the healing of each hit die before dnd5e applies it.
        Hooks.on("dnd5e.rollHitDieV2", (rolls, { subject, updates }) => {
            const state = activeRests.get(subject?.uuid);
            if (!state) return;
            state.rolled += 1;
            if (state.mode !== "bandage" || !(HP_PATH in (updates?.actor ?? {}))) return;
            const before = subject.system.attributes.hp.value;
            updates.actor[HP_PATH] = before + Math.floor((updates.actor[HP_PATH] - before) / 2);
        });
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        return Object.assign(context, StressDialogBase.hudContext(this.actor), {
            actor: this.actor,
            requireHealer: game.settings.get(STRESS_CONFIG.MODULE_ID, "requireHealerKitShort"),
            healItems: StressDialogBase.slotItems(ItemHandler.itemsOfKind(this.actor, "heal"))
        });
    }

    static async #onSubmit(event, form, formData) {
        this.close();
        try {
            await this._performRest(formData.object);
        } catch (err) {
            console.error("Stress Points & Rest | Short rest failed:", err);
            ui.notifications.error(game.i18n.localize("STRESS.Warn.RestFailed"));
        }
    }

    async _performRest(data) {
        const actor = this.actor;
        const requireHealer = game.settings.get(STRESS_CONFIG.MODULE_ID, "requireHealerKitShort");
        const logs = [];

        // The healing item is spent after the dnd5e rest, so cancelling that dialog keeps it.
        let healItem = requireHealer && data.healId ? actor.items.get(data.healId) : null;
        if (healItem && !ItemHandler.hasSupply(healItem)) {
            ui.notifications.warn(game.i18n.format("STRESS.Warn.NoMoreItem", { name: healItem.name }));
            healItem = null;
        }

        let mode = "normal";
        if (requireHealer) {
            if (!healItem) mode = "blocked";
            else if (ItemHandler.isBandage(healItem)) mode = "bandage";
        }

        const state = { mode, rolled: 0 };
        const hpBefore = actor.system.attributes.hp.value;
        let result;
        activeRests.set(actor.uuid, state);
        try {
            result = await actor.shortRest({ ...this.restConfig, stressRestModule: true });
        } finally {
            activeRests.delete(actor.uuid);
        }

        // Rest cancelled before any hit die was spent: nothing happened, nothing to report.
        if (!result && state.rolled === 0) return;

        const hpGained = actor.system.attributes.hp.value - hpBefore;

        if (healItem && (await ItemHandler.consume(actor, healItem.id, { silent: false }))) {
            logs.push(`${logIcon("bandage")} ${game.i18n.localize("STRESS.Report.UsedItem")}: <b>${esc(healItem.name)}</b>`);
            if (mode === "bandage" && hpGained > 0) {
                logs.push(tone("gold", game.i18n.format("STRESS.Report.BandageEffect", { val: hpGained })));
            }
        } else if (mode === "blocked") {
            logs.push(tone("warn", game.i18n.localize("STRESS.Msg.NoItemHeal")));
        }

        // The bandage line already reports the HP recovered.
        if (hpGained > 0 && mode !== "bandage") {
            logs.push(tone("good", game.i18n.format("STRESS.Report.HPRestored", { val: hpGained })));
        }

        await postStressCard(actor, {
            title: game.i18n.localize("STRESS.Report.Title"),
            template: "short-rest",
            data: { logs }
        });
    }
}
