import { STRESS_CONFIG } from "./stress-manager.js";

export class PushingLimitsDialog {
    // Método estático para aplicar direto, sem diálogo
    static async activate(item) {
        const actor = item.actor;
        if (!actor) return;

        console.log("Stress Module | Aplicando No Limite para:", actor.name);

        // 1. Pega configurações
        const ratio = game.settings.get(STRESS_CONFIG.MODULE_ID, "stressRatio") ?? 2;
        const maxStress = game.settings.get(STRESS_CONFIG.MODULE_ID, "maxStress") ?? 12;

        // 2. Cálculos
        const currentStress = actor.getFlag(STRESS_CONFIG.MODULE_ID, STRESS_CONFIG.FLAG_NAME) || 0;
        // Soma o Ratio (custo) ao estresse atual, respeitando o máximo
        const newStress = Math.min(currentStress + ratio, maxStress);
        // Calcula nova exaustão
        const newEx = Math.floor(newStress / ratio);

        // 3. Aplica no Ator
        const updates = { [`flags.${STRESS_CONFIG.MODULE_ID}.${STRESS_CONFIG.FLAG_NAME}`]: newStress };
        
        // Só atualiza exaustão se mudou o nível
        if (newEx !== actor.system.attributes.exhaustion) {
            updates["system.attributes.exhaustion"] = newEx;
        }
        
        await actor.update(updates, { stressSync: true });

        // 4. Envia mensagem no Chat
        this.createChatCard(actor, ratio, newStress);
    }

    static createChatCard(actor, ratio, currentStress) {
        const bannerImg = "systems/dnd5e/ui/official/banner-character-dark.webp";
        
        // Tenta traduzir ou usa Inglês como padrão
        const title = game.i18n.localize("STRESS.Chat.LimitExceeded") || "LIMIT EXCEEDED";
        const desc = game.i18n.localize("STRESS.Chat.LimitDesc") || "You pushed your limits to gain advantage.";
        const lblCost = game.i18n.localize("STRESS.Feature.CostLabel") || "COST";
        
        const content = `
        <div style="background:#111215; border:1px solid #000; color:#cfcdc2; font-family:'Signika', sans-serif; margin-top:5px;">
            <div style="position:relative; height:60px; overflow:hidden; border-bottom:1px solid #333;">
                <div style="position:absolute; width:100%; height:100%; background:url('${bannerImg}') top center/cover; opacity:0.5;"></div>
                <h3 style="position:relative; z-index:2; text-align:center; margin:0; padding-top:18px; color:#ecebdb; font-family:'Modesto Condensed', serif; font-size:24px; text-shadow:0 0 5px black;">
                    ${title}
                </h3>
            </div>
            <div style="padding:15px; text-align:center;">
                <div style="font-family:'Modesto Condensed', serif; font-size:24px; color:#ecebdb; text-transform:uppercase; margin-bottom:10px;">
                    ${actor.name}
                </div>
                <p style="font-size:13px; color:#aaa; font-style:italic; margin-bottom:15px;">
                    ${desc}
                </p>
                <div style="background:rgba(80, 0, 0, 0.4); border:1px solid #7a0000; padding:8px; border-radius:3px; display:inline-block; min-width:120px;">
                    <div style="font-size:10px; color:#ff8888; margin-bottom:2px;">${lblCost}</div>
                    <div style="color:#ff5555; font-family:'Modesto Condensed', serif; font-size:22px; font-weight:bold;">
                        +${ratio} ESTRESSE
                    </div>
                    <div style="font-size:10px; color:#666; margin-top:2px;">Total: ${currentStress}</div>
                </div>
            </div>
        </div>`;

        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({actor}),
            content: content
        });
    }

    // Init vazio para compatibilidade com o main.js
    static init() {} 
}