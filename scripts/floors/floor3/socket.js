// scripts/floors/floor3/socket.js
import { getRandomValidCells } from "./utils.js";

const MODULE_ID = "geo-tower";
let isAnimationPlaying = false;

const DAMAGE_COLORS = {
  acid: "#88e05e", bludgeoning: "#a0a0a0", cold: "#87ceeb", fire: "#ff4500",
  force: "#9b59b6", lightning: "#ffff00", necrotic: "#2e8b57", piercing: "#c0c0c0",
  poison: "#32cd32", psychic: "#ff69b4", radiant: "#fffacd", slashing: "#dcdcdc",
  thunder: "#8a2be2", random: "#000000" 
};

export function registerFloor3Sockets(socket) {
  
  socket.register("clearSafeZones", async ({ sceneId }) => {
    const scene = game.scenes.get(sceneId);
    if (!scene) return;
    const zones = scene.tiles.filter(t => t.flags?.[MODULE_ID]?.isSafeZone);
    if (zones.length > 0) {
      await scene.deleteEmbeddedDocuments("Tile", zones.map(t => t.id));
    }
  });

  socket.register("generateSafeZones", async ({ sceneId, count }) => {
    const scene = game.scenes.get(sceneId);
    if (!scene) return;

    const region = scene.regions.getName("Hazard Region");
    if (!region) return ui.notifications.error("Регион 'Hazard Region' не найден!");

    const cells = getRandomValidCells(scene, region, count);
    if (cells.length === 0) return ui.notifications.warn("Не удалось найти валидные клетки в регионе!");

    const gridSize = scene.grid.size;
    const currentType = game.settings.get(MODULE_ID, "floor3DamageType");
    const tintColor = DAMAGE_COLORS[currentType] || "#000000";

    const tilesData = cells.map(cell => ({
      name: "Hazard Point",
      x: cell.x,
      y: cell.y,
      width: gridSize,
      height: gridSize,
      texture: { 
        src: `modules/${MODULE_ID}/assets/floor-3/tiles/point-zone.webm`,
        anchorX: 0, anchorY: 0, tint: tintColor
      },
      video: { autoplay: true, loop: true, volume: 0 },
      hidden: false,
      flags: { [MODULE_ID]: { isSafeZone: true } }
    }));

    const createdTiles = await scene.createEmbeddedDocuments("Tile", tilesData);

    if (canvas.scene?.id === sceneId) {
      setTimeout(() => {
        for (const tileDoc of createdTiles) {
          const tilePlaceable = canvas.tiles.get(tileDoc.id);
          if (tilePlaceable?.texture?.baseTexture) {
            const video = tilePlaceable.texture.baseTexture.resource?.source || tilePlaceable.texture.baseTexture.resource?.video;
            if (video) { video.muted = true; video.currentTime = 0; video.play().catch(() => {}); }
          }
        }
      }, 150);
    }
  });

  socket.register("checkSafeZonesAndDamage", async ({ sceneId, formula, type }) => {
    const scene = game.scenes.get(sceneId);
    if (!scene) return;

    const zones = scene.tiles.filter(t => t.flags?.[MODULE_ID]?.isSafeZone);
    const playerTokens = scene.tokens.contents.filter(t => t.actor?.hasPlayerOwner);
    const gridSize = scene.grid.size;

    let allZonesCovered = zones.length > 0; 
    for (const zone of zones) {
      let zoneHasToken = false;
      for (const token of playerTokens) {
        if (token.x < zone.x + zone.width && token.x + (token.width * gridSize) > zone.x &&
            token.y < zone.y + zone.height && token.y + (token.height * gridSize) > zone.y) {
          zoneHasToken = true;
          break; 
        }
      }
      if (!zoneHasToken) { allZonesCovered = false; break; }
    }

    if (allZonesCovered) {
      // ✅ Измененный текст
      ChatMessage.create({ 
        content: `<div style="color: #ffffff; font-weight: bold; text-shadow: 1px 1px 2px #000;">
          Все точки перекрыты!
        </div>` 
      });
      return;
    }

    const currentType = game.settings.get(MODULE_ID, "floor3DamageType");
    const tintColor = DAMAGE_COLORS[currentType] || "#000000";
    
    socket.executeForEveryone("playFloor3Animation", { sceneId, tintColor });
    await new Promise(r => setTimeout(r, 200));

    let actualType = type;
    if (type === "random") {
      const physicalTypes = ["bludgeoning", "piercing", "slashing"];
      const validTypes = Object.keys(CONFIG.DND5E.damageTypes).filter(t => !physicalTypes.includes(t));
      actualType = validTypes[Math.floor(Math.random() * validTypes.length)];
    }
    
    const typeName = CONFIG.DND5E.damageTypes[actualType]?.label || actualType;
    const roll = await new Roll(formula).evaluate();

    ChatMessage.create({ 
      content: `<div style="border: 1px solid #ff0000; padding: 5px; border-radius: 4px; background: #ffe6e6; color: #aa0000;">
        Не все точки перекрыты! Все игроки получают <b>${roll.total}</b> урона (${typeName}).
      </div>` 
    });

    for (const token of playerTokens) {
      await token.actor.applyDamage([{ value: roll.total, type: actualType }]);
    }
  });

  socket.register("playFloor3Animation", async ({ sceneId, tintColor }) => {
    if (isAnimationPlaying) return;
    isAnimationPlaying = true;
    setTimeout(() => { isAnimationPlaying = false; }, 5000);

    const scene = game.scenes.get(sceneId);
    if (!scene || canvas.scene?.id !== sceneId) return; 

    const tileDoc = scene.tiles.getName("Hazard Effect");
    if (!tileDoc) return console.warn("Geo Tower | Тайл 'Hazard Effect' не найден на сцене!");

    if (game.user.isGM && (tileDoc.hidden || tileDoc.texture?.tint !== tintColor)) {
      await tileDoc.update({ hidden: false, "texture.tint": tintColor });
    }

    let videoElement = null;
    let attempts = 0;
    while (!videoElement && attempts < 20) {
      await new Promise(r => setTimeout(r, 200)); 
      attempts++;
      const tilePlaceable = canvas.tiles.get(tileDoc.id);
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
              await tileDoc.update({ hidden: true });
          }
        }, 4500);

      } catch (err) { 
        console.warn(`Geo Tower | Ошибка видео у ${game.user.name}:`, err); 
      }
    }
  });
}
