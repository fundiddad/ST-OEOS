// ElementDataManager: single source of truth for OEOS game data
// Provides: data structure, generation from chat/WI, updates, recompute, debounce sync, diffed sync to WI & Preset

import { loadWi, saveWi, getPresetByName, savePresetDirect } from './st-api.js';

// Helpers: regex extractors reused locally
const PAGES_BLOCK_RE = /<Pages>([\s\S]*?)<\/Pages>/gi;
const SUMMARY_BLOCK_RE = /<summary>([\s\S]*?)<\/summary>/gi;
const PAGE_SPLIT_RE = />\s*(\w+)\s*\r?\n([\s\S]*?)(?=(?:\r?\n>\s*\w+\s*\r?\n)|\s*$)/g;
const GOTO_RE = /(?:->)?\s*goto\s+(\w+)/g;

// Preset identifiers mapping
const PRESET_NAME = '小猫之神-oeos';
const PRESET_TAGS = {
    Graph: { identifier: '492188e4-a606-41ae-94ea-d8977c9151b5' },
    State: { identifier: '817f9ecc-ebad-42d5-a551-6c316caa1224' },
    'Dynamic-Context': { identifier: '2e971b31-51f2-4e32-8bbf-0248d5641f33' },
    summary: { identifier: 'cd7528e9-3f8a-4f89-9605-9925a9ec2c76' },
};


export class ElementDataManager {
    constructor(worldInfoName) {
        this.worldInfoName = worldInfoName;
        // Data model
        this.pages = new Map(); // pageId -> content
        this.summary = new Map(); // pageId -> abstract
        this.graph = new Map(); // pageId -> [childIds]
        this.state = '> start()'; // default on init if WI empty
        this.dynamicContext = '';

        // sync control
        this._dirty = false;
        this._timer = null;
        this._debounceMs = 500;
    }

    // ----- Extractors from chat -----
    static extractPagesFromChat(chatArray) {
        const result = [];
        for (const msg of chatArray || []) {
            if (!msg?.mes) continue;
            let block;
            while ((block = PAGES_BLOCK_RE.exec(msg.mes)) !== null) {
                const blockContent = block[1].trim();
                let m;
                while ((m = PAGE_SPLIT_RE.exec(blockContent)) !== null) {
                    result.push({ pageId: m[1].trim(), content: m[2].trim() });
                }
            }
        }
        return result; // [{pageId, content}]
    }

    static extractSummariesFromChat(chatArray) {
        const result = [];
        for (const msg of chatArray || []) {
            if (!msg?.mes) continue;
            let block;
            while ((block = SUMMARY_BLOCK_RE.exec(msg.mes)) !== null) {
                const lines = block[1].trim().split(/\r?\n/);
                for (const line of lines) {
                    const m = line.trim().match(/^(\w+)\s*:\s*(.+?)(?:;)?$/);
                    if (m) result.push({ pageId: m[1].trim(), abstract: m[2].trim() });
                }
            }
        }
        return result; // [{pageId, abstract}]
    }

    // ----- Build / Update -----
    async loadFromWiAndChat(chatArray) {
        const wi = await loadWi(this.worldInfoName);
        const entries = wi?.entries || {};
        const byComment = (name) => Object.values(entries).find(e => e.comment === name);
        const pagesEntry = byComment('Pages');
        const stateEntry = byComment('State');
        const graphEntry = byComment('Graph');
        const summaryEntry = byComment('summary');
        const dynEntry = byComment('Dynamic-Context');

        // Deserialize existing WI content
        if (pagesEntry?.content) this._deserializePages(pagesEntry.content);
        if (summaryEntry?.content) this._deserializeSummary(summaryEntry.content);
        this.state = (stateEntry?.content?.trim()) || '> start()';
        if (graphEntry?.content) this._deserializeGraph(graphEntry.content);
        if (dynEntry?.content) this.dynamicContext = dynEntry.content;

        // Enrich from chat
        const pagesFromChat = ElementDataManager.extractPagesFromChat(chatArray);
        const sumFromChat = ElementDataManager.extractSummariesFromChat(chatArray);
        let changed = false;
        for (const { pageId, content } of pagesFromChat) {
            const prev = this.pages.get(pageId);
            if (prev !== content) { this.pages.set(pageId, content); changed = true; }
        }
        for (const { pageId, abstract } of sumFromChat) {
            const prev = this.summary.get(pageId);
            if (prev !== abstract) { this.summary.set(pageId, abstract); changed = true; }
        }
        if (changed) {
            this.recomputeGraph();
            this.recomputeDynamicContext();
            this._dirty = true;
        }
    }

