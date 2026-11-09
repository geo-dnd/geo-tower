// scripts/floors/floor5/settings.js
const MODULE_ID = "geo-tower";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class Floor5SettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "floor5-settings",
    tag: "form",
    window: { title: "Настройки Этажа 5 (Исчадия)", resizable: false },
    form: { handler: Floor5SettingsApp.#onSubmit, submitOnChange: false, closeOnSubmit: true }
  };

  static PARTS = {
    form: { template: "modules/geo-tower/templates/floor5-settings.hbs" }
  };

  async _prepareContext(options) {
    return {
      roundsToReach: game.settings.get(MODULE_ID, "floor5RoundsToReach"),
      explosion1: game.settings.get(MODULE_ID, "floor5Explosion1"),
      explosion2: game.settings.get(MODULE_ID, "floor5Explosion2"),
      explosion3: game.settings.get(MODULE_ID, "floor5Explosion3"),
      explosion4: game.settings.get(MODULE_ID, "floor5Explosion4"),
      magmaDamage: game.settings.get(MODULE_ID, "floor5MagmaDamage")
    };
  }

  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    await game.settings.set(MODULE_ID, "floor5RoundsToReach", Number(data.roundsToReach));
    await game.settings.set(MODULE_ID, "floor5Explosion1", data.explosion1);
    await game.settings.set(MODULE_ID, "floor5Explosion2", data.explosion2);
    await game.settings.set(MODULE_ID, "floor5Explosion3", data.explosion3);
    await game.settings.set(MODULE_ID, "floor5Explosion4", data.explosion4);
    await game.settings.set(MODULE_ID, "floor5MagmaDamage", data.magmaDamage);
    ui.notifications.info("Настройки Этажа 5 сохранены.");
  }
}
