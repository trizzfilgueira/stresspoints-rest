import { StressManager, STRESS_CONFIG } from "./stress-manager.js";
import { ItemHandler } from "./item-handler.js";

export class StressRestDialog extends FormApplication {
    constructor(actor) {
        super();
        this.actor = actor;
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
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
        data.actor = this.actor;
        
        data.firstName = this.actor.name.split(' ')[0];
        data.hpVal = this.actor.system.attributes.hp.value;
        data.hpMax = this.actor.system.attributes.hp.max;
        data.hpPercent = Math.floor((data.hpVal / data.hpMax) * 100);
        
        data.stressVal = StressManager.getStress(this.actor);
        data.stressPercent = Math.floor((data.stressVal / 12) * 100);
        
        data.exhaustVal = this.actor.system.attributes.exhaustion;
        data.exhaustPercent = Math.floor((data.exhaustVal / 6) * 100);

        data.useEnvironment = game.settings.get(STRESS_CONFIG.MODULE_ID, "environmentMode");

        const consumables = this.actor.items.filter(i => i.type === "consumable");
        data.foodItems = consumables.filter(i => i.system.type?.value === "food" && !this._isDrink(i));
        data.drinkItems = consumables.filter(i => i.system.type?.value === "food" && this._isDrink(i));
        
        data.healItems = consumables.filter(i => 
            i.system.type?.value === "potion" || 
            this._isHealerKit(i) ||
            i.name.toLowerCase().match(/bandage|atadura|bandagem/)
        );
        
        return data;
    }

    _isDrink(i) { return i.name.toLowerCase().match(/água|water|drink|suco|juice|beer|cerveja|vinho|wine|cerveja|ale|cantil|skin/); }
    _isHealerKit(i) { return i.name.toLowerCase().match(/curandeiro|healer|kit/); }

    activateListeners(html) {
        super.activateListeners(html);
        
        html.find('.item-slot').click(ev => {
            const li = $(ev.currentTarget);
            const target = li.data("target");
            html.find(`#input-${target}`).val(li.data("value"));
            li.parent().find('.item-slot').removeClass('selected');
            li.addClass('selected');
        });

        const wrapper = html.find('.custom-select-wrapper');
        const trigger = html.find('.custom-select-trigger');
        const options = html.find('.custom-option');
        const hiddenInput = html.find('#input-environment');

        trigger.click(e => { e.stopPropagation(); wrapper.toggleClass('open'); });
        options.click(ev => {
            ev.stopPropagation();
            const el = $(ev.currentTarget);
            options.removeClass('selected');
            el.addClass('selected');
            trigger.find('span').text(el.text());
            hiddenInput.val(el.data('value'));
            wrapper.removeClass('open');
        });
        $(document).click(() => wrapper.removeClass('open'));
    }

    async _rollConSave(dc, flavorText) {
        const options = { 
            fastForward: false, 
            chatMessage: true,
            flavor: `${flavorText} -> <b>CD ${dc}</b>`
        };
        
        try {
            const result = await this.actor.rollSavingThrow({ ability: "con" }, options);
            const roll = Array.isArray(result) ? result[0] : result;
            if (roll) return { success: roll.total >= dc, total: roll.total };
        } catch (err) { console.error(err); }
        return { success: false, total: 0 };
    }

