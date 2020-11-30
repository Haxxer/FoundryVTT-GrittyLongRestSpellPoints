import { DND5E } from "../../systems/dnd5e/module/config.js";

export default class FinishedLongRestDialog extends FormApplication {
	constructor(actor, resolve, reject) {
		super();
		this._data = {};
		this.actor = actor;
		this.resolve = resolve;
		this.reject = reject;
		this.hasResolved = false;
		this._denom = null;
		this._extra_sp = 0;
	}

	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			classes: ['form'],
			popOut: true,
			template: `modules/slow-healing-long-rest-spell-points/templates/finished-long-rest.html`,
			id: 'finished-long-rest',
			title: 'Finished Long Rest'
		});
	}

	getData() {

		this._data.hd = this.get_hitdice();

		this._data.spells = this.get_spells();

		this._data.medium = this.get_consumables();
		
		return this._data;

	}

	update(rerender){

	}

	get_hitdice(){

		let hd = {}
		// Determine Hit Dice
		hd.availableHD = this.actor.data.items.reduce((hd, item) => {
			if ( item.type === "class" ) {
				const d = item.data;
				const denom = d.hitDice || "d6";
				const available = parseInt(d.levels || 1) - parseInt(d.hitDiceUsed || 0);
				hd[denom] = denom in hd ? hd[denom] + available : available;
			}
			return hd;
		}, {});
		hd.canRoll = this.actor.data.data.attributes.hd > 0;
		hd.denomination = this._denom;

		return hd;

	}

	get_spells(){

		let spell_data = {}

		let spellLevels = []
		spell_data.slots = {}
		// Recover spell slots
		for (let [k, v] of Object.entries(this.actor.data.data.spells)) {
				if((!v.max && !v.override) || k == "pact"){
						continue;
				}
				let level = k.substr(5)
				spellLevels.push(Number(level))
				spell_data.slots[level] = [];
				for(let i = 0; i < v.max; i++){
					spell_data.slots[level].push(i >= v.value)
				}
		}

		let highest_spell_slot = 0;
		if(spellLevels.length){
			highest_spell_slot = Math.max(...spellLevels)
		}

		let spell_points = highest_spell_slot*2 + this._extra_sp;

		spell_data.hasSpells = spell_points > 0;
		spell_data.sp_total = spell_points;
		spell_data.sp_left = spell_points;

		return spell_data;

	}

	get_consumables(){

		let medium_data = {}

		medium_data.hasMedium = false;

		medium_data.availableMedium = this.actor.data.items.reduce((medium, item) => {
			if ( item.type === "consumable" && item.data.consumableType === "spellpoint" ) {
				const d = item.data;
				if(d.formula){
					medium[item._id] = {
						'name': item.name,
						'formula': d.formula,
						'quantity': d.quantity
					}
					console.log(medium_data, d.quantity)
					medium_data.hasMedium = medium_data.hasMedium || d.quantity > 0;
				}
			}
			return medium;
		}, {});

		return medium_data;

	}


	/** @override */
	activateListeners(html) {
		super.activateListeners(html);
		
		let hd_btn = html.find("#roll-hd");
		hd_btn.click(this._onRollHitDie.bind(this));
		
		let chk = html.find(".spend-spell-point");
		chk.click(this._onSpendSpellPoint.bind(this));
		
		let medium_btn = html.find("#roll-medium");
		medium_btn.click(this._onRollMedium.bind(this));
	}

	/* -------------------------------------------- */

	/**
	 * Handle rolling a Hit Die as part of the long rest
	 * @param {Event} event     The triggering click event
	 * @private
	 */
	async _onRollHitDie(event) {
		event.preventDefault();
		const btn = event.currentTarget;
		this._denom = btn.form.hd.value;
		let dialog = this;
		await this.actor.rollHitDie(this._denom).then(function(result){
			if(result){
				dialog.update_hd();
			}
		});
	}


	/* -------------------------------------------- */

	/**
	 * Handle clicking on the spell point checkboxes
	 * @param {Event} event     The triggering click event
	 * @private
	 */
	async _onSpendSpellPoint(event) {
		this.update_spellpoints();
	}


	/* -------------------------------------------- */

	/**
	 * Handle rolling for spell points
	 * @param {Event} event     The triggering click event
	 * @private
	 */
	async _onRollMedium(event) {
		event.preventDefault();
		const btn = event.currentTarget;
		let item_id = btn.form.medium.value;
		let dialog = this;

		let item = this.actor.items.find(i => i.data._id === item_id);

		if(item && item.data.data.quantity){

			let d = new Roll(item.data.data.formula).roll();
			
			ChatMessage.create({ content: `During the long rest, ${this.actor.name} studies the ${item.name} and regains an additional [[${d.result}]] spell points.` })

			this._extra_sp += d.total;

			const updates = [
					{ _id: item._id, "data.quantity": item.data.data.quantity-1 },
			];

			this.actor.updateOwnedItem(updates).then(function(result){

				dialog.update_medium();
				dialog.update_spellpoints();

			});

		}
	}


	/* -------------------------------------------- */

	/**
	 * Updates the hit dice section of the UI
	 * @private
	 */
	update_hd(){

		for(let hd in this._data.hd.availableHD){
			this._element.find(`option[value=${hd}]`).text(`${hd} (${this._data.hd.availableHD[hd]} ${game.i18n.localize("DND5E.available")})`);
		}
		this._data.hd.canRoll = this.actor.data.data.attributes.hd > 0;
		this._element.find('#roll-hd').prop('disabled', !this._data.hd.canRoll);

	}


	/* -------------------------------------------- */

	/**
	 * Updates the spell point section of the UI
	 * @private
	 */
	update_spellpoints(){

		let sp_left = this._data.spells.sp_left + this._extra_sp;

		let checkboxes = this._element.find(".spend-spell-point");

		for(let i = 0; i < checkboxes.length; i++){

			let checkbox = checkboxes[i];

			let level = Number(checkbox.value);

			if(checkbox.checked){
				sp_left -= level;
			}
		}

		for(let i = 0; i < checkboxes.length; i++){

			let checkbox = checkboxes[i];

			let level = Number(checkbox.value);

			if(sp_left - level < 0 && !checkbox.checked){
				checkbox.setAttribute("disabled", "");
			}else{
				checkbox.removeAttribute("disabled");
			}
		}

		this._element.find('#sp-left').text(sp_left);

	}

	/* -------------------------------------------- */

	/**
	 * Updates the spell point medium section of the UI
	 * @private
	 */
	update_medium(){

		this._data.medium.availableMedium = this.get_consumables();

		for(let id in this._data.availableMedium){
			let medium = this._data.availableMedium[id];
			this._element.find(`option[value=${id}]`)
				.text(`${medium.name} (${medium.formula} | ${medium.quantity} ${game.i18n.localize("DND5E.available")})`)
				.prop('disabled', medium.quantity == 0);
		}

	}


	async _updateObject(event, formData) {

		let checkboxes = this._element.find(".spend-spell-point");

		let levels_regained = false

		if(checkboxes.length > 0){

			levels_regained = {};

			for(let i = 0; i < checkboxes.length; i++){

				let checkbox = checkboxes[i];

				if(checkbox.checked){
					let level = Number(checkbox.value);
					if(levels_regained[level] === undefined){
						levels_regained[level] = 0;
					}
					levels_regained[level]++;
				}
			}

			if(Object.keys(levels_regained).length == 0){
				levels_regained = false;
			}

		}

		this.resolve(levels_regained);

	}

	async close(options){
		this.resolve(false);
		super.close(options);
	}

	static async asyncDialog({actor}={}) {
		return new Promise((resolve, reject) => {
			const dlg = new this(actor, resolve, reject);
			dlg.render(true);
		})
	}
}