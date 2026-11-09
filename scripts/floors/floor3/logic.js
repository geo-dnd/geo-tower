// scripts/floors/floor3/logic.js
const MODULE_ID = "geo-tower";
const FLOOR_3_NAME = "Geo Tower - Этаж 3";

let updateCombatHook;
let deleteCombatHook;

export async function attachFloor3() {
  updateCombatHook = Hooks.on("updateCombat", async (combat, updateData) => {
    if (!game.user.isGM) return;
    if (canvas.scene?.name !== FLOOR_3_NAME) return;
    if (!combat.started) return;

    if (updateData.round === undefined || combat.previous.round === combat.round) return;

    console.log(`Geo Tower | Этаж 3: Начало раунда ${combat.round}.`);

    const socket = socketlib.modules.get(MODULE_ID);
    const count = game.settings.get(MODULE_ID, "floor3ZonesCount");
    const formula = game.settings.get(MODULE_ID, "floor3DamageFormula");
    const type = game.settings.get(MODULE_ID, "floor3DamageType");
    const sceneId = canvas.scene.id;

    if (combat.round > 1) {
      await socket.executeAsGM("checkSafeZonesAndDamage", { sceneId, formula, type });
    }

    await socket.executeAsGM("clearSafeZones", { sceneId });
    await socket.executeAsGM("generateSafeZones", { sceneId, count });
  });

  // ✅ Добавляем хук завершения боя
  deleteCombatHook = Hooks.on("deleteCombat", async (combat) => {
    if (!game.user.isGM) return;
    if (canvas.scene?.name !== FLOOR_3_NAME) return;

    console.log("Geo Tower | Этаж 3: Бой завершен. Удаляем зоны.");
    const socket = socketlib.modules.get(MODULE_ID);
    await socket.executeAsGM("clearSafeZones", { sceneId: canvas.scene.id });
  });

  console.log("Geo Tower | Floor 3 Attached");
}

export function detachFloor3() {
  if (updateCombatHook) Hooks.off("updateCombat", updateCombatHook);
  if (deleteCombatHook) Hooks.off("deleteCombat", deleteCombatHook);
  updateCombatHook = null;
  deleteCombatHook = null;
  console.log("Geo Tower | Floor 3 Detached");
}
