import { StressManager, STRESS_CONFIG } from "./stress-manager.js";
import { ItemHandler } from "./item-handler.js";

const RARITY_TIERS = [
    { key: "common",    i18n: "Common",    multiplier: 1,  bonus: 0, color: "#cfcdc2" },
    { key: "uncommon",  i18n: "Uncommon",  multiplier: 3,  bonus: 1, color: "#1eff00" },
    { key: "rare",      i18n: "Rare",      multiplier: 8,  bonus: 2, color: "#0070dd" },
    { key: "veryrare",  i18n: "VeryRare",  multiplier: 20, bonus: 3, color: "#a335ee" },
    { key: "legendary", i18n: "Legendary", multiplier: 50, bonus: 4, color: "#ff8000" }
];

export class StressRestDialog extends FormApplication {
    constructor(actor) { super(); this.actor = actor; }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "stress-long-rest",
            template: "modules/stresspoints-rest/templates/long-rest.hbs",
            title: game.i18n.localize("STRESS.Dialog.LongRest"),
            width: 500,
            classes: ["stress-rest-dialog"],
            closeOnSubmit: true
        });
    }

    getData() {
        const data = super.getData();
        const mid = STRESS_CONFIG.MODULE_ID;
        data.actor = this.actor;
        data.hpVal = this.actor.system.attributes.hp.value;
        data.hpMax = this.actor.system.attributes.hp.max;
        data.hpPercent = Math.floor((data.hpVal / data.hpMax) * 100);
        data.stressVal = StressManager.getStress(this.actor);
        data.stressPercent = Math.floor((data.stressVal / STRESS_CONFIG.MAX_STRESS) * 100);
        data.exhaustVal = this.actor.system.attributes.exhaustion;
        data.exhaustPercent = Math.floor((data.exhaustVal / 6) * 100);

        data.useEnvironment = game.settings.get(mid, "environmentMode");
        data.useHealItems = game.settings.get(mid, "requireHealerKitLong");
        data.foodCost = game.settings.get(mid, "foodCost");
        data.foodCur = game.settings.get(mid, "foodCurrency");
        data.drinkCost = game.settings.get(mid, "drinkCost");
        data.drinkCur = game.settings.get(mid, "drinkCurrency");

        const buildBuyOptions = (baseCost, cur, maxRarityKey) => {
            if (!baseCost) return [];
            const maxIdx = RARITY_TIERS.findIndex(t => t.key === maxRarityKey);
            return RARITY_TIERS.slice(0, maxIdx + 1).map(tier => ({
                value: `buy_external_${tier.key}`,
                price: parseFloat((baseCost * tier.multiplier).toFixed(2)),
                cur,
                color: tier.color,
                bonus: tier.bonus,
                label: game.i18n.localize(`STRESS.Rarity.${tier.i18n}`)
            }));
        };

        data.foodBuyOptions = buildBuyOptions(data.foodCost, data.foodCur, game.settings.get(mid, "maxFoodRarity"));
        data.drinkBuyOptions = buildBuyOptions(data.drinkCost, data.drinkCur, game.settings.get(mid, "maxDrinkRarity"));

        const consumables = this.actor.items.filter(i => i.type === "consumable");
        data.foodItems = consumables.filter(i => i.system.type?.value === "food" && !this._isDrink(i));
        data.drinkItems = consumables.filter(i => i.system.type?.value === "food" && this._isDrink(i));
        data.healItems = consumables.filter(i =>
            i.system.type?.value === "potion" ||
            i.name.toLowerCase().match(/kit|curandeiro|healer/) ||
            i.name.toLowerCase().match(/bandage|atadura|bandagem/)
        );

        return data;
    }

    _isDrink(i) { return i.name.toLowerCase().match(/água|water|drink|suco|cerveja|vinho|ale|cantil|skin|wasser|bier|wein|tea|saft|milk|met/); }

    async _deductCurrency(amount, type) {
        const rates = { "pp": 1000, "gp": 100, "ep": 50, "sp": 10, "cp": 1 };
        let actorCurrency = foundry.utils.duplicate(this.actor.system.currency);
        let totalInCp = 0;
        for (let [denom, qty] of Object.entries(actorCurrency)) { totalInCp += (qty * (rates[denom] || 0)); }
        const costInCp = amount * rates[type];
        if (totalInCp < costInCp) return false;
        let remainingCp = totalInCp - costInCp;
        const newCurrency = {
            pp: Math.floor(remainingCp / 1000),
            gp: Math.floor((remainingCp % 1000) / 100),
            ep: Math.floor((remainingCp % 100) / 50),
            sp: Math.floor((remainingCp % 50) / 10),
            cp: Math.floor(remainingCp % 10)
        };
        await this.actor.update({ "system.currency": newCurrency });
        return true;
    }

    async _rollConSave(dc, flavorText) {
        const result = await this.actor.rollSavingThrow(
            { ability: "con" },
            {},
            { data: { flavor: `${flavorText} -> <b>CD ${dc}</b>` } }
        );
        const roll = Array.isArray(result) ? result[0] : result;
        return { success: roll.total >= dc, total: roll.total };
    }

    async _updateObject(event, formData) {
        // Grab anything that depends on the still-rendered form before closing the window right away —
        // the rest of the processing (rolls, longRest, chat report) continues in the background afterward.
        const envLabel = this.element.find('.custom-option.selected').text();
        this.close();

        let modifiers = 0;
        let logs = [];
        let usedHeal = false;
        const actor = this.actor;
        const mid = STRESS_CONFIG.MODULE_ID;
        const stressStart = StressManager.getStress(actor);
        const isImmune = actor.system.details.race?.name?.toLowerCase().match(/warforged|forjado|reborn/) ||
                         actor.system.details.type?.value?.toLowerCase().match(/construct|undead/);
        const buyLabel = ` (${game.i18n.localize("STRESS.Msg.BuyExternal")})`;

        const getRarityBonus = (item) => {
            switch (item.system.rarity?.toLowerCase()) {
                case "uncommon":  return 1;
                case "rare":      return 2;
                case "veryrare":  return 3;
                case "legendary": return 4;
                default:          return 0;
            }
        };

        if (isImmune) {
            logs.push(`🍴 ${game.i18n.localize("STRESS.Msg.ImmuneFood")}`);
            logs.push(`🥤 ${game.i18n.localize("STRESS.Msg.ImmuneDrink")}`);
        } else {
            if (formData.foodId?.startsWith("buy_external_")) {
                const rarityKey = formData.foodId.slice("buy_external_".length);
                const tier = RARITY_TIERS.find(t => t.key === rarityKey) ?? RARITY_TIERS[0];
                const cost = game.settings.get(mid, "foodCost") * tier.multiplier;
                if (await this._deductCurrency(cost, game.settings.get(mid, "foodCurrency"))) {
                    const rarityLabel = game.i18n.localize(`STRESS.Rarity.${tier.i18n}`);
                    const bonusText = tier.bonus > 0 ? ` <b style="color:#9cdeba">(-${tier.bonus} ${game.i18n.localize("STRESS.Hud.Stress")})</b>` : "";
                    logs.push(`🥘 ${game.i18n.localize("STRESS.Msg.EatSuccess")}${buyLabel} <span style="color:${tier.color}">(${rarityLabel})</span>${bonusText}`);
                    modifiers -= tier.bonus;
                } else {
                    modifiers += 1;
                    logs.push(`🍴 <span style="color:#ffcc00">${game.i18n.localize("STRESS.Msg.InsufficientFunds")}</span> ${game.i18n.localize("STRESS.Report.NoFood")}`);
                }
            } else if (formData.foodId) {
                const item = actor.items.get(formData.foodId);
                const bonus = getRarityBonus(item);
                const consumed = await ItemHandler.consume(actor, formData.foodId);
                if (consumed) {
                    const bonusText = bonus > 0 ? ` <b style="color:#9cdeba">(-${bonus} ${game.i18n.localize("STRESS.Hud.Stress")})</b>` : "";
                    logs.push(`🍴 ${game.i18n.localize("STRESS.Msg.EatSuccess")}: ${item.name}${bonusText}`);
                    modifiers -= bonus;
                }
            } else if (game.settings.get(mid, "foodMode") === "roll") {
                const check = await this._rollConSave(10, game.i18n.localize("STRESS.Labels.FoodCheck"));
                if (check.success) {
                    logs.push(`🍴 ${game.i18n.localize("STRESS.Msg.Saved")}`);
                } else {
                    modifiers += 1;
                    logs.push(`🍴 ${game.i18n.localize("STRESS.Msg.FailStress")}`);
                }
            } else {
                modifiers += 1;
                logs.push(`🍴 ${game.i18n.localize("STRESS.Report.NoFood")}`);
            }

            if (formData.drinkId?.startsWith("buy_external_")) {
                const rarityKey = formData.drinkId.slice("buy_external_".length);
                const tier = RARITY_TIERS.find(t => t.key === rarityKey) ?? RARITY_TIERS[0];
                const cost = game.settings.get(mid, "drinkCost") * tier.multiplier;
                if (await this._deductCurrency(cost, game.settings.get(mid, "drinkCurrency"))) {
                    const rarityLabel = game.i18n.localize(`STRESS.Rarity.${tier.i18n}`);
                    const bonusText = tier.bonus > 0 ? ` <b style="color:#9cdeba">(-${tier.bonus} ${game.i18n.localize("STRESS.Hud.Stress")})</b>` : "";
                    logs.push(`🥤 ${game.i18n.localize("STRESS.Msg.DrinkSuccess")}${buyLabel} <span style="color:${tier.color}">(${rarityLabel})</span>${bonusText}`);
                    modifiers -= tier.bonus;
                } else {
                    modifiers += 1;
                    logs.push(`🥤 <span style="color:#ffcc00">${game.i18n.localize("STRESS.Msg.InsufficientFunds")}</span> ${game.i18n.localize("STRESS.Report.NoDrink")}`);
                }
            } else if (formData.drinkId) {
                const item = actor.items.get(formData.drinkId);
                const bonus = getRarityBonus(item);
                const consumed = await ItemHandler.consume(actor, formData.drinkId);
                if (consumed) {
                    const bonusText = bonus > 0 ? ` <b style="color:#9cdeba">(-${bonus} ${game.i18n.localize("STRESS.Hud.Stress")})</b>` : "";
                    logs.push(`🥤 ${game.i18n.localize("STRESS.Msg.DrinkSuccess")}: ${item.name}${bonusText}`);
                    modifiers -= bonus;
                }
            } else if (game.settings.get(mid, "drinkMode") === "roll") {
                const check = await this._rollConSave(10, game.i18n.localize("STRESS.Labels.DrinkCheck"));
                if (check.success) {
                    logs.push(`🥤 ${game.i18n.localize("STRESS.Msg.Saved")}`);
                } else {
                    modifiers += 1;
                    logs.push(`🥤 ${game.i18n.localize("STRESS.Msg.FailStress")}`);
                }
            } else {
                modifiers += 1;
                logs.push(`🥤 ${game.i18n.localize("STRESS.Report.NoDrink")}`);
            }
        }

        if (game.settings.get(mid, "environmentMode")) {
            if (formData.environment > 0) {
                const hasTent = actor.items.some(i => i.name.toLowerCase().match(/\btent\b|\bbarraca\b/));
                const hasBedroll = actor.items.some(i => i.name.toLowerCase().match(/\bbedroll\b|\bsaco de dormir\b/));

                let envBonus = 0;
                if (hasTent) { envBonus += 4; logs.push(`⛺ <b>${game.i18n.localize("STRESS.Item.Tent")}:</b> -4 CD`); }
                if (hasBedroll) { envBonus += 2; logs.push(`🛌 <b>${game.i18n.localize("STRESS.Item.Bedroll")}:</b> -2 CD`); }

                const check = await this._rollConSave(Math.max(0, formData.environment - envBonus), game.i18n.localize("STRESS.Labels.EnvCheck"));
                const statusIcon = check.success ? "🌍" : "💀";
                const failText = !check.success ? (modifiers++, ` <span style='color:#ff5555'>+1 ${game.i18n.localize("STRESS.Hud.Stress")}</span>`) : "";

                logs.push(`${statusIcon} ${game.i18n.format("STRESS.Report.EnvUnsafe", { type: envLabel.split(' ').slice(1).join(' ') })}${failText}`);
            } else {
                logs.push(`🌳 ${game.i18n.localize("STRESS.Report.EnvSafe")}`);
            }
        }

        if (game.settings.get(mid, "requireHealerKitLong")) {
            if (formData.healId && (await ItemHandler.consume(actor, formData.healId, { silent: false }))) {
                usedHeal = true;
                logs.push(`💊 ${game.i18n.localize("STRESS.Report.UsedItem")}`);
            } else {
                logs.push(`💊 <span style="color:#eebb23">${game.i18n.localize("STRESS.Report.NoHeal")}</span>`);
            }
        }

        if (!game.settings.get(mid, "requireHealerKitLong") || usedHeal) {
            logs.push(`<span style="color:#9cdeba">${game.i18n.localize("STRESS.Report.HPFull")}</span>`);
        }

        const hpBefore = actor.system.attributes.hp.value;
        await actor.longRest({ dialog: false, chat: false, newDay: true, stressRestModule: true });

        if (game.settings.get(mid, "requireHealerKitLong") && !usedHeal) {
            await actor.update({ "system.attributes.hp.value": hpBefore });
        }

        const baseRecovery = -2;
        const finalStress = Math.clamp(stressStart + baseRecovery + modifiers, 0, STRESS_CONFIG.MAX_STRESS);

        await actor.update({
            [`flags.${mid}.${STRESS_CONFIG.FLAG_NAME}`]: finalStress,
            "system.attributes.exhaustion": Math.floor(finalStress / STRESS_CONFIG.RATIO)
        }, { stressRest: true });

        const bannerImg = "systems/dnd5e/ui/official/banner-character-dark.webp";
        const content = `<div style="background:#111215; border:1px solid #000; color:#cfcdc2; font-family:'Signika', sans-serif; margin-top:5px;">
            <div style="position:relative; height:60px; overflow:hidden; border-bottom:1px solid #333;">
                <div style="position:absolute; width:100%; height:100%; background:url('${bannerImg}') top center/cover; opacity:0.5;"></div>
                <h3 style="position:relative; z-index:2; text-align:center; margin:0; padding-top:18px; color:#ecebdb; font-family:'Modesto Condensed', serif; font-size:24px; text-shadow:0 0 5px black; text-transform:uppercase;">${game.i18n.localize("STRESS.Report.Title")}</h3>
            </div>
            <div style="padding:15px; text-align:center;">
                <div style="font-family:'Modesto Condensed', serif; font-size:26px; color:#ecebdb; text-transform:uppercase; margin-bottom:15px;">${actor.name}</div>
                <div style="text-align:left; margin-bottom:15px; border-top:1px solid #333; padding-top:10px;">
                    ${logs.map(l => `<div style="padding:4px 0; font-size:13px; color:#eee;">${l}</div>`).join("")}
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; color:#777; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">
                    <span>${game.i18n.localize("STRESS.Report.Start")}: <b>${stressStart}</b></span>
                    <span>${game.i18n.localize("STRESS.Report.Recovery")}: <b>${baseRecovery}</b></span>
                    <span>${game.i18n.localize("STRESS.Report.Modifiers")}: <b>${modifiers >= 0 ? "+" + modifiers : modifiers}</b></span>
                </div>
                <div style="padding:10px; border:1px solid #4a7558; background:rgba(10, 30, 15, 0.6); color:#9cdeba; font-weight:bold; font-family:'Modesto Condensed', serif; font-size:22px;">
                    ${game.i18n.localize("STRESS.Report.FinalStress")}: ${finalStress}
                </div>
            </div></div>`;

        ChatMessage.create({ speaker: ChatMessage.getSpeaker({actor}), content });
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.item-slot').click(ev => {
            const li = $(ev.currentTarget);
            html.find(`#input-${li.data("target")}`).val(li.data("value"));
            li.parent().find('.item-slot').removeClass('selected');
            li.addClass('selected');
        });
        const wrapper = html.find('.custom-select-wrapper');
        html.find('.custom-select-trigger').click(e => { e.stopPropagation(); wrapper.toggleClass('open'); });
        html.find('.custom-option').click(ev => {
            const el = $(ev.currentTarget);
            html.find('.custom-option').removeClass('selected');
            el.addClass('selected');
            html.find('.custom-select-trigger span').text(el.text());
            html.find('#input-environment').val(el.data('value'));
            wrapper.removeClass('open');
        });
    }
}
