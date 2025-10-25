/**
 * Convert EOS Page object into javascript
 * (Runs in JS-Interpreter, not native JS)
 */
import pageCompilerUtil from '!!raw-loader!../interpreter/code/pageCompilerUtil.js'
import { decodeHTML } from 'entities'
import extractStyles from './extractStyles'
import normalizeCommand from './commandAdapter'
const includeMatcher = /(\/\/|\/\*)[\s]*-*oeos-js-include/

const parser = new DOMParser()

let images = {}
let sounds = []
let videos = []
let targets = {}
let styles = {}
let includes = []

export default function pageCompiler(page) {
  images = {}
  sounds = []
  videos = []
  targets = {}
  styles = {}
  includes = []
  return {
    script: `
    if (!pages._getNavQueued()) (function(continueFns){
      ${pageCompilerUtil}
      /* Compiled Page */
      _doCommandFns(${compileCommandsToArray(page)}, continueFns, []);
    })([])
    `,
    images,
    sounds,
    videos,
    targets,
    styles,
    includes,
  }
}

function compileCommandsToArray(commands) {
  if (!commands) return '[]'
  const script = []
  commands = commands.slice()
  for (let i = 0; i < commands.length; i++) {
    const nextIsPromptVal = commands[i + 1]
      ? `_nextIsPrompt = ${JSON.stringify(nextIsPrompt(commands, i))};`
      : ''
    const command = compileCommand(commands[i], i, commands)
    if (typeof command === 'string' && command !== '') {
      script.push(`function(continueFns){${nextIsPromptVal} ${command}}`)
    }
  }
  return `[${script.join(`,`)}]`
}

function compileCommand(command, index, commands) {
  command = normalizeCommand(command)
  // console.log('Compiling command', command, index, commands)
  const commandType = Object.keys(command)[0]
  const cfn = commandList[commandType]
  if (!cfn) {
    throw new TypeError('Unknown command: ' + commandType)
  }
  return cfn(command[commandType], index, commands)
}

const interactiveCommands = { choice: true, prompt: true, timer: true }

function nextIsPrompt(cl, i) {
  const nextCommand = cl[i + 1] || { none: {} }
  const nextCommandType = Object.keys(nextCommand)[0]
  const nextCommandObj = nextCommand[nextCommandType]
  return interactiveCommands[nextCommandType] && !nextCommandObj.isAsync
}

