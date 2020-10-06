# Slow Natural Healing & Spell Points - A FoundryVTT Module
A module for modifying how long rests are done on Foundry VTT Character sheets for D&amp;D 5th Edition. This module plugs right into the default 5e sheet, and replaces how the long rest button functions.

On a long rest normally a character would regain all of their hit points, half of their hit dice, all of their spell slots, and class features.

With the slow natural healing alternative rule, they instead regain half of their hit dice and none of their hit points. Characters have to roll hit dice in order to regain hit points.

However, this is alternative rule for an alternative rule! Healing functions the same, except that you regain hit dice before you spend them. If you were to get more than your maximum number of hit dice, it overshoots, and you can still spend the buffer of hit dice. Any hit dice that you left unspent over your maximum are lost.

In addition, my masochistic players wanted to hurt themselves even more, particularily the wizard. All of their spell slots are no longer regained, characters instead gain something called **spell points**, which the characters can spend to regain spell slots. At the end of a long rest, you get spell points equal to two times the largest spell slot. In the case of a 5th level wizard, they have 3rd level spell slots so they gain **6 spell points**. To regain a spell slot, the character must spend a number of spell points equal to the spell slot's level. They would have to spend 3 spell points in order to regain a 3rd level spell slot.

This slows the game down, and makes choosing which spell slots to regain a tactical decision. Do they need a first level spell slot for things like *Mage Armor* or *Shield* or do they want to go all out on their higher level spell slots? It's up to them! So far, it's been a good kind of slow, but not gritty realism "7 day long rests"-slow.

## Spell Point Medium

Spell point mediums are a new addition in 0.2.0. Consumable items can now have the type "spell point medium", which have been added to the long rest UI. During a long rest, a character may spend the two hours of their rest pouring over notes, focusing on a mote of energy, praying over a piece of religious lore, etc, and regain some more spell points at the end of their long rest. The medium might be a one-off thing, or have multiple uses, it's really up to you as a DM.  It's another form of treasure that you can award your players!
