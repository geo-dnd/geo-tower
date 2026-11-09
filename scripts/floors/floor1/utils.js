export function worldToTileLocal(point, doc) {
  const ax = doc.texture?.anchorX ?? 0;
  const ay = doc.texture?.anchorY ?? 0;
  const rad = (doc.rotation ?? 0) * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = point.x - doc.x, dy = point.y - doc.y;
  const rx = dx * cos + dy * sin, ry = -dx * sin + dy * cos;
  return { lx: rx + doc.width * ax, ly: ry + doc.height * ay };
}

export function getTileAABB(doc) {
  const ax = doc.texture?.anchorX ?? 0, ay = doc.texture?.anchorY ?? 0;
  const rad = (doc.rotation ?? 0) * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const w = doc.width, h = doc.height;
  const cornersLocal = [[0, 0], [w, 0], [w, h], [0, h]];
  const cornersWorld = cornersLocal.map(([lx, ly]) => {
    const rx = lx - w * ax, ry = ly - h * ay;
    return { x: doc.x + rx * cos - ry * sin, y: doc.y + rx * sin + ry * cos };
  });
  return {
    minX: Math.min(...cornersWorld.map((c) => c.x)),
    maxX: Math.max(...cornersWorld.map((c) => c.x)),
    minY: Math.min(...cornersWorld.map((c) => c.y)),
    maxY: Math.max(...cornersWorld.map((c) => c.y))
  };
}

export function distanceFromPointToTileEdgeFt(point, tileDoc) {
  const local = worldToTileLocal(point, tileDoc);
  const clampedX = Math.max(0, Math.min(tileDoc.width, local.lx));
  const clampedY = Math.max(0, Math.min(tileDoc.height, local.ly));
  const distPx = Math.hypot(local.lx - clampedX, local.ly - clampedY);
  const gridSize = canvas.grid?.size ?? 100;
  const gridDistance = canvas.grid?.distance ?? 5;
  return distPx * (gridDistance / gridSize);
}

export function isPointerOnAnyToken(point) {
  if (!canvas.tokens?.placeables) return false;
  for (const token of canvas.tokens.placeables) {
    if (token.document.hidden && !game.user.isGM) continue;
    if (token.center && token.width && token.height) {
      const halfW = token.width / 2 + 5, halfH = token.height / 2 + 5;
      if (point.x >= token.center.x - halfW && point.x <= token.center.x + halfW &&
          point.y >= token.center.y - halfH && point.y <= token.center.y + halfH) return true;
    }
  }
  return false;
}

export function getActingToken() {
  return canvas.tokens.controlled[0] ?? game.user.character?.getActiveTokens()[0] ?? null;
}

export const alphaTextureCache = new Map();
export async function loadAlphaTexture(src) {
  if (!src || alphaTextureCache.has(src)) return alphaTextureCache.get(src);
  try {
    const img = new Image(); img.crossOrigin = "anonymous";
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
    const entry = { canvas: c, ctx, width: c.width, height: c.height };
    alphaTextureCache.set(src, entry); return entry;
  } catch { return null; }
}

export async function preloadTileTextures(nameRegex) {
  for (const tile of canvas.tiles.placeables) {
    if (nameRegex.test(tile.document?.name ?? "")) await loadAlphaTexture(tile.document.texture?.src);
  }
}
