/**
 * settings.js — Preferencias de la aplicación (tema, tipografía, animaciones).
 * Persistidas en el store 'settings' de IndexedDB y aplicadas al <body>.
 */

import DB from '../database/db.js';

const DEFAULTS = {
  theme: 'default', // default | amoled | sepia | paper | cyber
  fontSize: 'md', // sm | md | lg
  animations: true,
  readingFont: 'inter',
};

export const Settings = {
  current: { ...DEFAULTS },

  async load() {
    const stored = await DB.getSetting('preferences', null);
    this.current = { ...DEFAULTS, ...(stored || {}) };
    this.apply();
    return this.current;
  },

  async save() {
    await DB.setSetting('preferences', this.current);
  },

  async set(key, value) {
    this.current[key] = value;
    this.apply();
    await this.save();
  },

  apply() {
    const body = document.body;
    body.classList.remove('theme-amoled', 'theme-sepia', 'theme-paper', 'theme-cyber');
    if (this.current.theme !== 'default') {
      body.classList.add('theme-' + this.current.theme);
    }
    body.classList.toggle('no-animations', !this.current.animations);
    body.dataset.fontSize = this.current.fontSize;
  },
};

window.Settings = Settings;
export default Settings;
