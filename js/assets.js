import { ASSET_CANDIDATES } from "./config.js";

export class AssetLoader {
  constructor(ui) {
    this.ui = ui;
    this.assets = {};
    this.loaded = 0;
    this.total = Object.keys(ASSET_CANDIDATES).length;
  }

  async loadAll() {
    await Promise.all(
      Object.entries(ASSET_CANDIDATES).map(([name, paths]) =>
        this.loadImageFromCandidates(name, paths)
      )
    );
    return this.assets;
  }

  loadImageFromCandidates(name, paths) {
    return new Promise((resolve) => {
      let index = 0;

      const tryNext = () => {
        if (index >= paths.length) {
          console.warn(`Missing asset: ${name}`, paths);
          this.assets[name] = null;
          this.loaded += 1;
          this.updateProgress();
          resolve();
          return;
        }

        const image = new Image();
        const path = paths[index++];

        image.onload = () => {
          this.assets[name] = image;
          this.loaded += 1;
          this.updateProgress();
          resolve();
        };

        image.onerror = tryNext;
        image.src = path;
      };

      tryNext();
    });
  }

  updateProgress() {
    const progress = Math.round((this.loaded / this.total) * 100);
    this.ui.loadingFill.style.width = `${progress}%`;
    this.ui.loadingText.textContent = `Loading ${this.loaded}/${this.total}`;
  }
}