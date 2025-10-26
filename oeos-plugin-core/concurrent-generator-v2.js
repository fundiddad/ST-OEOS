/**
 * OEOS并发生成器 V2
 *
 * 与V1的区别：
 * - V1使用quiet模式，不保存到聊天记录
 * - V2手动添加消息到聊天历史，保存并显示在UI中
 *
 * 特性：
 * - ✅ 保存到聊天记录
 * - ✅ 显示在聊天界面
 * - ✅ 支持并发（10个槽位）
 * - ✅ 不触发ST的发送按钮状态
 */

import { getContext } from '../../../../scripts/extensions.js';
import { chat, saveChat, characters, this_chid, eventSource, event_types, getRequestHeaders, substituteParams, addOneMessage } from '../../../../script.js';
import { getEventSourceStream } from '../../../sse-stream.js';
import { chat_completion_sources, oai_settings, getStreamingReply } from '../../../openai.js';
import { power_user } from '../../../../scripts/power-user.js';



/**
 * 并发生成器类 V2
 */
export class ConcurrentGeneratorV2 {
    constructor() {
        this.sessions = new Map(); // 存储10个槽位的会话
        this.buildRequestLock = Promise.resolve(); // 互斥锁，确保 buildAPIRequest 串行执行
    }

    /**
     * 规范化槽位ID
     * @param {string|number} id - 槽位ID (1-10 或 'xb1'-'xb10')
     * @returns {string} 规范化的槽位ID ('xb1'-'xb10')
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
                error: null,
                userMessageIndex: -1,  // 用户消息在chat数组中的索引
                aiMessageIndex: -1     // AI消息在chat数组中的索引
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
     * 添加用户消息到聊天历史
     * @param {string} prompt - 用户消息内容
     * @returns {number} 消息在chat数组中的索引
     */
    addUserMessage(prompt) {
        const context = getContext();
        const char = characters[this_chid];

        const userMessage = {
            name: context.name1 || 'You',
            is_user: true,
            is_system: false,
            send_date: Date.now(),
            mes: prompt,
            extra: {}
        };

        chat.push(userMessage);
        const messageIndex = chat.length - 1;

        console.log(`[OEOS-ConcurrentV2] 添加用户消息 #${messageIndex}:`, prompt);

        return messageIndex;
    }

    /**
     * 添加AI消息到聊天历史（初始为空）
     * @returns {number} 消息在chat数组中的索引
     */
    addAIMessage() {
        const context = getContext();
        const char = characters[this_chid];

        const aiMessage = {
            name: char?.name || 'Assistant',
            is_user: false,
            is_system: false,
            send_date: Date.now(),
            mes: '',  // 初始为空，流式生成时更新
            extra: {},
            swipe_id: 0,
            swipes: [''],
            swipe_info: [{}]
        };

        chat.push(aiMessage);
        const messageIndex = chat.length - 1;

        console.log(`[OEOS-ConcurrentV2] 添加AI消息槽位 #${messageIndex}`);

        return messageIndex;
    }

    /**
     * 更新AI消息内容
     * @param {number} messageIndex - 消息索引
     * @param {string} text - 新的文本内容
     */
    updateAIMessage(messageIndex, text) {
        if (messageIndex >= 0 && messageIndex < chat.length) {
            chat[messageIndex].mes = text;
            chat[messageIndex].swipes[0] = text;
            chat[messageIndex].send_date = Date.now();
        }
    }

    /**
     * 刷新聊天UI
     */
    async refreshChatUI() {
        // 触发聊天更新事件
        await eventSource.emit(event_types.MESSAGE_RECEIVED, chat.length - 1);

        // 滚动到底部
        const chatBlock = document.getElementById('chat');
        if (chatBlock) {
            chatBlock.scrollTop = chatBlock.scrollHeight;
        }
    }

    /**
     * 保存聊天记录
     */
    async saveChatHistory() {
        try {
            await saveChat();
            console.log('[OEOS-ConcurrentV2] 聊天记录已保存');
        } catch (error) {
            console.error('[OEOS-ConcurrentV2] 保存聊天记录失败:', error);
        }
    }

    /**
     * 构建API请求数据（使用LittleWhiteBox的方式：dryRun=true + 手动构建配置）
     * @param {number} userMessageIndex - 用户消息在chat数组中的索引
     * @returns {Promise<object>} API请求数据
     */
    async buildAPIRequest(userMessageIndex) {
        // 🔒 使用互斥锁确保同一时间只有一个任务在执行此方法
        // 这样可以避免多个并发任务同时操作 chat 数组导致的竞态条件
        const previousLock = this.buildRequestLock;
        let releaseLock;
        this.buildRequestLock = new Promise(resolve => {
            releaseLock = resolve;
        });

        try {
            // 等待前一个任务完成
            await previousLock;
            return await this._buildAPIRequestInternal(userMessageIndex);
        } finally {
            // 释放锁，让下一个任务继续
            releaseLock();
        }
    }

