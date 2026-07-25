export class Controls {
  constructor({ onPunch, onKick, onPause, onFullscreen, onMute, onStart }) {
    this.move = { up: false, down: false, left: false, right: false };
    this.previousGamepadButtons = [];
    this.handlers = { onPunch, onKick, onPause, onFullscreen, onMute, onStart };

    this.bindKeyboard();
    this.bindTouch();
    this.bindGamepadEvents();
  }

  bindKeyboard() {
    window.addEventListener("keydown", (event) => {
      if (["ArrowLeft", "KeyA"].includes(event.code)) this.move.left = true;
      if (["ArrowRight", "KeyD"].includes(event.code)) this.move.right = true;
      if (["ArrowUp", "KeyW"].includes(event.code)) this.move.up = true;
      if (["ArrowDown", "KeyS"].includes(event.code)) this.move.down = true;

      if (["KeyZ", "KeyJ", "Space"].includes(event.code)) this.handlers.onPunch();
      if (["KeyX", "KeyK"].includes(event.code)) this.handlers.onKick();
      if (event.code === "Enter") this.handlers.onStart();
      if (event.code === "KeyF") this.handlers.onFullscreen();
      if (event.code === "KeyM") this.handlers.onMute();
    });

    window.addEventListener("keyup", (event) => {
      if (["ArrowLeft", "KeyA"].includes(event.code)) this.move.left = false;
      if (["ArrowRight", "KeyD"].includes(event.code)) this.move.right = false;
      if (["ArrowUp", "KeyW"].includes(event.code)) this.move.up = false;
      if (["ArrowDown", "KeyS"].includes(event.code)) this.move.down = false;
    });
  }

  bindTouch() {
    document.querySelectorAll("[data-input]").forEach((button) => {
      const name = button.dataset.input;
      const press = (event) => {
        event.preventDefault();
        this.move[name] = true;
      };
      const release = (event) => {
        event.preventDefault();
        this.move[name] = false;
      };

      button.addEventListener("pointerdown", press);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("pointerleave", release);
    });

    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.dataset.action === "punch"
          ? this.handlers.onPunch()
          : this.handlers.onKick();
      });
    });
  }

  bindGamepadEvents() {
    window.addEventListener("gamepadconnected", () => {
      document.body.classList.add("controller-active");
    });

    window.addEventListener("gamepaddisconnected", () => {
      document.body.classList.remove("controller-active");
    });
  }

  pressedOnce(buttons, index) {
    return Boolean(buttons[index]?.pressed) && !this.previousGamepadButtons[index];
  }

  pollGamepad() {
    const gamepad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
    if (!gamepad) return;

    document.body.classList.add("controller-active");

    const deadZone = 0.3;
    const axisX = gamepad.axes[0] || 0;
    const axisY = gamepad.axes[1] || 0;

    this.move.left = axisX < -deadZone || Boolean(gamepad.buttons[14]?.pressed);
    this.move.right = axisX > deadZone || Boolean(gamepad.buttons[15]?.pressed);
    this.move.up = axisY < -deadZone || Boolean(gamepad.buttons[12]?.pressed);
    this.move.down = axisY > deadZone || Boolean(gamepad.buttons[13]?.pressed);

    if (this.pressedOnce(gamepad.buttons, 0)) this.handlers.onStart();
    if (this.pressedOnce(gamepad.buttons, 1)) this.handlers.onKick();
    if (this.pressedOnce(gamepad.buttons, 2)) this.handlers.onFullscreen();
    if (this.pressedOnce(gamepad.buttons, 3)) this.handlers.onMute();
    if (this.pressedOnce(gamepad.buttons, 9)) this.handlers.onPause();

    this.previousGamepadButtons = gamepad.buttons.map((button) =>
      Boolean(button.pressed)
    );
  }
}