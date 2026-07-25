import { WORLD } from "./config.js";

export class Renderer {
  constructor(canvas, shell, assets) {
    this.canvas = canvas;
    this.shell = shell;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    this.shakeAmount = 0;
    this.cameraX = 180;
    this.targetCameraX = 180;
    this.ctx.imageSmoothingEnabled = true;

    this.resize();

    window.addEventListener("resize", () => this.resize());

    document.addEventListener("fullscreenchange", () => {
      setTimeout(() => this.resize(), 80);
    });
  }

  resetCamera(playerX = 180) {
    this.cameraX = playerX;
    this.targetCameraX = playerX;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    this.cssWidth = Math.max(1, rect.width);
    this.cssHeight = Math.max(1, rect.height);

    this.canvas.width = Math.max(1, Math.round(this.cssWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(this.cssHeight * dpr));

    this.isPortrait = this.cssHeight > this.cssWidth;

    if (this.isPortrait) {
      // Show roughly 760 world units across on a phone.
      // This is zoomed enough to read the characters but wider than before.
      const visibleWorldWidth = 760;
      this.scale = this.canvas.width / visibleWorldWidth;

      // Vertically center the 540-unit world inside the available game area.
      this.offsetY =
        (this.canvas.height - WORLD.height * this.scale) / 2;
    } else {
      this.scale = Math.min(
        this.canvas.width / WORLD.width,
        this.canvas.height / WORLD.height
      );

      this.offsetY =
        (this.canvas.height - WORLD.height * this.scale) / 2;
    }
  }

  beginWorldFrame(game) {
    const ctx = this.ctx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#02030a";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    let offsetX =
      (this.canvas.width - WORLD.width * this.scale) / 2;

    if (this.isPortrait && game) {
      const playerX = game.player.x;

      const nearestEnemy = game.enemies
        .filter((enemy) => !enemy.defeated)
        .sort(
          (a, b) =>
            Math.abs(a.x - playerX) -
            Math.abs(b.x - playerX)
        )[0];

      // Camera starts on and strongly follows the player.
      // A nearby enemy only nudges the frame slightly toward the fight.
      let desiredX = playerX;

      if (
        nearestEnemy &&
        Math.abs(nearestEnemy.x - playerX) < 300
      ) {
        desiredX =
          playerX * 0.82 +
          nearestEnemy.x * 0.18;
      }

      this.targetCameraX = desiredX;

      // Smooth movement so the camera never snaps to enemies.
      this.cameraX +=
        (this.targetCameraX - this.cameraX) * 0.085;

      // Keep the player slightly left of center so the road ahead is visible.
      const playerScreenAnchor = this.canvas.width * 0.42;

      offsetX =
        playerScreenAnchor -
        this.cameraX * this.scale;

      const minimumOffset =
        this.canvas.width -
        WORLD.width * this.scale;

      offsetX = Math.max(
        minimumOffset,
        Math.min(0, offsetX)
      );
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