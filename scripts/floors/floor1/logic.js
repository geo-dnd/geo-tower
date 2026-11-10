// scripts/floors/floor1/logic.js

import {
  worldToTileLocal,
  getTileAABB,
  distanceFromPointToTileEdgeFt,
  isPointerOnAnyToken,
  getActingToken,
  alphaTextureCache,
  loadAlphaTexture,
  preloadTileTextures
} from "./utils.js";

const MODULE_ID = "geo-tower";
export const FLOOR_1_SCENE_NAME = "Geo Tower - Этаж 1";

const INTERACT_RANGE_FT = 10;
const HIT_MARGIN_PX = 10;
const ALPHA_THRESHOLD = 32;

let pointerHandler = null;
let canvasElement = null;

// ✅ Локальный замок для предотвращения двойных кликов
const pendingPickups = new Set();

export async function attachFloor1() {
  if (pointerHandler) return;
  const el = canvas.app?.view ?? canvas.view ?? canvas.canvas;
  if (!el) return console.error("Geo Tower | не найден DOM-элемент канваса");

  canvasElement = el;
  pointerHandler = onPointerDown;
  el.addEventListener("pointerdown", pointerHandler);
  console.log("Geo Tower | Floor 1: DOM pointerdown навешен");

  if (ALPHA_THRESHOLD > 0) {
    await preloadTileTextures(/^(small-glass-\d+|glass-broken-\d+)$/);
  }
}

export function detachFloor1() {
  if (pointerHandler && canvasElement) {
    canvasElement.removeEventListener("pointerdown", pointerHandler);
    console.log("Geo Tower | Floor 1: DOM pointerdown снят");
  }
  pointerHandler = null;
  canvasElement = null;
  pendingPickups.clear();
}

async function onPointerDown(event) {
  try {
    if ((event.button ?? 0) !== 0) return;
    
    const socket = socketlib.modules.get(MODULE_ID);
    if (!socket) return;

    let point = null;
    try {
      point = canvas.canvasCoordinatesFromClient({ x: event.clientX, y: event.clientY });
    } catch (err) {}

    if (!point || Number.isNaN(point?.x) || Number.isNaN(point?.y)) {
      try {
        const rect = canvas.app.view.getBoundingClientRect();
        const scaleX = canvas.app.view.width / rect.width;
        const scaleY = canvas.app.view.height / rect.height;
        const cx = (event.clientX - rect.left) * scaleX;
        const cy = (event.clientY - rect.top) * scaleY;
        point = canvas.stage.toLocal(new PIXI.Point(cx, cy));
      } catch (err) {}
    }

    if (!point || Number.isNaN(point.x) || Number.isNaN(point.y)) return;

    if (isPointerOnAnyToken(point)) return;

    const tilePlaceable = hitTestTile(point);
    if (!tilePlaceable) return;

    const tileDoc = tilePlaceable.document;
    const name = tileDoc.name ?? "";
    const smallMatch = name.match(/^small-glass-(\d+)$/);
    const brokenMatch = name.match(/^glass-broken-(\d+)$/);
    if (!smallMatch && !brokenMatch) return;

    const tokenPlaceable = getActingToken();
    if (!tokenPlaceable) return;
    
    const actor = tokenPlaceable.actor;
    if (!actor) return;
    if (!actor.testUserPermission(game.user, "OWNER")) return;

    const tokenCenter = tokenPlaceable.center;
    const distance = distanceFromPointToTileEdgeFt(tokenCenter, tileDoc);
    if (distance > INTERACT_RANGE_FT) return;

    const sceneId = canvas.scene.id;

    if (smallMatch) {
      const shardIndex = Number(smallMatch[1]);
      
      // ✅ Проверяем, не идет ли уже процесс подбора этого тайла
      if (pendingPickups.has(tileDoc.id)) return;
      
      // ✅ Ставим замок
      pendingPickups.add(tileDoc.id);
      
      await socket.executeAsGM("pickupShard", { sceneId, tileId: tileDoc.id, actorId: actor.id, shardIndex });
      
      // ✅ Снимаем замок через 1 секунду (чтобы дать время на синхронизацию)
      setTimeout(() => pendingPickups.delete(tileDoc.id), 1000);
      
      return;
    }

    if (brokenMatch) {
      const shardIndex = Number(brokenMatch[1]);
      await handleRepairAttempt(tilePlaceable, actor, shardIndex, sceneId);
    }
  } catch (err) {
    console.error("Geo Tower | ошибка в pointerdown:", err);
  }
}

