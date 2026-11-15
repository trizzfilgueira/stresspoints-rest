const TEMPLATE_DIR = "modules/stresspoints-rest/templates/chat";
const renderTemplate = (path, data) => (foundry.applications.handlebars?.renderTemplate ?? globalThis.renderTemplate)(path, data);

export const logIcon = name => `<i class="fa-solid fa-${name} fa-fw stress-card__li-icon"></i>`;

const CARD_ICONS = {
    "long-rest": "fa-solid fa-campground",
    "short-rest": "fa-solid fa-mug-hot",
    "exhaustion": "fa-solid fa-skull",
    "collapse": "fa-solid fa-heart-crack",
    "pushing-limits": "fa-solid fa-fist-raised",
    "group-report": "fa-solid fa-users"
};

// tone: good | bad | warn | gold | muted
export const tone = (name, html) => `<span class="sr-${name}">${html}</span>`;

export const stressBonusText = bonus => bonus > 0
    ? ` <b class="sr-good">(−${bonus} ${game.i18n.localize("STRESS.Sheet.Label")})</b>` : "";

// HTML in `data` that a template prints with {{{ }}} must already be escaped.
export async function renderStressCard({ title, template, data = {}, tone: cardTone, actorName, icon }) {
    const body = await renderTemplate(`${TEMPLATE_DIR}/${template}.hbs`, data);
    icon ??= CARD_ICONS[template] ?? "fa-solid fa-heart-crack";
    return renderTemplate(`${TEMPLATE_DIR}/card.hbs`, { title, tone: cardTone, actorName, icon, body });
}

export async function postStressCard(actor, { speaker, ...card }) {
    const content = await renderStressCard({ actorName: actor?.name, ...card });
    return ChatMessage.create({ speaker: speaker ?? ChatMessage.getSpeaker({ actor }), content });
}