    /**
     * 内部方法：实际执行API请求构建
     * @param {number} userMessageIndex - 用户消息在chat数组中的索引
     * @returns {Promise<object>} API请求数据
     */
    async _buildAPIRequestInternal(userMessageIndex) {
        const context = getContext();
        let capturedData = null;

        // 临时移除在userMessageIndex之后添加的所有消息
        // 这样context.generate()会读取到正确的lastUserMessage
        const removedMessages = [];
        if (userMessageIndex < chat.length - 1) {
            removedMessages.push(...chat.splice(userMessageIndex + 1));
        }

        // 监听GENERATE_AFTER_DATA事件获取消息数组
        const dataListener = (data) => {
            capturedData = (data && typeof data === 'object' && Array.isArray(data.prompt))
                ? { ...data, prompt: data.prompt.slice() }
                : (Array.isArray(data) ? data.slice() : data);
        };

        eventSource.on(event_types.GENERATE_AFTER_DATA, dataListener);

        try {
            // ✅ 使用dryRun=true获取消息数组（不触发UI状态）
            // ⚠️ 不传入quiet_prompt，让ST从chat数组中读取最后一条消息
            // 这样{{lastUserMessage}}宏会被正确替换为我们刚添加的用户消息
            await context.generate('normal', {
                quietToLoud: false,
                skipWIAN: false, // 包含World Info
                force_name2: true
            }, true); // ✅ dryRun=true - 不触发UI状态
        } finally {
            eventSource.removeListener(event_types.GENERATE_AFTER_DATA, dataListener);

            // 恢复被移除的消息
            if (removedMessages.length > 0) {
                chat.push(...removedMessages);
            }
        }

        if (!capturedData) {
            throw new Error('未能捕获消息数据');
        }

        // 提取消息数组
        const messages = Array.isArray(capturedData.prompt) ? capturedData.prompt :
                        (Array.isArray(capturedData) ? capturedData : []);

        if (!messages.length) {
            throw new Error('消息数组为空');
        }

        // 手动构建完整的API请求体（参考LittleWhiteBox的实现）
        const requestBody = this._buildRequestBody(messages, capturedData);

        return requestBody;
    }

    /**
     * 构建stop参数（从power_user.custom_stopping_strings读取）
     * @param {object} capturedData - 捕获的数据
     * @returns {Array|undefined} stop字符串数组或undefined
     */
    _buildStopStrings(capturedData) {
        // 优先使用capturedData中的stop参数（如果存在且有效）
        if (capturedData?.stop && Array.isArray(capturedData.stop) && capturedData.stop.length > 0) {
            return capturedData.stop;
        }

        // 从power_user.custom_stopping_strings读取
        try {
            // 如果没有自定义停止字符串，返回undefined
            if (!power_user.custom_stopping_strings) {
                return undefined;
            }

            // 解析JSON字符串
            let strings = JSON.parse(power_user.custom_stopping_strings);

            // 确保是数组
            if (!Array.isArray(strings)) {
                return undefined;
            }

            // 过滤掉非字符串和空字符串
            strings = strings.filter(s => typeof s === 'string' && s.length > 0);

            // 如果启用了宏替换，则替换参数
            if (power_user.custom_stopping_strings_macro) {
                strings = strings.map(x => substituteParams(x));
            }

            return strings.length > 0 ? strings : undefined;
        } catch (error) {
            console.warn('[OEOS-ConcurrentV2] 解析custom_stopping_strings失败:', error);
            return undefined;
        }
    }


    /**
     * 手动构建完整的API请求体（参考LittleWhiteBox的实现）
     * @param {Array} messages - 消息数组
     * @param {object} capturedData - 捕获的数据
     * @returns {object} 完整的API请求体
     */
    _buildRequestBody(messages, capturedData) {
        // 获取当前的API源和模型
        const chat_completion_source = oai_settings.chat_completion_source;

        // 根据不同的API源选择模型
        let model;
        switch (chat_completion_source) {
            case chat_completion_sources.OPENAI:
                model = oai_settings.openai_model;
                break;
            case chat_completion_sources.CLAUDE:
                model = oai_settings.claude_model;
                break;
            case chat_completion_sources.MAKERSUITE:
                model = oai_settings.google_model;
                break;
            case chat_completion_sources.COHERE:
                model = oai_settings.cohere_model;
                break;
            case chat_completion_sources.DEEPSEEK:
                model = oai_settings.deepseek_model;
                break;
            case chat_completion_sources.CUSTOM:
                model = oai_settings.custom_model;
                break;
            default:
                model = oai_settings.openai_model || 'gpt-4';
        }

        // 辅助函数：安全地转换为数字
        const num = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : undefined;
        };

