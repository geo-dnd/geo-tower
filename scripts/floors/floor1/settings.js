// scripts/floors/floor1/settings.js
const MODULE_ID = "geo-tower";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class Floor1SettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "floor1-settings",
    tag: "form",
    window: { title: "Настройки Этажа 1", resizable: false },
    form: { handler: Floor1SettingsApp.#onSubmit, submitOnChange: false, closeOnSubmit: true }
  };

  static PARTS = {
    form: { template: "modules/geo-tower/templates/floor1-settings.hbs" }
  };

  async _prepareContext(options) {
    return {
      floor1InteractRange: game.settings.get(MODULE_ID, "floor1InteractRange")
    };
  }

  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    await game.settings.set(MODULE_ID, "floor1InteractRange", Number(data.floor1InteractRange));
    ui.notifications.info("Настройки Этажа 1 сохранены.");
  }
}
