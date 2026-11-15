import { STRESS_CONFIG } from "./stress-manager.js";

// Sections of the module's settings tab, in display order.
const SECTIONS = [
    { label: "STRESS.Settings.Section.Stress", icon: "fas fa-heart-crack", keys: ["maxStress", "stressRatio", "stressOnZeroHp", "autoHpZero"] },
    { label: "STRESS.Settings.Section.Food", icon: "fas fa-utensils",
      keys: ["foodMode", "drinkMode", "foodCost", "foodCurrency", "drinkCost", "drinkCurrency", "maxFoodRarity", "maxDrinkRarity"] },
    { label: "STRESS.Settings.Section.Environment", icon: "fas fa-campground", keys: ["environmentMode", "gmEnvironment"] },
    { label: "STRESS.Settings.Section.Healing", icon: "fas fa-kit-medical", keys: ["requireHealerKitShort", "requireHealerKitLong", "longRestNeedsHp"] }
];

// Core lists settings flat. Settings that are not in a section stay after the sections.
export function groupSettings(app, element) {
    const root = element instanceof HTMLElement ? element : element?.[0];
    const tab = root?.querySelector(`[data-category="${STRESS_CONFIG.MODULE_ID}"]`);
    if (!tab || tab.querySelector(".stress-settings-section")) return;

    const groupFor = key => tab.querySelector(`[name="${STRESS_CONFIG.MODULE_ID}.${key}"]`)?.closest(".form-group");
    let previous = null;
    for (const section of SECTIONS) {
        const groups = section.keys.map(groupFor).filter(Boolean);
        if (!groups.length) continue;
        const fieldset = document.createElement("fieldset");
        fieldset.className = "stress-settings-section";
        const legend = document.createElement("legend");
        legend.innerHTML = `<i class="${section.icon}"></i> `;
        legend.append(game.i18n.localize(section.label));
        fieldset.append(legend, ...groups);
        if (previous) previous.after(fieldset);
        else tab.prepend(fieldset);
        previous = fieldset;
    }
}
