# OEOS Plugin (SillyTavern Extension)

English | [简体中文](README_CN.md)

**⚠️ Warning**

**This project is currently in a very early stage. Features are incomplete, and there may be many unforeseen bugs. Furthermore, all code in this project is AI-generated and is intended for technical validation and communication purposes only. Please use with caution.**

A SillyTavern extension that transforms AI conversations into an interactive OEOS gaming experience.

## Table of Contents

- [What is OEOS?](#what-is-oeos)
- [What is "AI-driven OEOS"?](#what-is-ai-driven-oeos)
- [Project Structure](#project-structure)
- [Build Instructions](#build-instructions)
- [Installation](#installation)
- [How It Works](#how-it-works)
- [Core Modules](#core-modules)
- [Credits](#credits)

## What is OEOS?

**OEOS (Erotic Obedience Scripting)** is an interactive scripting format originally created for the Milovana platform. It enables the creation of rich interactive content with dialogue, choices, images, audio, video, timers, and more.

**openOEOS** is an open-source OEOS player developed by fapnip that runs OEOS scripts in the browser.

## What is "AI-driven OEOS"?

This plugin integrates the openOEOS player into SillyTavern and introduces an innovative feature:

- **AI-generated OEOS content**: LLM responses are automatically parsed into OEOS pages and summaries
- **Persistent storage**: Generated content is saved to the character's World Info for later retrieval
- **Visual interaction**: Content is rendered through the openOEOS player for a graphical gaming experience
- **Smart pre-generation**: Supports concurrent pre-generation of multiple pages for smoother gameplay

## Project Structure

```
src/
├── oeos-plugin-core/              # SillyTavern extension core code (Git tracked)
│   ├── manifest.json              # Extension manifest file
│   ├── loader.js                  # Extension loader entry point
│   ├── index.js                   # Main entry, initializes all modules
│   ├── ui.js                      # UI injection and interface switching
│   ├── plugin-bridge.js           # Bridge layer, exposes window.oeosApi
│   ├── st-api.js                  # SillyTavern API abstraction layer
│   ├── element-data-manager.js    # Game data manager (single source of truth)
│   ├── game-state.js              # Game state management (World Info R/W)
│   ├── globalSettings.js          # Global settings (image/audio toggles)
│   ├── chat-history-control.js    # Chat history control module
│   ├── preset-switcher.js         # Automatic preset switching logic
│   ├── pregeneration.js           # Pre-generation system core
│   ├── concurrent-generator.js    # Concurrent generator V1 (quiet mode)
│   ├── concurrent-generator-v2.js # Concurrent generator V2 (saves to chat)
│   ├── debug-context-comparison.js# Debug tool: context comparison
│   └── 小猫之神-oeos.json         # SPreset preset file
│
├── openeos-master/                # openOEOS player (Vue 2 project)
│   ├── src/                       # Vue source code
│   ├── public/                    # Static assets
│   ├── dist/                      # Build output (not tracked)
│   ├── package.json               # Dependencies and build scripts
│   ├── vue.config.js              # Webpack configuration
│   ├── deploy.js                  # Deployment script (auto-sync to ST)
│   └── README.md                  # openOEOS player documentation
│
├── SillyTavern-release/           # SillyTavern installation (not tracked)
│   └── public/scripts/extensions/third-party/
│       └── oeos-st-extension/     # Final deployment location (auto-generated)
│
├── package.json                   # Root project dependencies
├── README.md                      # English documentation (this file)
└── README_CN.md                   # Chinese documentation
```

## Build Instructions

### Requirements

- Node.js 14+ and npm
- SillyTavern installed at `src/SillyTavern-release/`

### Build Steps

1. **Install Dependencies**
   ```bash
   cd src/openeos-master
   npm install
   ```

2. **Build the Project**
   ```bash
   npm run build
   ```

   The build process automatically performs the following:
   - Compiles the openOEOS player using Vue CLI (output to `dist/`)
   - Executes the `deploy.js` script
   - Copies the `oeos-plugin-core/` directory to the SillyTavern extension folder
   - Copies the `dist/` build artifacts to the SillyTavern extension folder

   Final output location:
   ```
   src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/
   ```

3. **Development Mode** (Optional)
   ```bash
   npm run serve
   ```
   Starts the Vue development server with hot reload

### Build Notes

- **Do NOT manually modify** files in `SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/`
- All changes should be made in `oeos-plugin-core/` or `openeos-master/src/`
- Each build automatically syncs the latest code to the SillyTavern extension directory

## Installation

### Prerequisites

1. **Install Tavern Assistant (酒馆助手)**
   - Ensure the "Tavern Assistant" plugin is installed

2. **Install SPreset Script**
   - Install the "SPreset - built-in regex | Macro nesting" script from Tavern Assistant
   - Reference: https://discord.com/channels/1134557553011998840/1407146985643053096

3. **Import Preset File**
   - Import `src/oeos-plugin-core/小猫之神-oeos.json` into SPreset within Tavern Assistant
   - Credits to preset author: 小猫之神
   - Reference: https://discord.com/channels/1134557553011998840/1402584661208858635

### Install Extension

1. Follow the "Build Instructions" above to build the project, or copy the pre-built extension directory to your SillyTavern installation:
   ```
   SillyTavern/public/scripts/extensions/third-party/oeos-st-extension/
   ```

2. Restart SillyTavern

3. Enable "OEOS Interface" under Extensions > Third-Party

## How It Works

### Overall Flow

1. **Plugin Loading**
   - The OEOS extension loads when SillyTavern starts
   - An OEOS game panel is injected beside the chat interface

2. **AI Content Generation**
   - When the AI responds, the plugin automatically extracts `<Pages>` and `<summary>` tags
   - These tags contain OEOS-formatted game content (dialogue, choices, images, etc.)

3. **Data Persistence**
   - Extracted content is automatically saved to the character's World Info
   - Game progress can be resumed when reopening the chat

4. **Game Rendering**
   - The openOEOS player reads the saved content
   - Text-based OEOS scripts are rendered into an interactive game interface
   - Supports multimedia elements like images, audio, video, and timers

5. **Smart Pre-generation**
   - The system can concurrently pre-generate multiple game pages (up to 10)
   - Prepares upcoming content in advance to reduce waiting time

### Technical Architecture

- **Frontend Player**: openOEOS player built with Vue 2 + Vuetify
- **Bridge Layer**: Connects SillyTavern and openOEOS, handles data extraction and synchronization
- **Concurrent Generator**: Leverages SillyTavern's API for multi-page concurrent generation

## Core Modules

### oeos-plugin-core Directory Files

#### 1. Entry and Loading Modules

- **`manifest.json`**
  - SillyTavern extension manifest file
  - Defines extension name, version, author, entry file, and other metadata
  - Specifies `loader.js` as the extension entry point

- **`loader.js`**
  - Extension loader, executed first when SillyTavern starts
  - Imports `index.js` to start the entire plugin

- **`index.js`**
  - Main entry file, initializes all modules
  - Calls `injectAndSetupSwapper()` to inject UI
  - Imports `plugin-bridge.js` to establish the bridge layer

#### 2. UI and Interface Modules

- **`ui.js`**
  - Injects the OEOS game panel into the SillyTavern interface
  - Implements chat/game interface switching logic
  - Dynamically loads openOEOS player build artifacts (JS/CSS)
  - Creates toggle buttons and manages interface visibility

#### 3. Core Bridge and API Modules

- **`plugin-bridge.js`**
  - Bridge layer core, connects SillyTavern and openOEOS player
  - Exposes `window.oeosApi` for Vue app consumption
  - Provides main functionality:
    - Game data management (via ElementDataManager)
    - Pre-generation system control
    - Chat history control
    - Automatic preset switching
    - Global settings management
  - Listens to AI response events, automatically extracts and saves game content

- **`st-api.js`**
  - SillyTavern API abstraction layer
  - Wraps access to SillyTavern core features:
    - World Info read/write (`saveWi`, `loadWi`)
    - Event listening (`listenToAiResponse`)
    - Preset management (`getPresetByName`, `savePresetDirect`)
  - Provides unified error handling and logging

#### 4. Data Management Modules

- **`element-data-manager.js`**
  - Game data manager, single source of truth for OEOS game data
  - Manages data structures:
    - `pages`: Page content (Map: pageId -> content)
    - `summary`: Page summaries (Map: pageId -> abstract)
    - `graph`: Page relationship graph (Map: pageId -> [childIds])
    - `state`: Current game state
    - `dynamicContext`: Dynamic context
  - Features:
    - Extracts Pages and Summary from chat messages
    - Loads game data from World Info
    - Incremental updates with debounced sync to World Info
    - Differential sync to preset files

- **`game-state.js`**
  - Game state management module
  - Handles reading/writing game state in World Info
  - Updates XML tag content in preset files (Graph, State, Dynamic-Context, Summary)
  - Provides page entry update functionality

- **`globalSettings.js`**
  - Global settings management module
  - Manages image, audio, and other global toggles
  - Persists settings using localStorage
  - Provides read, update, and reset functionality

#### 5. Smart Generation Modules

- **`pregeneration.js`**
  - Pre-generation system core module
  - Listens to page change events, automatically triggers pre-generation
  - Analyzes current page's jump targets (goto statements)
  - Intelligently pre-generates ungenerated target pages (up to 10)
  - Manages generation queue and slot usage

- **`concurrent-generator.js`**
  - Concurrent generator V1 (quiet mode)
  - Uses SillyTavern's quiet mode for generation
  - Does not save to chat history
  - Supports 10 concurrent slots (xb1-xb10)

- **`concurrent-generator-v2.js`**
  - Concurrent generator V2 (saves to chat)
  - Manually adds messages to chat history
  - Generated content displays in chat interface
  - Supports 10 concurrent slots
  - Fully uses user's API configuration and presets

#### 6. Utility Modules

- **`chat-history-control.js`**
  - Chat history control module
  - Provides enable/disable chatHistory in Prompt Manager
  - Used to temporarily disable chat history during pre-generation to avoid context pollution
  - Supports silent switching (no UI updates)

- **`preset-switcher.js`**
  - Automatic preset switching module
  - Automatically switches to OEOS-specific preset when changing characters
  - Saves and restores each character's previous preset
  - Uses PresetManager API for preset switching

- **`debug-context-comparison.js`**
  - Debug tool: context comparison
  - Compares context differences between concurrent generator and normal SillyTavern generation
  - Analyzes message arrays, role distribution, World Info inclusion
  - Exposes `window.debugContextComparison` for console debugging

#### 7. Configuration Files

- **`小猫之神-oeos.json`**
  - SPreset preset file
  - Contains prompt templates required for OEOS games
  - Defines XML tag structures for Graph, State, Dynamic-Context, Summary, etc.
  - Must be imported into Tavern Assistant's SPreset

### Module Dependencies

```
loader.js
  └─> index.js
       ├─> ui.js (UI injection)
       └─> plugin-bridge.js (Bridge layer)
            ├─> st-api.js (ST API wrapper)
            ├─> element-data-manager.js (Data management)
            ├─> game-state.js (State management)
            ├─> globalSettings.js (Global settings)
            ├─> chat-history-control.js (Chat history control)
            ├─> preset-switcher.js (Preset switching)
            └─> pregeneration.js (Pre-generation system)
                 ├─> concurrent-generator.js (V1)
                 └─> concurrent-generator-v2.js (V2)
```

## Credits

- [openOEOS](https://github.com/fapnip/openeos) - Excellent open-source OEOS player
- 小猫之神 - Provided SPreset rules and examples

## License

This project follows the respective open-source licenses. See LICENSE files in each subproject.

