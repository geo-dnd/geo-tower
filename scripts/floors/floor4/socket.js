// scripts/floors/floor4/socket.js
const MODULE_ID = "geo-tower";

export function registerFloor4Sockets(socket) {
  
  // 1. Наложение эффекта чумы
  socket.register("applyPlague", async ({ sceneId, tokenId }) => {
    const scene = game.scenes.get(sceneId);
    const token = scene?.tokens.get(tokenId);
    if (!token || !token.actor) return;

    const existing = token.actor.effects.filter(e => 
      e.name === "Кровавая чума" || e.flags?.[MODULE_ID]?.isPlague
    );
    if (existing.length > 0) {
      await token.actor.deleteEmbeddedDocuments("ActiveEffect", existing.map(e => e.id));
    }

    await token.actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Кровавая чума",
      img: `modules/${MODULE_ID}/assets/floor-4/tiles/blood.webp`, 
      description: "Вы заражены! Держитесь подальше от союзников.",
      showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
      flags: { [MODULE_ID]: { isPlague: true } }
    }]);

    ui.notifications.warn(`Кровавая чума настигла ${token.name}!`);
    console.log(`Geo Tower | Чума применена на ${token.name}`);
  });

  // 2. Нанесение урона и запуск анимации
  socket.register("triggerPlagueDamage", async ({ sceneId, plaguedTokenId, plagueDmg, aoeDmg, radius }) => {
    const scene = game.scenes.get(sceneId);
    const plaguedToken = scene?.tokens.get(plaguedTokenId);
    if (!scene || !plaguedToken || !plaguedToken.actor) return;

    const gridSize = scene.grid?.size ?? 100;
    const gridDistance = scene.grid?.distance ?? 5;
    const radiusPx = radius * (gridSize / gridDistance);

    const hp = plaguedToken.actor.system?.attributes?.hp?.value;
    if (hp !== undefined && hp <= 0) return; 

    await socket.executeForEveryone("playPlagueAnimation", { 
      sceneId, 
      x: plaguedToken.x, 
      y: plaguedToken.y, 
      width: plaguedToken.width, 
      height: plaguedToken.height 
    });
    
    await new Promise(r => setTimeout(r, 200));

    const rollPlague = await new Roll(plagueDmg).evaluate();
    await plaguedToken.actor.applyDamage([{ value: rollPlague.total, type: "piercing" }]);
    
    ChatMessage.create({
      content: `<div style="color: #2e8b57; font-weight: bold;">
        ${plaguedToken.name} страдает от Кровавой чумы и получает ${rollPlague.total} колющего урона!
      </div>`
    });

    const tokens = scene.tokens.contents;
    const aoeRoll = await new Roll(aoeDmg).evaluate();
    let hitCount = 0;

    const plaguedCenter = { 
      x: plaguedToken.x + (plaguedToken.width * gridSize) / 2, 
      y: plaguedToken.y + (plaguedToken.height * gridSize) / 2 
    };

    for (const token of tokens) {
      if (token.id === plaguedToken.id) continue; 
      if (!token.actor || !token.actor.hasPlayerOwner) continue; 

      const tokenCenter = { 
        x: token.x + (token.width * gridSize) / 2, 
        y: token.y + (token.height * gridSize) / 2 
      };

      const dx = tokenCenter.x - plaguedCenter.x;
      const dy = tokenCenter.y - plaguedCenter.y;
      const distPx = Math.hypot(dx, dy);

      if (distPx <= radiusPx) {
        await token.actor.applyDamage([{ value: aoeRoll.total, type: "piercing" }]);
        hitCount++;

        ChatMessage.create({
          content: `<div style="color: #aa0000;">
            ${token.name} находится слишком близко к зараженному и получает ${aoeRoll.total} колющего урона!
          </div>`
        });
      }
    }

    if (hitCount > 0) {
      console.log(`Geo Tower | Чума задела ${hitCount} союзников.`);
    }
  });

  // 3. Очистка при завершении боя
  socket.register("clearPlague", async ({ sceneId }) => {
    const scene = game.scenes.get(sceneId);
    if (!scene) return;
    
    for (const token of scene.tokens.contents) {
      if (!token.actor) continue;
      const effects = token.actor.effects.filter(e => e.flags?.[MODULE_ID]?.isPlague);
      if (effects.length > 0) {
        await token.actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(e => e.id));
      }
    }
  });

  // 4. Создание и проигрывание WebM анимации
  socket.register("playPlagueAnimation", async ({ sceneId, x, y, width, height }) => {
    const scene = game.scenes.get(sceneId);
    if (!scene || canvas.scene?.id !== sceneId) return; 

    const gridSize = scene.grid?.size ?? 100;
    const gridDistance = scene.grid?.distance ?? 5;

    const radiusFt = game.settings.get(MODULE_ID, "floor4PlagueRadius") || 10;
    const radiusPx = radiusFt * (gridSize / gridDistance);
    
    // Добавляем полклетки к диаметру
    const diameterPx = (radiusPx * 2) + (gridSize / 2);

    const tokenCenterX = x + (width * gridSize) / 2;
    const tokenCenterY = y + (height * gridSize) / 2;

    const newX = tokenCenterX - (diameterPx / 2);
    const newY = tokenCenterY - (diameterPx / 2);

    if (game.user.isGM) {
      const oldTiles = scene.tiles.filter(t => t.flags?.[MODULE_ID]?.isPlagueEffect);
      if (oldTiles.length > 0) {
        await scene.deleteEmbeddedDocuments("Tile", oldTiles.map(t => t.id));
      }

      const tileData = {
        name: "Plague Effect (Temp)",
        x: newX,
        y: newY,
        width: diameterPx,
        height: diameterPx,
        texture: { 
          src: `modules/${MODULE_ID}/assets/floor-4/tiles/dmg-tile.webm`,
          anchorX: 0,
          anchorY: 0,
          tint: "#990000" 
        },
        video: { autoplay: false, loop: false, volume: 0 }, 
        hidden: false,
        // ✅ Прозрачность 75% (0.75)
        alpha: 0.75,
        // ✅ Рендеринг поверх токенов (overhead)
        overhead: true,
        elevation: 100,
        flags: { [MODULE_ID]: { isPlagueEffect: true } }
      };

      const [createdTile] = await scene.createEmbeddedDocuments("Tile", [tileData]);
      
      // ✅ Удаляем тайл через 3 секунды (3000 мс)
      setTimeout(async () => {
        const currentScene = game.scenes.get(sceneId);
        const t = currentScene?.tiles.get(createdTile.id);
        if (t) await currentScene.deleteEmbeddedDocuments("Tile", [createdTile.id]);
      }, 3000);
    }

    let video = null;
    let attempts = 0;
    
    // Ждем прогрузки текстуры
    while (!video && attempts < 15) {
      await new Promise(r => setTimeout(r, 200));
      attempts++;
      
      const foundTile = scene.tiles.find(t => t.flags?.[MODULE_ID]?.isPlagueEffect);
      if (foundTile) {
        const tilePlaceable = canvas.tiles.get(foundTile.id);
        if (tilePlaceable?.texture?.baseTexture) {
          video = tilePlaceable.texture.baseTexture.resource?.source || tilePlaceable.texture.baseTexture.resource?.video;
        }
      }
    }

    if (video && typeof video.play === "function") {
      try {
        video.muted = true;
        video.currentTime = 0;
        if (video.readyState < 3) video.load();
        video.playbackRate = 1.0; 
        await video.play();
        
        const finalTile = scene.tiles.find(t => t.flags?.[MODULE_ID]?.isPlagueEffect);
        if (finalTile) {
          const finalPlaceable = canvas.tiles.get(finalTile.id);
          if (finalPlaceable?.texture?.baseTexture.update) finalPlaceable.texture.baseTexture.update();
          if (finalPlaceable?.texture.update) finalPlaceable.texture.update();
        }
        console.log(`Geo Tower | 🎥 Анимация чумы запущена. Размер: ${diameterPx}px`);
      } catch (err) { 
        console.warn("Geo Tower | Ошибка видео:", err); 
      }
    }
  });
}
