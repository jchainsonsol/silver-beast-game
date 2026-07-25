import { WORLD } from "./config.js";
import { AssetLoader } from "./assets.js";
import { AudioManager } from "./audio.js";
import { Controls } from "./controls.js";
import { createPlayer, resetPlayer, createEnemy } from "./entities.js";
import { Renderer } from "./renderer.js";

const shell = document.getElementById("game-shell");
const canvas = document.getElementById("game");

const ui = {
  loading: document.getElementById("loading-screen"),
  loadingFill: document.getElementById("loading-fill"),
  loadingText: document.getElementById("loading-text"),
  menu: document.getElementById("menu-screen"),
  hud: document.getElementById("hud"),
  pause: document.getElementById("pause-screen"),
  end: document.getElementById("end-screen"),
  endTitle: document.getElementById("end-title"),
  endScore: document.getElementById("end-score"),
  health: document.getElementById("health-fill"),
  beast: document.getElementById("beast-fill"),
  score: document.getElementById("score-value"),
  sol: document.getElementById("sol-value"),
  room: document.getElementById("room-value"),
  lives: document.getElementById("lives-value"),
  combo: document.getElementById("combo-value"),
  toast: document.getElementById("toast"),
  muteButton: document.getElementById("mute-button"),
  menuMute: document.getElementById("menu-mute")
};

