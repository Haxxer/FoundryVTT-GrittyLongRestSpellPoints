export default class FinishedLongRestDialog extends FormApplication {
  constructor(actor, resolve, reject) {
    super();
    this.actor = actor;
    this.resolve = resolve;
    this.reject = reject;
    this._denom = null;
    this._sp_left = null;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ['form'],
      popOut: true,
      template: `modules/slow-healing-long-rest-spell-points/templates/finished-long-rest.html`,
      id: 'finished-long-rest',
      title: 'Finished Long Rest',
    });
  }

  getData() {

    const data = {};

    // Determine Hit Dice
    data.availableHD = this.actor.data.items.reduce((hd, item) => {
      if ( item.type === "class" ) {
        const d = item.data;
        const denom = d.hitDice || "d6";
        const available = parseInt(d.levels || 1) - parseInt(d.hitDiceUsed || 0);
        hd[denom] = denom in hd ? hd[denom] + available : available;
      }
      return hd;
    }, {});
    data.canRoll = this.actor.data.data.attributes.hd > 0;
    data.denomination = this._denom;

    // Determine rest type
    const variant = game.settings.get("dnd5e", "restVariant");
    data.promptNewDay = variant !== "epic";     // It's never a new day when only resting 1 minute
    data.newDay = false;                        // It may be a new day, but not by default

    let spellLevels = []
    data.spellSlots = {}
    // Recover spell slots
    for (let [k, v] of Object.entries(this.actor.data.data.spells)) {
        if((!v.max && !v.override) || k == "pact"){
            continue;
        }
        let level = k.substr(5)
        spellLevels.push(Number(level))
        data.spellSlots[level] = [];
        for(let i = 0; i < v.max; i++){
          data.spellSlots[level].push(i >= v.value)
        }
    }

    let highest_spell_slot = 0;
    if(spellLevels.length){
      highest_spell_slot = Math.max(...spellLevels)
    }

    let spell_points = highest_spell_slot*2;

    data.has_spells = spell_points > 0;
    data.sp_total = spell_points;
    data.sp_left = spell_points;
    this._sp_left = spell_points;
    
    return data;
  }


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
    await this.actor.rollHitDie(this._denom);
    this.render();
  }


  async _onSpendSpellPoint(event) {

    let sp_left = this._sp_left;

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

    let sp_left_em = this._element.find("#sp-left")[0];

    sp_left_em.innerHTML = sp_left;

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
    }

    this.resolve(levels_regained);

  }

  async close(){
    super.close();
    this.resolve(false);
  }

  static async asyncDialog({actor}={}) {
    return new Promise((resolve, reject) => {
      const dlg = new this(actor, resolve, reject);
      console.log('wot')
      dlg.render(true);
    })
  }
}