import { StressManager, STRESS_CONFIG } from "./stress-manager.js";
import { postStressCard } from "./chat-card.js";
import { stressTooltip } from "./sheet-integration.js";
import {
    envLevel, envOptions, getCampEnvironment, setCampEnvironment, gmControlsEnvironment,
    getActorEnvironmentOverride, setActorEnvironment
} from "./environment.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// Falls back to every character while none has a player owner yet.
const partyActors = () => {
    const characters = game.actors.filter(a => a.type === "character");
    const owned = characters.filter(a => a.hasPlayerOwner);
    return (owned.length ? owned : characters).sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
};

export class StressGMPanel extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "stress-gm-panel",
        classes: ["stress-rest-dialog", "stress-gm-panel", "dnd5e2"],
        window: { title: "STRESS.Panel.Title", icon: "fas fa-heart-crack", resizable: true },
        position: { width: 560, height: "auto" },
        actions: {
            adjust: StressGMPanel.#onAdjust,
            setEnvironment: StressGMPanel.#onSetEnvironment,
            sendReport: StressGMPanel.#onSendReport,
            openSheet: StressGMPanel.#onOpenSheet
        }
    };

    static MIN_WIDTH = 520;

    setPosition(position = {}) {
        if (Number.isFinite(position.width)) position.width = Math.max(position.width, StressGMPanel.MIN_WIDTH);
        return super.setPosition(position);
    }

    static PARTS = {
        body: { template: "modules/stresspoints-rest/templates/gm-panel.hbs" }
    };

    static open() {
        if (!game.user.isGM) return null;
        const existing = foundry.applications.instances?.get(this.DEFAULT_OPTIONS.id);
        if (existing?.rendered) {
            existing.bringToFront?.();
            return existing;
        }
        const app = existing ?? new this();
        app.render({ force: true });
        return app;
    }

    static refresh() {
        const app = foundry.applications.instances?.get(this.DEFAULT_OPTIONS.id);
        if (app?.rendered) app.render();
    }

    static init() {
        const watched = ["flags.stresspoints-rest", "system.attributes.exhaustion", "system.attributes.hp", "name", "img"];
        Hooks.on("updateActor", (actor, changes) => {
            if (actor.type !== "character") return;
            if (watched.some(path => foundry.utils.hasProperty(changes, path))) StressGMPanel.refresh();
        });
        // A character's own environment is also shown in their open rest dialog.
        Hooks.on("updateActor", (actor, changes) => {
            const moduleFlags = changes.flags?.["stresspoints-rest"];
            if (moduleFlags && Object.keys(moduleFlags).some(k => k.includes("envOverride"))) onCampEnvironmentChange();
        });
        Hooks.on("createActor", () => StressGMPanel.refresh());
        Hooks.on("deleteActor", () => StressGMPanel.refresh());

        // Token controls button (v13+ object-based scene controls).
        Hooks.on("getSceneControlButtons", controls => {
            if (!game.user.isGM) return;
            const tokens = controls.tokens ?? controls.token;
            if (!tokens?.tools) return;
            tokens.tools.stressPanel = {
                name: "stressPanel",
                title: "STRESS.Panel.Title",
                icon: "fas fa-heart-crack",
                order: Object.keys(tokens.tools).length,
                button: true,
                visible: true,
                onChange: () => StressGMPanel.open()
            };
        });
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const max = StressManager.maxStress;
        const maxEx = StressManager.maxExhaustion;
        const pct = (v, m) => (m > 0 ? Math.clamp(Math.round((v / m) * 100), 0, 100) : 0);
        const camp = getCampEnvironment();

        context.actors = partyActors().map(actor => {
            const stress = StressManager.getStress(actor);
            const exhaustion = StressManager.getExhaustion(actor);
            const hp = actor.system.attributes.hp ?? {};
            const override = getActorEnvironmentOverride(actor);
            return {
                envOverride: override !== null,
                envOptions: envOptions(override ?? -1),
                uuid: actor.uuid,
                name: actor.name,
                img: actor.img,
                stress,
                maxStress: max,
                stressPercent: pct(stress, max),
                exhaustion,
                maxExhaustion: maxEx,
                tooltip: stressTooltip(actor),
                // Width of one exhaustion level on the bar.
                notchPercent: Math.min(100, (StressManager.ratio / max) * 100),
                hpVal: hp.value ?? 0,
                hpMax: hp.max ?? 0,
                danger: exhaustion >= maxEx - 1
            };
        });
        context.useEnvironment = game.settings.get(STRESS_CONFIG.MODULE_ID, "environmentMode");
        context.gmEnvironment = gmControlsEnvironment();
        context.envOptions = envOptions(camp);
        context.campEnv = envLevel(camp);
        return context;
    }

    // change events are not ApplicationV2 actions.
    _onRender(context, options) {
        super._onRender?.(context, options);
        for (const select of this.element.querySelectorAll("select.gm-actor-env")) {
            select.addEventListener("change", async () => {
                // Read before awaiting: a re-render can replace the select.
                const value = select.value;
                const actor = await fromUuid(select.closest("[data-actor-uuid]")?.dataset.actorUuid);
                if (actor) await setActorEnvironment(actor, value === "" ? null : value);
            });
        }
    }

    static async #onAdjust(event, target) {
        const actor = await fromUuid(target.closest("[data-actor-uuid]")?.dataset.actorUuid);
        if (!actor) return;
        const delta = Number(target.dataset.delta) || 0;
        // Shift-click moves a whole exhaustion level.
        await StressManager.applyStress(actor, event.shiftKey ? delta * StressManager.ratio : delta);
    }

    static async #onSetEnvironment(event, target) {
        await setCampEnvironment(target.dataset.dc);
    }

    static async #onOpenSheet(event, target) {
        const actor = await fromUuid(target.closest("[data-actor-uuid]")?.dataset.actorUuid);
        actor?.sheet?.render({ force: true });
    }

    static async #onSendReport() {
        const showEnv = game.settings.get(STRESS_CONFIG.MODULE_ID, "environmentMode");
        const actors = partyActors().map(actor => {
            const exhaustion = StressManager.getExhaustion(actor);
            const own = showEnv ? getActorEnvironmentOverride(actor) : null;
            return {
                name: actor.name,
                stress: StressManager.getStress(actor),
                maxStress: StressManager.maxStress,
                exhaustion,
                tone: exhaustion >= StressManager.maxExhaustion - 1 ? "bad" : exhaustion > 0 ? "warn" : "good",
                place: own !== null ? envLevel(own) : null
            };
        });
        await postStressCard(null, {
            speaker: { alias: game.i18n.localize("STRESS.Panel.GMReport") },
            title: game.i18n.localize("STRESS.Panel.GroupStatus"),
            template: "group-report",
            data: { actors, camp: showEnv ? envLevel(getCampEnvironment()) : null }
        });
    }
}

export function onCampEnvironmentChange() {
    StressGMPanel.refresh();
    for (const app of foundry.applications.instances?.values() ?? []) {
        if (app.constructor.name === "StressRestDialog" && app.rendered) app.render();
    }
}

