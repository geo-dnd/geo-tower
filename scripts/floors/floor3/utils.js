// scripts/floors/floor3/utils.js

export function getRandomValidCells(scene, region, count) {
  const gridSize = scene.grid.size;
  const bounds = region.bounds;
  const validCells = [];

  const isInside = (pt) => {
    if (!region.bounds.contains(pt.x, pt.y)) return false;
    if (region.shapes && region.shapes.length > 0) {
      return region.shapes.some(shape => shape.testPoint(pt));
    }
    const regionPlaceable = canvas.regions.get(region.id);
    if (regionPlaceable && typeof regionPlaceable.testPoint === "function") {
      return regionPlaceable.testPoint(pt);
    }
    return false;
  };

  // ✅ Выравниваем стартовые координаты строго по сетке (Math.floor)
  const startX = Math.floor(bounds.x / gridSize) * gridSize;
  const startY = Math.floor(bounds.y / gridSize) * gridSize;

  for (let x = startX; x <= bounds.x + bounds.width - gridSize; x += gridSize) {
    for (let y = startY; y <= bounds.y + bounds.height - gridSize; y += gridSize) {
      
      const c1 = { x, y };
      const c2 = { x: x + gridSize, y };
      const c3 = { x, y: y + gridSize };
      const c4 = { x: x + gridSize, y: y + gridSize };
      const center = { x: x + gridSize / 2, y: y + gridSize / 2 };

      if (
        isInside(c1) && 
        isInside(c2) && 
        isInside(c3) && 
        isInside(c4) &&
        isInside(center)
      ) {
        validCells.push({ x, y }); // Возвращаем строго угловые координаты
      }
    }
  }

  if (validCells.length === 0) {
    return [];
  }

  validCells.sort(() => Math.random() - 0.5);
  return validCells.slice(0, count);
}