    async _updateObject(event, formData) {
        let modifiers = 0; 
        let logs = [];
        let usedHealerItem = false;
        let isBandage = false; 
        
        const stressStart = StressManager.getStress(this.actor);
        const hpBefore = this.actor.system.attributes.hp.value;
        const moduleId = STRESS_CONFIG.MODULE_ID;
        const labelStress = game.i18n.localize("STRESS.Hud.Stress");

        const foodMode = game.settings.get(moduleId, "foodMode");
        const drinkMode = game.settings.get(moduleId, "drinkMode");
        const useEnvironment = game.settings.get(moduleId, "environmentMode");

        // --- 0. ITENS DE DESCANSO ---
        const hasTent = this.actor.items.some(i => i.name.toLowerCase().match(/tent|barraca/));
        const hasBedroll = this.actor.items.some(i => i.name.toLowerCase().match(/bedroll|saco de dormir/));
        let restItemBonus = 0;
        let restItemName = "";
        
        if (hasTent) {
            restItemBonus = 4;
            restItemName = game.i18n.localize("STRESS.Item.Tent");
        } else if (hasBedroll) {
            restItemBonus = 2;
            restItemName = game.i18n.localize("STRESS.Item.Bedroll");
        }

        // --- 1. COMIDA ---
        if (formData.foodId) {
            const item = await ItemHandler.consume(this.actor, formData.foodId);
            if (item) {
                logs.push(`${game.i18n.localize("STRESS.Msg.EatSuccess")}: ${item.name}`);
                const rarity = item.system.rarity || "common";
                if (rarity === "uncommon") { modifiers -= 1; logs.push(`<span style="color:#9cdeba">${game.i18n.localize("STRESS.Rarity.Uncommon")}: -1 ${labelStress}</span>`); }
                else if (rarity === "rare") { modifiers -= 2; logs.push(`<span style="color:#9cdeba">${game.i18n.localize("STRESS.Rarity.Rare")}: -2 ${labelStress}</span>`); }
                else if (rarity === "veryRare") { modifiers -= 3; logs.push(`<span style="color:#9cdeba">${game.i18n.localize("STRESS.Rarity.VeryRare")}: -3 ${labelStress}</span>`); }
                else if (rarity === "legendary") { modifiers -= 4; logs.push(`<span style="color:#9cdeba">${game.i18n.localize("STRESS.Rarity.Legendary")}: -4 ${labelStress}</span>`); }
            } else { modifiers += 1; logs.push(`<span style="color:#ff5555">${game.i18n.localize("STRESS.Msg.FailStress")}</span>`); }
        } else {
            if (foodMode === "roll") {
                const check = await this._rollConSave(10, game.i18n.localize("STRESS.Labels.FoodCheck"));
                if (check.success) logs.push(`<span style="color:#9cdeba">${game.i18n.localize("STRESS.Labels.FoodCheck")}: ${game.i18n.localize("STRESS.Msg.Saved")}</span>`);
                else { modifiers += 1; logs.push(`<span style="color:#ff5555">${game.i18n.localize("STRESS.Labels.FoodCheck")}: ${game.i18n.localize("STRESS.Msg.FailStress")}</span>`); }
            } else {
                modifiers += 1; logs.push(`<span style="color:#ff5555">${game.i18n.localize("STRESS.Settings.FoodMode.Name")}: +1 ${labelStress}</span>`);
            }
        }

        // --- 2. BEBIDA ---
        if (formData.drinkId) {
            const item = await ItemHandler.consume(this.actor, formData.drinkId);
            if (item) {
                logs.push(`${game.i18n.localize("STRESS.Msg.DrinkSuccess")}: ${item.name}`);
                const rarity = item.system.rarity || "common";
                if (rarity === "uncommon") { modifiers -= 1; logs.push(`<span style="color:#9cdeba">${game.i18n.localize("STRESS.Rarity.Uncommon")}: -1 ${labelStress}</span>`); }
                else if (rarity === "rare") { modifiers -= 2; logs.push(`<span style="color:#9cdeba">${game.i18n.localize("STRESS.Rarity.Rare")}: -2 ${labelStress}</span>`); }
                else if (rarity === "veryRare") { modifiers -= 3; logs.push(`<span style="color:#9cdeba">${game.i18n.localize("STRESS.Rarity.VeryRare")}: -3 ${labelStress}</span>`); }
                else if (rarity === "legendary") { modifiers -= 4; logs.push(`<span style="color:#9cdeba">${game.i18n.localize("STRESS.Rarity.Legendary")}: -4 ${labelStress}</span>`); }
            } else { modifiers += 1; logs.push(`<span style="color:#ff5555">${game.i18n.localize("STRESS.Msg.FailStress")}</span>`); }
        } else {
            if (drinkMode === "roll") {
                const check = await this._rollConSave(10, game.i18n.localize("STRESS.Labels.DrinkCheck"));
                if (check.success) logs.push(`<span style="color:#9cdeba">${game.i18n.localize("STRESS.Labels.DrinkCheck")}: ${game.i18n.localize("STRESS.Msg.Saved")}</span>`);
                else { modifiers += 1; logs.push(`<span style="color:#ff5555">${game.i18n.localize("STRESS.Labels.DrinkCheck")}: ${game.i18n.localize("STRESS.Msg.FailStress")}</span>`); }
            } else {
                modifiers += 1; logs.push(`<span style="color:#ff5555">${game.i18n.localize("STRESS.Settings.DrinkMode.Name")}: +1 ${labelStress}</span>`);
            }
        }

        // --- 3. CURA ---
        if (formData.healId) {
            const item = await ItemHandler.consume(this.actor, formData.healId);
            if (item) { 
                usedHealerItem = true; 
                logs.push(`${game.i18n.localize("STRESS.Report.UsedItem")}: ${item.name}`);
                
                if (item.name.toLowerCase().match(/bandage|atadura|bandagem/)) {
                    isBandage = true;
                }
            }
        } else { 
            logs.push(`<span style="color:#eebb23">${game.i18n.localize("STRESS.Msg.NoItemHeal")}</span>`); 
        }

        // --- 4. AMBIENTE ---
        if (useEnvironment) {
            let dc = parseInt(formData.environment);
            if (dc > 0) {
                const finalDC = Math.max(0, dc - restItemBonus);
                const flavor = `${game.i18n.localize("STRESS.Labels.EnvCheck")} (Base CD ${dc}${restItemBonus > 0 ? ` - ${restItemBonus} ${restItemName}` : ''})`;
                const check = await this._rollConSave(finalDC, flavor);
                if (check.success) {
                    logs.push(`<span style="color:#9cdeba">${game.i18n.localize("STRESS.Msg.Saved")} (${check.total} vs CD ${finalDC})</span>`);
                    if (restItemBonus > 0) logs.push(`<span style="font-size:11px; color:#aaa;">(Conforto: ${restItemName})</span>`);
                } else {
                    modifiers += 1;
                    logs.push(`<span style="color:#ff5555">${game.i18n.localize("STRESS.Msg.FailStress")} (${check.total} vs CD ${finalDC})</span>`);
                }
            } else {
                logs.push(game.i18n.localize("STRESS.Msg.EnvironmentSafe"));
            }
        }

        // --- 5. EXECUÇÃO ---
        await this.actor.longRest({ dialog: false, chat: false, newDay: true, stressRestModule: true });

        // --- 6. ATUALIZAÇÃO ---
        let stressAfterRecovery = Math.max(0, stressStart - 2);
        let finalStress = Math.clamped(stressAfterRecovery + modifiers, 0, STRESS_CONFIG.MAX_STRESS);
        
        const freshActor = game.actors.get(this.actor.id) || this.actor;
        const updates = {};

        // >>> LOGICA DE CURA CONDICIONAL <<<
        if (!usedHealerItem) {
            updates["system.attributes.hp.value"] = hpBefore;
        } else if (isBandage) {
            const hpMax = freshActor.system.attributes.hp.max;
            const fullGain = hpMax - hpBefore;
            const reducedGain = Math.floor(fullGain * 0.5);
            
            updates["system.attributes.hp.value"] = hpBefore + reducedGain;
            
            // >>> MUDANÇA AQUI: Usa a nova tradução limpa <<<
            logs.push(`<span style="color:#ffcc00">${game.i18n.format("STRESS.Report.BandageEffect", {val: reducedGain})}</span>`);

        } else {
            logs.push(`<span style="color:#9cdeba">Recuperação Total de PV.</span>`);
        }
        
        updates[`flags.${STRESS_CONFIG.MODULE_ID}.${STRESS_CONFIG.FLAG_NAME}`] = finalStress;
        updates["system.attributes.exhaustion"] = Math.floor(finalStress / STRESS_CONFIG.RATIO);
        
        await freshActor.update(updates, { stressRest: true });

        // --- 7. CHAT CARD ---
        const bannerImg = "systems/dnd5e/ui/official/banner-character-dark.webp";
        const content = `
        <div style="background:#111215; border:1px solid #000; color:#cfcdc2; font-family:'Signika', sans-serif; margin-top:5px;">
            <div style="position:relative; height:60px; overflow:hidden; border-bottom:1px solid #333;">
                <div style="position:absolute; width:100%; height:100%; background:url('${bannerImg}') top center/cover; opacity:0.5;"></div>
                <h3 style="position:relative; z-index:2; text-align:center; margin:0; padding-top:18px; color:#ecebdb; font-family:'Modesto Condensed', serif; font-size:24px; text-shadow:0 0 5px black;">
                    ${game.i18n.localize("STRESS.Report.Title")}
                </h3>
            </div>
            <div style="padding:15px; text-align:center;">
                <div style="font-family:'Modesto Condensed', serif; font-size:24px; color:#ecebdb; text-transform:uppercase; margin-bottom:15px; text-shadow:0 0 2px black; letter-spacing:1px;">
                    ${freshActor.name}
                </div>
                <div style="text-align:left; margin-bottom:15px;">
                    ${logs.map(l => `<div style="padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px; color:#aaa;">${l}</div>`).join("")}
                </div>
                <div style="font-size:11px; color:#666; display:flex; justify-content:space-between; margin-bottom:5px;">
                   <span>${game.i18n.localize("STRESS.Report.Start")}: <b>${stressStart}</b></span>
                   <span>${game.i18n.localize("STRESS.Report.Recovery")}: <b>-2</b></span>
                   <span>${game.i18n.localize("STRESS.Report.Modifiers")}: <b>${modifiers > 0 ? '+' : ''}${modifiers}</b></span>
                </div>
                <div style="padding:8px; border:1px solid ${modifiers > 2 ? '#7a0000' : '#4a7558'}; 
                            background:${modifiers > 2 ? 'rgba(80, 0, 0, 0.3)' : 'linear-gradient(to bottom, rgba(10, 30, 15, 0.6), rgba(20, 50, 25, 0.5))'}; 
                            color:${modifiers > 2 ? '#ff8888' : '#9cdeba'}; 
                            font-weight:bold; font-family:'Modesto Condensed', serif; font-size:18px; letter-spacing:1px; 
                            box-shadow: inset 0 0 15px rgba(0,0,0,0.2);">
                    ${game.i18n.localize("STRESS.Report.FinalStress")}: ${finalStress}
                </div>
            </div>
        </div>`;

        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({actor: freshActor}),
            content: content
        });
    }
}