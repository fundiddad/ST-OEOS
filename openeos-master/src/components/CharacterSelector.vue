<template>
  <v-container class="character-selector">
    <v-card>
      <v-card-title class="headline">
        选择角色开始冒险
      </v-card-title>
      <v-card-text>
        <v-progress-circular v-if="loading" indeterminate></v-progress-circular>
        <v-alert v-else-if="error" type="error">{{ error }}</v-alert>
        <v-list v-else-if="characters.length > 0">
          <v-list-item
            v-for="(char, index) in characters"
            :key="index"
            class="character-item"
            :class="{ 'oeos-character': char.isOEOS }"
          >
            <v-list-item-avatar>
              <v-img :src="getCharacterAvatar(char.avatar)"></v-img>
            </v-list-item-avatar>
            <v-list-item-content @click="selectCharacter(index)">
              <v-list-item-title>
                {{ char.name }}
                <v-chip v-if="char.isOEOS" x-small color="success" class="ml-2">
                  OEOS
                </v-chip>
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ char.description ? char.description.substring(0, 100) : '无描述' }}...
              </v-list-item-subtitle>
              <v-list-item-subtitle class="text--secondary">
                聊天记录: {{ char.chat_size || 0 }} |
                最后聊天: {{ formatDate(char.date_last_chat) }}
                <span v-if="char.worldInfo"> | World Info: {{ char.worldInfo }}</span>
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action v-if="!char.isOEOS">
              <v-btn
                small
                color="primary"
                @click.stop="enableOEOS(index)"
                :loading="enablingOEOS[index]"
              >
                启用 OEOS
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </v-list>
        <v-alert v-else type="info">
          没有找到可用的角色
        </v-alert>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script>
// 使用全局 API（解耦方案），不直接 import SillyTavern 文件

export default {
  name: 'CharacterSelector',
  data() {
    return {
      characters: [],
      loading: true,
      error: null,
      enablingOEOS: {}  // 跟踪每个角色的启用状态
    }
  },
  mounted() {
    this.loadCharacters()
  },
  methods: {
    async loadCharacters() {
      try {
        this.loading = true;
        this.error = null;

        // 使用全局 API（解耦方案）
        if (!window.oeosApi || !window.oeosApi.getCharacters) {
          throw new Error('OEOS API not available');
        }

        // getCharacters 现在是异步的，因为需要检查 OEOS 状态
        this.characters = await window.oeosApi.getCharacters();
      } catch (err) {
        this.error = err.message || '加载角色列表失败';
        console.error('[CharacterSelector] Error loading characters:', err);
      } finally {
        this.loading = false;
      }
    },
    selectCharacter(index) {
      const character = this.characters[index];

      // 只有 OEOS 角色才能被选择
      if (!character.isOEOS) {
        // 可以选择提示用户先启用 OEOS
        return;
      }

      this.$emit('character-selected', {
        index: character.index,  // 使用角色的实际索引
        character: character
      });
    },
    async enableOEOS(index) {
      try {
        // 设置加载状态
        this.$set(this.enablingOEOS, index, true);

        const character = this.characters[index];

        if (!window.oeosApi || !window.oeosApi.enableOEOSForCharacter) {
          throw new Error('OEOS API not available');
        }

        // 调用 API 启用 OEOS
        await window.oeosApi.enableOEOSForCharacter(character.index);

        // 重新加载角色列表以更新状态
        await this.loadCharacters();

      } catch (err) {
        this.error = err.message || '启用 OEOS 失败';
        console.error('[CharacterSelector] Error enabling OEOS:', err);
      } finally {
        this.$set(this.enablingOEOS, index, false);
      }
    },
    getCharacterAvatar(avatar) {
      return `/characters/${avatar}`;
    },
    formatDate(timestamp) {
      if (!timestamp) return '无';
      return new Date(timestamp).toLocaleDateString('zh-CN');
    }
  }
}
</script>

<style scoped>
.character-selector {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.character-selector .v-card {
  width: 100%;
  max-width: 800px;
}

.character-item {
  cursor: pointer;
  transition: background-color 0.3s, border-left 0.3s;
  border-left: 4px solid transparent;
}

.character-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

/* OEOS 角色的绿色标识 */
.character-item.oeos-character {
  background-color: rgba(76, 175, 80, 0.1);  /* 浅绿色背景 */
  border-left-color: #4CAF50;  /* 绿色左边框 */
}

.character-item.oeos-character:hover {
  background-color: rgba(76, 175, 80, 0.2);  /* 悬停时更深的绿色 */
}
</style>

