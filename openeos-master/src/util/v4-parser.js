class OEOSV4Parser {
  static toV1(v4Script) {
    console.log('[V4 Parser] ========== 开始解析 V4 脚本 ==========');
    console.log(`[V4 Parser] 脚本长度: ${v4Script.length} 字符`);
    console.log(`[V4 Parser] 脚本前 300 字符:\n${v4Script.substring(0, 300)}`);

    const lines = v4Script.split('\n')
    console.log(`[V4 Parser] 总行数: ${lines.length}`);

    const v1Data = { pages: {} }
    const contextStack = []

    for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
      const line = lines[lineNum - 1]
      if (
        !line.trim() ||
        (line.trim().startsWith('#') && !line.startsWith('#'))
      ) {
        continue
      }

      const indentSize = line.length - line.lstrip(' ').length
      const lineContent = line.trim()

      if (lineNum <= 10) {
        console.log(`[V4 Parser] 行 ${lineNum}: 缩进=${indentSize}, 内容="${lineContent.substring(0, 50)}${lineContent.length > 50 ? '...' : ''}"`);
      }

      // 处理页面分隔符 ---
      if (lineContent === '---' || lineContent.startsWith('---')) {
        // 遇到 --- 时，清空上下文栈，结束当前页面
        contextStack.length = 0
        continue
      }

      while (
        contextStack.length > 0 &&
        indentSize <= contextStack[contextStack.length - 1].indent
      ) {
        contextStack.pop()
      }

      if (lineContent.startsWith('>') || lineContent.startsWith('#')) {
        const pageId = lineContent.substring(1).trim()
        console.log(`[V4 Parser] 发现页面声明: "${pageId}" (行 ${lineNum})`);
        const pageCommands = []
        v1Data.pages[pageId] = pageCommands
        contextStack.length = 0
        contextStack.push({ list: pageCommands, indent: -1, context: 'page' })
        continue
      }

      if (contextStack.length === 0) {
        if (lineContent) {
          throw new Error(
            `Line ${lineNum}: Found command '${lineContent}' outside of a page declaration.`
          )
        }
        continue
      }

      const { list, context: parentContext } = contextStack[
        contextStack.length - 1
      ]

      try {
        if (parentContext === 'notification.create') {
          if (['commands', 'timerCommands'].includes(lineContent)) {
            const newList = []
            list[lineContent] = newList // list is the notification dict
            contextStack.push({
              list: newList,
              indent: indentSize,
              context: 'commands',
            })
            continue
          }
        }

        if (parentContext === 'choice') {
          const { commandObj, blockInfo } = this.parseV4Option(lineContent)
          list.push(commandObj)
          if (blockInfo.new_block) {
            contextStack.push({
              list: commandObj.commands,
              indent: indentSize,
              context: 'commands',
            })
          }
          continue
        }

        if (parentContext === 'eval') {
          list.action += (list.action ? '\n' : '') + lineContent
          continue
        }

        const { commandObj, blockInfo } = this.parseV4Line(lineContent)
        const cmdName = Object.keys(commandObj)[0]

        if (cmdName === 'if') {
          const isElse = blockInfo.is_else
          if (isElse) {
            let lastIfStruct = list[list.length - 1]
            if (!lastIfStruct || !lastIfStruct.if) {
              throw new Error(
                `Line ${lineNum}: 'else' or 'else if' has no matching 'if'.`
              )
            }
            while (
              lastIfStruct.if.elseCommands &&
              lastIfStruct.if.elseCommands.length > 0
            ) {
              const nextIf = lastIfStruct.if.elseCommands[0]
              if (!nextIf.if) break
              lastIfStruct = nextIf
            }
            lastIfStruct.if.elseCommands = commandObj.if.condition
              ? [commandObj]
              : commandObj.if.commands
          } else {
            list.push(commandObj)
          }
        } else {
          list.push(commandObj)
        }

        if (blockInfo.new_block) {
          contextStack.push({
            list: commandObj[cmdName].commands,
            indent: indentSize,
            context: 'commands',
          })
        } else if (blockInfo.new_options_block) {
          contextStack.push({
            list: commandObj[cmdName].options,
            indent: indentSize,
            context: 'choice',
          })
        } else if (blockInfo.new_notif_block) {
          contextStack.push({
            list: commandObj[cmdName],
            indent: indentSize,
            context: 'notification.create',
          })
        } else if (blockInfo.is_multiline_eval) {
          contextStack.push({
            list: commandObj[cmdName],
            indent: indentSize,
            context: 'eval',
          })
        }
      } catch (e) {
        console.error(`[V4 Parser] ❌ 解析错误 (行 ${lineNum}): "${lineContent}"`);
        console.error(`[V4 Parser] 错误详情:`, e);
        throw new Error(
          `Error parsing line ${lineNum}: '${lineContent}' -> ${e.message}`
        )
      }
    }

    console.log(`[V4 Parser] ✓ 解析完成，共 ${Object.keys(v1Data.pages).length} 个页面`);
    console.log(`[V4 Parser] 页面列表:`, Object.keys(v1Data.pages));

    this.cleanup(v1Data)

    console.log('[V4 Parser] ✓ 清理完成');
    console.log('[V4 Parser] 最终结果:', v1Data);
    console.log('[V4 Parser] ========== V4 脚本解析完成 ==========');

    return v1Data
  }

  static parseV4Line(line) {
    const parts = line.split(/ (.*)/s)
    let cmdName = parts[0]
    let argsStr = parts[1] || ''
    const params = {}
    const blockInfo = {}

    const shortcutCommands = {
      say: 'label',
      image: 'url',
      'audio.play': 'url',
      goto: 'target',
      'storage.remove': 'key',
      enable: 'target',
      disable: 'target',
      'notification.remove': 'id',
      'timer.remove': 'id',
    }

    if (shortcutCommands[cmdName]) {
      const match = argsStr.match(/^("(?:[^"\\]|\\.)*?"|\S+)\s*(.*)$/s)
      if (match) {
        const value = match[1]
        argsStr = match[2]
        params[shortcutCommands[cmdName]] = this.parseV1Value(value)
      }
    }

    const namedArgs = [
      ...argsStr.matchAll(/(\w+):\s*("(?:[^"\\]|\\.)*?"|true|false|-?\d+\.?\d*|\$\S+)/g),
    ]
    for (const match of namedArgs) {
      params[match[1]] = this.parseV1Value(match[2])
    }

    if (cmdName === 'if' || (cmdName === 'else' && argsStr.startsWith('if'))) {
      params.condition = argsStr.replace('if', '').trim()
      params.commands = []
      blockInfo.new_block = true
      if (cmdName === 'else') blockInfo.is_else = true
      cmdName = 'if'
    } else if (cmdName === 'else') {
      params.commands = []
      blockInfo.new_block = true
      blockInfo.is_else = true
      cmdName = 'if'
    } else if (cmdName === 'choice') {
      params.options = []
      blockInfo.new_options_block = true
    } else if (cmdName === 'notification.create') {
      blockInfo.new_notif_block = true
    } else if (cmdName === 'timer') {
      params.commands = []
      blockInfo.new_block = true
    } else if (cmdName === 'eval' && !params.code) {
      params.action = ''
      blockInfo.is_multiline_eval = true
    } else if (cmdName === 'eval' && params.code) {
      params.action = params.code
      delete params.code
    }

    return { commandObj: { [cmdName]: params }, blockInfo }
  }

  static parseV4Option(line) {
    const commands = []
    const blockInfo = {}
    let argsStr = ''

    if (line.includes('->')) {
      const parts = line.split('->', 2)
      line = parts[0].trim()
      const cmdParts = parts[1].trim().split(/ (.*)/s)
      if (cmdParts[0] === 'end') commands.push({ end: {} })
      else if (cmdParts[0] === 'goto')
        commands.push({ goto: { target: this.parseV1Value(cmdParts[1]) } })
      else
        throw new Error(
          `Shortcut '->' only supports 'end' and 'goto', but got '${cmdParts[0]}'`
        )
    } else {
      blockInfo.new_block = true
    }

    const match = line.match(/^("(?:[^"\\]|\\.)*?")\s*(.*)$/s)
    if (!match) throw new Error(`Could not parse option line: ${line}`)
    const labelStr = match[1]
    argsStr = match[2]
    const option = { label: this.parseV1Value(labelStr), commands: commands }

    const namedArgs = [
      ...argsStr.matchAll(
        /(when|color|keep):\s*("(?:[^"\\]|\\.)*?"|true|false|-?\d+\.?\d*|\$\S+)/g
      ),
    ]
    for (const match of namedArgs) {
      const key = match[1]
      const value = match[2]
      if (key === 'when') option.visible = value
      else option[key] = this.parseV1Value(value)
    }

    return { commandObj: option, blockInfo }
  }

  static parseV1Value(valueStr) {
    valueStr = valueStr.trim()
    if (valueStr.startsWith('"') && valueStr.endsWith('"'))
      return JSON.parse(valueStr)
    if (valueStr === 'true') return true
    if (valueStr === 'false') return false
    if (valueStr.startsWith('$')) return valueStr
    const num = Number(valueStr)
    return isNaN(num) ? valueStr : num
  }

  static cleanup(obj) {
    if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        obj.forEach(item => this.cleanup(item))
      } else {
        Object.entries(obj).forEach(([key, value]) => {
          if (
            key === 'timer' &&
            value &&
            value.commands &&
            value.commands.length === 0
          ) {
            delete value.commands
          }
          if (key === 'action' && typeof value === 'string') {
            obj[key] = value.trim()
          }
          this.cleanup(value)
        })
      }
    }
  }
}

String.prototype.lstrip = function(chars) {
  let start = 0
  while (start < this.length && chars.includes(this[start])) {
    start++
  }
  return this.substring(start)
}

export default OEOSV4Parser
