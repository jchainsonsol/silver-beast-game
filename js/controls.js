export class Controls {
  constructor({
    onPunch,
    onKick,
    onPause,
    onFullscreen,
    onMute,
    onStart,
    onPrimary
  }) {
    this.move = { up: false, down: false, left: false, right: false };
    this.previousGamepadButtons = [];
    this.handlers = {
      onPunch,
      onKick,
      onPause,
      onFullscreen,
      onMute,
      onStart,
      onPrimary
    };

    this.bindKeyboard();
    this.bindTouch();
    this.bindGamepadEvents();
  }

  markControllerMode() {
    document.body.classList.add("controller-active");

    const portrait = window.innerHeight > window.innerWidth;
    const compact = window.innerWidth <= 900 || window.innerHeight <= 900;

    if (portrait && compact) {
      document.body.classList.add("psg1-mode");
    }
  }

  bindKeyboard() {
    window.addEventListener("keydown", (event) => {
      const code = event.code;
      const key = String(event.key || "").toLowerCase();

      const isArrow = [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown"
      ].includes(code);

      if (isArrow) {
        event.preventDefault();
        this.markControllerMode();
      }

      if (code === "ArrowLeft") this.move.left = true;
      if (code === "ArrowRight") this.move.right = true;
      if (code === "ArrowUp") this.move.up = true;
      if (code === "ArrowDown") this.move.down = true;

      // Desktop fallback controls.
      if (!event.repeat && ["KeyZ", "KeyJ", "Space"].includes(code)) {
        event.preventDefault();
        this.handlers.onPunch();
      }

      if (!event.repeat && ["KeyK"].includes(code)) {
        event.preventDefault();
        this.handlers.onKick();
      }

      // PSG1 fallback: some handheld browsers expose face buttons as letters.
      if (!event.repeat && (code === "KeyA" || key === "a")) {
        event.preventDefault();
        this.markControllerMode();
        this.handlers.onPrimary();
      }

      if (!event.repeat && (code === "KeyB" || key === "b")) {
        event.preventDefault();
        this.markControllerMode();
        this.handlers.onKick();
      }

      if (!event.repeat && (code === "KeyX" || key === "x")) {
        event.preventDefault();
        this.markControllerMode();
        this.handlers.onFullscreen();
      }

      if (!event.repeat && (code === "KeyY" || key === "y")) {
        event.preventDefault();
        this.markControllerMode();
        this.handlers.onMute();
      }

      if (!event.repeat && ["Enter", "NumpadEnter"].includes(code)) {
        event.preventDefault();
        this.markControllerMode();
        this.handlers.onStart();
      }

      if (!event.repeat && code === "KeyF") this.handlers.onFullscreen();
      if (!event.repeat && code === "KeyM") this.handlers.onMute();
    }, { passive: false });

    window.addEventListener("keyup", (event) => {
      if (event.code === "ArrowLeft") this.move.left = false;
      if (event.code === "ArrowRight") this.move.right = false;
      if (event.code === "ArrowUp") this.move.up = false;
      if (event.code === "ArrowDown") this.move.down = false;
    });

    window.addEventListener("blur", () => this.releaseAll());

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.releaseAll();
    });
  }

  bindTouch() {
    const bindHoldButton = (button, name) => {
      const press = (event) => {
        event.preventDefault();
        event.stopPropagation();

        try {
          button.setPointerCapture?.(event.pointerId);
        } catch (_) {}

        this.move[name] = true;
      };

      const release = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.move[name] = false;
      };

      button.addEventListener("pointerdown", press, { passive: false });
      button.addEventListener("pointerup", release, { passive: false });
      button.addEventListener("pointercancel", release, { passive: false });
      button.addEventListener("lostpointercapture", release, { passive: false });
      button.addEventListener("contextmenu", (event) => event.preventDefault());
    };

    document.querySelectorAll("[data-input]").forEach((button) => {
      bindHoldButton(button, button.dataset.input);
    });

    document.querySelectorAll("[data-action]").forEach((button) => {
      let lastFire = 0;

      const fire = (event) => {
        event.preventDefault();
        event.stopPropagation();

        const now = performance.now();

        // Stops pointerdown + touchstart from firing the same attack twice.
        if (now - lastFire < 120) return;
        lastFire = now;

        if (button.dataset.action === "punch") this.handlers.onPunch();
        if (button.dataset.action === "kick") this.handlers.onKick();
      };

      button.addEventListener("pointerdown", fire, { passive: false });
      button.addEventListener("touchstart", fire, { passive: false });
      button.addEventListener("contextmenu", (event) => event.preventDefault());
    });
  }

  bindGamepadEvents() {
    window.addEventListener("gamepadconnected", () => {
      this.markControllerMode();
    });

    window.addEventListener("gamepaddisconnected", () => {
      document.body.classList.remove("controller-active", "psg1-mode");
      this.releaseAll();
    });
  }

  releaseAll() {
    this.move.up = false;
    this.move.down = false;
    this.move.left = false;
    this.move.right = false;
  }

  pressedOnce(buttons, index) {
    return Boolean(buttons[index]?.pressed) &&
      !Boolean(this.previousGamepadButtons[index]);
  }

  pollGamepad() {
    const gamepad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
    if (!gamepad) return;

    this.markControllerMode();

    const deadZone = 0.28;
    const axisX = gamepad.axes[0] || 0;
    const axisY = gamepad.axes[1] || 0;

    this.move.left =
      axisX < -deadZone ||
      Boolean(gamepad.buttons[14]?.pressed);

    this.move.right =
      axisX > deadZone ||
      Boolean(gamepad.buttons[15]?.pressed);

    this.move.up =
      axisY < -deadZone ||
      Boolean(gamepad.buttons[12]?.pressed);

    this.move.down =
      axisY > deadZone ||
      Boolean(gamepad.buttons[13]?.pressed);

    // Standard mapping:
    // A / bottom = punch or start
    // B / right  = kick
    // X / left   = fullscreen
    // Y / top    = mute
    // Start      = pause
    if (this.pressedOnce(gamepad.buttons, 0)) this.handlers.onPrimary();
    if (this.pressedOnce(gamepad.buttons, 1)) this.handlers.onKick();
    if (this.pressedOnce(gamepad.buttons, 2)) this.handlers.onFullscreen();
    if (this.pressedOnce(gamepad.buttons, 3)) this.handlers.onMute();
    if (this.pressedOnce(gamepad.buttons, 9)) this.handlers.onPause();

    this.previousGamepadButtons =
      gamepad.buttons.map((button) => Boolean(button.pressed));
  }
}
