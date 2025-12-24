export const STRESS_CONFIG = {
    MODULE_ID: "stresspoints-rest",
    FLAG_NAME: "stress",
    MAX_STRESS: 12,
    RATIO: 2
};

export class StressManager {
    static getStress(actor) {
        return actor.getFlag(STRESS_CONFIG.MODULE_ID, STRESS_CONFIG.FLAG_NAME) || 0;
    }

    static async setStress(actor, stress) {
        const clampedStress = Math.clamped(stress, 0, STRESS_CONFIG.MAX_STRESS);
        // Atualiza a flag. A exaustão é tratada no update geral ou manualmente onde chamado.
        await actor.setFlag(STRESS_CONFIG.MODULE_ID, STRESS_CONFIG.FLAG_NAME, clampedStress);
        return clampedStress;
    }
}