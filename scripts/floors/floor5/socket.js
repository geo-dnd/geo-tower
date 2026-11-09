// scripts/floors/floor5/socket.js
const MODULE_ID = "geo-tower";
let isAnimationPlaying = false;

export function registerFloor5Sockets(socket) {
  
  // 1. Спавн
  socket.register("spawnMonster", async ({ sceneId }) => {
    const scene = game.scenes.get(sceneId);
    if (!scene) return;
    const actor = game.actors.getName("Огненное исчадие");
    if (!actor) return;

    const startRegions = scene.regions.contents.filter(r => r.name === "Region-Start-1");
    if (startRegions.length === 0) return;
    const startRegion = startRegions[Math.floor(Math.random() * startRegions.length)];
    
    const targetRegion = scene.regions.getName("Region Target");
    if (!targetRegion) return;
    
    const spawnX = startRegion.bounds.x + startRegion.bounds.width / 2;
    const spawnY = startRegion.bounds.y + startRegion.bounds.height / 2;
    const targetCenter = { x: targetRegion.bounds.x + targetRegion.bounds.width / 2, y: targetRegion.bounds.y + targetRegion.bounds.height / 2 };
    
    const distPx = Math.hypot(targetCenter.x - spawnX, targetCenter.y - spawnY);
    const rounds = game.settings.get(MODULE_ID, "floor5RoundsToReach");
    const speed = distPx / rounds;
    const tokenImg = actor.prototypeToken.texture.src || actor.img || "icons/svg/mystery-man.svg";

    await scene.createEmbeddedDocuments("Token", [{
      name: actor.name, actorId: actor.id, actorLink: false, 
      x: spawnX - (scene.grid.size / 2), y: spawnY - (scene.grid.size / 2),
      width: 1, height: 1, texture: { src: tokenImg },
      flags: { [MODULE_ID]: { isHellspawn: true, speed: speed } }
    }]);
    console.log(`[SOCKET] Исчадие появилось. Скорость: ${speed.toFixed(1)}`);
  });

  // 2. Движение
  socket.register("moveMonsters", async ({ sceneId }) => {
    const scene = game.scenes.get(sceneId);
    const targetRegion = scene.regions.getName("Region Target");
    const targetCenter = { x: targetRegion.bounds.x + targetRegion.bounds.width / 2, y: targetRegion.bounds.y + targetRegion.bounds.height / 2 };
    const monsters = scene.tokens.contents.filter(t => t.flags?.[MODULE_ID]?.isHellspawn);

    for (const monster of monsters) {
      const speed = monster.flags[MODULE_ID].speed;
      const mCenter = { x: monster.x + (monster.width * scene.grid.size) / 2, y: monster.y + (monster.height * scene.grid.size) / 2 };
      const dist = Math.hypot(targetCenter.x - mCenter.x, targetCenter.y - mCenter.y);
      let isInside = targetRegion.testPoint({ x: mCenter.x, y: mCenter.y, elevation: 0 });

      if (isInside || dist <= (speed + (scene.grid.size * 1.5))) {
        const finalX = targetCenter.x - (monster.width * scene.grid.size) / 2;
        const finalY = targetCenter.y - (monster.height * scene.grid.size) / 2;
        try { 
          await monster.update({ x: finalX, y: finalY }, { animate: true, constrainOptions: { ignoreWalls: true, ignoreTokens: true } }); 
        } catch (e) { 
          await monster.update({ x: finalX, y: finalY }, { animate: false }); 
        }

        await new Promise(r => setTimeout(r, 800));
        await monster.delete(); 
        await socket.executeAsGM("triggerExplosion", { sceneId }); 
        continue;
      }

      const angle = Math.atan2(targetCenter.y - mCenter.y, targetCenter.x - mCenter.x);
      const newX = monster.x + Math.cos(angle) * speed;
      const newY = monster.y + Math.sin(angle) * speed;
      try { 
        await monster.update({ x: newX, y: newY }, { animate: true, constrainOptions: { ignoreWalls: true, ignoreTokens: true } }); 
      } catch (e) { 
        await monster.update({ x: newX, y: newY }, { animate: false }); 
      }
    }
  });

  // 3. Взрыв
  socket.register("triggerExplosion", async ({ sceneId }) => {
    const scene = game.scenes.get(sceneId);
    if (!scene) return;

    let stage = scene.getFlag(MODULE_ID, "magmaStage") || 0;
    stage++;
    await scene.setFlag(MODULE_ID, "magmaStage", stage);

    let dmgFormula = "";
    if (stage === 1) {
      dmgFormula = game.settings.get(MODULE_ID, "floor5Explosion1");
      await scene.tiles.getName("Floor 1")?.update({ hidden: true });
      await scene.regions.getName("Magma 1")?.update({ hidden: false });
    } else if (stage === 2) {
      dmgFormula = game.settings.get(MODULE_ID, "floor5Explosion2");
      await scene.tiles.getName("Floor 1")?.update({ hidden: true });
      await scene.tiles.getName("Floor 2")?.update({ hidden: true });
      await scene.regions.getName("Magma 2")?.update({ hidden: false });
    } else if (stage === 3) {
      dmgFormula = game.settings.get(MODULE_ID, "floor5Explosion3");
      await scene.tiles.getName("Floor 1")?.update({ hidden: true });
      await scene.tiles.getName("Floor 2")?.update({ hidden: true });
      await scene.tiles.getName("Floor 3")?.update({ hidden: true });
      await scene.regions.getName("Magma 3")?.update({ hidden: false });
    } else if (stage >= 4) {
      dmgFormula = game.settings.get(MODULE_ID, "floor5Explosion4");
    }

    socket.executeForEveryone("playExplosionAnimation", { sceneId });

    const roll = await new Roll(dmgFormula).evaluate();
    const players = scene.tokens.contents.filter(t => t.actor?.hasPlayerOwner && t.actor.system?.attributes?.hp?.value > 0);
    ChatMessage.create({ content: `<div style="color: #ff4500; font-weight: bold;">💥 ВЗРЫВ! Все игроки получают ${roll.total} урона огнем!</div>` });
    for (const p of players) await p.actor.applyDamage([{ value: roll.total, type: "fire" }]);
  });

  // 4. Магма
  socket.register("applyMagmaDamage", async ({ sceneId, tokenId }) => {
    const scene = game.scenes.get(sceneId);
    const token = scene?.tokens.get(tokenId);
    if (!token || !token.actor) return;
    const roll = await new Roll(game.settings.get(MODULE_ID, "floor5MagmaDamage")).evaluate();
    await token.actor.applyDamage([{ value: roll.total, type: "fire" }]);
    
    // ✅ Измененный текст
    ChatMessage.create({ content: `<div style="color: #ff4500;">🔥 ${token.name} находится в магме ${roll.total} урона от огня!</div>` });
  });

  // 5. Анимация
  socket.register("playExplosionAnimation", async ({ sceneId }) => {
    if (isAnimationPlaying) return;
    isAnimationPlaying = true;
    setTimeout(() => { isAnimationPlaying = false; }, 5000);

    const scene = game.scenes.get(sceneId);
    if (!scene || canvas.scene?.id !== sceneId) return; 

    const exploTile = scene.tiles.getName("Explo-tile");
    if (!exploTile) return console.warn("Geo Tower | Тайл 'Explo-tile' не найден на сцене!");

    if (game.user.isGM && exploTile.hidden) {
      await exploTile.update({ hidden: false });
    }

    let videoElement = null;
    let attempts = 0;
    
    while (!videoElement && attempts < 20) {
      await new Promise(r => setTimeout(r, 200)); attempts++;
      const tilePlaceable = canvas.tiles.get(exploTile.id);
      if (tilePlaceable?.texture?.baseTexture) {
        videoElement = tilePlaceable.texture.baseTexture.resource?.source || tilePlaceable.texture.baseTexture.resource?.video;
      }
    }

    if (videoElement && typeof videoElement.play === "function") {
      try {
        videoElement.muted = true; 
        videoElement.playsInline = true; 
        videoElement.currentTime = 0;

        if (videoElement.readyState < 3) {
          videoElement.load();
          await new Promise(res => {
             const timer = setTimeout(res, 1000);
             videoElement.addEventListener('canplay', () => { clearTimeout(timer); res(); }, { once: true });
          });
        }

        await videoElement.play();
        
        setTimeout(async () => {
          if (videoElement) {
              videoElement.pause();
              videoElement.currentTime = 0;
          }
          if (game.user.isGM) {
              await exploTile.update({ hidden: true });
          }
        }, 4500);

      } catch (err) { 
        console.warn(`Ошибка видео:`, err); 
      }
    }
  });
}
