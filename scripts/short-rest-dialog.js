import { ItemHandler } from "./item-handler.js";
import { StressManager, STRESS_CONFIG } from "./stress-manager.js";

export class StressShortRestDialog extends FormApplication {
    constructor(actor) {
        super();
        this.actor = actor;
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "stress-short-rest",
            template: "modules/stresspoints-rest/templates/short-rest.hbs",
            title: game.i18n.localize("STRESS.Dialog.ShortRest"),
            width: 400,
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
        const stressVal = StressManager.getStress(this.actor);
        data.stressVal = stressVal;
        data.stressPercent = Math.floor((stressVal / 12) * 100);
        data.exhaustVal = this.actor.system.attributes.exhaustion;
        data.exhaustPercent = Math.floor((data.exhaustVal / 6) * 100);

        data.requireHealer = game.settings.get(STRESS_CONFIG.MODULE_ID, "requireHealerKit");

        const consumables = this.actor.items.filter(i => i.type === "consumable");
        
        // Filtro de itens (inclui Bandagem)
        data.healItems = consumables.filter(i => 
            i.system.type?.value === "potion" || 
            i.name.toLowerCase().match(/curandeiro|healer|kit/) || 
            i.name.toLowerCase().match(/bandage|atadura|bandagem/)
        );
        
        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.item-slot').click(ev => {
            const li = $(ev.currentTarget);
            html.find(`#input-${li.data("target")}`).val(li.data("value"));
            li.parent().find('.item-slot').removeClass('selected');
            li.addClass('selected');
        });
    }

    async _updateObject(event, formData) {
        let usedHealerItem = false;
        let isBandage = false;
        let logs = [];
        
        const requireHealer = game.settings.get(STRESS_CONFIG.MODULE_ID, "requireHealerKit");

        // 1. CONSUMO
        if (formData.healId) {
            const item = await ItemHandler.consume(this.actor, formData.healId);
            if (item) {
                usedHealerItem = true;
                logs.push(`${game.i18n.localize("STRESS.Report.UsedItem")}: <b>${item.name}</b>`);
                
                if (item.name.toLowerCase().match(/bandage|atadura|bandagem/)) {
                    isBandage = true;
                }
            }
        } else {
            if (requireHealer) {
                logs.push(`<span style="color:#eebb23">${game.i18n.localize("STRESS.Msg.NoItemHeal")}</span>`);
            } else {
                logs.push(`<span style="color:#aaa; font-style:italic;">${game.i18n.localize("STRESS.Inventory.NoItemUsed")}</span>`);
            }
        }

        // 2. SISTEMA
        const hpBefore = this.actor.system.attributes.hp.value;

        const result = await this.actor.shortRest({
            dialog: true,
            chat: true,
            stressRestModule: true 
        });

        if (!result) return;

        // 3. LÓGICA DE HP
        const hpAfter = this.actor.system.attributes.hp.value;
        let hpGained = hpAfter - hpBefore;

        if (usedHealerItem && isBandage && hpGained > 0) {
            hpGained = Math.floor(hpGained * 0.5); // Corta a cura pela metade
            await this.actor.update({"system.attributes.hp.value": hpBefore + hpGained});
            
            // >>> MUDANÇA AQUI: Usa a nova tradução limpa <<<
            logs.push(`<span style="color:#ffcc00">${game.i18n.format("STRESS.Report.BandageEffect", {val: hpGained})}</span>`);

        } else if (requireHealer && hpGained > 0 && !usedHealerItem) {
            await this.actor.update({"system.attributes.hp.value": hpBefore});
            logs.push(`<span style="color:#ff5555"><b>${game.i18n.localize("STRESS.Report.HPCritical")}</b></span>`);
            hpGained = 0;
        } 
        
        if (hpGained > 0) {
            logs.push(`<span style="color:#9cdeba">${game.i18n.format("STRESS.Report.HPRestored", {val: hpGained})}</span>`);
        }

        // Chat Card
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
                    ${this.actor.name}
                </div>
                <div style="text-align:left; margin-bottom:15px;">
                    ${logs.map(l => `<div style="padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px; color:#aaa;">${l}</div>`).join("")}
                </div>
                <div style="padding:8px; border:1px solid #4a7558; 
                            background:linear-gradient(to bottom, rgba(10, 30, 15, 0.9), rgba(20, 50, 25, 0.8)); 
                            color:#9cdeba; font-weight:bold; font-family:'Modesto Condensed', serif; font-size:18px; letter-spacing:1px; 
                            box-shadow: inset 0 0 15px rgba(50, 200, 50, 0.1);">
                    ${game.i18n.localize("STRESS.Report.ShortRestDone")}
                </div>
            </div>
        </div>`;

        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({actor: this.actor}),
            content: content
        });
    }
}