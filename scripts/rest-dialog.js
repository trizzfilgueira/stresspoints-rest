import { StressManager, STRESS_CONFIG, esc } from "./stress-manager.js";
import { ItemHandler } from "./item-handler.js";
import { StressDialogBase } from "./dialog-base.js";
import { postStressCard, tone, stressBonusText, logIcon } from "./chat-card.js";
import { envLevel, envOptions, gmControlsEnvironment, actorEnvironment } from "./environment.js";

const RARITY_TIERS = [
    { key: "common",    i18n: "Common",    multiplier: 1,  bonus: 0, color: "#cfcdc2" },
    { key: "uncommon",  i18n: "Uncommon",  multiplier: 3,  bonus: 1, color: "#1eff00" },
    { key: "rare",      i18n: "Rare",      multiplier: 8,  bonus: 2, color: "#0070dd" },
    { key: "veryrare",  i18n: "VeryRare",  multiplier: 20, bonus: 3, color: "#a335ee" },
    { key: "legendary", i18n: "Legendary", multiplier: 50, bonus: 4, color: "#ff8000" }
];
const BUY_PREFIX = "buy_external_";
const BASE_RECOVERY = -2;

const PROVISIONS = {
    food: {
        icon: "utensils", buyIcon: "bowl-food", costKey: "foodCost", curKey: "foodCurrency", modeKey: "foodMode",
        success: "STRESS.Msg.EatSuccess", missing: "STRESS.Report.NoFood", check: "STRESS.Labels.FoodCheck"
    },
    drink: {
        icon: "glass-water", buyIcon: "glass-water", costKey: "drinkCost", curKey: "drinkCurrency", modeKey: "drinkMode",
        success: "STRESS.Msg.DrinkSuccess", missing: "STRESS.Report.NoDrink", check: "STRESS.Labels.DrinkCheck"
    }
};

const TENT_RE = /(?<!\p{L})(?:tent|barraca|tenda)(?!\p{L})/iu;
const BEDROLL_RE = /(?<!\p{L})(?:bedroll|saco de dormir)(?!\p{L})/iu;
const IMMUNE_NAME_RE = /warforged|forjado|reborn|renascido/i;
const IMMUNE_TYPES = new Set(["construct", "undead"]);

/** Stress removed by eating/drinking an item of this rarity (artifacts count as legendary). */
const rarityBonus = item => {
    const rarity = String(item.system.rarity ?? "").toLowerCase();
    return rarity === "artifact" ? 4 : (RARITY_TIERS.find(t => t.key === rarity)?.bonus ?? 0);
};

const setting = key => game.settings.get(STRESS_CONFIG.MODULE_ID, key);
const round2 = n => Math.round(n * 100) / 100;

export class StressRestDialog extends StressDialogBase {
    constructor(actor, restConfig = {}) {
        super(actor);
        this.restConfig = restConfig;
    }

    _refreshArgs(restConfig) {
        if (restConfig) this.restConfig = restConfig;
    }

    static DEFAULT_OPTIONS = {
        window: { title: "STRESS.Dialog.LongRest", icon: "fas fa-campground" },
        classes: ["stress-long-rest", "dnd5e2"],
        position: { width: 560 },
        form: { handler: StressRestDialog.#onSubmit }
    };

    static PARTS = {
        form: { template: "modules/stresspoints-rest/templates/long-rest.hbs" }
    };

    static init() {
        // No healing item: drop the HP from the rest result. Restoring and reverting it would trigger the 0 HP collapse.
        Hooks.on("dnd5e.preRestCompleted", (actor, result, config) => {
            if (!config?.stressSkipHp) return;
            delete result.updateData?.["system.attributes.hp.value"];
            if (result.deltas) result.deltas.hitPoints = 0;
            result.dhp = 0;
        });
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const actor = this.actor;

        const buildBuyOptions = (baseCost, cur, maxRarityKey) => {
            if (!(baseCost > 0)) return [];
            const maxIdx = Math.max(0, RARITY_TIERS.findIndex(t => t.key === maxRarityKey));
            return RARITY_TIERS.slice(0, maxIdx + 1).map(tier => {
                const price = round2(baseCost * tier.multiplier);
                return {
                    value: `${BUY_PREFIX}${tier.key}`,
                    color: tier.color,
                    label: game.i18n.localize(`STRESS.Rarity.${tier.i18n}`),
                    priceText: `${price} ${cur}`,
                    tip: StressDialogBase.bonusLabel(tier.bonus)
                };
            });
        };

        return Object.assign(context, StressDialogBase.hudContext(actor), {
            actor,
            useEnvironment: setting("environmentMode"),
            gmEnvironment: gmControlsEnvironment(),
            campEnv: envLevel(actorEnvironment(actor)),
            envOptions: envOptions(0),
            useHealItems: setting("requireHealerKitLong"),
            foodBuyOptions: buildBuyOptions(setting("foodCost"), setting("foodCurrency"), setting("maxFoodRarity")),
            drinkBuyOptions: buildBuyOptions(setting("drinkCost"), setting("drinkCurrency"), setting("maxDrinkRarity")),
            foodItems: StressDialogBase.slotItems(ItemHandler.itemsOfKind(actor, "food"), rarityBonus),
            drinkItems: StressDialogBase.slotItems(ItemHandler.itemsOfKind(actor, "drink"), rarityBonus),
            healItems: StressDialogBase.slotItems(ItemHandler.itemsOfKind(actor, "heal"))
        });
    }

    static async #onSubmit(event, form, formData) {
        // Read the form, then close; the rolls and the rest happen afterwards.
        const envLabel = this.element.querySelector(".custom-option.selected")?.dataset.label ?? envLevel(formData.object.environment).label;
        this.close();
        try {
            await this._performRest(formData.object, envLabel);
        } catch (err) {
            console.error("Stress Points & Rest | Long rest failed:", err);
            ui.notifications.error(game.i18n.localize("STRESS.Warn.RestFailed"));
        }
    }

