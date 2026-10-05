<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Library, ListFilter, Plus, Search, UserRound } from 'lucide-vue-next'
import type { Library as LibraryData, LibraryItem, Profile } from '../types'

const props = defineProps<{
  library: LibraryData | null
  loading: boolean
  connected: boolean
  friends: Profile[]
}>()

defineEmits<{
  connect: []
  selectProfile: [profile: Profile]
  selectItem: [item: LibraryItem]
}>()

const filter = ref('All')
const searchOpen = ref(false)
const query = ref('')
const filters = ['All', 'Playlists', 'Albums', 'Artists']

const items = computed(() => {
  if (!props.library) return []
  const groups: Record<string, LibraryItem[]> = {
    All: [
      {
        id: 'liked',
        name: 'Liked Songs',
        type: 'Playlist',
        detail: `${props.library.tracks.length} recent tracks`,
      },
      ...props.library.playlists,
      ...props.library.albums,
      ...props.library.artists,
    ],
    Playlists: props.library.playlists,
    Albums: props.library.albums,
    Artists: props.library.artists,
  }
  return (groups[filter.value] || groups.All).filter((item) =>
    item.name.toLowerCase().includes(query.value.toLowerCase()),
  )
})

function itemImage(item: LibraryItem) {
  return item.image || item.album?.image || null
}
</script>

<template>
  <aside class="library-panel panel">
    <div class="library-heading">
      <div class="library-heading__title"><Library :size="23" /> <strong>Your Library</strong></div>
      <div class="library-heading__actions">
        <button class="icon-button" aria-label="Create"><Plus :size="20" /></button>
        <button class="icon-button" aria-label="Expand library"><ArrowRight :size="20" /></button>
      </div>
    </div>

    <div class="filter-row">
      <button
        v-for="option in filters"
        :key="option"
        class="filter-chip"
        :class="{ 'filter-chip--active': filter === option }"
        @click="filter = option"
      >
        {{ option }}
      </button>
    </div>

    <div class="library-tools">
      <label :class="['library-search', { 'library-search--open': searchOpen }]">
        <button class="icon-button" aria-label="Search library" @click="searchOpen = !searchOpen">
          <Search :size="18" />
        </button>
        <input v-if="searchOpen" v-model="query" autofocus placeholder="Search your library" />
      </label>
      <button class="recents-button">Recents <ListFilter :size="17" /></button>
    </div>

    <section v-if="friends.length" class="friends-list">
      <span class="friends-list__heading"><UserRound :size="14" /> Friends</span>
      <div>
        <button v-for="friend in friends" :key="friend.id" @click="$emit('selectProfile', friend)">
          <img v-if="friend.image" :src="friend.image" :alt="friend.name" />
          <span v-else>{{ friend.name.slice(0, 1) }}</span>
          <small>{{ friend.name }}</small>
        </button>
      </div>
    </section>

    <div v-if="loading" class="library-list" aria-label="Loading library">
      <div v-for="index in 7" :key="index" class="library-item library-item--skeleton">
        <span class="skeleton skeleton--art" />
        <span><i class="skeleton skeleton--line" /><i class="skeleton skeleton--line-short" /></span>
      </div>
    </div>

    <div v-else-if="!connected" class="empty-library">
      <Library :size="34" />
      <strong>Your music, in one place</strong>
      <p>Connect Spotify to load playlists, albums, liked tracks, and followed artists.</p>
      <button class="connect-button" @click="$emit('connect')">Connect Spotify</button>
    </div>

    <div v-else class="library-list">
      <button
        v-for="item in items"
        :key="`${item.type}-${item.id}`"
        type="button"
        class="library-item"
        @click="$emit('selectItem', item)"
      >
        <img v-if="itemImage(item)" :class="{ 'round-art': item.type === 'Artist' }" :src="itemImage(item)!" :alt="item.name" />
        <span v-else-if="item.id === 'liked'" class="liked-art">♥</span>
        <span v-else class="art-fallback">{{ item.name.slice(0, 1) }}</span>
        <span class="library-item__copy">
          <strong>{{ item.name }}</strong>
          <small>{{ item.type }}<template v-if="item.detail"> · {{ item.detail }}</template></small>
        </span>
      </button>
      <p v-if="!items.length" class="no-results">No library items match “{{ query }}”.</p>
    </div>
  </aside>
</template>
