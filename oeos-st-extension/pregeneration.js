// src/oeos-st-extension/pregeneration.js
// 预生成系统核心模块

import { getManager } from './plugin-bridge.js';
import { getConcurrentGeneratorV2 } from './concurrent-generator-v2.js';

/**
 * 预生成系统类
 */
export class PregenerationSystem {
    constructor(worldInfoName) {
        this.worldInfoName = worldInfoName;
        this.isGenerating = false;
        this.lastPageId = null;
        this.generationQueue = [];
        this.usedSlots = new Set();
        this.pageChangeHandler = null;
    }

    /**
     * 启动预生成系统
     */
    start() {
        console.log('[OEOS-Pregen] 预生成系统已启动');
        this.startPageChangeMonitor();
    }

    /**
     * 监听页面变更（使用事件监听，不使用轮询）
     */
    startPageChangeMonitor() {
        // 创建事件处理函数
        this.pageChangeHandler = async (event) => {
            try {
                const { pageId } = event.detail || {};

                if (pageId && pageId !== this.lastPageId) {
                    console.log(`[OEOS-Pregen] 页面变更: ${this.lastPageId} -> ${pageId}`);
                    this.lastPageId = pageId;
                    await this.triggerPregeneration(pageId);
                }
            } catch (error) {
                console.error('[OEOS-Pregen] 页面监听错误:', error);
            }
        };

        // 监听自定义事件
        window.addEventListener('oeos:pageChange', this.pageChangeHandler);
        console.log('[OEOS-Pregen] 已注册页面变更事件监听器');
    }

    /**
     * 停止监听页面变更
     */
    stop() {
        if (this.pageChangeHandler) {
            window.removeEventListener('oeos:pageChange', this.pageChangeHandler);
            this.pageChangeHandler = null;
            console.log('[OEOS-Pregen] 已移除页面变更事件监听器');
        }
    }

    /**
     * 触发预生成流程
     */
    async triggerPregeneration(currentPageId) {
        if (this.isGenerating) {
            console.log('[OEOS-Pregen] 已有预生成任务在运行，跳过');
            return;
        }

        this.isGenerating = true;
        try {
            console.log(`[OEOS-Pregen] 开始预生成，当前页面: ${currentPageId}`);
            
            // 第一层预生成
            await this.pregenerateLayer1(currentPageId);
            
            // 第二层预生成
            await this.pregenerateLayer2(currentPageId);
            
            console.log('[OEOS-Pregen] 预生成完成');
        } catch (error) {
            console.error('[OEOS-Pregen] 预生成失败:', error);
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * 第一层预生成
     */
    async pregenerateLayer1(currentPageId) {
        const mgr = getManager(this.worldInfoName);
        // 不需要重新加载，直接读取已有数据

        const children = mgr.graph.get(currentPageId) || [];
        const existingPages = new Set(mgr.pages.keys());
        const missing = children.filter(id => !existingPages.has(id));
        
        if (missing.length === 0) {
            console.log('[OEOS-Pregen] 第一层页面已全部存在');
            return;
        }
        
        console.log(`[OEOS-Pregen] 第一层缺失页面: ${missing.join(', ')}`);
        await this.generatePages(currentPageId, missing);
    }

    /**
     * 第二层预生成
     */
    async pregenerateLayer2(currentPageId) {
        const mgr = getManager(this.worldInfoName);
        // 不需要重新加载，直接读取已有数据

        const firstLayerPages = mgr.graph.get(currentPageId) || [];
        const existingPages = new Set(mgr.pages.keys());
        
        for (const parentId of firstLayerPages) {
            const children = mgr.graph.get(parentId) || [];
            const missing = children.filter(id => !existingPages.has(id));
            
            if (missing.length > 0) {
                console.log(`[OEOS-Pregen] 第二层缺失页面 (父节点: ${parentId}): ${missing.join(', ')}`);
                await this.generatePages(parentId, missing);
            }
        }
    }

    /**
     * 并发生成页面
     */
    async generatePages(parentPageId, childPageIds) {
        const tasks = [];
        const sessionIds = [];
        
        for (let i = 0; i < childPageIds.length && i < 10; i++) {
            const childId = childPageIds[i];
            const slotId = this.allocateSlot();
            
            console.log(`[OEOS-Pregen] 生成页面: ${childId} (槽位: ${slotId})`);
            
            const task = this.executeGeneration(slotId, childId);
            tasks.push(task);
            sessionIds.push(`xb${slotId}`);
        }
        
        // 等待所有生成任务完成
        await Promise.all(tasks);
        
        // 释放槽位
        sessionIds.forEach(id => {
            const slotNum = parseInt(id.replace('xb', ''));
            this.usedSlots.delete(slotNum);
        });
        
        // 等待数据更新
        await this.waitForDataUpdate();
    }

    /**
     * 执行单个生成任务
     */
    async executeGeneration(slotId, pageId) {
        try {
            const generator = getConcurrentGeneratorV2();

            // 使用V2并发生成器（保存到聊天记录并显示在UI）
            const text = await generator.generatePage(slotId, pageId);

            console.log(`[OEOS-Pregen] 页面 ${pageId} 生成完成，长度: ${text.length}`);
            return text;
        } catch (error) {
            console.error(`[OEOS-Pregen] 页面 ${pageId} 生成失败:`, error);
            throw error;
        }
    }

    /**
     * 等待数据更新
     */
    async waitForDataUpdate() {
        // 由于 concurrent-generator-v2 已经在生成完成后立即更新内存缓存
        // 这里只需要短暂等待，确保所有异步操作完成
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    /**
     * 分配槽位
     */
    allocateSlot() {
        for (let i = 1; i <= 10; i++) {
            if (!this.usedSlots.has(i)) {
                this.usedSlots.add(i);
                return i;
            }
        }
        // 如果所有槽位都被占用，返回1（覆盖）
        return 1;
    }
}

// 全局实例管理
const instances = new Map();

/**
 * 获取或创建预生成系统实例
 */
export function getPregenerationSystem(worldInfoName) {
    if (!instances.has(worldInfoName)) {
        instances.set(worldInfoName, new PregenerationSystem(worldInfoName));
    }
    return instances.get(worldInfoName);
}