    _isImmune() {
        const actor = this.actor;
        // On characters the species is an embedded Item; its creature type lives on the item, not on details.type.
        const species = actor.system.details?.race;
        const speciesName = typeof species === "string" ? species : species?.name;
        const creatureType = species?.system?.type?.value ?? actor.system.details?.type?.value;
        return IMMUNE_NAME_RE.test(speciesName ?? "") || IMMUNE_TYPES.has(String(creatureType ?? "").toLowerCase());
    }

    // Resolves to null when the roll is cancelled.
    async _rollConSave(dc, flavorText) {
        if (dc <= 0) return { success: true, total: 0 };
        const rolls = await this.actor.rollSavingThrow(
            { ability: "con", target: dc },
            {},
            { data: { flavor: `${flavorText} → <b>${game.i18n.localize("STRESS.Env.DC")} ${dc}</b>` } }
        );
        const roll = Array.isArray(rolls) ? rolls[0] : rolls;
        if (!roll) return null;
        return { success: roll.total >= dc, total: roll.total };
    }

    // 2014 and 2024 rules: a long rest needs at least 1 HP.
    static blockedByZeroHp(actor) {
        if (!setting("longRestNeedsHp")) return false;
        if ((Number(actor.system.attributes?.hp?.value) || 0) > 0) return false;
        ui.notifications.warn(game.i18n.format("STRESS.Warn.LongRestNeedsHp", { name: actor.name }));
        return true;
    }

