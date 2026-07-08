import { STRESS_CONFIG } from "./stress-manager.js";

const FEATURE_FLAG = "pushingLimits";
const ADVANTAGE_FLAG = "pushingLimitsAdvantage";
const FEATURE_ICON = "icons/magic/fire/flame-burning-fist-strike.webp";
const FOLDER_NAME = "Features";
const MAX_RECOVERABLE_SLOT_LEVEL = 5;

// Hooks that fire once a d20 roll has actually been made, used to auto-consume the temporary advantage effect.
const ROLL_HOOKS = [
    "dnd5e.rollAttack",
    "dnd5e.rollAbilityCheck",
    "dnd5e.rollSavingThrow",
    "dnd5e.rollSkill",
    "dnd5e.rollToolCheck",
    "dnd5e.rollDeathSave"
];

export class PushingLimitsDialog {

    static init() {
        Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
            const item = activity?.item;
            if (!item?.getFlag(STRESS_CONFIG.MODULE_ID, FEATURE_FLAG)) return;
            new PushingLimitsPrompt(item.actor).render(true);
        });

        for (const hookName of ROLL_HOOKS) {
            Hooks.on(hookName, (rolls, data) => {
                const actor = data?.subject?.actor ?? data?.subject;
                PushingLimitsDialog._consumeAdvantage(actor);
            });
        }

        Hooks.once("ready", () => PushingLimitsDialog.ensureFeatureItem());
    }

    static async _consumeAdvantage(actor) {
        const effect = actor?.effects?.find(e => e.getFlag(STRESS_CONFIG.MODULE_ID, ADVANTAGE_FLAG));
        if (effect) await effect.delete();
    }

    /**
     * Makes sure exactly one correctly configured "Pushing Limits" feature item exists in the compendium,
     * filed under the Features folder. Removes duplicates left over from earlier setup attempts.
     */
    static async ensureFeatureItem() {
        if (!game.user.isGM) return;

        const pack = game.packs.get(`${STRESS_CONFIG.MODULE_ID}.stress-items`);
        if (!pack) return;

        try {
            await PushingLimitsDialog._reconcileFeatureItem(pack);
        } catch (err) {
            console.error("Stress Points & Rest | Failed to set up the 'Pushing Limits' feature item:", err);
            ui.notifications.error("Stress Points & Rest: falha ao configurar o item 'Levar ao Limite'. Veja o console (F12).");
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
        await PushingLimitsDialog._applyExhaustion(actor, 1);

        await actor.createEmbeddedDocuments("ActiveEffect", [{
            name: game.i18n.localize("STRESS.PushingLimits.AdvantageEffectName"),
            img: FEATURE_ICON,
            origin: actor.uuid,
            flags: {
                [STRESS_CONFIG.MODULE_ID]: { [ADVANTAGE_FLAG]: true }
            },
            changes: [
                { key: "flags.midi-qol.advantage.all", mode: CONST.ACTIVE_EFFECT_MODES.CUSTOM, value: "1", priority: 20 }
            ]
        }]);

        PushingLimitsDialog.createChatCard(actor, {
            desc: game.i18n.format("STRESS.PushingLimits.AdvantageDesc", { name: actor.name }),
            exhaustionGain: 1
        });
    }

    static async applySpellSlot(actor, level) {
        if (!level || level > MAX_RECOVERABLE_SLOT_LEVEL) return;
        const key = `spell${level}`;
        const slot = actor.system.spells?.[key];
        if (!slot || slot.value >= slot.max) {
            ui.notifications.warn(game.i18n.localize("STRESS.PushingLimits.NoSlotAvailable"));
            return;
        }

        const exhaustionGain = level;

        await actor.update({ [`system.spells.${key}.value`]: slot.value + 1 });
        await PushingLimitsDialog._applyExhaustion(actor, exhaustionGain);

        PushingLimitsDialog.createChatCard(actor, {
            desc: game.i18n.format("STRESS.PushingLimits.SlotDesc", { name: actor.name, level }),
            exhaustionGain
        });
    }

    static async _applyExhaustion(actor, exhaustionGain) {
        const ratio = game.settings.get(STRESS_CONFIG.MODULE_ID, "stressRatio") ?? 2;
        const maxStress = game.settings.get(STRESS_CONFIG.MODULE_ID, "maxStress") ?? 12;

        const currentStress = actor.getFlag(STRESS_CONFIG.MODULE_ID, STRESS_CONFIG.FLAG_NAME) || 0;
        const currentEx = actor.system.attributes.exhaustion || 0;
        const newStress = Math.min(currentStress + (exhaustionGain * ratio), maxStress);
        const newEx = Math.min(currentEx + exhaustionGain, 6);

        await actor.update({
            [`flags.${STRESS_CONFIG.MODULE_ID}.${STRESS_CONFIG.FLAG_NAME}`]: newStress,
            "system.attributes.exhaustion": newEx
        }, { stressSync: true });
    }

    static createChatCard(actor, { desc, exhaustionGain }) {
        const bannerImg = "systems/dnd5e/ui/official/banner-character-dark.webp";
        const title = game.i18n.localize("STRESS.PushingLimits.Title");
        const lblCost = game.i18n.localize("STRESS.Feature.CostLabel");

        const content = `
        <div style="background:#111215; border:1px solid #000; color:#cfcdc2; font-family:'Signika', sans-serif; margin-top:5px;">
            <div style="position:relative; height:60px; overflow:hidden; border-bottom:1px solid #333;">
                <div style="position:absolute; width:100%; height:100%; background:url('${bannerImg}') top center/cover; opacity:0.5;"></div>
                <h3 style="position:relative; z-index:2; text-align:center; margin:0; padding-top:18px; color:#ecebdb; font-family:'Modesto Condensed', serif; font-size:24px; text-shadow:0 0 5px black; text-transform:uppercase;">
                    ${title}
                </h3>
            </div>
            <div style="padding:15px; text-align:center;">
                <div style="font-family:'Modesto Condensed', serif; font-size:24px; color:#ecebdb; text-transform:uppercase; margin-bottom:10px;">
                    ${actor.name}
                </div>
                <p style="font-size:13px; color:#aaa; font-style:italic; margin-bottom:15px;">
                    ${desc}
                </p>
                <div style="background:rgba(80, 0, 0, 0.4); border:1px solid #7a0000; padding:8px; border-radius:3px; display:inline-block; min-width:140px;">
                    <div style="font-size:10px; color:#ff8888; margin-bottom:2px;">${lblCost}</div>
                    <div style="color:#ff5555; font-family:'Modesto Condensed', serif; font-size:22px; font-weight:bold;">
                        +${exhaustionGain} ${game.i18n.localize("STRESS.Hud.Exhaustion")}
                    </div>
                </div>
            </div>
        </div>`;

        ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
    }
}