async function handleRepairAttempt(brokenTilePlaceable, actor, requiredShardIndex, sceneId) {
  const socket = socketlib.modules.get(MODULE_ID);
  const shards = actor.items.filter((i) => /^Осколок \d+$/.test(i.name));
  if (shards.length === 0) return;

  let chosenShardId = null;
  try {
    const DialogV2 = foundry.applications.api.DialogV2;
    if (DialogV2) {
      const buttons = shards.map((s) => ({ action: s.id, label: s.name, callback: () => s.id }));
      chosenShardId = await DialogV2.wait({
        window: { title: "Восстановление витража", resizable: false },
        content: "<p>Выберите осколок для восстановления:</p>",
        buttons, modal: false, rejectClose: false
      });
    } else {
      chosenShardId = await legacyDialogChoice(shards);
    }
  } catch (err) {
    return console.warn("Geo Tower | DialogV2 ошибка:", err);
  }

  if (!chosenShardId) return;
  const chosenShard = actor.items.get(chosenShardId);
  if (!chosenShard) return;

  const result = await socket.executeAsGM("repairWindow", {
    sceneId, tileId: brokenTilePlaceable.document.id, actorId: actor.id, chosenItemId: chosenShard.id, shardIndex: requiredShardIndex
  });

  if (result === "wrong") ui.notifications.info("Осколок не подошёл, вам не удалось восстановить витраж.");
  else if (result === "success") ui.notifications.info("Витраж восстановлен!");
}

function legacyDialogChoice(shards) {
  return new Promise((resolve) => {
    const buttons = {};
    for (const s of shards) buttons[s.id] = { label: s.name, callback: () => resolve(s.id) };
    new Dialog({
      title: "Восстановление витража", content: "<p>Выберите осколок:</p>", buttons,
      default: Object.keys(buttons)[0] ?? null, close: () => resolve(null)
    }).render(true);
  });
}

function hitTestTile(point) {
  if (!point || Number.isNaN(point.x) || Number.isNaN(point.y)) return null;

  const tiles = [...canvas.tiles.placeables].reverse();
  for (const tile of tiles) {
    const doc = tile.document;
    if (!doc || doc.hidden) continue;

    const name = doc.name ?? "";
    if (!/^(small-glass-\d+|glass-broken-\d+)$/.test(name)) continue;
    if (doc.flags?.[MODULE_ID]?.repaired) continue;

    const aabb = getTileAABB(doc);
    const m = HIT_MARGIN_PX;
    if (point.x < aabb.minX - m || point.x > aabb.maxX + m || point.y < aabb.minY - m || point.y > aabb.maxY + m) continue;

    const local = worldToTileLocal(point, doc);
    const insideRect = local.lx >= 0 && local.lx <= doc.width && local.ly >= 0 && local.ly <= doc.height;

    if (!insideRect) {
      if (ALPHA_THRESHOLD > 0) continue;
      return tile;
    }

    if (ALPHA_THRESHOLD > 0) {
      const tex = alphaTextureCache.get(doc.texture?.src);
      if (!tex) {
        loadAlphaTexture(doc.texture?.src);
        continue;
      }
      const u = local.lx / doc.width;
      const v = local.ly / doc.height;
      const px = Math.min(tex.width - 1, Math.max(0, Math.floor(u * tex.width)));
      const py = Math.min(tex.height - 1, Math.max(0, Math.floor(v * tex.height)));
      try {
        const alpha = tex.ctx.getImageData(px, py, 1, 1).data[3];
        if (alpha < ALPHA_THRESHOLD) continue;
      } catch (err) {}
    }
    return tile;
  }
  return null;
}
