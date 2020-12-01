
export default class newShortRestDialog extends Dialog {
	
	constructor(actor, dialogData={}, options={}) {
		super(dialogData, options);

		/**
		 * Store a reference to the Actor entity which is resting
		 * @type {Actor}
		 */
		this.actor = actor;

		/**
		 * Track the most recently used HD denomination for re-rendering the form
		 * @type {string}
		 */
		this._denom = null;

		this._data = {}

	}

	/* -------------------------------------------- */

	/** @override */
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			template: `modules/slow-healing-long-rest-spell-points/templates/new-short-rest.html`,
			classes: ["dnd5e", "dialog"]
		});
	}

	/* -------------------------------------------- */

	/** @override */
	getData() {
		this._data = super.getData();

		this._data.hd = this.get_hitdice();

		this._data.spells = this.get_spells();

		// Determine rest type
		const variant = game.settings.get("dnd5e", "restVariant");
		this._data.promptNewDay = variant !== "epic";     // It's never a new day when only resting 1 minute
		this._data.newDay = false;                        // It may be a new day, but not by default

		return this._data;
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

		let spell_data = {
			has_feature: false,
			slots: {},
			sp_total: 0,
			sp_left: 0,
			class: ""
		}

		let class_item = this.actor.items.find(i => i.type === "class" && i.name == "Wizard");
		let item = this.actor.items.find(i => i.name.toLowerCase() === "arcane recovery");

		if(class_item && class_item.data.data.levels > 1 && item && item.data.data.uses.value != 0){

			spell_data.class = "Wizard";

			let spellLevels = []
			// Recover spell slots
			for (let [k, v] of Object.entries(this.actor.data.data.spells)) {
					if((!v.max && !v.override) || k == "pact"){
							continue;
					}
					let level = k.substr(5)
					if(Number(level) > 5){
						continue;
					}
					spellLevels.push(Number(level))
					spell_data.slots[level] = [];
					for(let i = 0; i < v.max; i++){
						spell_data.slots[level].push(i >= v.value)
					}
			}

			spell_data.has_feature = true;
			spell_data.sp_total = Math.ceil(class_item.data.data.levels/2);
			spell_data.sp_left = Math.ceil(class_item.data.data.levels/2);

		}

		return spell_data;

	}

	/* -------------------------------------------- */


	/** @override */
	activateListeners(html) {
		super.activateListeners(html);

		let btn = html.find("#roll-hd");
		btn.click(this._onRollHitDie.bind(this));
		
		let chk = html.find(".spend-spell-point");
		chk.click(this._onSpendSpellPoint.bind(this));
	}

	/* -------------------------------------------- */

	/**
	 * Handle rolling a Hit Die as part of a Short Rest action
	 * @param {Event} event     The triggering click event
	 * @private
	 */
	async _onRollHitDie(event) {
		event.preventDefault();
		const btn = event.currentTarget;
		this._denom = btn.form.hd.value;
		await this.actor.rollHitDie(this._denom, {dialog: false});
		this.update_hd();
	}


	/* -------------------------------------------- */

	/**
	 * Updates the hit dice section of the UI
	 * @private
	 */
	update_hd(){
		this._data.hd = this.get_hitdice();
		for(let hd in this._data.hd.availableHD){
			this._element.find(`option[value=${hd}]`).text(`${hd} (${this._data.hd.availableHD[hd]} ${game.i18n.localize("DND5E.available")})`);
		}
		this._data.hd.canRoll = this.actor.data.data.attributes.hd > 0;
		this._element.find('#roll-hd').prop('disabled', !this._data.hd.canRoll);
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
	 * Updates the spell point section of the UI
	 * @private
	 */
	update_spellpoints(){

		let sp_left = this._data.spells.sp_left;

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
	 * A helper constructor function which displays the Short Rest dialog and returns a Promise once it's workflow has
	 * been resolved.
	 * @param {Actor5e} actor
	 * @return {Promise}
	 */
	static async shortRestDialog({actor}={}) {
		return new Promise((resolve, reject) => {
			const dlg = new this(actor, {
				title: "Short Rest",
				buttons: {
					rest: {
						icon: '<i class="fas fa-bed"></i>',
						label: "Rest",
						callback: html => {

							let checkboxes = html.find(".spend-spell-point");

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


							let newDay = false;
							if (game.settings.get("dnd5e", "restVariant") === "gritty")
								newDay = html.find('input[name="newDay"]')[0].checked;

							resolve({
								newDay: newDay,
								levels_regained: levels_regained
							});
						}
					},
					cancel: {
						icon: '<i class="fas fa-times"></i>',
						label: "Cancel",
						callback: reject
					}
				},
				close: reject
			});
			dlg.render(true);
		});
	}

}
