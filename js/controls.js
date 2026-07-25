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

  bindKeyboard() {
    window.addEventListener("keydown", (event) => {
      const movementKey = [
        "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
        "KeyA", "KeyD", "KeyW", "KeyS"
      ].includes(event.code);

      if (movementKey) event.preventDefault();

      if (["ArrowLeft", "KeyA"].includes(event.code)) this.move.left = true;
      if (["ArrowRight", "KeyD"].includes(event.code)) this.move.right = true;
      if (["ArrowUp", "KeyW"].includes(event.code)) this.move.up = true;
      if (["ArrowDown", "KeyS"].includes(event.code)) this.move.down = true;

      if (!event.repeat && ["KeyZ", "KeyJ", "Space"].includes(event.code)) {
        event.preventDefault();
        this.handlers.onPunch();
      }

      if (!event.repeat && ["KeyX", "KeyK"].includes(event.code)) {
        event.preventDefault();
        this.handlers.onKick();
      }

      if (!event.repeat && event.code === "Enter") this.handlers.onStart();
      if (!event.repeat && event.code === "KeyF") this.handlers.onFullscreen();
      if (!event.repeat && event.code === "KeyM") this.handlers.onMute();
    }, { passive: false });

    window.addEventListener("keyup", (event) => {
      if (["ArrowLeft", "KeyA"].includes(event.code)) this.move.left = false;
      if (["ArrowRight", "KeyD"].includes(event.code)) this.move.right = false;
      if (["ArrowUp", "KeyW"].includes(event.code)) this.move.up = false;
      if (["ArrowDown", "KeyS"].includes(event.code)) this.move.down = false;
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
        try { button.setPointerCapture?.(event.pointerId); } catch (_) {}
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
      const fire = (event) => {
        event.preventDefault();
        event.stopPropagation();

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
      document.body.classList.add("controller-active");
    });

    window.addEventListener("gamepaddisconnected", () => {
      document.body.classList.remove("controller-active");
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

    document.body.classList.add("controller-active");

    const deadZone = 0.28;
    const axisX = gamepad.axes[0] || 0;
    const axisY = gamepad.axes[1] || 0;

    this.move.left = axisX < -deadZone || Boolean(gamepad.buttons[14]?.pressed);
    this.move.right = axisX > deadZone || Boolean(gamepad.buttons[15]?.pressed);
    this.move.up = axisY < -deadZone || Boolean(gamepad.buttons[12]?.pressed);
    this.move.down = axisY > deadZone || Boolean(gamepad.buttons[13]?.pressed);

    // PSG1 / standard gamepad:
    // A (0) = Start from menu, Punch during gameplay
    // B (1) = Kick
    // X (2) = Fullscreen
    // Y (3) = Mute
    // Start (9) = Pause
    if (this.pressedOnce(gamepad.buttons, 0)) this.handlers.onPrimary();
    if (this.pressedOnce(gamepad.buttons, 1)) this.handlers.onKick();
    if (this.pressedOnce(gamepad.buttons, 2)) this.handlers.onFullscreen();
    if (this.pressedOnce(gamepad.buttons, 3)) this.handlers.onMute();
    if (this.pressedOnce(gamepad.buttons, 9)) this.handlers.onPause();

    // Some Android handhelds report face buttons one position over.
    // These fallbacks only fire when the normal buttons are absent.
    if (!gamepad.buttons[0] && this.pressedOnce(gamepad.buttons, 4)) {
      this.handlers.onPrimary();
    }
    if (!gamepad.buttons[1] && this.pressedOnce(gamepad.buttons, 5)) {
      this.handlers.onKick();
    }

    this.previousGamepadButtons = gamepad.buttons.map((button) =>
      Boolean(button.pressed)
    );
  }
}
