/**
 * settings.js — Preferencias de la aplicación (tema y tamaño de fuente de la interfaz).
 * Persistidas en el store 'settings' de IndexedDB y aplicadas al <html>/<body>.
 */

import DB from '../database/db.js';

export const FONT_SCALE_MIN = 80;
export const FONT_SCALE_MAX = 160;
export const FONT_SCALE_STEP = 5;

const DEFAULTS = {
  theme: 'default', // default | amoled | sepia | paper | cyber
  fontScale: 100, // % — escala todo el texto de la interfaz (usa unidades rem)
  language: 'es', // es | en | fr | pt
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
    // Todas las --fs-* de tokens.css están en rem, así que escalar el tamaño
    // de fuente raíz reescala proporcionalmente toda la tipografía de la app.
    document.documentElement.style.fontSize = `${this.current.fontScale}%`;
    document.documentElement.lang = this.current.language || 'es';
  },
};

window.Settings = Settings;
export default Settings;
