import { StressManager, STRESS_CONFIG } from "./stress-manager.js";
import { StressRestDialog } from "./rest-dialog.js";
import { StressShortRestDialog } from "./short-rest-dialog.js";
import { ExhaustionHandler } from "./exhaustion-handler.js"; 
import { PushingLimitsDialog } from "./pushing-limits.js"; 

Hooks.once("init", () => {
    console.log("Stress Points & Rest | Inicializando...");

    game.settings.register(STRESS_CONFIG.MODULE_ID, "maxStress", {
        name: "STRESS.Settings.MaxStress.Name", hint: "STRESS.Settings.MaxStress.Hint", scope: "world", config: true, type: Number, default: 12, onChange: value => { STRESS_CONFIG.MAX_STRESS = value; }
    });
    game.settings.register(STRESS_CONFIG.MODULE_ID, "stressRatio", {
        name: "STRESS.Settings.Ratio.Name", hint: "STRESS.Settings.Ratio.Hint", scope: "world", config: true, type: Number, default: 2, onChange: value => { STRESS_CONFIG.RATIO = value; }
    });
    game.settings.register(STRESS_CONFIG.MODULE_ID, "autoHpZero", {
        name: "STRESS.Settings.AutoHp.Name", hint: "STRESS.Settings.AutoHp.Hint", scope: "world", config: true, type: Boolean, default: true
    });
    game.settings.register(STRESS_CONFIG.MODULE_ID, "requireHealerKit", {
        name: "STRESS.Settings.HealerReq.Name", hint: "STRESS.Settings.HealerReq.Hint", scope: "world", config: true, type: Boolean, default: true
    });
    game.settings.register(STRESS_CONFIG.MODULE_ID, "foodMode", {
        name: "STRESS.Settings.FoodMode.Name", hint: "STRESS.Settings.FoodMode.Hint", scope: "world", config: true, type: String, choices: { "mandatory": "STRESS.Options.Mandatory", "roll": "STRESS.Options.Roll" }, default: "mandatory"
    });
    game.settings.register(STRESS_CONFIG.MODULE_ID, "drinkMode", {
        name: "STRESS.Settings.DrinkMode.Name", hint: "STRESS.Settings.DrinkMode.Hint", scope: "world", config: true, type: String, choices: { "mandatory": "STRESS.Options.Mandatory", "roll": "STRESS.Options.Roll" }, default: "mandatory"
    });
    game.settings.register(STRESS_CONFIG.MODULE_ID, "environmentMode", {
        name: "STRESS.Settings.EnvMode.Name", hint: "STRESS.Settings.EnvMode.Hint", scope: "world", config: true, type: Boolean, default: true
    });

    STRESS_CONFIG.MAX_STRESS = game.settings.get(STRESS_CONFIG.MODULE_ID, "maxStress");
    STRESS_CONFIG.RATIO = game.settings.get(STRESS_CONFIG.MODULE_ID, "stressRatio");
    
    ExhaustionHandler.init();

    console.log("Stress Points & Rest | Configurações Carregadas.");
});

Hooks.once("ready", async () => {
    if (!game.user.isGM) return;

    const folderName = "Stress Points & Rest";
    const folderColor = "#0077e6"; 
    const packsToMove = ["stresspoints-rest.stress-items", "stresspoints-rest.stress-macros"];

    let folder = game.packs.folders.find(f => f.name === folderName);
    if (!folder) {
        folder = await Folder.create({
            name: folderName,
            type: "Compendium",
            color: folderColor
        });
    }

    for (const packKey of packsToMove) {
        const pack = game.packs.get(packKey);
        if (pack && pack.folder?.id !== folder.id) {
            await pack.configure({ folder: folder.id });
        }
    }
});

