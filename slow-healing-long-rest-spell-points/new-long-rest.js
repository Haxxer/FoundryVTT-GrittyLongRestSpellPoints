export default class LongRestDialog extends FormApplication {
  constructor(actor, resolve, reject) {
    super();
    this.actor = actor;
    this.resolve = resolve;
    this.reject = reject;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ['form'],
      popOut: true,
      template: `modules/slow-healing-long-rest-spell-points/templates/new-long-rest.html`,
      id: 'started-long-rest',
      title: 'Long Rest',
    });
  }

  getData() {
    return {
      newDay: false
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
  }

  async _updateObject(event, formData) {
    this.resolve(formData.exampleInput);
  }

  static async asyncDialog({actor}={}) {
    return new Promise((resolve, reject) => {
      const dlg = new this(actor, resolve, reject);
      dlg.render(true);
    })
  }
}