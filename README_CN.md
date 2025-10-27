# OEOS 插件（SillyTavern 扩展）

[English](README.md) | 简体中文
**⚠️ 注意**

**本项目目前仍处于非常初级的阶段，功能尚不完善，可能存在许多未预见的 Bug。此外，项目中的所有代码均由 AI 生成，仅供技术验证和交流。请谨慎使用。**

一个将 AI 对话转化为互动式 OEOS 游戏体验的 SillyTavern 扩展。


## 什么是 OEOS？

**OEOS（Erotic Obedience Scripting）** 是一种互动式脚本格式，最初用于 Milovana 平台，可以创建包含对话、选择、图片、音频、视频、计时器等丰富交互元素的互动内容。

**openOEOS** 是由 fapnip 开发的开源 OEOS 播放器，可以在浏览器中运行 OEOS 脚本。

## 什么是"基于 AI 的 OEOS"？

本插件将 openOEOS 播放器集成到 SillyTavern 中，并实现了一个创新功能：

- **AI 自动生成 OEOS 内容**：大语言模型（LLM）的回复会被自动解析为 OEOS 页面和摘要
- **持久化存储**：生成的内容保存到角色的 World Info 中，可以随时读取和继续
- **可视化交互**：通过 openOEOS 播放器渲染，提供图形化的游戏体验
- **智能预生成**：支持并发预生成多个页面，提升体验流畅度

## 安装方法

### 前置条件

1. **安装酒馆助手**
   - 请先确保已安装"酒馆助手"插件

2. **安装 SPreset 脚本**
   - 安装"酒馆助手脚本"中的【SPreset - 预设内置正则 | 宏嵌套…】
   - 参考链接：https://discord.com/channels/1134557553011998840/1407146985643053096

3. **导入预设文件**
   - 将 `src/oeos-plugin-core/小猫之神-oeos.json` 导入到"酒馆助手"的 SPreset 中
   - 感谢预设作者：小猫之神
   - 参考链接：https://discord.com/channels/1134557553011998840/1402584661208858635

### 安装扩展

1. 将以下目录复制到你的 SillyTavern 第三方扩展目录：
   ```
   SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/
   ```

2. 重启 SillyTavern

3. 在"扩展管理 > 第三方扩展"中启用 "OEOS Interface"

## 工作原理

### 整体流程

1. **插件加载**
   - SillyTavern 启动时加载 OEOS 扩展
   - 在聊天界面旁边注入 OEOS 游戏面板

2. **AI 生成内容**
   - 当 AI 回复时，插件自动提取其中的 `<Pages>` 和 `<summary>` 标签
   - 这些标签包含了 OEOS 格式的游戏内容（对话、选项、图片等）

3. **数据持久化**
   - 提取的内容自动保存到角色专属的 World Info 中
   - 下次打开聊天时可以继续之前的游戏进度

4. **游戏渲染**
   - openOEOS 播放器读取保存的内容
   - 将文本格式的 OEOS 脚本渲染为可交互的游戏界面
   - 支持图片、音频、视频、计时器等多媒体元素

5. **智能预生成**
   - 系统可以并发预生成多个游戏页面（最多 10 个）
   - 提前准备后续内容，减少等待时间

### 技术架构

- **前端播放器**：基于 Vue 2 + Vuetify 的 openOEOS 播放器
- **桥接层**：连接 SillyTavern 和 openOEOS，处理数据提取和同步
- **并发生成器**：利用 SillyTavern 的 API 实现多页面并发生成

## 致谢

- [openOEOS](https://github.com/fapnip/openeos) - 优秀的开源 OEOS 播放器
- 小猫之神 - 提供 SPreset 预设规则和示例

## 许可证

本项目遵循相应的开源许可证，详见各子项目的 LICENSE 文件。

