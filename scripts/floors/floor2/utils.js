// scripts/floors/floor2/utils.js

export function getRegionCenter(region) {
  if (!region || !region.bounds) return null;
  return { 
    x: region.bounds.x + region.bounds.width / 2, 
    y: region.bounds.y + region.bounds.height / 2 
  };
}
