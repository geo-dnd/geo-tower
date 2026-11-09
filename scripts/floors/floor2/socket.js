// scripts/floors/floor2/socket.js

const MODULE_ID = "geo-tower";

export function registerFloor2Sockets(socket) {
  socket.register("applyColdWave", async ({ sceneId, center, radius, damageFormula }) => {
    const scene = game.scenes.get(sceneId);
    if (!scene) return;

    // ✅ ЖДЕМ, пока анимация запустится у ВСЕХ игроков (и у ГМа)
    await socket.executeForEveryone("playColdWaveAnimation", { sceneId });

    // Небольшая пауза (200мс), чтобы первый кадр видео успел отрисоваться
    await new Promise(r => setTimeout(r, 200));

    const tokens = scene.tokens.contents;
    let hitCount = 0;

    const gridSize = scene.grid?.size ?? 100;
    const gridDistance = scene.grid?.distance ?? 5;
    const radiusPx = radius * (gridSize / gridDistance);

    const ClockwiseSweepPolygon = foundry.canvas.geometry.ClockwiseSweepPolygon;

    for (const token of tokens) {
      if (!token.actor || !token.actor.hasPlayerOwner) continue;

      const tokenCenter = { 
        x: token.x + (token.width * gridSize) / 2, 
        y: token.y + (token.height * gridSize) / 2 
      };

      const dx = tokenCenter.x - center.x;
      const dy = tokenCenter.y - center.y;
      if (Math.hypot(dx, dy) > radiusPx) continue;

      let blocked = false;
      let blockReason = "";
      
      try {
        if (ClockwiseSweepPolygon) {
          const origin = { x: center.x, y: center.y, elevation: 0 };
          const destination = { x: tokenCenter.x, y: tokenCenter.y, elevation: token.elevation ?? 0 };

          const bSight = ClockwiseSweepPolygon.testCollision(origin, destination, { type: "sight", mode: "any" });
          const bMove = ClockwiseSweepPolygon.testCollision(origin, destination, { type: "move", mode: "any" });
          const bSound = ClockwiseSweepPolygon.testCollision(origin, destination, { type: "sound", mode: "any" });

          if (bSight) blockReason += "Sight ";
          if (bMove) blockReason += "Move ";
          if (bSound) blockReason += "Sound ";
          blocked = bSight || bMove || bSound;
        }
      } catch (err) { console.error(err); }

      if (blocked) {
        console.log(`Geo Tower | Токен ${token.name} укрыт (${blockReason})`);
        continue; 
      }

      try {
        const roll = await new Roll(damageFormula).evaluate();
        await token.actor.applyDamage([{ value: roll.total, type: "cold" }]);
        hitCount++;

        ChatMessage.create({
          content: `<div class="geo-tower-chat" style="border: 1px solid #4a90e2; padding: 5px; border-radius: 4px; background: #e6f2ff; color: #0055aa;">
            <b>❄️ Волна холода!</b><br>
            ${token.name} получает <b>${roll.total}</b> урона холодом.
          </div>`,
          speaker: ChatMessage.getSpeaker({ token })
        });
      } catch (e) { console.error(e); }
    }

    console.log(`Geo Tower | Волна холода задела ${hitCount} токенов.`);
  });

  // Сокет для запуска анимации
  socket.register("playColdWaveAnimation", async ({ sceneId }) => {
    const scene = game.scenes.get(sceneId);
    if (!scene || canvas.scene?.id !== sceneId) return; 

    const tileName = "Cold Wave Effect";
    const tileDoc = scene.tiles.getName(tileName);
    if (!tileDoc) return;

    // Делаем тайл видимым
    if (tileDoc.hidden) {
      await tileDoc.update({ hidden: false });
      await new Promise(r => setTimeout(r, 150)); 
    }

    const tilePlaceable = canvas.tiles.get(tileDoc.id);
    if (!tilePlaceable || !tilePlaceable.texture || !tilePlaceable.texture.baseTexture) return;

    const baseTex = tilePlaceable.texture.baseTexture;
    const video = baseTex.resource?.source || baseTex.resource?.video;

    if (video && typeof video.play === "function") {
      try {
        // ✅ Сбрасываем видео
        video.currentTime = 0;
        
        // ✅ Если видео загружено не до конца, принудительно грузим
        if (video.readyState < 3) {
          video.load();
        }

        await video.play();

        // ✅ ПРИНУДИТЕЛЬНО ОБНОВЛЯЕМ ТЕКСТУРУ PIXI, чтобы кадры пошли на экран
        if (baseTex.update) baseTex.update();
        if (tilePlaceable.texture.update) tilePlaceable.texture.update();

        console.log(`Geo Tower | 🎥 Анимация запущена у ${game.user.name}`);
      } catch (err) {
        console.warn(`Geo Tower | Ошибка видео у ${game.user.name}:`, err);
      }
    }
  });
}
