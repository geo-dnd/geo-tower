// scripts/floors/floor5/logic.js
const MODULE_ID = "geo-tower";
const FLOOR_5_NAME = "Geo Tower - Этаж 5";

let updateCombatHook, updateActorHook, updateTokenHook, deleteCombatHook;

export async function attachFloor5() {
  const socket = socketlib.modules.get(MODULE_ID);
  const scene = canvas.scene;

  // Сброс сцены при старте
  if (game.user.isGM) {
    await scene.setFlag(MODULE_ID, "magmaStage", 0);
    const monsters = scene.tokens.contents.filter(t => t.flags?.[MODULE_ID]?.isHellspawn);
    if (monsters.length) await scene.deleteEmbeddedDocuments("Token", monsters.map(m => m.id));
  }

  function getActiveMagmaRegions(scene, stage) {
    const activeNames = [];
    if (stage >= 1) activeNames.push("Magma 1");
    if (stage >= 2) activeNames.push("Magma 2");
    if (stage >= 3) activeNames.push("Magma 3");
    return activeNames.map(n => scene.regions.getName(n)).filter(r => r);
  }

  // Проверка пересечения токена и магмы (по 5 точкам)
  function checkTokenInMagma(tokenData, magmaRegions, gridSize) {
    const tw = tokenData.width * gridSize;
    const th = tokenData.height * gridSize;
    const elev = tokenData.elevation || 0;

    const pts = [
      { x: tokenData.x + tw / 2, y: tokenData.y + th / 2 }, // Центр
      { x: tokenData.x + 5, y: tokenData.y + 5 },           // Углы
      { x: tokenData.x + tw - 5, y: tokenData.y + 5 },
      { x: tokenData.x + 5, y: tokenData.y + th - 5 },
      { x: tokenData.x + tw - 5, y: tokenData.y + th - 5 }
    ];

    for (const region of magmaRegions) {
      const placeable = canvas.regions.get(region.id);
      for (const pt of pts) {
        if (placeable && typeof placeable.testPoint === "function") {
          if (placeable.testPoint(pt.x, pt.y)) return true;
        }
        if (region.testPoint({ x: pt.x, y: pt.y, elevation: elev })) return true;
        if (region.shapes && region.shapes.some(s => s.testPoint(pt))) return true;
      }
    }
    return false;
  }

  // 1. Смена раунда (движение/спавн) и хода (урон)
  updateCombatHook = Hooks.on("updateCombat", async (combat, updateData, options, userId) => {
    if (!game.user.isGM || canvas.scene?.name !== FLOOR_5_NAME) return;
    if (!combat.started) return;

    // А) СМЕНА РАУНДА: Движение и спавн монстров
    if (updateData.round !== undefined && combat.previous.round !== combat.round) {
      await socket.executeAsGM("moveMonsters", { sceneId: canvas.scene.id });

      const activeMonsters = canvas.scene.tokens.contents.filter(t => t.flags?.[MODULE_ID]?.isHellspawn);
      if (activeMonsters.length === 0) {
        await socket.executeAsGM("spawnMonster", { sceneId: canvas.scene.id });
      }
    }

    // Б) СМЕНА ХОДА: Урон от магмы в начале хода
    if (updateData.turn !== undefined || updateData.round !== undefined) {
      const token = canvas.scene.tokens.get(combat.current?.tokenId);
      if (token && token.actor?.hasPlayerOwner) {
        const stage = canvas.scene.getFlag(MODULE_ID, "magmaStage") || 0;
        
        if (stage > 0) {
          const magmaRegions = getActiveMagmaRegions(canvas.scene, stage);
          const gridSize = canvas.scene.grid.size;
          const isInMagma = checkTokenInMagma(token, magmaRegions, gridSize);

          if (isInMagma) {
            // Принудительно ставим флаг, чтобы при движении внутри магмы не было повторного урона
            if (!token.flags?.[MODULE_ID]?.inMagma) {
              await token.setFlag(MODULE_ID, "inMagma", true);
            }
            await socket.executeAsGM("applyMagmaDamage", { sceneId: canvas.scene.id, tokenId: token.id });
          } else {
            if (token.flags?.[MODULE_ID]?.inMagma) {
              await token.setFlag(MODULE_ID, "inMagma", false);
            }
          }
        }
      }
    }
  });

  // 2. Смерть монстра
  updateActorHook = Hooks.on("updateActor", async (actor, changes) => {
    if (!game.user.isGM || canvas.scene?.name !== FLOOR_5_NAME) return;
    if (changes.system?.attributes?.hp?.value <= 0) {
      const token = canvas.scene.tokens.contents.find(t => t.actor === actor && t.flags?.[MODULE_ID]?.isHellspawn);
      if (token) await token.delete();
    }
  });

  // 3. Урон при входе в магму (движение)
  updateTokenHook = Hooks.on("updateToken", async (tokenDoc, changes, options, userId) => {
    if (!game.user.isGM || canvas.scene?.name !== FLOOR_5_NAME) return;
    if (changes.x === undefined && changes.y === undefined) return;
    if (!tokenDoc.actor?.hasPlayerOwner) return;

    const stage = canvas.scene.getFlag(MODULE_ID, "magmaStage") || 0;
    if (stage === 0) return;

    const magmaRegions = getActiveMagmaRegions(canvas.scene, stage);
    const gridSize = canvas.scene.grid.size;
    
    // Используем новые координаты (changes), а не старые
    const checkData = {
      x: changes.x !== undefined ? changes.x : tokenDoc.x,
      y: changes.y !== undefined ? changes.y : tokenDoc.y,
      width: tokenDoc.width,
      height: tokenDoc.height,
      elevation: tokenDoc.elevation
    };

    const isInMagma = checkTokenInMagma(checkData, magmaRegions, gridSize);
    const wasInMagma = tokenDoc.flags?.[MODULE_ID]?.inMagma || false;

    if (isInMagma && !wasInMagma) {
      await tokenDoc.setFlag(MODULE_ID, "inMagma", true);
      await socket.executeAsGM("applyMagmaDamage", { sceneId: canvas.scene.id, tokenId: tokenDoc.id });
    } else if (!isInMagma && wasInMagma) {
      await tokenDoc.setFlag(MODULE_ID, "inMagma", false);
    }
  });

  // 4. Очистка сцены при завершении боя
  deleteCombatHook = Hooks.on("deleteCombat", async (combat) => {
    if (!game.user.isGM || canvas.scene?.name !== FLOOR_5_NAME) return;
    console.log("Geo Tower | Бой завершен. Удаление исчадий.");
    
    const monsters = canvas.scene.tokens.contents.filter(t => t.flags?.[MODULE_ID]?.isHellspawn);
    if (monsters.length > 0) {
      await canvas.scene.deleteEmbeddedDocuments("Token", monsters.map(m => m.id));
    }
  });

  console.log("Geo Tower | Floor 5 Attached");
}

export function detachFloor5() {
  if (updateCombatHook) Hooks.off("updateCombat", updateCombatHook);
  if (updateActorHook) Hooks.off("updateActor", updateActorHook);
  if (updateTokenHook) Hooks.off("updateToken", updateTokenHook);
  if (deleteCombatHook) Hooks.off("deleteCombat", deleteCombatHook);
  
  updateCombatHook = null; 
  updateActorHook = null; 
  updateTokenHook = null; 
  deleteCombatHook = null;
  
  console.log("Geo Tower | Floor 5 Detached");
}
