// A map for commands that have a single, shorthand parameter.
const singleParamCommands = {
  say: 'label',
  eval: 'action',
  goto: 'target',
  enable: 'target',
  disable: 'target',
  image: 'url',
  'storage.remove': 'key',
  'timer.remove': 'id',
  'notification.remove': 'id',
}

/**
 * A simple adapter to handle both array-based and object-based command formats.
 * It normalizes any given command into the classic object format.
 * e.g., ["say", "Hello"] -> {"say": {"label": "Hello"}}
 * @param {Object|Array} command The command to normalize.
 * @returns {Object} The normalized command in object format.
 */
const normalizeCommand = command => {
  // If it's not an array, it's the old format, so we don't need to do anything.
  if (!Array.isArray(command)) {
    return command
  }

  const [commandName, params] = command
  const defaultParamName = singleParamCommands[commandName]

  if (defaultParamName && (typeof params !== 'object' || params === null)) {
    // Shorthand command like ["say", "Hello"]
    // Convert to {"say": {"label": "Hello"}}
    return { [commandName]: { [defaultParamName]: params } }
  } else if (params !== undefined) {
    // Multi-parameter command like ["prompt", {var: "name"}]
    // or a no-shorthand command.
    // Convert to {"prompt": {var: "name"}}
    return { [commandName]: params }
  } else {
    // No-parameter command like ["end"]
    // Convert to {"end": {}}
    return { [commandName]: {} }
  }
}

export default normalizeCommand
