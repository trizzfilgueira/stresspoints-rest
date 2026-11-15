import { postStressCard } from "./chat-card.js";

const OLD_EX_OPTION = "stressOldExhaustion";

export class ExhaustionHandler {

    static init() {
        // The card is posted by the client that made the change, once the update has gone through.
        Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
            if (game.user.id !== userId || actor.type !== "character") return;
            if (!foundry.utils.hasProperty(changes, "system.attributes.exhaustion")) return;
            options[OLD_EX_OPTION] = actor.system.attributes.exhaustion || 0;
        });

        Hooks.on("updateActor", (actor, changes, options, userId) => {
            if (game.user.id !== userId || !(OLD_EX_OPTION in options)) return;
            const newEx = foundry.utils.getProperty(changes, "system.attributes.exhaustion");
            if (newEx === undefined || newEx === null) return;
            if (newEx > options[OLD_EX_OPTION] && newEx >= 1) ExhaustionHandler.createCard(actor, newEx);
        });
    }

    static getFlavor(level) {
        const key = `STRESS.Exhaustion.L${level}`;
        return { text: game.i18n.has(key) ? game.i18n.localize(key) : "" };
    }

    static createCard(actor, level) {
        const flavor = ExhaustionHandler.getFlavor(level);
        return postStressCard(actor, {
            title: game.i18n.localize("STRESS.Exhaustion.Title"),
            template: "exhaustion",
            data: { level, quote: flavor.text }
        });
    }
}
