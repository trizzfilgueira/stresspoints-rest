# Stress Points & Rest (D&D 5e)

![Foundry v12](https://img.shields.io/badge/Foundry-v12-orange)
![System D&D5e](https://img.shields.io/badge/System-D%26D5e-blue)
![Language](https://img.shields.io/badge/Language-English%20%7C%20Português-green)

**Stress Points & Rest** is a Foundry VTT module for D&D 5e that introduces a granular **Stress System** to bridge the gap between full health and Exhaustion. It completely overhauls the **Short and Long Rest** interface, turning resting into a tactical phase of resource management involving Food, Drink, Comfort, and Medical Supplies.

---

## 🌟 Key Features

### 1. Stress & Exhaustion System
Instead of taking a full level of Exhaustion immediately, characters accumulate **Stress Points**.
* **Stress Track:** Characters have a Stress cap (Default: **12**).
* **Conversion:** Every **2 Stress Points** automatically convert into **1 Level of Exhaustion**.
* **Trauma:** Dropping to **0 HP** immediately inflicts **+2 Stress Points**.
* **Survival Triggers:** Malnutrition, Dehydration, or Discomfort add +1 Stress each.

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

### 4. Pushing Limits
A "Risk vs Reward" mechanic included in the compendium.
* **Effect:** A character can accept physical toll to gain **Advantage** on a roll.
* **Cost:** Immediately gain **1 Level of Exhaustion** (or equivalent Stress).
* **Limit:** Can be used once per Long Rest.

---

## 📦 Installation Guide

1.  **Copy the Manifest Link:**
    `YOUR_MANIFEST_LINK_HERE`
2.  Open **Foundry VTT**.
3.  Go to the **Add-on Modules** tab.
4.  Click **Install Module**.
5.  Paste the link into the "Manifest URL" field and click **Install**.
6.  Launch your World, go to **Game Settings > Manage Modules**, and enable **Stress Points & Rest**.

---

## 🛠️ How to Use

### 1. Setting Up Items
The module comes with a Compendium named **"Stress & Rest Items"**. You must import these items into your world for the automation to work:
* **Bandage:** Consumable item for Short Rests.
* **Pushing Limits:** Feature to be added to character sheets.

### 2. Resting
Simply click the standard **Short Rest** or **Long Rest** button on the D&D 5e character sheet.
* **Short Rest:** A dialog will ask for a Healer's Kit or Bandage.
* **Long Rest:** A dialog will ask for Food, Drink, and Camping Gear, showing the current Environment DC.

### 3. Tracking Stress
You don't need to do anything manually. The module automatically adds a tracker. If a player takes Exhaustion via the standard sheet, the Stress updates automatically (and vice-versa).

---

## ⚙️ Configuration

You can customize the mechanics in **Configure Settings**:

* **Max Stress:** Set the maximum stress before death (Default: 12).
* **Stress Ratio:** How many Stress Points equal 1 Exhaustion (Default: 2).
* **Collapse at 0 HP:** Enable/Disable stress gain when falling unconscious.
* **Require Healer's Kit:** If disabled, Short Rests behave normally (vanilla).
* **Food/Drink Mode:**
    * *Mandatory:* Items must be deducted from inventory.
    * *Roll:* Players make a check if they don't have food.

---

## 🤝 Credits

* **Author:** trizzfilgueira
* **System:** Dungeons & Dragons 5th Edition (2024 ruleset adaptation).
* **License:** MIT License.

---
