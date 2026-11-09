// scripts/floors/floor2/settings.js
const MODULE_ID = "geo-tower";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class Floor2SettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "floor2-settings",
    tag: "form",
    window: { title: "Настройки Этажа 2", resizable: false },
    form: { handler: Floor2SettingsApp.#onSubmit, submitOnChange: false, closeOnSubmit: true }
  };

  static PARTS = {
    form: { template: "modules/geo-tower/templates/floor2-settings.hbs" }
  };

  async _prepareContext(options) {
    return {
      waveRadius: game.settings.get(MODULE_ID, "waveRadius"),
      waveDamage: game.settings.get(MODULE_ID, "waveDamage")
    };
  }

  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    await game.settings.set(MODULE_ID, "waveRadius", Number(data.waveRadius));
    await game.settings.set(MODULE_ID, "waveDamage", data.waveDamage);
    ui.notifications.info("Настройки Этажа 2 сохранены.");
  }
}
