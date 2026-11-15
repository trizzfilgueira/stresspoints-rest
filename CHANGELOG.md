# Changelog

## 2.2.0

### New
- **GM Panel:** every character's Stress, HP and Exhaustion with +/− buttons (Shift-click moves a whole Exhaustion level), the party camp environment, per-character environments and a button that posts a group report to chat. Opens from the heart button in the Token controls, the *GM Stress Panel* macro or the API.
- **Rest environment set by the GM:** one party camp for everyone, plus an optional override per character. Players see it locked in their rest dialog. The *GM Defines the Rest Environment* setting turns this off.
- **Stress on the character sheet:** a meter below Hit Points, with a tooltip showing how much is left until the next Exhaustion level. Also available as a token bar (`attributes.stress`).
- **Long Rest requires 1 HP** (official rule, can be turned off). Nothing is consumed when the rest is refused.
- **Pushing Limits** grants advantage on the next d20 roll without Midi-QOL, and can recover Warlock pact slots.
- **Item detection:** food, drink and healing items are recognized automatically. A `restKind` flag fixes any item that is misclassified.
- **API and hook:** `game.modules.get("stresspoints-rest").api` and the `stresspoints-rest.stressChanged` hook (see the README).
- Automated tests for the Quench module.

### Interface
- Rest dialogs restyled to match the dnd5e character sheet: HP, Hit Dice, Stress and Exhaustion meters on top, then food, drink and healing as tile carousels with icons.
- The dialog fits smaller screens: only the body scrolls, and the banner and button stay in place.
- Pushing Limits uses the same layout, with the cost shown on each option.
- Chat cards use dnd5e's card style and follow the light or dark theme.
- Settings grouped into sections.

### Fixes
- Short Rest without a healing item blocks Hit Dice before they are rolled, so none are wasted. The item is only spent if the rest goes through.
- Purchases use the chosen coin first and only break larger coins into change when needed.
- Text casing cleaned up in English and Portuguese.

### Compatibility
- Verified with dnd5e 6.1.0 on Foundry v14. Requires dnd5e 5.0.0 or later.
