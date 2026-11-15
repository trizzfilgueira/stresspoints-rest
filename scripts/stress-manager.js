export const STRESS_CONFIG = {
    MODULE_ID: "stresspoints-rest",
    FLAG_NAME: "stress",
    MAX_STRESS: 12,
    RATIO: 2
};

/** Escape player-controlled text (actor and item names) before it goes into chat HTML. */
export const esc = value => foundry.utils.escapeHTML?.(String(value ?? "")) ?? Handlebars.escapeExpression(String(value ?? ""));

export class StressManager {
    static get ratio() {
        return Math.max(1, Number(STRESS_CONFIG.RATIO) || 1);
    }

    static get maxStress() {
        return Math.max(1, Number(STRESS_CONFIG.MAX_STRESS) || 1);
    }

    static get maxExhaustion() {
        return CONFIG.DND5E?.conditionTypes?.exhaustion?.levels ?? 6;
    }

    static getStress(actor) {
        return Number(actor.getFlag(STRESS_CONFIG.MODULE_ID, STRESS_CONFIG.FLAG_NAME)) || 0;
    }

    // Read from source: the prepared value lags until dnd5e refreshes the Exhaustion effect.
    static getExhaustion(actor) {
        return Number(actor._source?.system?.attributes?.exhaustion ?? actor.system.attributes?.exhaustion) || 0;
    }

    static clampStress(stress) {
        return Math.clamp(Math.round(stress), 0, StressManager.maxStress);
    }

    static exhaustionFor(stress) {
        return Math.clamp(Math.floor(stress / StressManager.ratio), 0, StressManager.maxExhaustion);
    }

    /** @returns {Promise<{stress:number, exhaustion:number, stressGain:number, exhaustionGain:number}>} */
    static async setStress(actor, stress, options = {}) {
        const oldStress = StressManager.getStress(actor);
        const oldEx = StressManager.getExhaustion(actor);
        const newStress = StressManager.clampStress(stress);
        const newEx = StressManager.exhaustionFor(newStress);
        await actor.update({
            [`flags.${STRESS_CONFIG.MODULE_ID}.${STRESS_CONFIG.FLAG_NAME}`]: newStress,
            "system.attributes.exhaustion": newEx
        }, { stressSync: true, ...options });
        return { stress: newStress, exhaustion: newEx, stressGain: newStress - oldStress, exhaustionGain: newEx - oldEx };
    }

    static applyStress(actor, delta, options = {}) {
        return StressManager.setStress(actor, StressManager.getStress(actor) + delta, options);
    }

    // Fires stresspoints-rest.stressChanged on every client when stress changes (see README).
    static initHooks() {
        const path = `flags.${STRESS_CONFIG.MODULE_ID}.${STRESS_CONFIG.FLAG_NAME}`;
        // The initiating client records the old values; update options travel to every client.
        Hooks.on("preUpdateActor", (actor, changes, options) => {
            if (!foundry.utils.hasProperty(changes, path)) return;
            options.stressPrevious = { stress: StressManager.getStress(actor), exhaustion: StressManager.getExhaustion(actor) };
        });
        Hooks.on("updateActor", (actor, changes, options, userId) => {
            if (!foundry.utils.hasProperty(changes, path)) return;
            // Missing only if the update bypassed preUpdateActor (e.g. sent straight to the server).
            const previous = options.stressPrevious ?? { stress: null, exhaustion: null };
            const stress = StressManager.getStress(actor);
            if (stress === previous.stress) return;
            Hooks.callAll(`${STRESS_CONFIG.MODULE_ID}.stressChanged`, actor, {
                stress,
                previous: previous.stress,
                delta: previous.stress === null ? null : stress - previous.stress,
                exhaustion: StressManager.getExhaustion(actor),
                previousExhaustion: previous.exhaustion,
                options,
                userId
            });
        });
    }
}
