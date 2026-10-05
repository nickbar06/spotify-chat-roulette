<script setup lang="ts">
import { Bell, ChevronLeft, ChevronRight, Home, MessageCircle, Search } from 'lucide-vue-next'
import type { Profile } from '../types'

defineProps<{
  profile: Profile | null
  chatOpen: boolean
}>()

defineEmits<{
  toggleChat: []
  connect: []
}>()
</script>

<template>
  <header class="topbar">
    <div class="topbar__history">
      <button class="icon-button icon-button--quiet" aria-label="Go back"><ChevronLeft /></button>
      <button class="icon-button icon-button--quiet" aria-label="Go forward"><ChevronRight /></button>
    </div>

    <div class="topbar__center">
      <button class="home-button" aria-label="Home"><Home :size="21" fill="currentColor" /></button>
      <label class="search-box">
        <Search :size="21" />
        <input aria-label="Search" placeholder="What do you want to play?" />
        <span class="search-shortcut">⌘ K</span>
      </label>
    </div>

    <div class="topbar__actions">
      <button class="icon-button" aria-label="Notifications"><Bell :size="20" /></button>
      <button
        class="icon-button"
        :class="{ 'icon-button--active': chatOpen }"
        aria-label="Toggle artist chat"
        :aria-pressed="chatOpen"
        @click="$emit('toggleChat')"
      >
        <MessageCircle :size="20" />
      </button>
      <button v-if="!profile" class="connect-button connect-button--compact" @click="$emit('connect')">
        Connect
      </button>
      <img v-else-if="profile.image" class="avatar" :src="profile.image" :alt="profile.name" />
      <span v-else class="avatar avatar--fallback">{{ profile.name.slice(0, 1) }}</span>
    </div>
  </header>
</template>