const commandList = {
  noop: () => 'return false;',
  if: (c, i, cl) => {
    return `
    var nextCmdFns = ${compileCommandsToArray(cl.splice(i + 1))};
    if (${wrap(c.condition, false, 'If Action Condition')}) {
      _doCommandFns(${compileCommandsToArray(
        c.commands
      )}, nextCmdFns, continueFns);
    } else {
      _doCommandFns(${compileCommandsToArray(
        c.elseCommands
      )}, nextCmdFns, continueFns);
    }
    return true;
    `
  },
  eval: c => {
    const style = extractStyles(c.action)
    Object.assign(styles, style.styles)
    if (c.action && c.action.match(includeMatcher)) {
      includes.push(c.action)
      return `return false;`
    }
    return `
    ${isolate(c.action, 'Eval Action')}
    return false;
    `
  },
  say: (c, i, cl) => {
    return `
    var peekNext = {
      isPrompt: _nextIsPrompt,
    };
    var nextCmdFns = ${compileCommandsToArray(cl.splice(i + 1))};
    new Say({
      label: ${parseHtmlToJS(c.label)},
      mode: ${JSON.stringify(c.mode)},
      nextCommand: peekNext,
      duration: ${buildExpression(c.duration, 'Say duration expression')},
      skip: ${JSON.stringify(c.skip)},
      align: ${JSON.stringify(c.align)},
      onContinue: function() {
        _doCommandFns(nextCmdFns, continueFns, []);
      }
    })
    return true;
    `
  },
  timer: (c, i, cl) => {
    const isAsync = !!c.isAsync || (c.commands && c.commands.length)
    let loops = 1
    if (isAsync && c.commands && c.commands.length) {
      const nextCommand = c.commands[0] || { none: {} }
      const nextCommandType = Object.keys(nextCommand)[0]
      const nextCommandObj = nextCommand[nextCommandType]
      if (nextCommandType === 'eval') {
        const loopMatch = (nextCommandObj.script || '').match(
          /(\/\/|\/\*)[^\r\n]*oeos-timer-loops-([0-9]+)/
        )
        if (loopMatch) {
          loops = parseInt(loopMatch[2], 10)
        } else {
          const loopMatchExp = (nextCommandObj.script || '').match(
            /(\/\/|\/\*)[^\r\n]*oeos-timer-loops-<eval>(.*)<\/eval>/
          )
          if (loopMatchExp) {
            loops = '$' + loopMatchExp[2]
          }
        }
      }
    }
    return `${
      isAsync
        ? ``
        : `
    var nextCmdFns = ${compileCommandsToArray(cl.splice(i + 1))};
    `
    }
    new Timer({
      duration: ${buildExpression(c.duration, 'Timer duration expression')},
      loops: ${buildExpression(loops, 'Timer loops expression')},
      style: ${JSON.stringify(c.style)},
      isAsync: ${JSON.stringify(isAsync)},
      id: ${JSON.stringify(c.id)},
      onTimeout: ${
        isAsync
          ? `function() {
        _doCommandFns(${compileCommandsToArray(c.commands)}, [], []);
      }`
          : `null`
      },
      onContinue: ${
        isAsync
          ? `null`
          : `function() {
        _doCommandFns(nextCmdFns, continueFns, []);
      }`
      }
    })
    return ${!isAsync};
    `
  },
  image: c => {
    images[c.url || c.url] = false
    return `
    pages.setImage(${buildExpression(
      c.url || c.url,
      'Image locator expression'
    )});
    return false;
    `
  },
  choice: (c, i, cl) => {
    return `
    var nextCmdFns = ${compileCommandsToArray(cl.splice(i + 1))};
    new Choice({
      options: [${buildChoiceOptions(c.options)}],
      onContinue: function() {
        _doCommandFns(nextCmdFns, continueFns, []);
      }
    })
    return true;
    `
  },
  prompt: (c, i, cl) => {
    let v = c.var || '__lastPromptVal'
    return `
    var nextCmdFns = ${compileCommandsToArray(cl.splice(i + 1))};
    new Prompt({
      onInput: function (inputValue) {
        if (!_isComplete()) {
          _globalEval(${JSON.stringify(v)} + ' = ' + JSON.stringify(inputValue))
          _doCommandFns(nextCmdFns, continueFns, []);
        }
      }
    })
    return true;
    `
  },
  'audio.play': (c, i, cl) => {
    if (c.locator && c.locator.match(/^(file:).*\+\(\|(oeos-video):(.+)\)$/)) {
      // We're a video command masked in an audio command
      return commandList['video.play'](c, i, cl)
    }
    c.locator = c.url
    sounds.push(c)
    return `
    new Sound({
      locator: ${JSON.stringify(c.url)},
      id: ${JSON.stringify(c.id)},
      loops: ${JSON.stringify(c.loops)},
      volume: ${JSON.stringify(c.volume)},
      background: ${JSON.stringify(c.background)}
    }, true)
    return false;
    `
  },
  'video.play': (c, i, cl) => {
    const isAsync = !!c.background
    videos.push(c)
    return `${
      isAsync
        ? ``
        : `
    var nextCmdFns = ${compileCommandsToArray(cl.splice(i + 1))};
    `
    }
    new Video({
      locator: ${JSON.stringify(c.locator)},
      id: ${JSON.stringify(c.id)},
      loops: ${JSON.stringify(c.loops)},
      volume: ${JSON.stringify(c.volume)},
      background: ${JSON.stringify(c.background)},
      onContinue: ${
        isAsync
          ? `null`
          : `function() {
        _doCommandFns(nextCmdFns, continueFns, []);}`
      }
    }, true)
    return false;
    `
  },
  'notification.create': c => {
    return `
    new Notification({
      label: ${parseHtmlToJS(c.label)},
      id: ${JSON.stringify(c.id)},
      duration: ${buildExpression(c.duration, 'Notification timer expression')},
      button: ${parseHtmlToJS(c.button)},
      onClick: function () {
        _navId = pages._getNavId(); // Allow execution on any page
        _doCommandFns(${compileCommandsToArray(c.commands)}, [], []);
      },
      onTimeout: function () {
        _navId = pages._getNavId(); // Allow execution on any page
        _doCommandFns(${compileCommandsToArray(c.timerCommands)}, [], []);
      }
    });
    return false;
    `
  },
  'notification.remove': c => {
    return `
    var notification = Notification.get(${JSON.stringify(c.id)});
    if (notification) {
      notification.remove();
    }
    return false;
    `
  },
  'timer.remove': c => {
    return `
    var timer = Timer.get(${JSON.stringify(c.id)});
    if (timer) {
      timer.remove();
    }
    return false;
    `
  },
  goto: c => {
    targets[c.target] = true
    return `
    pages.goto(${buildExpression(c.target, 'Page goto expression')});
    return false;
    `
  },
  enable: c => {
    return `
    pages.enable(${buildExpression(c.target, 'Page enable expression')});
    return false;
    `
  },
  disable: c => {
    return `
    pages.disable(${buildExpression(c.target, 'Page disable expression')});
    return false;
    `
  },
  end: () => {
    return `
    pages.end();
    return false;
    `
  },
  'storage.set': c => {
    return `
    Storage.set(${buildExpression(
      c.key,
      'Storage key expression'
    )}, ${buildExpression(c.value, 'Storage value expression')});
    return false;
    `
  },
  'storage.remove': c => {
    return `
    Storage.remove(${buildExpression(c.key, 'Storage key expression')});
    return false;
    `
  },
  'storage.clear': () => {
    return `
    Storage.clear();
    return false;
    `
  },
  'nyx.page': (c, i, cl) => {
    const commands = []
    if (c.media) {
      commands.push({
        image: {
          locator: c.media['nyx.image'],
        },
      })
    }
    if (c.text) {
      commands.push({
        say: {
          label: c.text,
          mode: 'instant',
        },
      })
    }
    const hidden = c.hidden
    if (hidden) {
      commands.push(hidden)
    }
    const action = c.action
    if (action) {
      const timer = action['nyx.timer']
      if (timer) {
        timer.push({
          timer: {
            ...timer,
          },
        })
      }
      const buttons = action['nyx.buttons']
      if (buttons) {
        commands.push({
          choice: {
            options: buttons,
          },
        })
      }
    }
    return `
    `
  },
}