        // 读取所有参数（参考LittleWhiteBox的实现）
        const temperature = num(oai_settings.temp_openai ?? oai_settings.temperature);
        const presence_penalty = num(oai_settings.pres_pen_openai ?? oai_settings.presence_penalty);
        const frequency_penalty = num(oai_settings.freq_pen_openai ?? oai_settings.frequency_penalty);

        // 根据API源选择top_p和max_tokens
        let top_p, max_tokens, top_k;

        if (chat_completion_source === chat_completion_sources.MAKERSUITE) {
            // Gemini/Google
            top_p = num(oai_settings.makersuite_top_p ?? oai_settings.top_p_openai ?? oai_settings.top_p);
            top_k = num(oai_settings.makersuite_top_k ?? oai_settings.top_k_openai ?? oai_settings.top_k);
            max_tokens = num(oai_settings.makersuite_max_tokens ??
                           oai_settings.max_output_tokens ??
                           oai_settings.openai_max_tokens ??
                           oai_settings.max_tokens) ?? 1024;
        } else {
            // OpenAI, Claude, etc.
            top_p = num(oai_settings.top_p_openai ?? oai_settings.top_p);
            max_tokens = num(oai_settings.openai_max_tokens ?? oai_settings.max_tokens) ?? 1024;
        }

        // 构建基础请求体
        const body = {
            messages,
            model,
            stream: oai_settings.stream_openai ?? true,
            chat_completion_source,
            temperature,
            presence_penalty,
            frequency_penalty,
            top_p,
            max_tokens,
            stop: this._buildStopStrings(capturedData),
        };

        // Gemini特殊处理
        if (chat_completion_source === chat_completion_sources.MAKERSUITE) {
            if (top_k !== undefined) {
                body.top_k = top_k;
            }
            body.max_output_tokens = max_tokens;
        }

        // 反向代理配置（检查是否有值）
        const reverseProxy = String(oai_settings.reverse_proxy || '').trim();
        if (reverseProxy) {
            body.reverse_proxy = reverseProxy.replace(/\/?$/, '');
        }

        const proxyPassword = String(oai_settings.proxy_password || '').trim();
        if (proxyPassword) {
            body.proxy_password = proxyPassword;
        }

        // Custom API特殊处理
        if (chat_completion_source === chat_completion_sources.CUSTOM) {
            const customUrl = String(oai_settings.custom_url || '').trim();
            if (customUrl) {
                body.custom_url = customUrl;
            }

            if (oai_settings.custom_include_headers) {
                body.custom_include_headers = oai_settings.custom_include_headers;
            }
            if (oai_settings.custom_include_body) {
                body.custom_include_body = oai_settings.custom_include_body;
            }
            if (oai_settings.custom_exclude_body) {
                body.custom_exclude_body = oai_settings.custom_exclude_body;
            }
        }

