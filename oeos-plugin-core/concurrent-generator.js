// src/oeos-plugin-core/concurrent-generator.js
// 简化版并发生成系统 - 不依赖LittleWhiteBox

import { getRequestHeaders, eventSource, event_types } from '../../../../script.js';
import { getStreamingReply, chat_completion_sources, oai_settings } from '../../../openai.js';
import { getEventSourceStream } from '../../../sse-stream.js';
import { getContext } from '../../../st-context.js';

/**
 * 并发生成器类
 * 实现独立的并发生成功能，直接调用后端API，绕过SillyTavern的全局锁
 */
export class ConcurrentGenerator {
    constructor() {
        this.sessions = new Map(); // 存储10个槽位的会话
        this.activeCount = 0;
    }

    /**
     * 获取槽位ID
     * @param {number|string} id - 槽位ID (1-10)
     * @returns {string} 格式化的槽位ID (xb1-xb10)
     */
    _getSlotId(id) {
        if (!id) return 'xb1';
        const m = String(id).match(/^xb(\d+)$/i);
        if (m && +m[1] >= 1 && +m[1] <= 10) return `xb${m[1]}`;
        const n = parseInt(id, 10);
        return (!isNaN(n) && n >= 1 && n <= 10) ? `xb${n}` : 'xb1';
    }

    /**
     * 确保会话存在
     * @param {string} slotId - 槽位ID
     * @param {string} prompt - 提示词
     * @returns {object} 会话对象
     */
    _ensureSession(slotId, prompt) {
        if (!this.sessions.has(slotId)) {
            if (this.sessions.size >= 10) {
                this._cleanupOldestSessions();
            }
            this.sessions.set(slotId, {
                id: slotId,
                text: '',
                isStreaming: false,
                isCompleted: false,
                prompt: prompt || '',
                updatedAt: Date.now(),
                abortController: null,
                error: null
            });
        }
        return this.sessions.get(slotId);
    }

    /**
     * 清理最旧的会话
     */
    _cleanupOldestSessions() {
        const sorted = [...this.sessions.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
        sorted.slice(0, Math.max(0, sorted.length - 9)).forEach(([sid, s]) => {
            try {
                s.abortController?.abort();
            } catch {}
            this.sessions.delete(sid);
        });
    }

    /**
     * 更新会话文本
     * @param {string} text - 生成的文本
     * @param {string} sessionId - 会话ID
     */
    updateSessionText(text, sessionId) {
        const s = this.sessions.get(sessionId);
        if (s) {
            s.text = String(text || '');
            s.updatedAt = Date.now();
        }
    }

    /**
     * 获取会话状态
     * @param {string} sessionId - 会话ID
     * @returns {object} 会话状态
     */
    getStatus(sessionId) {
        const s = this.sessions.get(sessionId);
        if (s) {
            return {
                isStreaming: !!s.isStreaming,
                isCompleted: !!s.isCompleted,
                text: s.text,
                sessionId: sessionId,
                error: s.error
            };
        }
        return {
            isStreaming: false,
            isCompleted: false,
            text: '',
            sessionId: sessionId,
            error: null
        };
    }

    /**
     * 构建完整的生成配置（使用ST的Generate函数，完全使用用户设置）
     * @param {string} prompt - 提示词
     * @returns {Promise<object>} 完整的generate_data对象
     */
    async buildGenerateData(prompt) {
        const context = getContext();
        let capturedGenerateData = null;
        let abortController = new AbortController();

        // 监听CHAT_COMPLETION_SETTINGS_READY事件捕获ST构建的完整请求配置
        const settingsListener = (data) => {
            capturedGenerateData = data ? { ...data } : null;
            // 立即中止这次生成，我们只需要配置
            abortController.abort();
        };

        eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, settingsListener);

        try {
            // 使用dryRun=false调用Generate，让ST构建完整的请求配置
            // 这样会使用所有用户设置：API配置、模型、预设、World Info、扩展提示词等
            await context.generate('quiet', {
                quiet_prompt: prompt, // 只改变用户输入
                quietToLoud: false,
                skipWIAN: false, // 包含World Info
                force_name2: true,
                signal: abortController.signal
            }, false); // dryRun=false，让ST走完整流程
        } catch (error) {
            // 忽略中止错误
            if (error.name !== 'AbortError') {
                console.warn('[ConcurrentGen] 构建配置时出错:', error);
            }
        } finally {
            eventSource.removeListener(event_types.CHAT_COMPLETION_SETTINGS_READY, settingsListener);
        }

        if (!capturedGenerateData) {
            throw new Error('未能捕获ST的生成配置');
        }

        return capturedGenerateData;
    }

