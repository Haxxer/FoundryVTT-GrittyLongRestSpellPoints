import Actor5e from "../../systems/dnd5e/module/actor/entity.js";
import LongRestDialog from "./new-long-rest.js";
import FinishedLongRestDialog from "./finished-long-rest.js";

Hooks.on("init", () => {
    patch_longRest();
});

function ordinal_suffix_of(i) {
  var j, k;
  j = i % 10;
  k = i % 100;
  if (j === 1 && k !== 11) {
    return i + 'st';
  }
  if (j === 2 && k !== 12) {
    return i + 'nd';
  }
  if (j === 3 && k !== 13) {
    return i + 'rd';
  }
  return i + 'th';
};

function text_to_number(i) {
    switch(i){
        case 1:
            return "One";
        case 2:
            return "Two";
        case 3:
            return "Three";
        case 4:
            return "Four";
        case 5:
            return "Five";
    }
};

function patch_longRest() {
    Actor5e.prototype.longRest = async function ({ dialog = true, chat = true } = {}) {

        const data = this.data.data;

        const updateData = {
            "data.attributes.hp.temp": 0,
            "data.attributes.hp.tempmax": 0,
        };

        let newDay = false;
        try {
            newDay = await LongRestDialog.asyncDialog({ actor: this })
        } catch (err) {
            console.log(err)
            return;
        }

        // Recover character resources
        for (let [k, r] of Object.entries(data.resources)) {
            if (r.max && (r.sr || r.lr)) {
                updateData[`data.resources.${k}.value`] = r.max;
            }
        }

        // Recover pact slots.
        const pact = data.spells.pact;
        updateData["data.spells.pact.value"] = pact.override || pact.max;

        let recoverHD = Math.max(Math.floor(data.details.level * 0.5), 1);
        let dhd = 0;

        // Sort classes which can recover HD, assuming players prefer recovering larger HD first.
        var updateItems = this.items
            .filter((item) => item.data.type === "class")
            .sort((a, b) => {
                let da = parseInt(a.data.data.hitDice.slice(1)) || 0;
                let db = parseInt(b.data.data.hitDice.slice(1)) || 0;
                return db - da;
            })
            .reduce((updates, item) => {
                const d = item.data.data;
                if (recoverHD > 0) {
                    let delta = recoverHD;
                    recoverHD -= delta;
                    dhd += delta;
                    updates.push({ _id: item.id, "data.hitDiceUsed": d.hitDiceUsed - delta });
                }
                return updates;
            }, []);

        // Iterate over owned items, restoring uses per day and recovering Hit Dice
        const recovery = newDay ? ["sr", "lr", "day"] : ["sr", "lr"];
        for (let item of this.items) {
            const d = item.data.data;
            if (d.uses && recovery.includes(d.uses.per)) {
                updateItems.push({ _id: item.id, "data.uses.value": d.uses.max });
            } else if (d.recharge && d.recharge.value) {
                updateItems.push({ _id: item.id, "data.recharge.charged": true });
            }
        }

        let lost_spell_slots = false;
        let level = 0;
        for (let [k, v] of Object.entries(data.spells)) {
            if(!v.max && !v.override){
                continue;
            }

            if(v.value != (v.max || v.override)){
                lost_spell_slots = true;
            }
            level++;
        }

        await this.update(updateData);
        if (updateItems.length) await this.updateEmbeddedEntity("OwnedItem", updateItems);

        // Take note of the initial hit points the Actor has
        const currHitDice = this.data.data.attributes.hd;
        const hp0 = data.attributes.hp.value;

        var regained_spell_slots = await FinishedLongRestDialog.asyncDialog({ actor: this });

        // Recover hit points to full, and eliminate any existing temporary HP
        const dhp = this.data.data.attributes.hp.value - hp0;
        const spentHD = currHitDice - this.data.data.attributes.hd;

        let regained_spell_slots_string = "";
        if(regained_spell_slots){

            regained_spell_slots_string = "<ul>"
            let level = 0;
            for (let [k, v] of Object.entries(data.spells)) {

                if(!v.max && !v.override){
                    continue;
                }
                level++;

                if(regained_spell_slots[level]){

                    updateData[`data.spells.${k}.value`] = v.value + regained_spell_slots[level];
                    regained_spell_slots_string += `<li>${text_to_number(regained_spell_slots[level])} ${ordinal_suffix_of(level)} level spell slot${regained_spell_slots[level] > 1 ? "s" : ""}</li>`;

                }
            }

            regained_spell_slots_string += "</ul>";
        }

        let leftOver = 0;

        updateItems = this.items
            .filter((item) => item.data.type === "class")
            .sort((a, b) => {
                let da = parseInt(a.data.data.hitDice.slice(1)) || 0;
                let db = parseInt(b.data.data.hitDice.slice(1)) || 0;
                return db - da;
            })
            .reduce((updates, item) => {
                const d = item.data.data;
                if (d.hitDiceUsed < 0) {
                    leftOver += d.hitDiceUsed;
                    updates.push({ _id: item.id, "data.hitDiceUsed": 0 });
                }else if (d.hitDiceUsed > 0 && leftOver < 0) {
                    leftOver += d.hitDiceUsed;
                    updates.push({ _id: item.id, "data.hitDiceUsed": Math.max(leftOver, 0) });
                }
                return updates;
            }, []);

        await this.update(updateData);
        if (updateItems.length) await this.updateEmbeddedEntity("OwnedItem", updateItems);

        // Display a Chat Message summarizing the rest effects
        let restFlavor;
        switch (game.settings.get("dnd5e", "restVariant")) {
            case "normal":
                restFlavor = game.i18n.localize(newDay ? "DND5E.LongRestOvernight" : "DND5E.LongRestNormal");
                break;
            case "gritty":
                restFlavor = game.i18n.localize("DND5E.LongRestGritty");
                break;
            case "epic":
                restFlavor = game.i18n.localize("DND5E.LongRestEpic");
                break;
        }

        if (chat) {

            ChatMessage.create({
                user: game.user._id,
                speaker: { actor: this, alias: this.name },
                flavor: restFlavor,
                content: regained_spell_slots_string != "" ? 
                    game.i18n.format("{name} finishes a long rest, spending {dice} Hit Dice to regain {health} Hit Points. In addition, they also regain the following spell slots:{spells}", { name: this.name, health: dhp, dice: spentHD, spells: regained_spell_slots_string }) :
                    game.i18n.format("{name} finishes a long rest, spending {dice} Hit Dice to regain {health} Hit Points.", { name: this.name, health: dhp, dice: spentHD }),
            });
        }

        // Return data summarizing the rest effects
        return {
            dhd: dhd,
            dhp: dhp,
            updateData: updateData,
            updateItems: updateItems,
            newDay: newDay,
        };
    };
}
