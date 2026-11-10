// scripts/floors/floor1/socket.js
const MODULE_ID = "geo-tower";

export function registerFloor1Sockets(socket) {
  
  socket.register("pickupShard", async ({ sceneId, tileId, actorId, shardIndex }) => {
    const scene = game.scenes.get(sceneId);
    const tile = scene?.tiles?.get(tileId);
    const actor = game.actors.get(actorId);
    if (!scene || !tile || !actor) return;

    // ✅ ЗАЩИТА: Если тайл уже скрыт, значит его уже подобрали. Второй предмет не выдаем.
    if (tile.hidden) {
        console.log(`Geo Tower | Тайл ${tile.name} уже скрыт. Повторная выдача отменена.`);
        return;
    }

    const worldItem = game.items.getName(`Осколок ${shardIndex}`);
    if (!worldItem) {
      ui.notifications.error(`Geo Tower: нет предмета "Осколок ${shardIndex}" в мире.`);
      return;
    }

    await actor.createEmbeddedDocuments("Item", [worldItem.toObject()]);
    
    // Скрываем тайл (после этого клиент игрока перестанет его видеть)
    await tile.update({ hidden: true });
  });

  socket.register("repairWindow", async ({ sceneId, tileId, actorId, chosenItemId, shardIndex }) => {
    const scene = game.scenes.get(sceneId);
    const brokenTile = scene?.tiles?.get(tileId);
    const actor = game.actors.get(actorId);
    const chosenItem = actor?.items?.get(chosenItemId);
    if (!scene || !brokenTile || !actor || !chosenItem) return "error";
    
    if (chosenItem.name !== `Осколок ${shardIndex}`) return "wrong";

    await chosenItem.delete();
    await brokenTile.update({
      "texture.src": `modules/${MODULE_ID}/assets/floor-1/tiles/glass-full-${shardIndex}.webp`,
      [`flags.${MODULE_ID}.repaired`]: true
    });
    
    const runeTile = scene.tiles.getName(`Floor-rune-${shardIndex}`);
    if (runeTile) await runeTile.update({ hidden: false });
    return "success";
  });
}
