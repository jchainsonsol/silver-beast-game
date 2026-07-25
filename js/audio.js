import { AUDIO_CANDIDATES } from "./config.js";

export class AudioManager {
  constructor(ui) {
    this.ui = ui;
    this.music = new Audio();
    this.music.loop = true;
    this.music.volume = 0.45;
    this.muted = false;
    this.setFirstWorkingSource(AUDIO_CANDIDATES);
  }

  setFirstWorkingSource(paths, index = 0) {
    if (index >= paths.length) return;
    this.music.src = paths[index];
    this.music.addEventListener(
      "error",
      () => this.setFirstWorkingSource(paths, index + 1),
      { once: true }
    );
  }

  play() {
    this.music.play().catch(() => {});
  }

  toggleMute() {
    this.muted = !this.muted;
    this.music.muted = this.muted;
    this.ui.muteButton.textContent = this.muted ? "🔇" : "🔊";
    this.ui.menuMute.textContent = this.muted ? "🔇 MUTED" : "🔊 SOUND";
  }
}