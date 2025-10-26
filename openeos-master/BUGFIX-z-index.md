# Bug修复：OEOS导致SillyTavern窗口被挤到边缘

## 问题描述
打开OEOS后，打开ST的一些窗口（例如：正则表达式编辑器、词符计数器等）会被挤到左上角边缘，无法正常居中显示。

## 问题原因
经过分析，发现有两个主要问题：

### 1. 全局 `html` 元素的 `overflow: hidden`
在 `OpenEosPlayer.vue` 中设置了全局样式：
```css
html {
  overflow: hidden;
}
```
这个全局样式会影响整个页面的布局和弹窗定位，导致SillyTavern的dialog元素无法正确计算居中位置。

### 2. Vuetify 弹窗的高 z-index
Vuetify框架的对话框（v-dialog）和遮罩层（v-overlay）默认使用非常高的z-index值（通常是200+），可能会遮挡SillyTavern的原生弹窗。

### 3. `.v-application` 的 `all: unset` 重置
之前的隔离策略使用了 `all: unset !important` 来重置Vuetify样式，但这会破坏弹窗的定位属性。

## 解决方案

### 修改1：移除全局 `html` 的 `overflow: hidden`
**文件**: `src/components/OpenEosPlayer.vue`

将全局的 `html { overflow: hidden; }` 改为只在 OEOS 容器内设置：
```css
/* 不要设置全局 html 的 overflow，这会影响 SillyTavern 的弹窗定位 */
#oeos-main-container {
  overflow: hidden;
}
```

### 修改2：优化样式隔离策略
**文件**: `src/styles/isolation.css`

#### 2.1 修复 `.v-application` 重置策略
将 `all: unset !important` 改为只重置关键属性：
```css
.v-application:not(#oeos-main-container .v-application) {
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
}
```

#### 2.2 降低Vuetify弹窗层级
```css
/* 将所有Vuetify相关的弹窗层级降低到100 */
.v-dialog,
.v-overlay,
.v-dialog__content,
.v-overlay--active {
  z-index: 100 !important;
}
```

#### 2.3 提升SillyTavern弹窗层级
```css
/* 确保ST的弹窗层级在1000+ */
body > dialog,
body > .popup,
dialog:not(.v-dialog),
.popup {
  z-index: 1000 !important;
}
```

#### 2.4 强制恢复 html/body 的 overflow
```css
html {
  overflow: auto !important;
}

body {
  overflow: auto !important;
}
```

#### 2.5 确保弹窗正确定位
```css
dialog,
.popup {
  position: fixed !important;
  margin: auto !important;
}

dialog::backdrop,
.popup::backdrop {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
}
```

## 层级结构
修复后的z-index层级结构：
- **1000**: SillyTavern弹窗（dialog, popup）
- **999**: SillyTavern弹窗背景遮罩
- **100**: OEOS/Vuetify弹窗和遮罩层
- **0-99**: 正常页面内容

## 测试步骤
1. 启动SillyTavern
2. 打开OEOS功能
3. 尝试打开以下ST窗口：
   - 正则表达式编辑器
   - 词符计数器
   - 其他工具窗口
4. 确认这些窗口能正常显示在最上层，不被OEOS遮挡

## 相关文件
- `src/openeos-master/src/styles/isolation.css` - 样式隔离和弹窗层级修复
- `src/openeos-master/src/components/OpenEosPlayer.vue` - 移除全局 html overflow 设置

## 注意事项
- 此修复使用 `!important` 确保优先级
- 同时处理了容器内和body下的Vuetify元素
- 不影响OEOS内部弹窗的正常显示

## 构建和部署
修改完成后需要重新构建：
```bash
cd src/openeos-master
npm run build
```

构建完成后，`postbuild`脚本会自动将文件同步到：
- `src/SillyTavern-release/public/scripts/extensions/third-party/oeos-st-extension/`
- `src/oeos-plugin-core/`

## 影响范围
此修复影响以下组件的弹窗显示：
- CharacterSelector.vue - 角色选择器的设置对话框
- App.vue - 主应用的消息对话框
- OpenEosPlayer.vue - 游戏结束对话框和调试对话框

所有这些弹窗的z-index都被限制在100，确保不会遮挡SillyTavern的工具窗口。