    updatePage(pageId, content, abstract) {
        let changed = false;
        if (typeof content === 'string') {
            const prev = this.pages.get(pageId);
            if (prev !== content) { this.pages.set(pageId, content); changed = true; }
        }
        if (typeof abstract === 'string') {
            const prevA = this.summary.get(pageId);
            if (prevA !== abstract) { this.summary.set(pageId, abstract); changed = true; }
        }
        if (changed) {
            this.recomputeGraph();
            this.recomputeDynamicContext();
            this.markDirty();
        }
    }

    updateState(pageId, variables = {}) {
        // append a state segment like " > pageId(k:v,...)"
        const varStr = Object.keys(variables).length
            ? Object.entries(variables).map(([k, v]) => `${k}:${v}`).join(',')
            : '';
        const newSeg = ` > ${pageId}(${varStr})`;
        const trimmed = (this.state || '').trim();
        let last = '';
        const matches = trimmed.match(/>\s*\w+\s*\([^)]*\)/g) || [];
        if (matches.length) last = matches[matches.length - 1].trim();
        if (last !== newSeg.trim()) {
            this.state = (trimmed + newSeg).trimStart();
            this.recomputeDynamicContext();
            this.markDirty();
        }
    }

    recomputeGraph() {
        // build graph from all pages
        const g = new Map();
        for (const [pid, content] of this.pages.entries()) {
            const targets = new Set();
            let m;
            while ((m = GOTO_RE.exec(content)) !== null) targets.add(m[1]);
            if (targets.size) g.set(pid, Array.from(targets));
        }
        this.graph = g;
    }

    recomputeDynamicContext() {
        const path = this._parseStatePath(this.state);
        if (path.length === 0) { this.dynamicContext = ''; return; }
        const current = path[path.length - 1];
        const future = this.graph.get(current) || [];
        const history = path.slice(-5);
        const all = new Set([...future, ...history]);
        // include children of historical nodes
        for (const h of history) {
            const kids = this.graph.get(h) || [];
            for (const k of kids) all.add(k);
        }
        let block = '';
        for (const id of all) {
            const content = this._extractPageSource(id);
            if (content) block += content + '\n\n';
        }
        this.dynamicContext = block.trim();
    }

    // ----- Debounce sync -----
    markDirty() { this._dirty = true; }

    scheduleSync(callback, delayMs = this._debounceMs) {
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(async () => {
            if (this._dirty) {
                try { await callback?.(); } finally { this._dirty = false; }
            }
        }, delayMs);
    }

    // ----- Sync to WI + Preset with diff (best-effort atomic) -----
    async syncAll() {
        // Load originals
        const wiOriginal = await loadWi(this.worldInfoName) || { entries: {} };
        const wiWorking = JSON.parse(JSON.stringify(wiOriginal)); // mutable clone
        const entries = wiWorking.entries;
        const getByComment = (name) => Object.values(entries).find(e => e.comment === name);
        const ensure = (name, key) => {
            let e = getByComment(name);
            if (!e) {
                const uid = Date.now() + Math.floor(Math.random() * 1000);
                e = entries[uid] = { uid, comment: name, key: [key], content: '', disable: true };
            }
            return e;
        };

        const pagesEntry = ensure('Pages', 'pages');
        const stateEntry = ensure('State', 'state');
        const graphEntry = ensure('Graph', 'graph');
        const summaryEntry = ensure('summary', 'summary');
        const dynEntry = ensure('Dynamic-Context', 'dynamic-context');

        const serializedPages = this._serializePages();
        const serializedState = this.state || '> start()';
        const serializedGraph = this._serializeGraph();
        const serializedSummary = this._serializeSummary();
        const serializedDyn = this.dynamicContext || '';

        const wiDiffs = [];
        const applyIfChanged = (entry, newText, label) => {
            const old = String(entry.content || '');
            const newVal = String(newText ?? '');
            if (newVal === '' && old !== '') return; // protect against accidental empty overwrite
            if (old !== newVal) { entry.content = newVal; wiDiffs.push(label); }
        };

        applyIfChanged(pagesEntry, serializedPages, 'WI.Pages');
        applyIfChanged(stateEntry, serializedState, 'WI.State');
        applyIfChanged(graphEntry, serializedGraph, 'WI.Graph');
        applyIfChanged(summaryEntry, serializedSummary, 'WI.summary');
        applyIfChanged(dynEntry, serializedDyn, 'WI.Dynamic-Context');

        // Prepare preset updated snapshot (do not mutate original until commit)
        const presetOriginal = getPresetByName(PRESET_NAME);
        let presetWorking = null;
        let presetDiffs = [];
        if (presetOriginal && Array.isArray(presetOriginal.prompts)) {
            presetWorking = JSON.parse(JSON.stringify(presetOriginal));
            const setTag = (tagName, content) => {
                const id = PRESET_TAGS[tagName]?.identifier;
                if (!id) return;
                const prompt = presetWorking.prompts.find(p => p.identifier === id);
                if (!prompt) return;

                // 直接将序列化数据赋值给 content，不再使用 XML 标签
                if (prompt.content !== content) {
                    prompt.content = content;
                    presetDiffs.push(tagName);
                }
            };
            setTag('Graph', serializedGraph);
            setTag('State', serializedState);
            setTag('Dynamic-Context', serializedDyn);
            setTag('summary', serializedSummary);
        }

        // Nothing to do
        if (!wiDiffs.length && (!presetDiffs.length)) {
            console.info('[OEOS] Sync skipped (no changes)');
            return { wiChanged: [], presetChanged: [] };
        }

        // Commit with rollback (best-effort atomicity)
        let wiCommitted = false;
        try {
            if (wiDiffs.length && presetDiffs.length) {
                // Both sides changed: commit WI then Preset, rollback WI if Preset fails
                await saveWi(this.worldInfoName, wiWorking);
                wiCommitted = true;
                await savePresetDirect(PRESET_NAME, presetWorking);
            } else if (wiDiffs.length) {
                await saveWi(this.worldInfoName, wiWorking);
                wiCommitted = true;
            } else if (presetDiffs.length) {
                await savePresetDirect(PRESET_NAME, presetWorking);
            }
        } catch (e) {
            // If preset failed after WI commit, attempt rollback WI
            if (wiCommitted && wiDiffs.length && presetDiffs.length) {
                try {
                    await saveWi(this.worldInfoName, wiOriginal);
                    console.warn('[OEOS] Preset save failed; WI rolled back successfully.');
                } catch (rollbackErr) {
                    console.error('[OEOS] Preset save failed and WI rollback failed. Manual intervention required.');
                }
            }
            console.error('[OEOS] Sync failed:', e);
            throw e;
        }

        console.info('[OEOS] Sync complete. Changed:', { wi: wiDiffs, preset: presetDiffs });
        return { wiChanged: wiDiffs, presetChanged: presetDiffs };
    }

    // ----- Internal (serialize/deserialize) -----
    _serializePages() {
        // Join as "> id\ncontent\n\n"
        let out = '';
        for (const [id, content] of this.pages.entries()) {
            const header = content.startsWith(`> ${id}`) ? '' : `> ${id}\n`;
            out += `${header}${content.replace(/^>\s*\w+\s*\r?\n/i, '')}\n\n`;
        }
        return out.trim() + (out ? '\n' : '');
    }
    _serializeGraph() {
        let out = '';
        for (const [id, children] of this.graph.entries()) {
            out += `${id} > ${children.join(', ')};\n`;
        }
        return out.trim();
    }
    _serializeSummary() {
        let out = '';
        for (const [id, abs] of this.summary.entries()) {
            out += `${id}: ${abs};\n`;
        }
        return out.trim();
    }

    _deserializePages(text) {
        this.pages.clear();
        const content = String(text || '');
        // find each page by header
        const pageHeaderRe = />\s*(\w+)\s*\r?\n([\s\S]*?)(?=(?:\r?\n>\s*\w+\s*\r?\n)|\s*$)/g;
        let m;
        while ((m = pageHeaderRe.exec(content)) !== null) {
            const id = m[1].trim();
            const body = m[2].trim();
            this.pages.set(id, `> ${id}\n${body}`);
        }
    }

    _deserializeSummary(text) {
        this.summary.clear();
        const lines = String(text || '').split(/\r?\n/);
        for (const line of lines) {
            const m = line.trim().match(/^(\w+)\s*:\s*(.+?);?$/);
            if (m) this.summary.set(m[1].trim(), m[2].trim());
        }
    }

    _deserializeGraph(text) {
        this.graph.clear();
        const entries = String(text || '').split(';').filter(Boolean);
        for (const e of entries) {
            const [parent, kidsStr] = e.split('>').map(s => s.trim());
            if (!parent || !kidsStr) continue;
            const kids = kidsStr.split(',').map(s => s.trim()).filter(Boolean);
            if (kids.length) this.graph.set(parent, kids);
        }
    }

    _extractPageSource(pageId) {
        const content = this.pages.get(pageId);
        if (!content) return null;
        if (/^>\s*\w+/.test(content)) return content;
        return `> ${pageId}\n${content}`;
    }

    _parseStatePath(stateString) {
        if (!stateString) return [];
        const matches = stateString.match(/(\w+)\s*\(/g) || [];
        return matches.map(x => x.replace('(', '').trim());
    }
}

