import { StressManager } from "./stress-manager.js";

const TOKEN_ATTRIBUTE = "attributes.stress";

export function stressTooltip(actor) {
    const stress = StressManager.getStress(actor);
    const max = StressManager.maxStress;
    const ratio = StressManager.ratio;
    const exhaustion = StressManager.getExhaustion(actor);
    const base = game.i18n.format("STRESS.Sheet.Value", { stress, max });
    if (exhaustion >= StressManager.maxExhaustion || stress >= max) {
        return `${base} · ${game.i18n.localize("STRESS.Sheet.AtMax")}`;
    }
    const next = Math.floor(stress / ratio) + 1;
    const remaining = (next * ratio) - stress;
    return `${base} · ${game.i18n.format("STRESS.Sheet.NextLevel", { remaining, level: next })}`;
}

export class SheetIntegration {
    static init() {
        SheetIntegration._registerTokenBar();

        // dnd5e 5.x+ character sheets are ApplicationV2; the generic hook covers every subclass.
        Hooks.on("renderActorSheetV2", (app, element) => SheetIntegration._injectMeter(app, element));
    }

    // Stress as system.attributes.stress, so it can be a token bar. The flag stays the source of truth.
    static _registerTokenBar() {
        const proto = CONFIG.Actor.documentClass.prototype;
        const original = proto.prepareDerivedData;
        proto.prepareDerivedData = function(...args) {
            const result = original.apply(this, args);
            if (this.type === "character" && this.system?.attributes) {
                this.system.attributes.stress = { value: StressManager.getStress(this), max: StressManager.maxStress };
            }
            return result;
        };

        // dnd5e builds CONFIG.Actor.trackableAttributes in its own "setup" hook, which runs before ours.
        Hooks.once("setup", () => {
            const trackable = CONFIG.Actor.trackableAttributes?.character;
            if (trackable?.bar && !trackable.bar.includes(TOKEN_ATTRIBUTE)) trackable.bar.push(TOKEN_ATTRIBUTE);
        });

        // Editing the bar from the token HUD writes the flag (and exhaustion) instead of system data.
        Hooks.on("modifyTokenAttribute", ({ attribute, value, isDelta }, updates, actor) => {
            if (attribute !== TOKEN_ATTRIBUTE) return;
            const current = StressManager.getStress(actor);
            StressManager.setStress(actor, isDelta ? current + value : value);
            return false;
        });
    }

    static _injectMeter(app, element) {
        const actor = app.actor ?? app.document;
        if (actor?.type !== "character") return;
        const stats = element.querySelector(".sidebar .stats");
        if (!stats) return;
        stats.querySelector(".stress-meter-group")?.remove();

        const stress = StressManager.getStress(actor);
        const max = StressManager.maxStress;
        const pct = Math.clamp(Math.round((stress / max) * 100), 0, 100);

        const group = document.createElement("div");
        group.className = "meter-group stress-meter-group";
        group.innerHTML = `
            <div class="label roboto-condensed-upper"><span>${game.i18n.localize("STRESS.Sheet.Label")}</span></div>
            <div class="meter progress stress-meter meter-lg" role="meter" aria-valuemin="0"
                 aria-valuenow="${stress}" aria-valuemax="${max}" style="--bar-percentage: ${pct}%">
                <div class="label">
                    <span class="value">${stress}</span><span class="separator">/</span><span class="max">${max}</span>
                </div>
            </div>`;
        const meter = group.querySelector(".stress-meter");
        meter.dataset.tooltip = stressTooltip(actor);
        if (game.user.isGM) {
            meter.classList.add("clickable");
            meter.addEventListener("click", () => game.modules.get("stresspoints-rest")?.api?.openGMPanel());
        }

        const hpGroup = stats.querySelector(".meter.hit-points")?.closest(".meter-group");
        if (hpGroup) hpGroup.after(group);
        else stats.append(group);
    }
}