        return body;
    }

    /**
     * 调用API生成（流式）
     * @param {object} requestData - API请求数据
     * @param {AbortSignal} abortSignal - 中止信号
     * @returns {AsyncGenerator<string>} 生成的文本流
     */
    async* callAPI(requestData, abortSignal) {
        console.groupCollapsed('[OEOS-ConcurrentV2] 发送API请求:', {
            url: '/api/backends/chat-completions/generate',
            method: 'POST',
            model: requestData.model,
            messages: requestData.messages?.length,
            stream: requestData.stream,
            temperature: requestData.temperature,
            max_tokens: requestData.max_tokens,
            chat_completion_source: requestData.chat_completion_source
        });
        console.log('完整请求体:', JSON.stringify(requestData, null, 2));
        console.groupEnd();

        const response = await fetch('/api/backends/chat-completions/generate', {
            method: 'POST',
            body: JSON.stringify(requestData),
            headers: getRequestHeaders(),
            signal: abortSignal,
        });

        console.log('[OEOS-ConcurrentV2] API响应状态:', response.status, response.statusText);

        if (!response.ok) {
            // 尝试读取错误响应体
            let errorBody = '';
            try {
                errorBody = await response.text();
                console.error('[OEOS-ConcurrentV2] API错误响应体:', errorBody);
            } catch (e) {
                console.error('[OEOS-ConcurrentV2] 无法读取错误响应体:', e);
            }
            throw new Error(`API请求失败: ${response.status} ${response.statusText}\n${errorBody}`);
        }

        // 使用ST的SSE流处理器（参考LittleWhiteBox的实现）
        const eventStream = getEventSourceStream();
        response.body.pipeThrough(eventStream);
        const reader = eventStream.readable.getReader();

        // 用于存储推理内容和图片（某些API如Claude可能返回）
        const state = { reasoning: '', image: '' };
        let fullText = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done || !value?.data || value.data === '[DONE]') {
                    break;
                }

                try {
                    const parsed = JSON.parse(value.data);

                    // 使用ST的getStreamingReply来正确解析不同API源的响应
                    const chunk = getStreamingReply(parsed, state, {
                        chatCompletionSource: requestData.chat_completion_source
                    });

                    if (typeof chunk === 'string' && chunk) {
                        fullText += chunk;
                        yield fullText;
                    }
                } catch (e) {
                    console.warn('[OEOS-ConcurrentV2] 解析SSE数据失败:', e, value.data);
                }
            }
        } catch (err) {
            // 忽略AbortError
            if (err?.name !== 'AbortError') {
                throw err;
            }
        } finally {
            try {
                reader.releaseLock();
            } catch (e) {
                // 忽略释放锁的错误
            }
        }

        console.log('[OEOS-ConcurrentV2] 流式生成完成，总长度:', fullText.length);
        return fullText;
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

        console.log(`[OEOS-ConcurrentV2] 开始生成页面: ${pageId} (槽位: ${sessionId})`);

        // 创建会话
        const session = this._ensureSession(sessionId, prompt);
        session.isStreaming = true;
        session.isCompleted = false;
        session.error = null;
        session.abortController = new AbortController();

        try {
            // 1. 添加用户消息到聊天历史
            session.userMessageIndex = this.addUserMessage(prompt);

            // 2. 添加AI消息槽位
            session.aiMessageIndex = this.addAIMessage();

            // 3. 构建API请求（传入用户消息索引，确保读取正确的用户消息）
            const requestData = await this.buildAPIRequest(session.userMessageIndex);

            // 4. 调用API生成
            const generator = this.callAPI(requestData, session.abortController.signal);

            // 5. 处理流式响应（不实时更新UI，只累积文本）
            for await (const text of generator) {
                session.text = text;
                // 不实时更新UI，只更新内存中的文本
            }

            // 6. 生成完成后，更新AI消息内容
            this.updateAIMessage(session.aiMessageIndex, session.text);

            // 7. 渲染消息到UI
            // 渲染用户消息
            addOneMessage(chat[session.userMessageIndex], {
                forceId: session.userMessageIndex,
                scroll: false
            });
            // 渲染AI消息
            addOneMessage(chat[session.aiMessageIndex], {
                forceId: session.aiMessageIndex,
                scroll: true
            });

            // 8. 标记完成
            session.isStreaming = false;
            session.isCompleted = true;

            // 9. 保存聊天记录
            await this.saveChatHistory();

            // 10. 触发AI回复完成事件，让OEOS的AI回复监听器处理这条消息
            // 这样页面内容会被提取并保存到World Info
            await eventSource.emit('chat_completion_stream_finish');

            console.log(`[OEOS-ConcurrentV2] 页面 ${pageId} 生成完成，长度: ${session.text.length}`);

            return session.text;
        } catch (error) {
            session.isStreaming = false;
            session.error = error;
            console.error(`[OEOS-ConcurrentV2] 页面 ${pageId} 生成失败:`, error);
            throw error;
        }
    }

    /**
     * 取消生成
     * @param {string|number} slotId - 槽位ID
     */
    cancelGeneration(slotId) {
        const sessionId = this._getSlotId(slotId);
        const session = this.sessions.get(sessionId);
        if (session?.abortController) {
            session.abortController.abort();
            session.isStreaming = false;
            console.log(`[OEOS-ConcurrentV2] 已取消槽位 ${sessionId} 的生成`);
        }
    }

    /**
     * 获取会话状态
     * @param {string|number} slotId - 槽位ID
     * @returns {object|null} 会话状态
     */
    getSessionStatus(slotId) {
        const sessionId = this._getSlotId(slotId);
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        return {
            id: session.id,
            isStreaming: session.isStreaming,
            isCompleted: session.isCompleted,
            textLength: session.text.length,
            error: session.error,
            prompt: session.prompt
        };
    }
}

// 单例实例
let instance = null;

/**
 * 获取并发生成器实例
 * @returns {ConcurrentGeneratorV2}
 */
export function getConcurrentGeneratorV2() {
    if (!instance) {
        instance = new ConcurrentGeneratorV2();
    }
    return instance;
}

