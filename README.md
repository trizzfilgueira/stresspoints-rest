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
* **Medical Requirement:** To spend Hit Dice effectively, a character needs a **Healer's Kit**.
* **New Item: Bandage:** If a *Bandage* is used instead of a Kit, the character recovers only **50%** of the rolled Hit Die value (inefficient treatment).
* **No Stress Relief:** Short rests do not reduce Stress or Exhaustion.

### 3. Immersive Long Rest
Long Resting requires preparation. The GM sets an **Environment DC** and players must consume supplies.

#### Camping & Environment
Players roll a Constitution Save against the Environment DC.
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
Players can purchase food and drink directly from the rest screen, without needing items in their inventory. The cost is automatically deducted from their character's coins.
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

**Stress & Rest Items** — It is recommended to import and use these items so the module's automation works correctly:
* **Bandage:** Consumable item for Short Rests.
* **Food & Drink items:** Pre-configured with the correct rarities for Stress reduction.

**Stress Macros** — Contains utility macros for the GM. If you want to manually adjust a character's Stress (add, remove, or set a specific value), import the relevant macro from this compendium and run it from your macro bar.

### 2. Resting
Simply click the standard **Short Rest** or **Long Rest** button on the D&D 5e character sheet.
* **Short Rest:** A dialog will ask for a Healer's Kit or Bandage.
* **Long Rest:** A dialog will ask for Food, Drink, and Camping Gear, showing the current Environment DC. Supplies can be taken from inventory or purchased externally if the GM has enabled that option.

### 3. Tracking Stress
You don't need to do anything manually. The module automatically adds a tracker. If a player takes Exhaustion via the standard sheet, the Stress updates automatically (and vice-versa).

---

## ⚙️ Configuration

You can customize the mechanics in **Configure Settings**:

* **Max Stress:** Set the maximum stress before death (Default: 12).
* **Stress Ratio:** How many Stress Points equal 1 Exhaustion (Default: 2).
* **Stress at 0 HP:** How many Stress Points are inflicted when a character drops unconscious (Default: 2).
* **Require Healer's Kit (Short Rest):** If disabled, Short Rests behave normally (vanilla).
* **Require Healer's Kit (Long Rest):** Independently control whether healing items are required for Long Rests.
* **External Purchase Price:** Set the base coin cost for purchasing supplies at rest. Set to 0 to disable.
* **External Purchase Currency:** Choose which coin type is used for purchases (PP, GP, EP, SP, or CP).
* **Max Purchase Rarity:** Define the highest rarity of supplies players can buy externally.
* **Food/Drink Mode:**
    * *Mandatory:* Items must be deducted from inventory.
    * *Roll:* Players make a check if they don't have food.

---

## 🤝 Credits

* **Author:** trizzfilgueira
* **System:** Dungeons & Dragons 5.5e (2024 ruleset adaptation).
