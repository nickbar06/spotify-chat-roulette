<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { MessageCircle, Play, Send, Users, X } from 'lucide-vue-next'
import type { ActiveRoom, ChatMessage, ChatRoom, Profile } from '../types'

const props = defineProps<{
  room: ChatRoom | null
  messages: ChatMessage[]
  profile: Profile | null
  connected: boolean
  presence: string | null
  activeRooms: ActiveRoom[]
  browsing: boolean
}>()

const emit = defineEmits<{
  close: []
  connect: []
  send: [message: string]
  browse: [roomId: string]
  followPlayback: []
  selectProfile: [profile: Profile]
  playArtist: [artistId: string]
}>()

const draft = ref('')
const scrollArea = ref<HTMLElement | null>(null)

const roomSubtitle = computed(() =>
  props.room?.artistId ? 'Listening to this artist now' : 'Waiting for your music',
)
const currentActiveRoom = computed(() =>
  props.activeRooms.find((activeRoom) => activeRoom.id === props.room?.id),
)

watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    if (scrollArea.value) scrollArea.value.scrollTop = scrollArea.value.scrollHeight
  },
)

function send() {
  const value = draft.value.trim()
  if (!value) return
  emit('send', value)
  draft.value = ''
}

function time(sentAt: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(sentAt))
}
</script>

<template>
  <aside class="chat-panel panel">
    <header class="chat-heading">
      <div>
        <span class="chat-heading__label">Artist chat</span>
        <h2>{{ room?.name || 'Connecting…' }}</h2>
        <p><span class="live-dot" /> {{ browsing ? 'Browsing demo room' : roomSubtitle }}</p>
      </div>
      <button class="icon-button" aria-label="Close chat" @click="$emit('close')"><X :size="20" /></button>
    </header>

    <div v-if="!connected" class="chat-empty">
      <span class="chat-empty__icon"><MessageCircle /></span>
      <h3>Music is better together</h3>
      <p>Connect Spotify to join a room with everyone listening to your current artist.</p>
      <button class="connect-button" @click="$emit('connect')">Connect Spotify</button>
    </div>

    <template v-else>
      <section class="active-chats">
        <div class="active-chats__heading">
          <strong>Active chats</strong>
          <button v-if="browsing" @click="$emit('followPlayback')">Back to my artist</button>
        </div>
        <div class="active-chat-list">
          <div
            v-for="activeRoom in activeRooms"
            :key="activeRoom.id"
            class="active-chat"
            :class="{ 'active-chat--current': activeRoom.id === room?.id }"
          >
            <button class="active-chat__main" @click="$emit('browse', activeRoom.id)">
              <span class="active-chat__art">{{ activeRoom.name.slice(0, 1) }}</span>
              <span class="active-chat__copy">
                <strong>{{ activeRoom.name }}</strong>
                <small>Artist lobby</small>
              </span>
              <span class="active-chat__count"><Users :size="12" />{{ activeRoom.listenerCount }}</span>
            </button>
            <button
              v-if="activeRoom.artistId"
              class="active-chat__play"
              :aria-label="`Play ${activeRoom.name}`"
              @click="$emit('playArtist', activeRoom.artistId)"
            ><Play :size="13" fill="currentColor" /></button>
          </div>
        </div>
      </section>

      <div ref="scrollArea" class="message-list" aria-live="polite">
        <div class="room-note">
          <Users :size="18" />
          <span>You’re in <strong>{{ room?.name || 'the lobby' }}</strong>. Be kind and keep it about the music.</span>
        </div>
        <div v-if="currentActiveRoom?.participants.length" class="participant-row">
          <button
            v-for="participant in currentActiveRoom.participants"
            :key="participant.id"
            :title="participant.name"
            @click="$emit('selectProfile', participant)"
          >
            <img v-if="participant.image" :src="participant.image" :alt="participant.name" />
            <span v-else>{{ participant.name.slice(0, 1) }}</span>
          </button>
          <small>{{ currentActiveRoom.listenerCount }} listening</small>
        </div>
        <p v-if="presence" class="presence-note">{{ presence }}</p>
        <div v-if="!messages.length" class="first-message">
          <MessageCircle :size="28" />
          <strong>Start the conversation</strong>
          <p>What do you think of the track?</p>
        </div>
        <article
          v-for="message in messages"
          :key="message.id"
          class="message"
          :class="{ 'message--mine': message.user.id === profile?.id }"
        >
          <button class="profile-trigger" :aria-label="`View ${message.user.name}'s profile`" @click="$emit('selectProfile', message.user)">
            <img v-if="message.user.image" :src="message.user.image" :alt="message.user.name" />
            <span v-else class="message__avatar">{{ message.user.name.slice(0, 1) }}</span>
          </button>
          <div>
            <p class="message__meta">
              <button @click="$emit('selectProfile', message.user)">{{ message.user.name }}</button>
              <span v-if="message.user.isBot" class="bot-label">Demo bot</span>
              <time>{{ time(message.sentAt) }}</time>
            </p>
            <p class="message__body">{{ message.message }}</p>
          </div>
        </article>
      </div>

      <form class="message-composer" @submit.prevent="send">
        <textarea v-model="draft" maxlength="500" rows="1" :placeholder="`Message ${room?.name || 'the room'}`" @keydown.enter.exact.prevent="send" />
        <button :disabled="!draft.trim()" aria-label="Send message"><Send :size="17" /></button>
      </form>
    </template>
  </aside>
</template>
