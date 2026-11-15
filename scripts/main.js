import { StressManager, STRESS_CONFIG } from "./stress-manager.js";
import { StressRestDialog } from "./rest-dialog.js";
import { StressShortRestDialog } from "./short-rest-dialog.js";
import { ExhaustionHandler } from "./exhaustion-handler.js";
import { PushingLimitsDialog } from "./pushing-limits.js";
import { postStressCard } from "./chat-card.js";
import { StressGMPanel, onCampEnvironmentChange } from "./gm-panel.js";
import { SheetIntegration } from "./sheet-integration.js";
import { groupSettings } from "./settings-sections.js";
import { CAMP_SETTING, GM_ENV_SETTING, setCampEnvironment, setActorEnvironment, actorEnvironment } from "./environment.js";

Hooks.once("init", () => {
    console.log("Stress Points & Rest | Initializing");

    game.settings.register(STRESS_CONFIG.MODULE_ID, "maxStress", {
        name: "STRESS.Settings.MaxStress.Name",
        hint: "STRESS.Settings.MaxStress.Hint",
        scope: "world",
        config: true,
        type: Number,
        range: { min: 1, max: 60, step: 1 },
        default: 12,
        onChange: value => { STRESS_CONFIG.MAX_STRESS = value; }
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "stressRatio", {
        name: "STRESS.Settings.Ratio.Name",
        hint: "STRESS.Settings.Ratio.Hint",
        scope: "world",
        config: true,
        type: Number,
        range: { min: 1, max: 10, step: 1 },
        default: 2,
        onChange: value => { STRESS_CONFIG.RATIO = value; }
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "stressOnZeroHp", {
        name: "STRESS.Settings.StressZero.Name",
        hint: "STRESS.Settings.StressZero.Hint",
        scope: "world",
        config: true,
        type: Number,
        range: { min: 0, max: 12, step: 1 },
        default: 2
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "autoHpZero", {
        name: "STRESS.Settings.AutoHp.Name",
        hint: "STRESS.Settings.AutoHp.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "requireHealerKitLong", {
        name: "STRESS.Settings.HealerLong.Name",
        hint: "STRESS.Settings.HealerLong.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "longRestNeedsHp", {
        name: "STRESS.Settings.LongRestHp.Name",
        hint: "STRESS.Settings.LongRestHp.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "requireHealerKitShort", {
        name: "STRESS.Settings.HealerShort.Name",
        hint: "STRESS.Settings.HealerShort.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "foodCost", {
        name: "STRESS.Settings.FoodCost.Name",
        scope: "world",
        config: true,
        type: Number,
        default: 0.5
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "foodCurrency", {
        name: "STRESS.Settings.FoodCur.Name",
        scope: "world",
        config: true,
        type: String,
        choices: { "pp": "PP", "gp": "GP", "ep": "EP", "sp": "SP", "cp": "CP" },
        default: "gp"
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "drinkCost", {
        name: "STRESS.Settings.DrinkCost.Name",
        scope: "world",
        config: true,
        type: Number,
        default: 0.2
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "drinkCurrency", {
        name: "STRESS.Settings.DrinkCur.Name",
        scope: "world",
        config: true,
        type: String,
        choices: { "pp": "PP", "gp": "GP", "ep": "EP", "sp": "SP", "cp": "CP" },
        default: "gp"
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "foodMode", {
        name: "STRESS.Settings.FoodMode.Name",
        scope: "world",
        config: true,
        type: String,
        choices: { "mandatory": "STRESS.Options.Mandatory", "roll": "STRESS.Options.Roll" },
        default: "mandatory"
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "drinkMode", {
        name: "STRESS.Settings.DrinkMode.Name",
        scope: "world",
        config: true,
        type: String,
        choices: { "mandatory": "STRESS.Options.Mandatory", "roll": "STRESS.Options.Roll" },
        default: "mandatory"
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "environmentMode", {
        name: "STRESS.Settings.EnvMode.Name",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, GM_ENV_SETTING, {
        name: "STRESS.Settings.GmEnv.Name",
        hint: "STRESS.Settings.GmEnv.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: () => onCampEnvironmentChange()
    });

    // Party camp DC, set in the GM panel.
    game.settings.register(STRESS_CONFIG.MODULE_ID, CAMP_SETTING, {
        scope: "world",
        config: false,
        type: Number,
        default: 0,
        onChange: () => onCampEnvironmentChange()
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "maxFoodRarity", {
        name: "STRESS.Settings.MaxFoodRarity.Name",
        hint: "STRESS.Settings.MaxFoodRarity.Hint",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "common":    "STRESS.Rarity.Common",
            "uncommon":  "STRESS.Rarity.Uncommon",
            "rare":      "STRESS.Rarity.Rare",
            "veryrare":  "STRESS.Rarity.VeryRare",
            "legendary": "STRESS.Rarity.Legendary"
        },
        default: "common"
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "maxDrinkRarity", {
        name: "STRESS.Settings.MaxDrinkRarity.Name",
        hint: "STRESS.Settings.MaxDrinkRarity.Hint",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "common":    "STRESS.Rarity.Common",
            "uncommon":  "STRESS.Rarity.Uncommon",
            "rare":      "STRESS.Rarity.Rare",
            "veryrare":  "STRESS.Rarity.VeryRare",
            "legendary": "STRESS.Rarity.Legendary"
        },
        default: "common"
    });

    STRESS_CONFIG.MAX_STRESS = game.settings.get(STRESS_CONFIG.MODULE_ID, "maxStress");
    STRESS_CONFIG.RATIO = game.settings.get(STRESS_CONFIG.MODULE_ID, "stressRatio");

    StressManager.initHooks();
    ExhaustionHandler.init();
    PushingLimitsDialog.init();
    StressRestDialog.init();
    StressShortRestDialog.init();
    StressGMPanel.init();
    SheetIntegration.init();

    // Public API for macros and other modules.
    game.modules.get(STRESS_CONFIG.MODULE_ID).api = {
        openGMPanel: () => StressGMPanel.open(),
        getStress: actor => StressManager.getStress(actor),
        setStress: (actor, value) => StressManager.setStress(actor, value),
        applyStress: (actor, delta) => StressManager.applyStress(actor, delta),
        setCampEnvironment,
        setActorEnvironment,
        getActorEnvironment: actor => actorEnvironment(actor),
        getExhaustionFor: stress => StressManager.exhaustionFor(stress),
        get maxStress() { return StressManager.maxStress; },
        get ratio() { return StressManager.ratio; },
        HOOK_STRESS_CHANGED: `${STRESS_CONFIG.MODULE_ID}.stressChanged`
    };
});

Hooks.on("renderSettingsConfig", groupSettings);

// Automated tests, only when the Quench module is active.
Hooks.once("quenchReady", async quench => {
    const { registerQuenchTests } = await import("./tests/quench-tests.js");
    registerQuenchTests(quench);
});

Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
    if (game.user.id !== userId || actor.type !== "character") return;
    if (options.stressSync || options.stressRest || options.isRest) return;

    // A manual exhaustion change (sheet, condition toggle, other module) moves stress along with it.
    if (foundry.utils.hasProperty(changes, "system.attributes.exhaustion")) {
        const newEx = Number(foundry.utils.getProperty(changes, "system.attributes.exhaustion")) || 0;
        const diff = newEx - StressManager.getExhaustion(actor);
        if (diff !== 0) {
            const newStress = StressManager.clampStress(StressManager.getStress(actor) + (diff * StressManager.ratio));
            foundry.utils.setProperty(changes, `flags.${STRESS_CONFIG.MODULE_ID}.${STRESS_CONFIG.FLAG_NAME}`, newStress);
        }
    }
});

Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (game.user.id !== userId || actor.type !== "character") return;
    if (!game.settings.get(STRESS_CONFIG.MODULE_ID, "autoHpZero")) return;
    // Updates made by rests or by this module (e.g. reverting HP) are not a collapse.
    if (options.isRest || options.stressRest || options.stressSync || options.isRestore) return;
    if (foundry.utils.getProperty(changes, "system.attributes.hp.value") !== 0) return;

    const amount = game.settings.get(STRESS_CONFIG.MODULE_ID, "stressOnZeroHp");
    if (!amount) return;
    const { stressGain, exhaustionGain } = await StressManager.applyStress(actor, amount);

    postStressCard(actor, {
        title: game.i18n.localize("STRESS.Collapse.Title"),
        tone: "danger",
        template: "collapse",
        data: { stressGain, exhaustionGain }
    });
});

// Swap dnd5e's rest flow for the module's dialogs. The original config is replayed on confirm, otherwise
// GM requests on tables with "allowRests" off would be refused.
const restOverrides = (config) => {
    const { dialogClass, type, ...rest } = config;
    return rest;
};

Hooks.on("dnd5e.preLongRest", (actor, config) => {
    if (actor.type !== "character" || config.stressRestModule) return true;
    if (StressRestDialog.blockedByZeroHp(actor)) return false;
    StressRestDialog.open(actor, restOverrides(config));
    return false;
});

Hooks.on("dnd5e.preShortRest", (actor, config) => {
    if (actor.type !== "character" || config.stressRestModule) return true;
    StressShortRestDialog.open(actor, restOverrides(config));
    return false;
});
