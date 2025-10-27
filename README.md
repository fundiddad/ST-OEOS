# OEOS Plugin (SillyTavern Extension)

English | [简体中文](README_CN.md)
**⚠️ Warning**

**This project is currently in a very early stage. Features are incomplete, and there may be many unforeseen bugs. Furthermore, all code in this project is AI-generated and is intended for technical validation and communication purposes only. Please use with caution.**

A SillyTavern extension that transforms AI conversations into an interactive OEOS gaming experience.


## What is OEOS?

**OEOS (Erotic Obedience Scripting)** is an interactive scripting format originally created for the Milovana platform. It enables the creation of rich interactive content with dialogue, choices, images, audio, video, timers, and more.

**openOEOS** is an open-source OEOS player developed by fapnip that runs OEOS scripts in the browser.

## What is "AI-driven OEOS"?

This plugin integrates the openOEOS player into SillyTavern and introduces an innovative feature:

- **AI-generated OEOS content**: LLM responses are automatically parsed into OEOS pages and summaries
- **Persistent storage**: Generated content is saved to the character's World Info for later retrieval
- **Visual interaction**: Content is rendered through the openOEOS player for a graphical gaming experience
- **Smart pre-generation**: Supports concurrent pre-generation of multiple pages for smoother gameplay

## Installation

### Prerequisites

1. **Install Tavern Assistant (酒馆助手)**
   - Ensure the "Tavern Assistant" plugin is installed

2. **Install SPreset Script**
   - Install the "SPreset - built-in regex | Macro nesting" script from Tavern Assistant
   - Reference: https://discord.com/channels/1134557553011998840/1407146985643053096

3. **Import Preset File**
   - Import `oeos-plugin-core/小猫之神-oeos.json` into SPreset within Tavern Assistant
   - Credits to preset author: 小猫之神
   - Reference: https://discord.com/channels/1134557553011998840/1402584661208858635

### Install Extension

1. Copy the following directory to your SillyTavern third-party extensions folder:
   ```
   SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/
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

## Credits

- [openOEOS](https://github.com/fapnip/openeos) - Excellent open-source OEOS player
- 小猫之神 - Provided SPreset rules and examples

## License

This project follows the respective open-source licenses. See LICENSE files in each subproject.

