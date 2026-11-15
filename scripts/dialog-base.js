import { StressManager } from "./stress-manager.js";
import { stressTooltip } from "./sheet-integration.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Base for the module's dialogs, one window per actor.
 * Tiles: [data-action="selectSlot"][data-input][data-value] fill input[name=<data-input>].
 * Dropdowns: .custom-select-wrapper[data-input] with .custom-option[data-value] entries.
 */
export class StressDialogBase extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(actor, options = {}) {
        super({ id: new.target.idFor(actor), ...options });
        this.actor = actor;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        classes: ["stress-rest-dialog"],
        position: { height: "auto" },
        window: { resizable: false },
        form: { closeOnSubmit: false, submitOnChange: false },
        actions: {
            selectSlot: StressDialogBase.#onSelectSlot,
            toggleSelect: StressDialogBase.#onToggleSelect,
            selectOption: StressDialogBase.#onSelectOption
        }
    };

    // uuid, not id: unlinked token actors share their base actor's id.
    static idFor(actor) {
        return `${this.name.toLowerCase()}-${actor.uuid.replace(/[^\w-]/g, "-")}`;
    }

    static open(actor, ...args) {
        const existing = foundry.applications.instances?.get(this.idFor(actor));
        if (existing) {
            existing._refreshArgs?.(...args);
            if (existing.rendered) existing.bringToFront?.();
            return existing;
        }
        const app = new this(actor, ...args);
        app.render({ force: true });
        return app;
    }

    // Registers the {{> stress-rest-tile}} partial.
    async _preFirstRender(context, options) {
        await super._preFirstRender(context, options);
        await foundry.applications.handlebars.loadTemplates({ "stress-rest-tile": "modules/stresspoints-rest/templates/parts/rest-tile.hbs" });
    }

    static hudContext(actor) {
        const { hp, hd } = actor.system.attributes;
        const pct = (v, max) => (max > 0 ? Math.clamp(Math.floor((v / max) * 100), 0, 100) : 0);
        const stressVal = StressManager.getStress(actor);
        const exhaustVal = StressManager.getExhaustion(actor);
        const maxExhaustion = StressManager.maxExhaustion;
        return {
            hpVal: hp.value,
            hpMax: hp.max,
            hpPercent: pct(hp.value, hp.max),
            hdVal: hd?.value ?? 0,
            hdMax: hd?.max ?? 0,
            hdPercent: pct(hd?.value ?? 0, hd?.max ?? 0),
            stressVal,
            maxStress: StressManager.maxStress,
            stressPercent: pct(stressVal, StressManager.maxStress),
            stressTooltip: stressTooltip(actor),
            exhaustVal,
            maxExhaustion,
            exhaustPips: Array.from({ length: maxExhaustion }, (_, i) => i < exhaustVal)
        };
    }

    // Plain objects: Handlebars should not read documents directly.
    static slotItems(items, bonusFor) {
        return items.map(item => {
            const qty = item.system.quantity ?? 1;
            const { value, max } = item.system.uses ?? {};
            const meta = [], tip = [item.name];
            if (qty > 1) {
                meta.push(`×${qty}`);
                tip.push(`${game.i18n.localize("STRESS.Inventory.Quantity")} ${qty}`);
            }
            if (max) {
                meta.push(`${value}/${max}`);
                tip.push(`${game.i18n.localize("STRESS.Inventory.Uses")} ${value}/${max}`);
            }
            const bonus = StressDialogBase.bonusLabel(bonusFor?.(item) ?? 0);
            if (bonus) tip.push(bonus);
            return { id: item.id, name: item.name, img: item.img, meta: meta.join(" · "), tip: tip.join("<br>") };
        });
    }

    static bonusLabel(bonus) {
        return bonus > 0 ? `−${bonus} ${game.i18n.localize("STRESS.Sheet.Label")}` : "";
    }

    _setInput(name, value) {
        const input = this.element.querySelector(`input[name="${name}"]`);
        if (input) input.value = value ?? "";
    }

    static #onSelectSlot(event, target) {
        this._setInput(target.dataset.input, target.dataset.value);
        for (const el of target.parentElement.querySelectorAll('[data-action="selectSlot"]')) el.classList.toggle("selected", el === target);
        this._onSlotSelected?.(target);
    }

    static #onToggleSelect(event, target) {
        event.stopPropagation();
        target.closest(".custom-select-wrapper")?.classList.toggle("open");
    }

    static #onSelectOption(event, target) {
        const wrapper = target.closest(".custom-select-wrapper");
        for (const el of wrapper.querySelectorAll(".custom-option")) el.classList.toggle("selected", el === target);
        wrapper.querySelector(".custom-select-trigger span").textContent = target.textContent.trim();
        this._setInput(wrapper.dataset.input, target.dataset.value);
        wrapper.classList.remove("open");
        this._onOptionSelected?.(target);
    }
}
