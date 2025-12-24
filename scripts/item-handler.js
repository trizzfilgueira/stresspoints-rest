export class ItemHandler {
    static async consume(actor, itemId) {
        if (!itemId) return null;

        const item = actor.items.get(itemId);
        if (!item) return null;

        const uses = item.system.uses || {};
        const max = parseInt(uses.max) || 0;
        const value = parseInt(uses.value) || 0;
        const qty = item.system.quantity || 0;
        const config = { configureDialog: false };

        if (max > 0) {
            if (value > 0) {
                const usage = await item.use({}, config);
                if (!usage) return null;
                return item;
            } 
            else if (qty > 1) {
                await item.update({ 
                    "system.quantity": qty - 1, 
                    "system.uses.value": max 
                });
                return item;
            } else {
                ui.notifications.warn(game.i18n.format("STRESS.Warn.ItemEmpty", {name: item.name}));
                return null;
            }
        } 
        else {
            if (qty > 0) {
                const usage = await item.use({}, config);
                if (!usage) return null;
                return item;
            } else {
                ui.notifications.warn(game.i18n.format("STRESS.Warn.NoMoreItem", {name: item.name}));
                return null;
            }
        }
    }
}