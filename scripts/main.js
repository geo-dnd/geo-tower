// scripts/main.js
import { registerFloor1Sockets } from "./floors/floor1/socket.js";
import { attachFloor1, detachFloor1 } from "./floors/floor1/logic.js";
import { Floor1SettingsApp } from "./floors/floor1/settings.js";

import { registerFloor2Sockets } from "./floors/floor2/socket.js";
import { attachFloor2, detachFloor2 } from "./floors/floor2/logic.js";
import { Floor2SettingsApp } from "./floors/floor2/settings.js";

import { registerFloor3Sockets } from "./floors/floor3/socket.js";
import { attachFloor3, detachFloor3 } from "./floors/floor3/logic.js";
import { Floor3SettingsApp } from "./floors/floor3/settings.js";

import { registerFloor4Sockets } from "./floors/floor4/socket.js";
import { attachFloor4, detachFloor4 } from "./floors/floor4/logic.js";
import { Floor4SettingsApp } from "./floors/floor4/settings.js";

import { registerFloor5Sockets } from "./floors/floor5/socket.js";
import { attachFloor5, detachFloor5 } from "./floors/floor5/logic.js";
import { Floor5SettingsApp } from "./floors/floor5/settings.js";

const MODULE_ID = "geo-tower";
const FLOOR_1_NAME = "Geo Tower - Этаж 1";
const FLOOR_2_NAME = "Geo Tower - Этаж 2";
const FLOOR_3_NAME = "Geo Tower - Этаж 3";
const FLOOR_4_NAME = "Geo Tower - Этаж 4";
const FLOOR_5_NAME = "Geo Tower - Этаж 5";

console.log("%c Geo Tower | module script loaded ", "background:#4caf50;color:white;padding:2px 6px;border-radius:3px");

Hooks.once("init", () => {
  // ==========================================
  // ЭТАЖ 1
  // ==========================================
  game.settings.register(MODULE_ID, "floor1InteractRange", {
    scope: "world", config: false, type: Number, default: 10
  });
  game.settings.registerMenu(MODULE_ID, "floor1SettingsMenu", {
    name: "[Этаж 1] Настройки", label: "Настроить Этаж 1", icon: "fas fa-glass-cheers", type: Floor1SettingsApp, restricted: true
  });

  // ==========================================
  // ЭТАЖ 2
  // ==========================================
  game.settings.register(MODULE_ID, "waveRadius", {
    scope: "world", config: false, type: Number, default: 30
  });
  game.settings.register(MODULE_ID, "waveDamage", {
    scope: "world", config: false, type: String, default: "1d6"
  });
  game.settings.registerMenu(MODULE_ID, "floor2SettingsMenu", {
    name: "[Этаж 2] Настройки", label: "Настроить Этаж 2", icon: "fas fa-snowflake", type: Floor2SettingsApp, restricted: true
  });

  // ==========================================
  // ЭТАЖ 3
  // ==========================================
  game.settings.register(MODULE_ID, "floor3ZonesCount", { scope: "world", config: false, type: Number, default: 1 });
  game.settings.register(MODULE_ID, "floor3DamageFormula", { scope: "world", config: false, type: String, default: "1d8" });
  game.settings.register(MODULE_ID, "floor3DamageType", { scope: "world", config: false, type: String, default: "cold" });
  game.settings.registerMenu(MODULE_ID, "floor3SettingsMenu", {
    name: "[Этаж 3] Настройки", label: "Настроить Этаж 3", icon: "fas fa-snowflake", type: Floor3SettingsApp, restricted: true
  });

  // ==========================================
  // ЭТАЖ 4
  // ==========================================
  game.settings.register(MODULE_ID, "floor4PlagueDamage", { scope: "world", config: false, type: String, default: "1d6" });
  game.settings.register(MODULE_ID, "floor4AoeDamage", { scope: "world", config: false, type: String, default: "1d4" });
  game.settings.register(MODULE_ID, "floor4PlagueRadius", { scope: "world", config: false, type: Number, default: 10 });
  game.settings.registerMenu(MODULE_ID, "floor4SettingsMenu", {
    name: "[Этаж 4] Настройки", label: "Настроить Этаж 4", icon: "fas fa-biohazard", type: Floor4SettingsApp, restricted: true
  });

  // ==========================================
  // ЭТАЖ 5
  // ==========================================
  game.settings.register(MODULE_ID, "floor5SpawnRate", { scope: "world", config: false, type: Number, default: 1 });
  game.settings.register(MODULE_ID, "floor5RoundsToReach", { scope: "world", config: false, type: Number, default: 2 });
  game.settings.register(MODULE_ID, "floor5Explosion1", { scope: "world", config: false, type: String, default: "2d6" });
  game.settings.register(MODULE_ID, "floor5Explosion2", { scope: "world", config: false, type: String, default: "3d6" });
  game.settings.register(MODULE_ID, "floor5Explosion3", { scope: "world", config: false, type: String, default: "4d6" });
  game.settings.register(MODULE_ID, "floor5Explosion4", { scope: "world", config: false, type: String, default: "5d6" });
  game.settings.register(MODULE_ID, "floor5MagmaDamage", { scope: "world", config: false, type: String, default: "1d10" });
  game.settings.registerMenu(MODULE_ID, "floor5SettingsMenu", {
    name: "[Этаж 5] Настройки", label: "Настроить Этаж 5", icon: "fas fa-fire", type: Floor5SettingsApp, restricted: true
  });
});

let socket = null;
Hooks.once("socketlib.ready", () => {
  if (typeof socketlib === "undefined") return;
  socket = socketlib.registerModule(MODULE_ID);
  registerFloor1Sockets(socket);
  registerFloor2Sockets(socket);
  registerFloor3Sockets(socket);
  registerFloor4Sockets(socket);
  registerFloor5Sockets(socket);
  console.log("Geo Tower | Все сокеты зарегистрированы");
});

Hooks.on("canvasReady", async () => {
  const scene = canvas.scene;
  if (!scene) return;

  if (scene.name === FLOOR_1_NAME) {
    detachFloor2(); detachFloor3(); detachFloor4(); detachFloor5();
    await attachFloor1();
  } else if (scene.name === FLOOR_2_NAME) {
    detachFloor1(); detachFloor3(); detachFloor4(); detachFloor5();
    await attachFloor2();
  } else if (scene.name === FLOOR_3_NAME) {
    detachFloor1(); detachFloor2(); detachFloor4(); detachFloor5();
    await attachFloor3();
  } else if (scene.name === FLOOR_4_NAME) {
    detachFloor1(); detachFloor2(); detachFloor3(); detachFloor5();
    await attachFloor4();
  } else if (scene.name === FLOOR_5_NAME) {
    detachFloor1(); detachFloor2(); detachFloor3(); detachFloor4();
    await attachFloor5();
  } else {
    detachFloor1(); detachFloor2(); detachFloor3(); detachFloor4(); detachFloor5();
  }
});

Hooks.on("canvasTearDown", () => {
  detachFloor1(); detachFloor2(); detachFloor3(); detachFloor4(); detachFloor5();
});
