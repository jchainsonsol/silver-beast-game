export function createPlayer() {
  return {
    x: 180,
    y: 410,
    hp: 100,
    maxHp: 100,
    facing: 1,
    state: "idle",
    stateTime: 0,
    cooldown: 0,
    invulnerable: 0,
    walkPhase: 0
  };
}

export function resetPlayer(player) {
  Object.assign(player, createPlayer());
}

export function createEnemy(x, y, isBoss = false) {
  return {
    x,
    y,
    isBoss,
    hp: isBoss ? 300 : 55,
    maxHp: isBoss ? 300 : 55,
    facing: -1,
    state: "walk",
    stateTime: 0,
    cooldown: 0.4 + Math.random() * 0.8,
    hurtTimer: 0,
    invulnerable: 0,
    defeated: false,
    defeatedTimer: 0,
    speed: isBoss ? 58 : 78
  };
}