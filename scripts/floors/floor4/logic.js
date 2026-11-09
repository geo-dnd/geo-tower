// scripts/floors/floor4/logic.js
const MODULE_ID = "geo-tower";
const FLOOR_4_NAME = "Geo Tower - Этаж 4";

let combatStartHook, updateCombatHook, deleteCombatHook;

export async function attachFloor4() {
  combatStartHook = Hooks.on("combatStart", async (combat) => {
    if (!game.user.isGM || canvas.scene?.name !== FLOOR_4_NAME) return;
    await transferPlague(); // При старте передаем null (исключать некого)
  });

  updateCombatHook = Hooks.on("updateCombat", async (combat, updateData) => {
    if (!game.user.isGM || canvas.scene?.name !== FLOOR_4_NAME) return;
    if (!combat.started) return;
    if (updateData.round === undefined || combat.previous.round === combat.round) return;
    if (combat.round === 1) return; 

    const socket = socketlib.modules.get(MODULE_ID);
    const sceneId = canvas.scene.id;
    
    const plaguedToken = canvas.scene.tokens.find(t => t.actor?.effects.some(e => e.flags?.[MODULE_ID]?.isPlague));
    let prevPlaguedId = null;

    if (plaguedToken) {
      prevPlaguedId = plaguedToken.id; // Запоминаем ID, чтобы исключить его
      
      const plagueDmg = game.settings.get(MODULE_ID, "floor4PlagueDamage");
      const aoeDmg = game.settings.get(MODULE_ID, "floor4AoeDamage");
      const radius = game.settings.get(MODULE_ID, "floor4PlagueRadius");

      await socket.executeAsGM("triggerPlagueDamage", { 
        sceneId, plaguedTokenId: plaguedToken.id, plagueDmg, aoeDmg, radius 
      });
      
      const effects = plaguedToken.actor.effects.filter(e => e.flags?.[MODULE_ID]?.isPlague);
      if (effects.length > 0) {
        await plaguedToken.actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(e => e.id));
      }
    }

    // Передаем ID предыдущего, чтобы чума ушла к другому
    await transferPlague(prevPlaguedId);
  });

  deleteCombatHook = Hooks.on("deleteCombat", async (combat) => {
    if (!game.user.isGM || canvas.scene?.name !== FLOOR_4_NAME) return;
    const socket = socketlib.modules.get(MODULE_ID);
    await socket.executeAsGM("clearPlague", { sceneId: canvas.scene.id });
  });

  console.log("Geo Tower | Floor 4 Attached");
}

export function detachFloor4() {
  if (combatStartHook) Hooks.off("combatStart", combatStartHook);
  if (updateCombatHook) Hooks.off("updateCombat", updateCombatHook);
  if (deleteCombatHook) Hooks.off("deleteCombat", deleteCombatHook);
  combatStartHook = null; updateCombatHook = null; deleteCombatHook = null;
  console.log("Geo Tower | Floor 4 Detached");
}

async function transferPlague(previousTokenId = null) {
  const socket = socketlib.modules.get(MODULE_ID);
  const scene = canvas.scene;
  
  // Ищем живых игроков, ИСКЛЮЧАЯ предыдущего зараженного
  let livingPlayers = scene.tokens.filter(t => {
    if (!t.actor?.hasPlayerOwner) return false;
    if (t.id === previousTokenId) return false; // Исключаем
    const hp = t.actor.system?.attributes?.hp?.value;
    return hp === undefined || hp > 0;
  });

  // Если других живых нет (или он один), разрешаем выбрать его же
  if (livingPlayers.length === 0) {
    livingPlayers = scene.tokens.filter(t => {
      if (!t.actor?.hasPlayerOwner) return false;
      const hp = t.actor.system?.attributes?.hp?.value;
      return hp === undefined || hp > 0;
    });
  }

  if (livingPlayers.length === 0) return;
  
  const randomTarget = livingPlayers[Math.floor(Math.random() * livingPlayers.length)];
  await socket.executeAsGM("applyPlague", { sceneId: scene.id, tokenId: randomTarget.id });
}
