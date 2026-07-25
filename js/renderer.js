import { WORLD } from "./config.js";

export class Renderer {
  constructor(canvas, shell, assets) {
    this.canvas = canvas;
    this.shell = shell;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    this.shakeAmount = 0;
    this.ctx.imageSmoothingEnabled = true;

    this.resize();
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("fullscreenchange", () => {
      setTimeout(() => this.resize(), 80);
    });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));

    this.isPortrait = rect.height > rect.width;

    // Portrait uses cover so the fighters are large and readable.
    // Landscape/desktop use contain so the whole arena remains visible.
    this.scale = this.isPortrait
      ? Math.max(
          this.canvas.width / WORLD.width,
          this.canvas.height / WORLD.height
        )
      : Math.min(
          this.canvas.width / WORLD.width,
          this.canvas.height / WORLD.height
        );

    this.offsetX = (this.canvas.width - WORLD.width * this.scale) / 2;
    this.offsetY = (this.canvas.height - WORLD.height * this.scale) / 2;
  }

  beginWorldFrame(game) {
    const ctx = this.ctx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#02030a";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    let offsetX = this.offsetX;

    if (this.isPortrait && game) {
      const living = game.enemies.filter((enemy) => !enemy.defeated);
      const focusPoints = [game.player.x, ...living.map((enemy) => enemy.x)];
      const focusX = focusPoints.reduce((sum, value) => sum + value, 0) /
        Math.max(1, focusPoints.length);

      offsetX = this.canvas.width / 2 - focusX * this.scale;

      const minOffset = this.canvas.width - WORLD.width * this.scale;
      offsetX = Math.max(minOffset, Math.min(0, offsetX));
    }

    ctx.setTransform(
      this.scale,
      0,
      0,
      this.scale,
      offsetX,
      this.offsetY
    );
  }

  drawImageCentered(image, x, y, width, height, facing = 1, alpha = 1) {
    if (!image) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.drawImage(image, -width / 2, -height, width, height);
    ctx.restore();
  }

  drawShadow(x, y, width) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,.42)";
    ctx.beginPath();
    ctx.ellipse(x, y + 5, width, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawScene(game) {
    const ctx = this.ctx;

    this.beginWorldFrame(game);
    ctx.save();

    if (this.shakeAmount > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.shakeAmount,
        (Math.random() - 0.5) * this.shakeAmount
      );
    }

    if (this.assets.background) {
      ctx.drawImage(this.assets.background, 0, 0, WORLD.width, WORLD.height);
    } else {
      ctx.fillStyle = "#080b24";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    }

    const shade = ctx.createLinearGradient(0, WORLD.floorTop, 0, WORLD.height);
    shade.addColorStop(0, "rgba(0,0,0,.02)");
    shade.addColorStop(1, "rgba(0,0,0,.28)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, WORLD.floorTop, WORLD.width, WORLD.height - WORLD.floorTop);

    const drawList = [
      { type: "player", y: game.player.y },
      ...game.enemies.map((enemy) => ({ type: "enemy", y: enemy.y, enemy }))
    ].sort((a, b) => a.y - b.y);

    for (const item of drawList) {
      item.type === "player"
        ? this.drawPlayer(game)
        : this.drawEnemy(item.enemy);
    }

    this.drawPickups(game.pickups);
    this.drawParticles(game.particles);
    ctx.restore();
  }

  drawPlayer(game) {
    const player = game.player;
    const pose =
      player.state === "punch" ? "playerPunch" :
      player.state === "kick" ? "playerKick" :
      player.state === "hurt" ? "playerHurt" :
      player.state === "walk" ? "playerWalk" :
      "playerIdle";

    const size = game.beastModeTimer > 0 ? 178 : 160;
    this.drawShadow(player.x, player.y, 45);

    if (game.beastModeTimer > 0 && this.assets.beastOrb) {
      this.ctx.globalAlpha = 0.42 + 0.12 * Math.sin(performance.now() / 90);
      this.ctx.drawImage(this.assets.beastOrb, player.x - 100, player.y - 205, 200, 200);
      this.ctx.globalAlpha = 1;
    }

    const alpha =
      player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 === 0
        ? 0.35
        : 1;

    this.drawImageCentered(
      this.assets[pose],
      player.x,
      player.y,
      size,
      size,
      player.facing,
      alpha
    );
  }

  drawEnemy(enemy) {
    const prefix = enemy.isBoss ? "boss" : "enemy";
    const pose =
      enemy.defeated ? `${prefix}Defeated` :
      enemy.hurtTimer > 0 ? `${prefix}Hurt` :
      enemy.state === "attack" ? `${prefix}${enemy.isBoss ? "Attack" : "Punch"}` :
      enemy.state === "walk" ? `${prefix}Walk` :
      `${prefix}Idle`;

    const size = enemy.isBoss ? 210 : 145;
    this.drawShadow(enemy.x, enemy.y, enemy.isBoss ? 58 : 38);
    this.drawImageCentered(this.assets[pose], enemy.x, enemy.y, size, size, enemy.facing);

    if (!enemy.defeated) {
      const width = enemy.isBoss ? 150 : 80;
      this.ctx.fillStyle = "#111";
      this.ctx.fillRect(enemy.x - width / 2, enemy.y - size - 9, width, 7);
      this.ctx.fillStyle = enemy.isBoss ? "#ff3e50" : "#a24cff";
      this.ctx.fillRect(
        enemy.x - width / 2,
        enemy.y - size - 9,
        width * Math.max(0, enemy.hp / enemy.maxHp),
        7
      );
    }
  }

  drawPickups(pickups) {
    for (const pickup of pickups) {
      const bob = Math.sin(pickup.phase) * 6;
      const icon =
        pickup.kind === "sol" ? this.assets.solCoin :
        pickup.kind === "pizza" ? this.assets.pizza :
        this.assets.beastOrb;

      const glow =
        pickup.kind === "sol" ? this.assets.coinGlow :
        pickup.kind === "pizza" ? this.assets.healthGlow :
        this.assets.beastOrb;

      const size = pickup.kind === "pizza" ? 60 : 52;

      if (glow) {
        this.ctx.globalAlpha = 0.45;
        this.ctx.drawImage(
          glow,
          pickup.x - size * 0.8,
          pickup.y + bob - size * 0.8,
          size * 1.6,
          size * 1.6
        );
        this.ctx.globalAlpha = 1;
      }

      if (icon) {
        this.ctx.drawImage(
          icon,
          pickup.x - size / 2,
          pickup.y + bob - size / 2,
          size,
          size
        );
      }

      if (this.assets.sparkle) {
        this.ctx.globalAlpha = 0.35 + 0.25 * Math.sin(pickup.phase * 2);
        this.ctx.drawImage(
          this.assets.sparkle,
          pickup.x - 24,
          pickup.y + bob - 40,
          48,
          48
        );
        this.ctx.globalAlpha = 1;
      }
    }
  }

  drawParticles(particles) {
    for (const particle of particles) {
      this.ctx.globalAlpha = Math.max(0, particle.life / 0.45);
      this.ctx.fillStyle = particle.color;
      this.ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    this.ctx.globalAlpha = 1;
  }
}