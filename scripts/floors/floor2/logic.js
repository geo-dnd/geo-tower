// scripts/floors/floor2/logic.js

import { getRegionCenter } from "./utils.js";

const MODULE_ID = "geo-tower";
const FLOOR_2_NAME = "Geo Tower - Этаж 2";

let combatStartHook, combatUpdateHook;

export async function attachFloor2() {
  // 1. Срабатывание при старте боя (после броска инициативы)
  combatStartHook = Hooks.on("combatStart", (combat, updateData) => {
    triggerWave(combat);
  });

  // 2. Срабатывание в начале каждого нового раунда (перед ходом первого)
  combatUpdateHook = Hooks.on("updateCombat", (combat, updateData) => {
    // Проверяем, что переключился раунд или ход на первого игрока (turn === 0)
    if (updateData.turn === 0 || updateData.round !== undefined) {
      triggerWave(combat);
    }
  });

  console.log("Geo Tower | Floor 2 Attached");
}

export function detachFloor2() {
  if (combatStartHook) Hooks.off("combatStart", combatStartHook);
  if (combatUpdateHook) Hooks.off("updateCombat", combatUpdateHook);
  combatStartHook = null;
  combatUpdateHook = null;
  console.log("Geo Tower | Floor 2 Detached");
}

function triggerWave(combat) {
  // Выполняем только на клиенте ГМа
  if (!game.user.isGM) return;
  // Проверяем, что бой идет на нашей сцене
  if (canvas.scene?.name !== FLOOR_2_NAME) return;
  if (!combat.started) return;

  const region = canvas.scene.regions.getName("Region Centre");
  if (!region) return console.warn("Geo Tower | Регион 'Region Centre' не найден!");

  const center = getRegionCenter(region);
  if (!center) return;

  const radius = game.settings.get(MODULE_ID, "waveRadius");
  const damageFormula = game.settings.get(MODULE_ID, "waveDamage");

  console.log(`Geo Tower | Запуск волны холода (Раунд ${combat.round}).`);

  // Отправляем через сокет для синхронизации
  const socket = socketlib.modules.get(MODULE_ID);
  socket.executeAsGM("applyColdWave", { 
    sceneId: canvas.scene.id, 
    center, 
    radius, 
    damageFormula 
  });
}