    /**
     * 直接调用后端API进行生成（使用ST构建的完整配置）
     * @param {object} generateData - ST构建的完整generate_data对象
     * @param {AbortSignal} abortSignal - 中止信号
     * @returns {AsyncGenerator<string>} 流式生成的文本
     */
    async* callAPI(generateData, abortSignal) {
        // 直接使用ST构建的完整配置，不做任何修改
        const body = { ...generateData };
        const source = body.chat_completion_source;

        // 打印完整的请求内容（折叠显示，类似ST后台）
        console.groupCollapsed(
            `%c[OEOS-Concurrent] 📤 发送API请求`,
            'color: #4CAF50; font-weight: bold;'
        );
        console.log('完整请求体:', {
            messages: body.messages,
            prompt: body.prompt,
            model: body.model,
            temperature: body.temperature,
            max_tokens: body.max_tokens,
            max_completion_tokens: body.max_completion_tokens,
            stream: body.stream,
            presence_penalty: body.presence_penalty,
            frequency_penalty: body.frequency_penalty,
            top_p: body.top_p,
            top_k: body.top_k,
            stop: body.stop,
            logit_bias: body.logit_bias,
            seed: body.seed,
            n: body.n,
            logprobs: body.logprobs,
            top_logprobs: body.top_logprobs,
        });
        console.log('API配置:', {
            chat_completion_source: body.chat_completion_source,
            reverse_proxy: body.reverse_proxy ? '***已配置***' : undefined,
            proxy_password: body.proxy_password ? '***已配置***' : undefined,
            custom_url: body.custom_url,
        });
        console.groupEnd();

        // 直接调用后端API
        const response = await fetch('/api/backends/chat-completions/generate', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: getRequestHeaders(),
            signal: abortSignal,
        });

        if (!response.ok) {
            const txt = await response.text().catch(() => '');
            throw new Error(txt || `后端响应错误: ${response.status}`);
        }

        // 处理流式响应
        const eventStream = getEventSourceStream();
        response.body.pipeThrough(eventStream);
        const reader = eventStream.readable.getReader();
        const state = { reasoning: '', image: '' };
        let text = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done || !value?.data || value.data === '[DONE]') {
                    return;
                }

                let parsed;
                try {
                    parsed = JSON.parse(value.data);
                } catch {
                    continue;
                }

                const chunk = getStreamingReply(parsed, state, { chatCompletionSource: source });
                if (typeof chunk === 'string' && chunk) {
                    text += chunk;
                    yield text;
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                throw err;
            }
        } finally {
            try {
                reader.releaseLock();
            } catch {}
        }
    }

    /**
     * 生成单个页面
     * @param {number} slotId - 槽位ID (1-10)
     * @param {string} pageId - 页面ID
     * @returns {Promise<string>} 生成的文本
     */
    async generatePage(slotId, pageId) {
        const sessionId = this._getSlotId(slotId);
        const prompt = `${pageId}`;

        console.log(`[ConcurrentGen] 开始生成页面: ${pageId} (槽位: ${sessionId})`);

        // 创建会话
        const session = this._ensureSession(sessionId, prompt);
        session.isStreaming = true;
        session.isCompleted = false;
        session.error = null;
        session.abortController = new AbortController();

        try {
            // 1. 构建完整的生成配置（使用ST的完整流程）
            console.groupCollapsed(
                `%c[OEOS-Concurrent] 🔨 构建生成配置: ${pageId}`,
                'color: #2196F3; font-weight: bold;'
            );
            console.log('提示词:', prompt);
            console.log('槽位:', sessionId);
            console.groupEnd();

            const generateData = await this.buildGenerateData(prompt);

            console.groupCollapsed(
                `%c[OEOS-Concurrent] ✅ 生成配置构建完成: ${pageId}`,
                'color: #4CAF50; font-weight: bold;'
            );
            console.log('模型:', generateData.model);
            console.log('消息数量:', generateData.messages?.length);
            console.log('流式:', generateData.stream);
            console.log('停止词:', generateData.stop);
            console.log('完整配置:', generateData);
            console.groupEnd();

            // 2. 调用API生成
            const generator = this.callAPI(generateData, session.abortController.signal);

            // 3. 处理流式响应
            for await (const text of generator) {
                this.updateSessionText(text, sessionId);
            }

            // 4. 标记完成
            session.isStreaming = false;
            session.isCompleted = true;

            console.groupCollapsed(
                `%c[OEOS-Concurrent] 🎉 生成完成: ${pageId}`,
                'color: #4CAF50; font-weight: bold;'
            );
            console.log('槽位:', sessionId);
            console.log('文本长度:', session.text.length);
            console.log('生成内容:', session.text);
            console.groupEnd();

            return session.text;
        } catch (error) {
            session.isStreaming = false;
            session.isCompleted = true;
            session.error = error.message;
            console.error(`[ConcurrentGen] 页面 ${pageId} 生成失败:`, error);
            throw error;
        }
    }

    /**
     * 等待会话完成
     * @param {string} sessionId - 会话ID
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<string>} 生成的文本
     */
    async waitForCompletion(sessionId, timeout = 60000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                const status = this.getStatus(sessionId);

                if (status.isCompleted) {
                    clearInterval(checkInterval);
                    if (status.error) {
                        reject(new Error(status.error));
                    } else {
                        resolve(status.text);
                    }
                    return;
                }

                // 超时检查
                if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error(`生成超时: ${sessionId}`));
                }
            }, 200);
        });
    }

    /**
     * 取消生成
     * @param {string} sessionId - 会话ID
     */
    cancel(sessionId) {
        const s = this.sessions.get(sessionId);
        if (s?.abortController) {
            s.abortController.abort();
        }
    }

    /**
     * 清理所有会话
     */
    cleanup() {
        this.sessions.forEach(s => s.abortController?.abort());
        this.sessions.clear();
        this.activeCount = 0;
    }
}

// 全局实例
const globalGenerator = new ConcurrentGenerator();

/**
 * 获取全局并发生成器实例
 * @returns {ConcurrentGenerator}
 */
export function getConcurrentGenerator() {
    return globalGenerator;
}

