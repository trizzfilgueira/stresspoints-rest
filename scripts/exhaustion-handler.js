/**
 * ARQUIVO: exhaustion-handler.js
 * Monitora aumento de Exaustão e envia cards narrativos traduzidos.
 */

const STRESS_BANNER = "systems/dnd5e/ui/official/banner-character-dark.webp";

export class ExhaustionHandler {
    
    static init() {
        Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
            const newEx = foundry.utils.getProperty(changes, "system.attributes.exhaustion");
            if (newEx === undefined || newEx === null) return;

            const oldEx = actor.system.attributes.exhaustion || 0;

            if (newEx > oldEx && newEx >= 1 && newEx <= 6) {
                ExhaustionHandler.createCard(actor, newEx);
            }
        });
        
        console.log("Stress Module | Monitor de Exaustão Ativo.");
    }

    static getFlavor(level) {
        // Cores hardcoded (estilo)
        const colors = {
            1: "#eebb23",
            2: "#eebb23",
            3: "#ffaa00",
            4: "#ff5555",
            5: "#ff0000",
            6: "#880000"
        };

        // Textos via i18n
        return {
            color: colors[level] || "#ccc",
            text: game.i18n.localize(`STRESS.Exhaustion.L${level}`)
        };
    }

    static createCard(actor, level) {
        const flavor = ExhaustionHandler.getFlavor(level);

        const content = `
        <div style="background:#111215; border:1px solid #000; color:#cfcdc2; font-family:'Signika', sans-serif; margin-top:5px;">
            <div style="position:relative; height:60px; overflow:hidden; border-bottom:1px solid #333;">
                <div style="position:absolute; width:100%; height:100%; background:url('${STRESS_BANNER}') top center/cover; opacity:0.5;"></div>
                <h3 style="position:relative; z-index:2; text-align:center; margin:0; padding-top:18px; color:#ecebdb; font-family:'Modesto Condensed', serif; font-size:24px; text-shadow:0 0 5px black; text-transform:uppercase;">
                    ${game.i18n.localize("STRESS.Exhaustion.Title")}
                </h3>
            </div>
            
            <div style="padding:15px; text-align:center;">
                <div style="font-family:'Modesto Condensed', serif; font-size:20px; color:#ecebdb; margin-bottom:10px; text-transform:uppercase;">
                    ${actor.name}
                </div>

                <div style="margin-bottom:10px;">
                    <i class="fas fa-skull" style="font-size:30px; color:${flavor.color}; text-shadow:0 0 10px ${flavor.color};"></i>
                    <div style="font-size:28px; font-weight:bold; font-family:'Modesto Condensed', serif; color:${flavor.color}; line-height:1;">
                        ${game.i18n.localize("STRESS.Exhaustion.Level")} ${level}
                    </div>
                </div>

                <div style="background:rgba(0, 0, 0, 0.4); border:1px solid ${flavor.color}; padding:10px; border-radius:3px;">
                    <div style="font-size:14px; color:#fff; font-style:italic; line-height:1.4;">
                        "${flavor.text}"
                    </div>
                </div>
            </div>
        </div>`;

        ChatMessage.create({
            speaker: ChatMessage.getSpeaker({actor}),
            content: content
        });
    }
}