class PushingLimitsPrompt extends FormApplication {
    constructor(actor) {
        super();
        this.actor = actor;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "pushing-limits-dialog",
            template: "modules/stresspoints-rest/templates/pushing-limits.hbs",
            title: game.i18n.localize("STRESS.PushingLimits.Title"),
            width: 380,
            classes: ["stress-rest-dialog"],
            closeOnSubmit: true
        });
    }

    getData() {
        const data = super.getData();
        const actor = this.actor;
        data.actor = actor;

        data.spellLevels = Array.from({ length: MAX_RECOVERABLE_SLOT_LEVEL }, (_, i) => i + 1)
            .map(lvl => ({ lvl, slot: actor.system.spells?.[`spell${lvl}`] }))
            .filter(({ slot }) => slot && slot.max > 0 && slot.value < slot.max)
            .map(({ lvl, slot }) => ({
                level: lvl,
                cost: lvl,
                label: game.i18n.format("STRESS.PushingLimits.SlotOption", { level: lvl, value: slot.value, max: slot.max })
            }));

        data.firstLevel = data.spellLevels[0]?.level ?? "";
        data.firstCost = data.spellLevels[0]?.cost ?? "";
        data.firstLabel = data.spellLevels[0]?.label ?? "";

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);
        const slotSection = html.find("#pl-slot-section");

        html.find(".pl-choice").click(ev => {
            const el = $(ev.currentTarget);
            html.find(".pl-choice").removeClass("selected");
            el.addClass("selected");
            const choice = el.data("choice");
            html.find("#input-choice").val(choice);
            slotSection.toggle(choice === "slot");
        });

        const wrapper = html.find(".custom-select-wrapper");
        html.find(".custom-select-trigger").click(e => { e.stopPropagation(); wrapper.toggleClass("open"); });
        html.find(".custom-option").click(ev => {
            const el = $(ev.currentTarget);
            html.find(".custom-option").removeClass("selected");
            el.addClass("selected");
            html.find(".custom-select-trigger span").text(el.text());
            html.find("#input-slotLevel").val(el.data("value"));
            html.find("#pl-slot-cost").text(`+${el.data("cost")} ${game.i18n.localize("STRESS.Hud.Exhaustion")}`);
            wrapper.removeClass("open");
        });
    }

    async _updateObject(event, formData) {
        if (formData.choice === "slot" && formData.slotLevel) {
            await PushingLimitsDialog.applySpellSlot(this.actor, Number(formData.slotLevel));
        } else {
            await PushingLimitsDialog.applyAdvantage(this.actor);
        }
    }
}