function buildChoiceOptions(options) {
  return (options || [])
    .reduce((a, o) => {
      a.push(buildChoiceOption(o))
      return a
    }, [])
    .join(',')
}

function buildChoiceOption(o) {
  const hasVisible = 'visible' in o
  return `{
    label: ${parseHtmlToJS(o.label)},
    ${
      hasVisible
        ? `visible: ${buildExpression(o.visible, 'Choice visible expression')},`
        : ``
    }
    color: ${buildExpression(o.color, 'Choice color expression')},
    onSelect: function () {
      _doCommandFns(${compileCommandsToArray(
        o.commands
      )}, nextCmdFns, continueFns)
    }
  }`
}

function wrap(script, onerror, type) {
  return `
  (function() {try {return _globalEval(${JSON.stringify(script)})}
    catch (e) {console.error(
      e.stack,
      ${JSON.stringify('\nIn ' + (type || 'Script EVAL') + ':\n')},
      ${JSON.stringify(script)}
      );return ${onerror || ''}}
  })()`
}

function isolate(script, type) {
  return `
  try {_globalEval(${JSON.stringify(script)})}
    catch (e) {console.error(
      e.stack,
      ${JSON.stringify('\n\nIn ' + (type || 'Script EVAL') + ':\n')},
      ${JSON.stringify(script)}
      )}`
}

const expressionRegexp = /^\$/

function buildExpression(exp, type) {
  if (typeof exp !== 'string' || !exp || !exp.match(expressionRegexp)) {
    return JSON.stringify(exp)
  }
  return wrap(exp.replace(expressionRegexp, ''), false, type)
}

// Convert HTML string to in-line javascript string expression
// Replace ...<eval>expression</eval>... with "..." + (isolated eval expression) + "..."
// (Further xss filtering comes at run time/render with markupFilter)
function parseHtmlToJS(string) {
  if (typeof string !== 'string') return JSON.stringify('')

  // 检查字符串是否包含 HTML 标签或 <eval> 标签
  // 如果不包含，直接返回 JSON.stringify(string)，避免 DOMParser 对特殊字符的处理
  const hasHtmlTags = /<[^>]+>/.test(string)
  if (!hasHtmlTags) {
    return JSON.stringify(string)
  }

  const result = []
  const doc = parser
    .parseFromString(string, 'text/html')
    .getElementsByTagName('body')[0]
  const evs = doc.getElementsByTagName('eval')
  let docstring = doc.innerHTML
  for (const ev of evs) {
    const evHtml = ev.outerHTML
    const i = docstring.indexOf(evHtml)
    const beforeEv = docstring.slice(0, i)
    const afterEv = docstring.slice(i + evHtml.length, docstring.length)
    if (beforeEv.length) {
      result.push(JSON.stringify(beforeEv))
    }
    const evExpression = decodeHTML(ev.innerHTML).trim()
    if (evExpression.length) {
      result.push(wrap(evExpression, 'e.toString()', 'Say/Text <eval>'))
    }
    docstring = afterEv
  }
  if (docstring.length) {
    result.push(JSON.stringify(docstring))
  }
  if (!result.length) return JSON.stringify('')
  return result.join(' + ')
}
