/**
 * OEOS全局设置管理模块
 * 用于管理图片、音频等全局开关设置
 * 支持localStorage持久化
 */

const STORAGE_KEY = 'oeos_global_settings';

// 默认设置
const DEFAULT_SETTINGS = {
  enableImages: true,
  enableAudio: true,
};

// 内存中的设置缓存
let settingsCache = null;

/**
 * 初始化设置（从localStorage加载）
 */
export function initializeSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      settingsCache = JSON.parse(stored);
    } else {
      settingsCache = { ...DEFAULT_SETTINGS };
      saveSettings();
    }
  } catch (e) {
    console.error('[OEOS Settings] Failed to load settings:', e);
    settingsCache = { ...DEFAULT_SETTINGS };
  }
  return settingsCache;
}

/**
 * 获取所有设置
 */
export function getSettings() {
  if (!settingsCache) {
    initializeSettings();
  }
  return { ...settingsCache };
}

/**
 * 获取单个设置值
 * @param {string} key - 设置键名
 * @returns {*} 设置值
 */
export function getSetting(key) {
  if (!settingsCache) {
    initializeSettings();
  }
  return settingsCache[key];
}

/**
 * 设置单个值
 * @param {string} key - 设置键名
 * @param {*} value - 设置值
 */
export function setSetting(key, value) {
  if (!settingsCache) {
    initializeSettings();
  }
  settingsCache[key] = value;
  saveSettings();
}

/**
 * 批量设置
 * @param {Object} updates - 要更新的设置对象
 */
export function updateSettings(updates) {
  if (!settingsCache) {
    initializeSettings();
  }
  Object.assign(settingsCache, updates);
  saveSettings();
}

/**
 * 保存设置到localStorage
 */
function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsCache));
    console.log('[OEOS Settings] Settings saved:', settingsCache);
  } catch (e) {
    console.error('[OEOS Settings] Failed to save settings:', e);
  }
}

/**
 * 重置为默认设置
 */
export function resetSettings() {
  settingsCache = { ...DEFAULT_SETTINGS };
  saveSettings();
  return settingsCache;
}

/**
 * 检查图片是否启用
 */
export function isImagesEnabled() {
  return getSetting('enableImages') !== false;
}

/**
 * 检查音频是否启用
 */
export function isAudioEnabled() {
  return getSetting('enableAudio') !== false;
}

/**
 * 启用/禁用图片
 */
export function setImagesEnabled(enabled) {
  setSetting('enableImages', enabled);
}

/**
 * 启用/禁用音频
 */
export function setAudioEnabled(enabled) {
  setSetting('enableAudio', enabled);
}

