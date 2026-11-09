const MODULE_ID = "geo-tower";

export function registerFloor1Sockets(socket) {
  socket.register("pickupShard", async ({ sceneId, tileId, actorId, shardIndex }) => {
    const scene = game.scenes.get(sceneId);
    const tile = scene?.tiles?.get(tileId);
    const actor = game.actors.get(actorId);
    const worldItem = game.items.getName(`Осколок ${shardIndex}`);
    if (!scene || !tile || !actor || !worldItem) return;

    await actor.createEmbeddedDocuments("Item", [worldItem.toObject()]);
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
