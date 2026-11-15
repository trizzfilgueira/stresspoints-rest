import { STRESS_CONFIG } from "./stress-manager.js";

// Long rest Constitution save DCs. `icon` is used in chat and selects, `fa` in the dialogs.
export const ENV_LEVELS = [
    { dc: 0,  key: "Safe",       icon: "⛺", fa: "fa-solid fa-campground" },
    { dc: 10, key: "LowSafe",    icon: "⚠️", fa: "fa-solid fa-eye" },
    { dc: 12, key: "LowDanger",  icon: "⚠️", fa: "fa-solid fa-triangle-exclamation" },
    { dc: 14, key: "Danger",     icon: "💀", fa: "fa-solid fa-skull" },
    { dc: 16, key: "HighDanger", icon: "💀", fa: "fa-solid fa-skull-crossbones" },
    { dc: 18, key: "Hostile",    icon: "☠️", fa: "fa-solid fa-fire" }
];

export const CAMP_SETTING = "campEnvironment";
export const GM_ENV_SETTING = "gmEnvironment";

export function envLevel(dc) {
    const n = Number(dc) || 0;
    const level = ENV_LEVELS.find(l => l.dc === n) ?? ENV_LEVELS[0];
    return {
        ...level,
        label: game.i18n.localize(`STRESS.Env.${level.key}`),
        dcLabel: level.dc ? `${game.i18n.localize("STRESS.Env.DC")} ${level.dc}` : game.i18n.localize("STRESS.Env.NoSave")
    };
}

export function envOptions(selectedDc) {
    return ENV_LEVELS.map(l => ({ ...envLevel(l.dc), selected: l.dc === (Number(selectedDc) || 0) }));
}

export function gmControlsEnvironment() {
    return game.settings.get(STRESS_CONFIG.MODULE_ID, GM_ENV_SETTING);
}

export function getCampEnvironment() {
    return Number(game.settings.get(STRESS_CONFIG.MODULE_ID, CAMP_SETTING)) || 0;
}

export function setCampEnvironment(dc) {
    return game.settings.set(STRESS_CONFIG.MODULE_ID, CAMP_SETTING, Number(dc) || 0);
}

// null = the character follows the party camp.
export const ACTOR_ENV_FLAG = "envOverride";

export function getActorEnvironmentOverride(actor) {
    const value = actor?.getFlag(STRESS_CONFIG.MODULE_ID, ACTOR_ENV_FLAG);
    return (value === undefined || value === null || value === "") ? null : Number(value);
}

export function actorEnvironment(actor) {
    return getActorEnvironmentOverride(actor) ?? getCampEnvironment();
}

export function setActorEnvironment(actor, dc) {
    if (dc === null || dc === undefined || dc === "") return actor.unsetFlag(STRESS_CONFIG.MODULE_ID, ACTOR_ENV_FLAG);
    return actor.setFlag(STRESS_CONFIG.MODULE_ID, ACTOR_ENV_FLAG, Number(dc) || 0);
}