// --- HOOKS DE ESTRESSE E DESCANSO ---
Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
    if (options.stressSync || options.stressRest) return;
    
    // TRAVA PARA NPC: Ignora se não for personagem de jogador
    if (actor.type !== "character") return;

    if (hasProperty(changes, "system.attributes.exhaustion")) {
        const newEx = changes.system.attributes.exhaustion;
        const oldEx = actor.system.attributes.exhaustion;
        const diff = newEx - oldEx;
        if (diff !== 0) {
            const currentStress = StressManager.getStress(actor);
            let newStress = currentStress + (diff * STRESS_CONFIG.RATIO);
            newStress = Math.clamped(newStress, 0, STRESS_CONFIG.MAX_STRESS);
            foundry.utils.setProperty(changes, `flags.${STRESS_CONFIG.MODULE_ID}.${STRESS_CONFIG.FLAG_NAME}`, newStress);
        }
    }
});

Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (!game.user.isGM && !actor.isOwner) return;
    
    // TRAVA PARA NPC: NPCs não geram card de colapso
    if (actor.type !== "character") return;

    const useAutoHp = game.settings.get(STRESS_CONFIG.MODULE_ID, "autoHpZero");
    if (!useAutoHp) return;

    if (changes.system?.attributes?.hp?.value === 0 && !options.isRestore) {
        const current = StressManager.getStress(actor);
        const newStress = Math.clamped(current + 2, 0, STRESS_CONFIG.MAX_STRESS);
        const newEx = Math.floor(newStress / STRESS_CONFIG.RATIO);
        const updates = { [`flags.${STRESS_CONFIG.MODULE_ID}.${STRESS_CONFIG.FLAG_NAME}`]: newStress };
        if (newEx !== actor.system.attributes.exhaustion) { updates["system.attributes.exhaustion"] = newEx; }
        await actor.update(updates, { stressSync: true });

        const bannerImg = "systems/dnd5e/ui/official/banner-character-dark.webp";
        const content = `
        <div style="background:#111215; border:1px solid #000; color:#cfcdc2; font-family:'Signika', sans-serif; margin-top:5px;">
            <div style="position:relative; height:60px; overflow:hidden; border-bottom:1px solid #333;">
                <div style="position:absolute; width:100%; height:100%; background:url('${bannerImg}') top center/cover; opacity:0.5;"></div>
                <h3 style="position:relative; z-index:2; text-align:center; margin:0; padding-top:18px; color:#ff5555; font-family:'Modesto Condensed', serif; font-size:24px; text-shadow:0 0 5px black; text-transform:uppercase;">${game.i18n.localize("STRESS.Collapse.Title")}</h3>
            </div>
            <div style="padding:15px; text-align:center;">
                <div style="font-family:'Modesto Condensed', serif; font-size:20px; color:#ecebdb; margin-bottom:10px;">${actor.name}</div>
                <div style="background:rgba(80, 0, 0, 0.2); border:1px solid #7a0000; padding:10px; border-radius:3px;">
                    <div style="font-size:12px; color:#aaa; margin-bottom:5px;">${game.i18n.localize("STRESS.Collapse.SubTitle")}</div>
                    <div style="color:#ff5555; font-family:'Modesto Condensed', serif; font-size:22px; font-weight:bold; letter-spacing:1px; text-shadow:0 0 5px rgba(255,0,0,0.3);">${game.i18n.localize("STRESS.Collapse.Gain")}</div>
                    ${newEx > actor.system.attributes.exhaustion ? `<div style="font-size:10px; color:#ff8888; margin-top:2px;">${game.i18n.localize("STRESS.Collapse.ExhaustionUp")}</div>` : ''}
                </div>
            </div>
        </div>`;
        ChatMessage.create({ speaker: ChatMessage.getSpeaker({actor}), content: content });
    }
});

Hooks.on("dnd5e.preLongRest", (actor, config) => {
    if (actor.type !== "character") return true; // NPCs descansam normal pelo sistema base
    if (config.stressRestModule) return true;
    new StressRestDialog(actor).render(true);
    return false;
});

Hooks.on("dnd5e.preShortRest", (actor, config) => {
    if (actor.type !== "character") return true;
    if (config.stressRestModule) return true;
    new StressShortRestDialog(actor).render(true);
    return false;
});

function checkAndActivate(item) {
    if (!item || !item.actor || item.actor.type !== "character") return;

    const isFlagged = item.getFlag("stresspoints-rest", "feature") === "no-limite";
    const name = item.name.toLowerCase().trim();
    const isNameMatch = name === "no limite" || name === "pushing limits" || name.includes("no limite") || name.includes("pushing limits");

    if (isFlagged || isNameMatch) {
        PushingLimitsDialog.activate(item);
    }
}

Hooks.on("dnd5e.useItem", (item, config, options) => { checkAndActivate(item); });
Hooks.on("dnd5e.postUseActivity", (activity, usage, results) => {
    if (activity && activity.item) { checkAndActivate(activity.item); }
});
