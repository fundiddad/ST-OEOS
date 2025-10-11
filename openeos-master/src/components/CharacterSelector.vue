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
            @click="selectCharacter(index)"
            class="character-item"
          >
            <v-list-item-avatar>
              <v-img :src="getCharacterAvatar(char.avatar)"></v-img>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>{{ char.name }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ char.description ? char.description.substring(0, 100) : '无描述' }}...
              </v-list-item-subtitle>
              <v-list-item-subtitle class="text--secondary">
                聊天记录: {{ char.chat_size || 0 }} |
                最后聊天: {{ formatDate(char.date_last_chat) }}
              </v-list-item-subtitle>
            </v-list-item-content>
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
// ✅ 使用全局 API（解耦方案），不直接 import SillyTavern 文件

export default {
  name: 'CharacterSelector',
  data() {
    return {
      characters: [],
      loading: true,
      error: null
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

        // ✅ 使用全局 API（解耦方案）
        if (!window.oeosApi || !window.oeosApi.getCharacters) {
          throw new Error('OEOS API not available');
        }
        this.characters = window.oeosApi.getCharacters();
      } catch (err) {
        this.error = err.message || '加载角色列表失败';
        console.error('[CharacterSelector] Error loading characters:', err);
      } finally {
        this.loading = false;
      }
    },
    selectCharacter(index) {
      const character = this.characters[index];
      this.$emit('character-selected', {
        index: index,
        character: character
      });
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
}

.character-item {
  cursor: pointer;
  transition: background-color 0.3s;
}

.character-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}
</style>

