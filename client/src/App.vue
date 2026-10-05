<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { api, API_URL } from './api'
import ChatPanel from './components/ChatPanel.vue'
import HomeContent from './components/HomeContent.vue'
import LibrarySidebar from './components/LibrarySidebar.vue'
import PlayerBar from './components/PlayerBar.vue'
import TopBar from './components/TopBar.vue'
import type {
  ActiveRoom,
  ChatMessage,
  ChatRoom,
  Library,
  LibraryItem,
  Playback,
  PlaylistDetail,
  Profile,
  Track,
} from './types'
import { useSpotifyPlayer } from './useSpotifyPlayer'

interface SessionResponse {
  authenticated: boolean
  configured: boolean
  profile: Profile | null
}

const profile = ref<Profile | null>(null)
const library = ref<Library | null>(null)
const playback = ref<Playback | null>(null)
const room = ref<ChatRoom | null>(null)
const messages = ref<ChatMessage[]>([])
const activeRooms = ref<ActiveRoom[]>([])
const browsing = ref(false)
const presence = ref<string | null>(null)
const selectedProfile = ref<Profile | null>(null)
const selectedPlaylist = ref<PlaylistDetail | null>(null)
const friends = ref<Profile[]>([])
const chatOpen = ref(true)
const loadingLibrary = ref(false)
const configured = ref(true)
const error = ref<string | null>(null)
const sessionLoaded = ref(false)
const { ready: sdkReady, deviceId, error: sdkError, initialize: initializePlayer } = useSpotifyPlayer()
let socket: Socket | null = null
let pollTimer: number | undefined
let presenceTimer: number | undefined

async function connectSpotify() {
  try {
    error.value = null
    const response = await api.get<{ authorizeUrl: string }>('/api/auth/login')
    window.location.assign(response.authorizeUrl)
  } catch (connectError) {
    error.value = connectError instanceof Error ? connectError.message : 'Could not connect Spotify'
  }
}

async function loadPlayback() {
  if (!profile.value) return
  try {
    playback.value = await api.get<Playback>('/api/player')
  } catch (playbackError) {
    error.value = playbackError instanceof Error ? playbackError.message : 'Could not load playback'
  }
}

async function loadAccountData() {
  if (!profile.value) return
  loadingLibrary.value = true
  const results = await Promise.allSettled([
    api.get<Library>('/api/library'),
    api.get<Playback>('/api/player'),
  ])
  if (results[0].status === 'fulfilled') library.value = results[0].value
  else error.value = results[0].reason.message
  if (results[1].status === 'fulfilled') playback.value = results[1].value
  loadingLibrary.value = false
}

function showPresence(message: string) {
  presence.value = message
  window.clearTimeout(presenceTimer)
  presenceTimer = window.setTimeout(() => (presence.value = null), 4000)
}

function initializeSocket() {
  socket = io(API_URL, { withCredentials: true })
  socket.on('playback', (state: Playback) => {
    playback.value = state
  })
  socket.on('room_changed', (payload: { room: ChatRoom; messages: ChatMessage[]; browsing?: boolean }) => {
    room.value = payload.room
    messages.value = payload.messages
    browsing.value = Boolean(payload.browsing)
  })
  socket.on('active_rooms', (rooms: ActiveRoom[]) => {
    activeRooms.value = rooms
  })
  socket.on('chat_message', (message: ChatMessage) => {
    messages.value.push(message)
  })
  socket.on('presence', ({ message }: { message: string }) => showPresence(message))
  socket.on('spotify_error', ({ message }: { message: string }) => {
    error.value = message
  })
}

function sendMessage(message: string) {
  socket?.emit('chat_message', { message })
}

function browseRoom(roomId: string) {
  socket?.emit('browse_room', roomId)
}

function followPlayback() {
  socket?.emit('follow_playback')
}

function selectProfile(listener: Profile) {
  selectedPlaylist.value = null
  selectedProfile.value = listener
  if (window.innerWidth <= 820) chatOpen.value = false
}

async function selectLibraryItem(item: LibraryItem) {
  if (item.id === 'liked') {
    selectedProfile.value = null
    selectedPlaylist.value = {
      id: 'liked',
      uri: 'spotify:collection:tracks',
      name: 'Liked Songs',
      description: 'Your recent saved tracks',
      image: null,
      owner: profile.value?.name || 'You',
      total: library.value?.tracks.length || 0,
      tracks: (library.value?.tracks || []) as unknown as Track[],
    }
    return
  }
  if (item.type !== 'Playlist') return

  try {
    error.value = null
    const playlist = await api.get<PlaylistDetail>(`/api/library/playlists/${item.id}`)
    selectedProfile.value = null
    selectedPlaylist.value = playlist
  } catch (playlistError) {
    error.value = playlistError instanceof Error ? playlistError.message : 'Could not load playlist'
  }
}

