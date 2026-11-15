import { STRESS_CONFIG, StressManager, esc } from "./stress-manager.js";
import { StressDialogBase } from "./dialog-base.js";
import { postStressCard } from "./chat-card.js";

const FEATURE_FLAG = "pushingLimits";
const ADVANTAGE_FLAG = "pushingLimitsAdvantage";
const FEATURE_ICON = "icons/magic/fire/flame-burning-fist-strike.webp";
const FOLDER_NAME = "Features";
const MAX_RECOVERABLE_SLOT_LEVEL = 5;

// d20 tests and death saves: advantage without needing Midi-QOL.
const PRE_ROLL_HOOKS = ["dnd5e.preRollD20TestV2", "dnd5e.preRollDeathSaveV2"];

// After the roll, remove the one-shot advantage effect.
const ROLL_HOOKS = [
    "dnd5e.rollAttackV2",
    "dnd5e.rollAbilityCheck",
    "dnd5e.rollSavingThrow",
    "dnd5e.rollSkillV2",
    "dnd5e.rollToolCheckV2",
    "dnd5e.rollDeathSaveV2"
];

const subjectActor = subject => subject?.actor ?? subject;
const advantageEffect = actor => actor?.effects?.find?.(e => e.getFlag(STRESS_CONFIG.MODULE_ID, ADVANTAGE_FLAG));

export class PushingLimitsDialog {

    static init() {
        Hooks.on("dnd5e.postUseActivity", (activity) => {
            const item = activity?.item;
            if (!item?.actor || !item.getFlag(STRESS_CONFIG.MODULE_ID, FEATURE_FLAG)) return;
            PushingLimitsPrompt.open(item.actor);
        });

        for (const hookName of PRE_ROLL_HOOKS) {
            Hooks.on(hookName, (config) => {
                if (advantageEffect(subjectActor(config?.subject))) config.advantage = true;
            });
        }

        for (const hookName of ROLL_HOOKS) {
            Hooks.on(hookName, (rolls, data) => PushingLimitsDialog._consumeAdvantage(subjectActor(data?.subject)));
        }
        Hooks.on("dnd5e.rollInitiative", (actor) => PushingLimitsDialog._consumeAdvantage(actor));

        Hooks.once("ready", () => PushingLimitsDialog.ensureFeatureItem());
    }

    // A death save fires both rollSavingThrow and rollDeathSaveV2: delete the effect only once.
    static #deleting = new Set();

