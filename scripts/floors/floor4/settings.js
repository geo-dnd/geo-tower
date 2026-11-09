// scripts/floors/floor4/settings.js
const MODULE_ID = "geo-tower";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class Floor4SettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "floor4-settings",
    tag: "form",
    window: { title: "Настройки Кровавой Чумы (Этаж 4)", resizable: false },
    form: { handler: Floor4SettingsApp.#onSubmit, submitOnChange: false, closeOnSubmit: true }
  };

  static PARTS = {
    form: { template: "modules/geo-tower/templates/floor4-settings.hbs" }
  };

  async _prepareContext(options) {
    return {
      plagueDamage: game.settings.get(MODULE_ID, "floor4PlagueDamage"),
      aoeDamage: game.settings.get(MODULE_ID, "floor4AoeDamage"),
      plagueRadius: game.settings.get(MODULE_ID, "floor4PlagueRadius")
    };
  }

  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    await game.settings.set(MODULE_ID, "floor4PlagueDamage", data.plagueDamage);
    await game.settings.set(MODULE_ID, "floor4AoeDamage", data.aoeDamage);
    await game.settings.set(MODULE_ID, "floor4PlagueRadius", Number(data.plagueRadius));
    ui.notifications.info("Настройки Этажа 4 сохранены.");
  }
}