function toggleFriend() {
  if (!selectedProfile.value) return
  const exists = friends.value.some((friend) => friend.id === selectedProfile.value?.id)
  friends.value = exists
    ? friends.value.filter((friend) => friend.id !== selectedProfile.value?.id)
    : [...friends.value, selectedProfile.value]
  localStorage.setItem('scr-friends', JSON.stringify(friends.value))
}

function loadFriends() {
  try {
    const saved = JSON.parse(localStorage.getItem('scr-friends') || '[]')
    friends.value = Array.isArray(saved) ? saved : []
  } catch {
    localStorage.removeItem('scr-friends')
  }
}

async function playerControl(action: string, payload: Record<string, unknown> = {}) {
  try {
    error.value = null
    await api.put(`/api/player/${action}`, {
      deviceId: playback.value?.device?.id || undefined,
      ...payload,
    })
    if (playback.value && (action === 'play' || action === 'pause')) {
      playback.value.isPlaying = action === 'play'
    }
    window.setTimeout(() => {
      loadPlayback()
      socket?.emit('sync_playback')
    }, 500)
  } catch (controlError) {
    error.value = controlError instanceof Error ? controlError.message : 'Playback control failed'
  }
}

async function transferPlayback() {
  if (!deviceId.value) return
  await playerControl('transfer', { deviceId: deviceId.value })
}

async function playArtist(artistId: string) {
  followPlayback()
  await playerControl('play', { contextUri: `spotify:artist:${artistId}` })
}

function dismissError() {
  error.value = null
  sdkError.value = null
}

onMounted(async () => {
  try {
    loadFriends()
    const session = await api.get<SessionResponse>('/api/auth/session')
    configured.value = session.configured
    profile.value = session.profile
    if (session.authenticated) {
      await loadAccountData()
      initializeSocket()
      initializePlayer()
      pollTimer = window.setInterval(loadPlayback, 10_000)
    }
  } catch (sessionError) {
    error.value = sessionError instanceof Error ? sessionError.message : 'Backend is unavailable'
  } finally {
    sessionLoaded.value = true
  }
})

onBeforeUnmount(() => {
  socket?.disconnect()
  window.clearInterval(pollTimer)
  window.clearTimeout(presenceTimer)
})
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--chat-closed': !chatOpen }">
    <TopBar :profile="profile" :chat-open="chatOpen" @toggle-chat="chatOpen = !chatOpen" @connect="connectSpotify" />

    <div class="workspace">
      <LibrarySidebar
        :library="library"
        :loading="loadingLibrary || !sessionLoaded"
        :connected="Boolean(profile)"
        :friends="friends"
        @connect="connectSpotify"
        @select-profile="selectProfile"
        @select-item="selectLibraryItem"
      />
      <HomeContent
        :profile="profile"
        :selected-profile="selectedProfile"
        :selected-playlist="selectedPlaylist"
        :is-friend="Boolean(selectedProfile && friends.some((friend) => friend.id === selectedProfile?.id))"
        @connect="connectSpotify"
        @open-chat="chatOpen = true"
        @close-profile="selectedProfile = null"
        @close-playlist="selectedPlaylist = null"
        @toggle-friend="toggleFriend"
        @play-context="(uri) => playerControl('play', { contextUri: uri })"
        @play-track="(uri) => playerControl('play', { trackUri: uri })"
      />
      <ChatPanel
        v-if="chatOpen"
        :room="room"
        :messages="messages"
        :profile="profile"
        :connected="Boolean(profile)"
        :presence="presence"
        :active-rooms="activeRooms"
        :browsing="browsing"
        @close="chatOpen = false"
        @connect="connectSpotify"
        @send="sendMessage"
        @browse="browseRoom"
        @follow-playback="followPlayback"
        @select-profile="selectProfile"
        @play-artist="playArtist"
      />
    </div>

    <PlayerBar
      :playback="playback"
      :connected="Boolean(profile)"
      :sdk-ready="sdkReady"
      @connect="connectSpotify"
      @control="playerControl"
      @transfer="transferPlayback"
    />

    <div v-if="error || sdkError" class="toast" role="status">
      <span>{{ error || sdkError }}</span>
      <button aria-label="Dismiss" @click="dismissError">×</button>
    </div>
    <div v-if="!configured && sessionLoaded" class="setup-banner">
      Spotify credentials are not configured. Add them to <code>.env</code> to enable live data.
    </div>
  </div>
</template>