class SilverBeastGame {
  constructor(assets) {
    this.assets = assets;
    this.audio = new AudioManager(ui);
    this.renderer = new Renderer(canvas, shell, assets);
    this.player = createPlayer();

    this.state = "menu";
    this.room = 1;
    this.score = 0;
    this.sol = 0;
    this.lives = 3;
    this.combo = 0;
    this.comboTimer = 0;
    this.beastMeter = 0;
    this.beastModeTimer = 0;
    this.hitStop = 0;
    this.enemies = [];
    this.pickups = [];
    this.particles = [];
    this.lastFrame = performance.now();

    this.controls = new Controls({
      onPunch: () => this.attack("punch"),
      onKick: () => this.attack("kick"),
      onPause: () => this.togglePause(),
      onFullscreen: () => this.toggleFullscreen(),
      onMute: () => this.audio.toggleMute(),
      onStart: () => this.handleStart(),
      onPrimary: () => this.handlePrimary()
    });

    this.bindButtons();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  bindButtons() {
    document.getElementById("start-button").onclick = () => this.startGame();
    document.getElementById("play-again-button").onclick = () => this.startGame();
    document.getElementById("resume-button").onclick = () => this.togglePause();
    document.getElementById("restart-button").onclick = () => this.startGame();
    document.getElementById("mute-button").onclick = () => this.audio.toggleMute();
    document.getElementById("menu-mute").onclick = () => this.audio.toggleMute();
    document.getElementById("pause-button").onclick = () => this.togglePause();
    document.getElementById("fullscreen-button").onclick = () => this.toggleFullscreen();
    document.getElementById("menu-fullscreen").onclick = () => this.toggleFullscreen();
  }

  handleStart() {
    if (["menu", "gameover", "victory"].includes(this.state)) {
      this.startGame();
    } else {
      this.togglePause();
    }
  }

  handlePrimary() {
    if (["menu", "gameover", "victory"].includes(this.state)) {
      this.startGame();
    } else if (this.state === "playing") {
      this.attack("punch");
    }
  }

  async startGame() {
    await this.tryDeviceFullscreen();

    this.room = 1;
    this.score = 0;
    this.sol = 0;
    this.lives = 3;
    this.combo = 0;
    this.comboTimer = 0;
    this.beastMeter = 0;
    this.beastModeTimer = 0;
    this.pickups = [];
    this.particles = [];
    resetPlayer(this.player);
    this.renderer.resetCamera(this.player.x);
    this.spawnRoom();
    this.updateHud();

    this.state = "playing";
    document.body.classList.add("game-active");
    ui.menu.classList.add("hidden");
    ui.end.classList.add("hidden");
    ui.pause.classList.add("hidden");
    ui.hud.classList.remove("hidden");

    this.audio.play();
    this.showToast("ROOM 1 — SCAMMER DISTRICT", "#25e8ff");
  }

  spawnRoom() {
    this.enemies = [];

    if (this.room < 4) {
      const count = 2 + this.room;
      for (let i = 0; i < count; i += 1) {
        this.enemies.push(
          createEnemy(640 + i * 72, 340 + (i % 3) * 56, false)
        );
      }
    } else {
      this.enemies.push(createEnemy(760, 400, true));
    }
  }

  attack(kind) {
    if (
      this.state !== "playing" ||
      this.player.cooldown > 0 ||
      this.player.state === "hurt"
    ) return;

    this.player.state = kind;
    this.player.stateTime = 0;
    this.player.cooldown = kind === "punch" ? 0.32 : 0.52;
  }

  applyPlayerAttack(kind) {
    const range = kind === "punch" ? 95 : 125;
    const baseDamage = kind === "punch" ? 14 : 24;
    const damage =
      this.beastModeTimer > 0 ? Math.round(baseDamage * 1.65) : baseDamage;

    let hitSomething = false;

    for (const enemy of this.enemies) {
      if (enemy.defeated || enemy.invulnerable > 0) continue;

      const inFront = Math.sign(enemy.x - this.player.x) === this.player.facing;
      const close =
        Math.abs(enemy.x - this.player.x) < range &&
        Math.abs(enemy.y - this.player.y) < 58;

      if (!inFront || !close) continue;

      enemy.hp -= damage;
      enemy.hurtTimer = 0.18;
      enemy.invulnerable = 0.12;
      enemy.x += this.player.facing * (kind === "kick" ? 34 : 20);

      this.combo += 1;
      this.comboTimer = 1.5;
      this.beastMeter = Math.min(
        100,
        this.beastMeter + (kind === "kick" ? 9 : 6)
      );
      this.score += damage * 5;
      this.createBurst(enemy.x, enemy.y - 80, "#ffffff");
      hitSomething = true;

      if (enemy.hp <= 0) this.defeatEnemy(enemy);
    }

    if (hitSomething) {
      this.renderer.shakeAmount = kind === "kick" ? 9 : 5;
      this.hitStop = kind === "kick" ? 0.075 : 0.045;
      this.updateHud();
    }
  }

  defeatEnemy(enemy) {
    enemy.defeated = true;
    enemy.defeatedTimer = 0;
    this.score += enemy.isBoss ? 5000 : 500;

    if (!enemy.isBoss) {
      const roll = Math.random();
      this.pickups.push({
        x: enemy.x,
        y: enemy.y - 30,
        kind: roll < 0.58 ? "sol" : roll < 0.82 ? "pizza" : "beast",
        life: 12,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  damagePlayer(amount, attackerX) {
    if (this.player.invulnerable > 0 || this.state !== "playing") return;

    this.player.hp -= amount;
    this.player.invulnerable = 0.8;
    this.player.state = "hurt";
    this.player.stateTime = 0;
    this.player.x += this.player.x < attackerX ? -30 : 30;
    this.combo = 0;
    this.comboTimer = 0;
    this.renderer.shakeAmount = 10;
    this.createBurst(this.player.x, this.player.y - 80, "#ff4d6d");

    if (this.player.hp <= 0) this.loseLife();
    this.updateHud();
  }

  loseLife() {
    this.lives -= 1;

    if (this.lives <= 0) {
      this.endGame(false);
      return;
    }

    this.player.hp = this.player.maxHp;
    this.player.x = 180;
    this.player.y = 410;
    this.player.invulnerable = 1.5;
    this.showToast("BULL BACK IN THE FIGHT", "#ffd84a");
  }

  collectPickup(pickup) {
    pickup.life = 0;

    if (pickup.kind === "sol") {
      this.sol += 1;
      this.score += 100;
      this.beastMeter = Math.min(100, this.beastMeter + 10);
      this.showToast("$SOL COLLECTED +100", "#35ff9b");
    } else if (pickup.kind === "pizza") {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35);
      this.showToast("PIZZA POWER +35 HP", "#ffd84a");
    } else {
      this.beastMeter = Math.min(100, this.beastMeter + 40);
      this.showToast("BEAST ORB +40", "#b45cff");
    }

    if (this.beastMeter >= 100 && this.beastModeTimer <= 0) {
      this.beastModeTimer = 8;
      this.showToast("BEAST MODE!", "#ffd84a");
    }

    this.updateHud();
  }

  nextRoom() {
    if (this.room >= 4) {
      this.endGame(true);
      return;
    }

    this.room += 1;
    this.player.x = 180;
    this.player.y = 410;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
    this.renderer.resetCamera(this.player.x);
    this.spawnRoom();

    this.showToast(
      this.room === 4 ? "BOSS — RUG PULL KING" : `ROOM ${this.room}`,
      this.room === 4 ? "#ff4d6d" : "#25e8ff"
    );
    this.updateHud();
  }

  endGame(victory) {
    this.state = victory ? "victory" : "gameover";
    document.body.classList.remove("game-active");
    ui.hud.classList.add("hidden");
    ui.endTitle.textContent = victory ? "RUG KING DEFEATED" : "RUN OVER";
    ui.endScore.textContent = `FINAL SCORE ${this.score.toLocaleString("en-US")}`;
    ui.end.classList.remove("hidden");
  }

  createBurst(x, y, color) {
    for (let i = 0; i < 12; i += 1) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 220,
        vy: (Math.random() - 0.7) * 220,
        life: 0.45,
        color,
        size: 2 + Math.random() * 5
      });
    }
  }

  update(delta) {
    this.controls.pollGamepad();
    if (this.state !== "playing") return;

    if (this.hitStop > 0) {
      this.hitStop -= delta;
      return;
    }

    this.player.cooldown = Math.max(0, this.player.cooldown - delta);
    this.player.invulnerable = Math.max(0, this.player.invulnerable - delta);
    this.player.stateTime += delta;

    if (this.comboTimer > 0) this.comboTimer -= delta;
    else if (this.combo > 0) {
      this.combo = 0;
      this.updateHud();
    }

    if (this.beastModeTimer > 0) {
      this.beastModeTimer -= delta;
      if (this.beastModeTimer <= 0) {
        this.beastMeter = 0;
        this.updateHud();
      }
    }

    const movementLocked = ["punch", "kick", "hurt"].includes(this.player.state);

    if (!movementLocked) {
      let dx = (this.controls.move.right ? 1 : 0) - (this.controls.move.left ? 1 : 0);
      let dy = (this.controls.move.down ? 1 : 0) - (this.controls.move.up ? 1 : 0);

      if (dx || dy) {
        const length = Math.hypot(dx, dy) || 1;
        this.player.x += (dx / length) * 220 * delta;
        this.player.y += (dy / length) * 150 * delta;
        if (dx) this.player.facing = Math.sign(dx);
        this.player.state = "walk";
      } else {
        this.player.state = "idle";
      }
    }

    if (
      this.player.state === "punch" &&
      this.player.stateTime >= 0.13 &&
      this.player.stateTime - delta < 0.13
    ) this.applyPlayerAttack("punch");

    if (
      this.player.state === "kick" &&
      this.player.stateTime >= 0.21 &&
      this.player.stateTime - delta < 0.21
    ) this.applyPlayerAttack("kick");

    if (this.player.state === "punch" && this.player.stateTime > 0.32) {
      this.player.state = "idle";
      this.player.stateTime = 0;
    }

    if (this.player.state === "kick" && this.player.stateTime > 0.52) {
      this.player.state = "idle";
      this.player.stateTime = 0;
    }

    if (this.player.state === "hurt" && this.player.stateTime > 0.38) {
      this.player.state = "idle";
      this.player.stateTime = 0;
    }

    this.player.x = Math.max(45, Math.min(WORLD.width - 45, this.player.x));
    this.player.y = Math.max(WORLD.floorTop, Math.min(WORLD.floorBottom, this.player.y));

    for (const enemy of this.enemies) {
      if (enemy.defeated) {
        enemy.defeatedTimer += delta;
        continue;
      }

      enemy.hurtTimer = Math.max(0, enemy.hurtTimer - delta);
      enemy.invulnerable = Math.max(0, enemy.invulnerable - delta);
      enemy.cooldown -= delta;
      enemy.stateTime += delta;

      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 1;
      enemy.facing = dx >= 0 ? 1 : -1;

      if (enemy.hurtTimer > 0) {
        enemy.state = "hurt";
      } else if (distance > (enemy.isBoss ? 105 : 80)) {
        enemy.state = "walk";
        enemy.x += (dx / distance) * enemy.speed * delta;
        enemy.y += (dy / distance) * enemy.speed * 0.72 * delta;
      } else if (enemy.cooldown <= 0) {
        enemy.state = "attack";
        enemy.stateTime = 0;
        enemy.cooldown = enemy.isBoss ? 0.9 : 1.25;
      } else if (enemy.state !== "attack") {
        enemy.state = "idle";
      }

      const strikeTime = enemy.isBoss ? 0.35 : 0.25;
      if (
        enemy.state === "attack" &&
        enemy.stateTime >= strikeTime &&
        enemy.stateTime - delta < strikeTime &&
        distance < (enemy.isBoss ? 125 : 90)
      ) {
        this.damagePlayer(enemy.isBoss ? 20 : 10, enemy.x);
      }

      if (
        enemy.state === "attack" &&
        enemy.stateTime > (enemy.isBoss ? 0.62 : 0.48)
      ) {
        enemy.state = "idle";
        enemy.stateTime = 0;
      }
    }

    this.enemies = this.enemies.filter(
      (enemy) => !enemy.defeated || enemy.defeatedTimer < 0.9
    );

    for (const pickup of this.pickups) {
      pickup.life -= delta;
      pickup.phase += delta * 4;

      if (
        Math.abs(pickup.x - this.player.x) < 55 &&
        Math.abs(pickup.y - this.player.y) < 55
      ) this.collectPickup(pickup);
    }

    this.pickups = this.pickups.filter((pickup) => pickup.life > 0);

    for (const particle of this.particles) {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vy += 350 * delta;
      particle.life -= delta;
    }

    this.particles = this.particles.filter((particle) => particle.life > 0);

    if (this.enemies.length === 0) this.nextRoom();

    this.renderer.shakeAmount = Math.max(
      0,
      this.renderer.shakeAmount - delta * 40
    );
  }

  updateHud() {
    ui.health.style.width = `${Math.max(
      0,
      (this.player.hp / this.player.maxHp) * 100
    )}%`;
    ui.beast.style.width = `${Math.max(0, this.beastMeter)}%`;
    ui.score.textContent = this.score.toLocaleString("en-US");
    ui.sol.textContent = this.sol;
    ui.room.textContent = `${this.room}/4`;
    ui.lives.textContent = this.lives;
    ui.combo.textContent = `COMBO ×${this.combo}`;
  }

  showToast(text, color = "#25e8ff") {
    ui.toast.textContent = text;
    ui.toast.style.color = color;
    ui.toast.style.borderColor = color;
    ui.toast.style.boxShadow = `0 0 24px ${color}`;
    ui.toast.classList.add("show");

    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      ui.toast.classList.remove("show");
    }, 900);
  }

  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      ui.pause.classList.remove("hidden");
    } else if (this.state === "paused") {
      this.state = "playing";
      ui.pause.classList.add("hidden");
    }
  }

  async tryDeviceFullscreen() {
    const deviceSized =
      window.matchMedia("(max-width: 900px)").matches ||
      window.matchMedia("(pointer: coarse)").matches;

    if (!deviceSized || document.fullscreenElement) return;

    try {
      if (shell.requestFullscreen) {
        await shell.requestFullscreen();
      } else if (shell.webkitRequestFullscreen) {
        shell.webkitRequestFullscreen();
      }
    } catch (error) {
      // Browsers block automatic fullscreen unless the call comes from
      // a recognized tap/click. The game still fills the visible viewport.
      console.info("Fullscreen needs a direct tap on this browser.");
    }
  }

  async toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (shell.requestFullscreen) await shell.requestFullscreen();
      else if (shell.webkitRequestFullscreen) shell.webkitRequestFullscreen();
    } catch (error) {
      console.warn("Fullscreen unavailable:", error);
    }
  }

  loop(now) {
    const delta = Math.min(0.033, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.update(delta);
    this.renderer.drawScene(this);
    requestAnimationFrame(this.loop);
  }
}

const loader = new AssetLoader(ui);
const assets = await loader.loadAll();

ui.loading.classList.add("hidden");
ui.menu.classList.remove("hidden");

new SilverBeastGame(assets);