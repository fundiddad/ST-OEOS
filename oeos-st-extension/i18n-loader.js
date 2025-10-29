/**
 * OEOS i18n 加载器
 * 从插件的 locales 目录加载翻译文件，并使用 SillyTavern 的 addLocaleData 函数注册
 */

import { addLocaleData, getCurrentLocale } from '../../../../scripts/i18n.js';

/**
 * 加载并注册 OEOS 插件的翻译数据
 */
export async function loadOEOSTranslations() {
    try {
        const currentLocale = getCurrentLocale();
        console.log(`[OEOS i18n] Current locale: ${currentLocale}`);

        // 如果是英语，不需要加载翻译（使用默认文本）
        if (currentLocale === 'en') {
            console.log('[OEOS i18n] English locale detected, using default text');
            return;
        }

        // 构建翻译文件的URL（相对于插件目录）
        const localeUrl = `/scripts/extensions/third-party/oeos-st-extension/locales/${currentLocale}.json`;

        console.log(`[OEOS i18n] Loading translations from: ${localeUrl}`);

        // 加载翻译文件
        const response = await fetch(localeUrl);
        if (!response.ok) {
            console.warn(`[OEOS i18n] Translation file not found for locale: ${currentLocale}`);
            return;
        }

        const translations = await response.json();
        console.log(`[OEOS i18n] Loaded ${Object.keys(translations).length} translations`);

        // 注册翻译数据到 SillyTavern 的 i18n 系统
        addLocaleData(currentLocale, translations);
        console.log('[OEOS i18n] Translations registered successfully');

    } catch (error) {
        console.error('[OEOS i18n] Failed to load translations:', error);
    }
}

