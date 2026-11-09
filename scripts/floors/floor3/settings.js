// scripts/floors/floor3/settings.js
const MODULE_ID = "geo-tower";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class Floor3SettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "floor3-settings",
    tag: "form",
    window: { title: "Настройки шипов (Этаж 3)", resizable: false },
    form: { handler: Floor3SettingsApp.#onSubmit, submitOnChange: false, closeOnSubmit: true }
  };

  static PARTS = {
    form: {
      template: "modules/geo-tower/templates/floor3-settings.hbs"
    }
  };

  async _prepareContext(options) {
    const currentType = game.settings.get(MODULE_ID, "floor3DamageType");
    
    // ✅ Список физических типов урона, которые нужно скрыть
    const physicalTypes = ["bludgeoning", "piercing", "slashing"];

    // Берем все типы, кроме физических
    const magicTypes = Object.entries(CONFIG.DND5E.damageTypes)
      .filter(([key]) => !physicalTypes.includes(key))
      .map(([key, val]) => ({
        value: key,
        label: val.label || val,
        selected: key === currentType
      }));

    return {
      zonesCount: game.settings.get(MODULE_ID, "floor3ZonesCount"),
      damageFormula: game.settings.get(MODULE_ID, "floor3DamageFormula"),
      damageTypes: magicTypes,
      isRandom: currentType === "random"
    };
  }

  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    await game.settings.set(MODULE_ID, "floor3ZonesCount", Number(data.zonesCount));
    await game.settings.set(MODULE_ID, "floor3DamageFormula", data.damageFormula);
    await game.settings.set(MODULE_ID, "floor3DamageType", data.damageType);
    ui.notifications.info("Настройки Этажа 3 сохранены.");
  }
}