    static async _consumeAdvantage(actor) {
        const effect = advantageEffect(actor);
        if (!effect?.isOwner || PushingLimitsDialog.#deleting.has(effect.uuid)) return;
        PushingLimitsDialog.#deleting.add(effect.uuid);
        try {
            await effect.delete();
        } catch (err) {
            console.warn("Stress Points & Rest | Could not remove the Pushing Limits advantage effect:", err);
        } finally {
            PushingLimitsDialog.#deleting.delete(effect.uuid);
        }
    }

    // Keeps exactly one configured Pushing Limits feature in the compendium, in the Features folder.
    static async ensureFeatureItem() {
        if (!game.user.isGM) return;

        const pack = game.packs.get(`${STRESS_CONFIG.MODULE_ID}.stress-items`);
        if (!pack) return;

        try {
            await PushingLimitsDialog._reconcileFeatureItem(pack);
        } catch (err) {
            console.error("Stress Points & Rest | Failed to set up the 'Pushing Limits' feature item:", err);
            ui.notifications.error(game.i18n.localize("STRESS.Warn.FeatureSetupFailed"));
        }
    }

    static async _withUnlockedPack(pack, fn) {
        const wasLocked = pack.locked;
        if (wasLocked) await pack.configure({ locked: false });
        try {
            return await fn();
        } finally {
            if (wasLocked) await pack.configure({ locked: true });
        }
    }

    static async _reconcileFeatureItem(pack) {
        const index = await pack.getIndex({ fields: ["flags", "folder", "img"] });
        const matches = index.filter(i => foundry.utils.getProperty(i, `flags.${STRESS_CONFIG.MODULE_ID}.${FEATURE_FLAG}`));
        const featuresFolder = pack.folders?.find(f => f.name === FOLDER_NAME) ?? null;

        if (!matches.length) {
            await PushingLimitsDialog._withUnlockedPack(pack, () => PushingLimitsDialog._createFeatureItem(pack, featuresFolder));
            console.log("Stress Points & Rest | 'Pushing Limits' feature item created.");
            return;
        }

        const [keep, ...duplicates] = matches;
        const keepDoc = await pack.getDocument(keep._id);
        const updates = {};
        if (featuresFolder && keepDoc.folder?.id !== featuresFolder.id) updates.folder = featuresFolder.id;
        if (keepDoc.img !== FEATURE_ICON) updates.img = FEATURE_ICON;

        if (!duplicates.length && foundry.utils.isEmpty(updates)) return;

        await PushingLimitsDialog._withUnlockedPack(pack, async () => {
            if (duplicates.length) {
                await Item.deleteDocuments(duplicates.map(d => d._id), { pack: pack.collection });
                console.log(`Stress Points & Rest | Removed ${duplicates.length} duplicate 'Pushing Limits' item(s).`);
            }
            if (!foundry.utils.isEmpty(updates)) await keepDoc.update(updates);
        });
    }

    static async _createFeatureItem(pack, folder) {
        const activityId = foundry.utils.randomID();
        await Item.create({
            name: game.i18n.localize("STRESS.PushingLimits.Title"),
            type: "feat",
            img: FEATURE_ICON,
            folder: folder?.id ?? null,
            system: {
                description: { value: `<p>${game.i18n.localize("STRESS.PushingLimits.ItemDescription")}</p>` },
                type: { value: "class" },
                activities: {
                    [activityId]: {
                        _id: activityId,
                        type: "utility",
                        name: game.i18n.localize("STRESS.PushingLimits.Title"),
                        sort: 0,
                        activation: { type: "special", override: false, condition: "" },
                        consumption: { scaling: { allowed: false }, spellSlot: false, targets: [] },
                        description: { chatFlavor: "" },
                        duration: { units: "inst", concentration: false, override: false },
                        effects: [],
                        range: { units: "self", override: false, special: "" },
                        target: {
                            template: { contiguous: false, units: "ft", type: "" },
                            affects: { choice: false, type: "" },
                            override: false,
                            prompt: false
                        },
                        uses: { spent: 0, recovery: [], max: "" },
                        roll: { prompt: false, visible: false, name: "", formula: "" },
                        flags: {},
                        visibility: { level: {}, requireAttunement: false, requireIdentification: false, requireMagic: false }
                    }
                }
            },
            flags: {
                [STRESS_CONFIG.MODULE_ID]: { [FEATURE_FLAG]: true }
            }
        }, { pack: pack.collection });
    }

    static async applyAdvantage(actor) {
        const { exhaustionGain } = await StressManager.applyStress(actor, StressManager.ratio);

        // Midi-QOL reads its own flag; plain dnd5e gets advantage from the preRoll hooks above.
        const changes = game.modules.get("midi-qol")?.active
            ? [{ key: "flags.midi-qol.advantage.all", mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM, value: "1", priority: 20 }]
            : [];
        await actor.createEmbeddedDocuments("ActiveEffect", [{
            name: game.i18n.localize("STRESS.PushingLimits.AdvantageEffectName"),
            img: FEATURE_ICON,
            origin: actor.uuid,
            flags: { [STRESS_CONFIG.MODULE_ID]: { [ADVANTAGE_FLAG]: true } },
            changes
        }]);

        return PushingLimitsDialog.createChatCard(actor, {
            desc: game.i18n.format("STRESS.PushingLimits.AdvantageDesc", { name: esc(actor.name) }),
            exhaustionGain
        });
    }

    /** Spent spell slots of levels 1-5, plus spent Warlock pact slots of level 5 or lower. */
    static recoverableSlots(actor) {
        const spells = actor.system.spells ?? {};
        const slots = [];
        for (let lvl = 1; lvl <= MAX_RECOVERABLE_SLOT_LEVEL; lvl++) {
            const slot = spells[`spell${lvl}`];
            if (slot?.max > 0 && slot.value < slot.max) slots.push({ key: `spell${lvl}`, level: lvl, slot, pact: false });
        }
        const pact = spells.pact;
        if (pact?.max > 0 && pact.value < pact.max && pact.level > 0 && pact.level <= MAX_RECOVERABLE_SLOT_LEVEL) {
            slots.push({ key: "pact", level: pact.level, slot: pact, pact: true });
        }
        return slots;
    }

    static async applySpellSlot(actor, key) {
        const entry = PushingLimitsDialog.recoverableSlots(actor).find(s => s.key === key);
        if (!entry) {
            ui.notifications.warn(game.i18n.localize("STRESS.PushingLimits.NoSlotAvailable"));
            return;
        }

        await actor.update({ [`system.spells.${key}.value`]: entry.slot.value + 1 });
        const { exhaustionGain } = await StressManager.applyStress(actor, entry.level * StressManager.ratio);

        return PushingLimitsDialog.createChatCard(actor, {
            desc: game.i18n.format("STRESS.PushingLimits.SlotDesc", { name: esc(actor.name), level: entry.level }),
            exhaustionGain
        });
    }

    static createChatCard(actor, { desc, exhaustionGain }) {
        return postStressCard(actor, {
            title: game.i18n.localize("STRESS.PushingLimits.Title"),
            template: "pushing-limits",
            data: { desc, exhaustionGain }
        });
    }
}

class PushingLimitsPrompt extends StressDialogBase {
    static DEFAULT_OPTIONS = {
        window: { title: "STRESS.PushingLimits.Title", icon: "fas fa-fist-raised" },
        classes: ["stress-pushing-limits", "dnd5e2"],
        position: { width: 420 },
        form: { handler: PushingLimitsPrompt.#onSubmit }
    };

    static PARTS = {
        form: { template: "modules/stresspoints-rest/templates/pushing-limits.hbs" }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const costLabel = n => game.i18n.format("STRESS.PushingLimits.Cost", { n });
        const slots = PushingLimitsDialog.recoverableSlots(this.actor).map(({ key, level, slot, pact }) => ({
            key,
            costLabel: costLabel(level),
            label: game.i18n.format(pact ? "STRESS.PushingLimits.PactOption" : "STRESS.PushingLimits.SlotOption",
                { level, value: slot.value, max: slot.max })
        }));
        return Object.assign(context, StressDialogBase.hudContext(this.actor), {
            actor: this.actor,
            advantageCost: costLabel(1),
            spellLevels: slots,
            first: slots[0] ?? null
        });
    }

    _onSlotSelected(target) {
        if (target.dataset.input !== "choice") return;
        const section = this.element.querySelector(".pl-slot-section");
        if (section) section.hidden = target.dataset.value !== "slot";
    }

    _onOptionSelected(target) {
        const cost = this.element.querySelector('[data-input="choice"][data-value="slot"] .rest-tile-meta');
        if (cost) cost.textContent = target.dataset.costLabel;
    }

    static async #onSubmit(event, form, formData) {
        const { choice, slotLevel } = formData.object;
        this.close();
        try {
            if (choice === "slot" && slotLevel) await PushingLimitsDialog.applySpellSlot(this.actor, slotLevel);
            else await PushingLimitsDialog.applyAdvantage(this.actor);
        } catch (err) {
            console.error("Stress Points & Rest | Pushing Limits failed:", err);
        }
    }
}
