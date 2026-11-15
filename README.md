# Stress Points & Rest (D&D 5e)

![Foundry v13](https://img.shields.io/badge/Foundry-v13-orange)
![Foundry v14](https://img.shields.io/badge/Foundry-v14-orange)
![System D&D5.5e](https://img.shields.io/badge/System-D%26D5.5e-blue)
![Language](https://img.shields.io/badge/Language-English%20%7C%20Português-green)

**Stress and Rest Points** is a Foundry VTT module for D&D 5.5e that introduces a **Stress System** to bridge the gap between full health and exhaustion. It completely overhauls the **Short and Long Rest** interface, transforming rest into a resource management system involving Food, Drink, Comfort and Medical Supplies.

---

## 🌟 Key Features

### 1. Stress & Exhaustion System
Instead of taking a full level of Exhaustion immediately, characters accumulate **Stress Points**.
* **Stress Track:** Characters have a Stress cap (Default: **12**).
* **Conversion:** Every **2 Stress Points** automatically convert into **1 Level of Exhaustion**.
* **Trauma:** Dropping to **0 HP** inflicts a configurable amount of Stress (Default: **+2**).
* **Survival Triggers:** Malnutrition, Dehydration, or Discomfort each add **+1 Stress**.
* **Immunity:** Races and creatures that don't need to eat or drink (Warforged, undead, constructs, etc.) are automatically recognized and exempt from hunger and thirst penalties.

### 2. Tactical Short Rest
Short rests are no longer guaranteed full healing.
* **Medical Requirement:** To spend Hit Dice, a character needs a **Healer's Kit** (or a healing potion/bandage). Without one, Hit Dice cannot be spent, so none are wasted. The item is only consumed if the rest actually happens.
* **New Item: Bandage:** If a *Bandage* is used instead of a Kit, the character recovers only **50%** of the rolled Hit Die value (inefficient treatment).
* **No Stress Relief:** Short rests do not reduce Stress or Exhaustion.

### 3. Immersive Long Rest
Long Resting requires preparation. The GM sets an **Environment DC** and players must consume supplies.

**Hit Points:** following the official rule (2014 and 2024), a character at **0 HP cannot start a Long Rest**: they must be healed or stabilized above 0 HP first, and nothing is consumed. The GM can turn this off in the settings.

#### Camping & Environment
Players roll a Constitution Save against the Environment DC. By default the **GM** sets it in the GM Panel: one **party camp** shared by everyone, plus an optional **per-character override** for anyone resting somewhere else (e.g. the scout keeping watch on a hostile ridge). Players see the environment locked in their rest dialog; it updates live if the GM changes it. Disable *GM Defines the Rest Environment* to let players pick it themselves.
* **Safe:** DC 0
* **Low Safety:** DC 10
* **Low Danger:** DC 12
* **Dangerous:** DC 14
* **High Danger:** DC 16
* **Extremely Hostile:** DC 18

**Camping Gear Bonuses:**
* **Bedroll:** -2 to Environment DC.
* **Tent:** -4 to Environment DC.

#### Food & Drink Quality
Consuming supplies is mandatory. Better quality food reduces Stress:
| Rarity | Effect on Stress |
| :--- | :--- |
| **Common** | Prevents hunger stress (0) |
| **Uncommon** | Removes **-1** Stress |
| **Rare** | Removes **-2** Stress |
| **Very Rare** | Removes **-3** Stress |
| **Legendary** | Removes **-4** Stress |

#### External Purchases
Players can purchase food and drink directly from the rest screen, without needing items in their inventory. The cost is deducted from their character's coins: the chosen currency is used first, other coins are combined when needed, and a larger coin is only broken into change when necessary. The rest of the purse is left untouched.
* The GM can set the **base price** and the **currency** used (PP, GP, EP, SP, or CP).
* The GM can define the **maximum rarity** available for purchase, controlling how much quality can reduce Stress.
* If the character doesn't have enough coins, they suffer Stress normally.
* This feature can be **disabled** by setting the price to 0.

---

## 📦 Installation Guide

1.  **Copy the Manifest Link:**
    `https://raw.githubusercontent.com/trizzfilgueira/stresspoints-rest/main/module.json`
2.  Open **Foundry VTT**.
3.  Go to the **Add-on Modules** tab.
4.  Click **Install Module**.
5.  Paste the link into the "Manifest URL" field and click **Install**.
6.  Launch your World, go to **Game Settings > Manage Modules**, and enable **Stress Points & Rest**.

---

## 🛠️ How to Use

### 1. Setting Up Items
The module comes with two Compendiums to help you get started:

**Stress & Rest Items:** it is recommended to import and use these items so the module's automation works correctly:
* **Bandage:** Consumable item for Short Rests.
* **Food & Drink items:** Pre-configured with the correct rarities for Stress reduction.

**Item detection:** food, drink and healing items are recognized automatically (consumable type "food", items with a *Heal* activity, healer's kits and bandages). If an item is misclassified, set a flag on it, e.g. with a macro:
```js
// "food" | "drink" | "heal" | "none"
await item.setFlag("stresspoints-rest", "restKind", "drink");
```

**Stress Macros:** the *GM Stress Panel* macro opens the GM Panel described below.

### 2. Resting
Click the standard **Short Rest** or **Long Rest** button on the D&D 5e character sheet.
* **Short Rest:** A dialog will ask for a Healer's Kit or Bandage.
* **Long Rest:** A dialog will ask for Food, Drink, Healer's Kit, and the current Environment. Supplies can be taken from inventory or purchased externally if the GM has enabled that option.

### 3. Tracking Stress
* **Character sheet:** a Stress meter sits right below Hit Points. Its tooltip shows how many points are left until the next Exhaustion level (e.g. *7/12 Stress · 1 more until Exhaustion 4*). For the GM, clicking it opens the GM Panel.
* **Token bar:** pick `attributes.stress` as a token resource bar. Editing it from the token HUD changes Stress (and Exhaustion) directly.
* **Sync:** if a player takes Exhaustion via the standard sheet, the Stress updates automatically (and vice-versa).

### 4. GM Panel
Open it with the **heart button in the Token controls** (GM only), the *GM Stress Panel* macro, or `game.modules.get("stresspoints-rest").api.openGMPanel()`. It shows:
* each character's Stress, HP and Exhaustion, with **+/−** buttons (**Shift-click** moves a whole Exhaustion level);
* the **party camp** environment and a per-character environment selector;
* a **Send report** button that posts the group status to chat.

---

### 5. Pushing Limits
Using the *Pushing Limits* feature grants **Advantage on the next d20 roll** (attack, check, save, initiative or death save) for +1 Exhaustion, or recovers a spent spell slot (levels 1–5, including Warlock pact slots) for Exhaustion equal to the slot level. Advantage works with plain dnd5e; Midi-QOL is optional.

---

## ⚙️ Configuration

You can customize the mechanics in **Configure Settings**:

* **Max Stress:** Set the maximum stress before death (Default: 12).
* **Stress Ratio:** How many Stress Points equal 1 Exhaustion (Default: 2).
* **Stress at 0 HP:** How many Stress Points are inflicted when a character drops unconscious (Default: 2).
* **Require Healer's Kit (Short Rest):** If disabled, Short Rests behave normally (vanilla).
* **Require Healer's Kit (Long Rest):** Independently control whether healing items are required for Long Rests.
* **Long Rest Requires 1 HP:** On by default (official rule). A character at 0 HP cannot start a Long Rest.
* **External Purchase Price:** Set the base coin cost for purchasing supplies at rest. Set to 0 to disable.
* **External Purchase Currency:** Choose which coin type is used for purchases (PP, GP, EP, SP, or CP).
* **Max Purchase Rarity:** Define the highest rarity of supplies players can buy externally.
* **Food/Drink Mode:**
    * *Mandatory:* Items must be deducted from inventory.
    * *Roll:* Players make a check if they don't have food.
* **GM Defines the Rest Environment:** On by default. The GM sets the camp (and per-character overrides) in the GM Panel; off lets players choose in the rest dialog.

### Macro API
```js
const api = game.modules.get("stresspoints-rest").api;
api.openGMPanel();
api.getStress(actor);              // current Stress
await api.setStress(actor, 6);     // set Stress (Exhaustion follows)
await api.applyStress(actor, -2);  // add/remove Stress
await api.setCampEnvironment(14);  // party camp DC: 0, 10, 12, 14, 16 or 18
await api.setActorEnvironment(actor, 18);   // per-character override; null = follow the camp
api.getActorEnvironment(actor);    // DC this character rests under
api.getExhaustionFor(7);           // Exhaustion level a Stress value implies
api.maxStress; api.ratio;          // current settings
```

### Hook for other modules
`stresspoints-rest.stressChanged` fires on every client whenever a character's Stress changes, whatever caused it (rest, collapse, GM Panel, token bar, manual Exhaustion, another module):
```js
Hooks.on("stresspoints-rest.stressChanged", (actor, { stress, previous, delta, exhaustion, previousExhaustion, options, userId }) => {
    if (delta > 0 && userId === game.user.id) ui.notifications.info(`${actor.name} is under more pressure (${stress}).`);
});
```

### Automated tests
With the [Quench](https://foundryvtt.com/packages/quench) module active, the module registers three test batches (Stress, Rest and Interface). Open Quench's window and run them after updating Foundry or dnd5e. They use temporary actors, which are deleted at the end, and restore any setting they change.

---

## 🤝 Credits

* **Author:** trizzfilgueira
* **System:** Dungeons & Dragons 5.5e (2024 ruleset adaptation).
