import { StressManager, STRESS_CONFIG } from "./stress-manager.js";
import { StressRestDialog } from "./rest-dialog.js";
import { StressShortRestDialog } from "./short-rest-dialog.js";
import { ExhaustionHandler } from "./exhaustion-handler.js";

Hooks.once("init", () => {
    console.log("Stress Points & Rest | Inicializando...");

    game.settings.register(STRESS_CONFIG.MODULE_ID, "maxStress", {
        name: "STRESS.Settings.MaxStress.Name",
        hint: "STRESS.Settings.MaxStress.Hint",
        scope: "world",
        config: true,
        type: Number,
        default: 12,
        onChange: value => { STRESS_CONFIG.MAX_STRESS = value; }
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "stressRatio", {
        name: "STRESS.Settings.Ratio.Name",
        hint: "STRESS.Settings.Ratio.Hint",
        scope: "world",
        config: true,
        type: Number,
        default: 2,
        onChange: value => { STRESS_CONFIG.RATIO = value; }
    });

    game.settings.register(STRESS_CONFIG.MODULE_ID, "stressOnZeroHp", {
        name: "STRESS.Settings.StressZero.Name",
        hint: "STRESS.Settings.StressZero.Hint",
        scope: "world",
        config: true,
        type: Number,
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

    ExhaustionHandler.init();
});

Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
    if (game.user.id !== userId || actor.type !== "character") return;
    if (options.stressSync || options.stressRest) return;

    if (hasProperty(changes, "system.attributes.exhaustion")) {
        const newEx = getProperty(changes, "system.attributes.exhaustion");
        const oldEx = actor.system.attributes.exhaustion || 0;
        const diff = newEx - oldEx;
        if (diff !== 0) {
            const currentStress = StressManager.getStress(actor);
            const newStress = Math.clamped(currentStress + (diff * STRESS_CONFIG.RATIO), 0, STRESS_CONFIG.MAX_STRESS);
            foundry.utils.setProperty(changes, `flags.${STRESS_CONFIG.MODULE_ID}.${STRESS_CONFIG.FLAG_NAME}`, newStress);
        }
    }
});

Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (game.user.id !== userId || actor.type !== "character") return;
    if (!game.settings.get(STRESS_CONFIG.MODULE_ID, "autoHpZero")) return;

    if (changes.system?.attributes?.hp?.value === 0 && !options.isRestore) {
        const amount = game.settings.get(STRESS_CONFIG.MODULE_ID, "stressOnZeroHp");
        const current = StressManager.getStress(actor);
        const newStress = Math.clamped(current + amount, 0, STRESS_CONFIG.MAX_STRESS);
        const currentExhaustion = actor.system.attributes.exhaustion || 0;
        const exhaustionGain = Math.floor(amount / STRESS_CONFIG.RATIO);
        const newExhaustion = Math.min(currentExhaustion + exhaustionGain, 6);

        await actor.update({
            [`flags.${STRESS_CONFIG.MODULE_ID}.${STRESS_CONFIG.FLAG_NAME}`]: newStress,
            "system.attributes.exhaustion": newExhaustion
        }, { stressSync: true });

        const bannerImg = "systems/dnd5e/ui/official/banner-character-dark.webp";
        const content = `
        <div style="background:#111215; border:1px solid #000; color:#cfcdc2; font-family:'Signika', sans-serif; margin-top:5px;">
            <div style="position:relative; height:60px; overflow:hidden; border-bottom:1px solid #333;">
                <div style="position:absolute; width:100%; height:100%; background:url('${bannerImg}') top center/cover; opacity:0.5;"></div>
                <h3 style="position:relative; z-index:2; text-align:center; margin:0; padding-top:18px; color:#ff5555; font-family:'Modesto Condensed', serif; font-size:24px; text-shadow:0 0 5px black; text-transform:uppercase;">${game.i18n.localize("STRESS.Collapse.Title")}</h3>
            </div>
            <div style="padding:15px; text-align:center;">
                <div style="font-family:'Modesto Condensed', serif; font-size:20px; color:#ecebdb; margin-bottom:10px;">${actor.name}</div>
                <div style="background:rgba(80, 0, 0, 0.2); border:1px solid #7a0000; padding:10px; border-radius:3px; display:flex; justify-content:space-around;">
                    <div style="color:#ff5555; font-family:'Modesto Condensed', serif; font-size:22px; font-weight:bold;">+${amount} ${game.i18n.localize("STRESS.Hud.Stress")}</div>
                    <div style="color:#eebb23; font-family:'Modesto Condensed', serif; font-size:22px; font-weight:bold;">+${exhaustionGain} ${game.i18n.localize("STRESS.Hud.Exhaustion")}</div>
                </div>
            </div>
        </div>`;
        ChatMessage.create({ speaker: ChatMessage.getSpeaker({actor}), content });
    }
});

Hooks.on("dnd5e.preLongRest", (actor, config) => {
    if (actor.type !== "character" || config.stressRestModule) return true;
    new StressRestDialog(actor).render(true);
    return false;
});

Hooks.on("dnd5e.preShortRest", (actor, config) => {
    if (actor.type !== "character" || config.stressRestModule) return true;
    new StressShortRestDialog(actor).render(true);
    return false;
});