    async _performRest(data, envLabel) {
        const actor = this.actor;
        // HP may have dropped while the dialog was open.
        if (StressRestDialog.blockedByZeroHp(actor)) return;
        const logs = [];
        let modifiers = 0;
        const stressStart = StressManager.getStress(actor);
        const isImmune = this._isImmune();
        const requireHeal = setting("requireHealerKitLong");

        // Saves come first: a cancelled roll aborts the rest before anything is spent.
        const needsCheck = kind => !isImmune && !data[`${kind}Id`] && setting(PROVISIONS[kind].modeKey) === "roll";
        const checks = {};
        for (const kind of ["food", "drink"]) {
            if (!needsCheck(kind)) continue;
            checks[kind] = await this._rollConSave(10, game.i18n.localize(PROVISIONS[kind].check));
            if (!checks[kind]) return this._abort();
        }

        let envResult = null;
        let envBonusLogs = [];
        // When the GM controls the camp, the current world value wins over whatever the form says.
        if (gmControlsEnvironment()) {
            const camp = envLevel(actorEnvironment(this.actor));
            data.environment = camp.dc;
            envLabel = camp.label;
        }
        const envDc = Number(data.environment) || 0;
        if (setting("environmentMode") && envDc > 0) {
            let envBonus = 0;
            if (actor.items.some(i => TENT_RE.test(i.name))) {
                envBonus += 4;
                envBonusLogs.push(`${logIcon("tent")} <b>${game.i18n.localize("STRESS.Item.Tent")}:</b> -4 ${game.i18n.localize("STRESS.Env.DC")}`);
            }
            if (actor.items.some(i => BEDROLL_RE.test(i.name))) {
                envBonus += 2;
                envBonusLogs.push(`${logIcon("bed")} <b>${game.i18n.localize("STRESS.Item.Bedroll")}:</b> -2 ${game.i18n.localize("STRESS.Env.DC")}`);
            }
            envResult = await this._rollConSave(Math.max(0, envDc - envBonus), game.i18n.localize("STRESS.Labels.EnvCheck"));
            if (!envResult) return this._abort();
        }

        // Run the dnd5e rest before spending anything, so a refused rest costs nothing. Exhaustion follows
        // stress, so dnd5e's own reduction is off, and HP only comes back with a healing item.
        let healItem = requireHeal && data.healId ? actor.items.get(data.healId) : null;
        if (healItem && !ItemHandler.hasSupply(healItem)) healItem = null;
        const recoversHp = !requireHeal || !!healItem;
        const restResult = await actor.longRest({
            ...this.restConfig,
            dialog: false,
            // A GM-requested rest only counts as done once dnd5e posts its own result message.
            chat: Boolean(this.restConfig.request),
            exhaustionDelta: 0,
            stressRestModule: true,
            stressSkipHp: !recoversHp
        });
        if (!restResult) return;

        // Food and drink
        if (isImmune) {
            logs.push(`${logIcon("utensils")} ${game.i18n.localize("STRESS.Msg.ImmuneFood")}`);
            logs.push(`${logIcon("glass-water")} ${game.i18n.localize("STRESS.Msg.ImmuneDrink")}`);
        } else {
            for (const kind of ["food", "drink"]) {
                modifiers += await this._resolveProvision(kind, data[`${kind}Id`], checks[kind], logs);
            }
        }

        // Environment
        if (setting("environmentMode")) {
            if (envResult) {
                logs.push(...envBonusLogs);
                let failText = "";
                if (!envResult.success) {
                    modifiers += 1;
                    failText = ` ${tone("bad", `+1 ${game.i18n.localize("STRESS.Hud.Stress")}`)}`;
                }
                logs.push(`${logIcon(envResult.success ? "shield-halved" : "skull")} ${game.i18n.format("STRESS.Report.EnvUnsafe", { type: esc(envLabel) })}${failText}`);
            } else {
                logs.push(`${logIcon("tree")} ${game.i18n.localize("STRESS.Report.EnvSafe")}`);
            }
        }

        // Healing item, spent only now that the rest went through
        if (requireHeal) {
            if (healItem) await ItemHandler.consume(actor, healItem.id, { silent: false });
            logs.push(healItem
                ? `${logIcon("kit-medical")} ${game.i18n.localize("STRESS.Report.UsedItem")}: <b>${esc(healItem.name)}</b>`
                : `${logIcon("kit-medical")} ${tone("warn", game.i18n.localize("STRESS.Report.NoHeal"))}`);
        }
        if (recoversHp) logs.push(tone("good", game.i18n.localize("STRESS.Report.HPFull")));

        const finalStress = StressManager.clampStress(stressStart + BASE_RECOVERY + modifiers);
        await StressManager.setStress(actor, finalStress, { stressRest: true });

        await postStressCard(actor, {
            title: game.i18n.localize("STRESS.Report.Title"),
            template: "long-rest",
            data: {
                logs,
                start: stressStart,
                recovery: BASE_RECOVERY,
                modifiers: modifiers >= 0 ? `+${modifiers}` : modifiers,
                final: finalStress
            }
        });
    }

    _abort() {
        ui.notifications.warn(game.i18n.localize("STRESS.Warn.RestCancelled"));
    }

    // Buy, consume, roll for or go without food or drink. Returns the stress modifier.
    async _resolveProvision(kind, choice, check, logs) {
        const cfg = PROVISIONS[kind];
        const actor = this.actor;
        const missing = () => {
            logs.push(`${logIcon(cfg.icon)} ${game.i18n.localize(cfg.missing)}`);
            return 1;
        };

        if (choice?.startsWith(BUY_PREFIX)) {
            const tier = RARITY_TIERS.find(t => t.key === choice.slice(BUY_PREFIX.length)) ?? RARITY_TIERS[0];
            const cost = round2(setting(cfg.costKey) * tier.multiplier);
            if (!(await ItemHandler.payCurrency(actor, cost, setting(cfg.curKey)))) {
                logs.push(`${logIcon(cfg.icon)} ${tone("gold", game.i18n.localize("STRESS.Msg.InsufficientFunds"))} ${game.i18n.localize(cfg.missing)}`);
                return 1;
            }
            const rarityLabel = game.i18n.localize(`STRESS.Rarity.${tier.i18n}`);
            const buyLabel = ` (${game.i18n.localize("STRESS.Msg.BuyExternal")})`;
            logs.push(`${logIcon(cfg.buyIcon)} ${game.i18n.localize(cfg.success)}${buyLabel} <span class="sr-accent" style="--sr-accent: ${tier.color}">(${rarityLabel})</span>${stressBonusText(tier.bonus)}`);
            return -tier.bonus;
        }

        if (choice) {
            const item = await ItemHandler.consume(actor, choice);
            // An empty or missing item means the character did not actually eat/drink.
            if (!item) return missing();
            const bonus = rarityBonus(item);
            logs.push(`${logIcon(cfg.icon)} ${game.i18n.localize(cfg.success)}: ${esc(item.name)}${stressBonusText(bonus)}`);
            return -bonus;
        }

        if (check) {
            if (check.success) {
                logs.push(`${logIcon(cfg.icon)} ${game.i18n.localize("STRESS.Msg.Saved")}`);
                return 0;
            }
            logs.push(`${logIcon(cfg.icon)} ${game.i18n.localize("STRESS.Msg.FailStress")}`);
            return 1;
        }

        return missing();
    }
}
