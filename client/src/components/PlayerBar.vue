<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ExternalLink,
  Laptop2,
  ListMusic,
  Maximize2,
  Pause,
  Play,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-vue-next'
import type { Playback } from '../types'

const props = defineProps<{
  playback: Playback | null
  connected: boolean
  sdkReady: boolean
}>()

const emit = defineEmits<{
  connect: []
  control: [action: string, payload?: Record<string, unknown>]
  transfer: []
}>()

const displayProgress = ref(0)
let timer: number | undefined

const duration = computed(() => props.playback?.track?.durationMs || 0)
const progressPercent = computed(() =>
  duration.value ? Math.min(100, (displayProgress.value / duration.value) * 100) : 0,
)

watch(
  () => [props.playback?.progressMs, props.playback?.track?.id],
  () => {
    displayProgress.value = props.playback?.progressMs || 0
  },
  { immediate: true },
)

function tick() {
  if (props.playback?.isPlaying) {
    displayProgress.value = Math.min(duration.value, displayProgress.value + 1000)
  }
}

function formatTime(milliseconds: number) {
  if (!Number.isFinite(milliseconds)) return '0:00'
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function seek(event: Event) {
  const positionMs = Number((event.target as HTMLInputElement).value)
  displayProgress.value = positionMs
  emit('control', 'seek', { positionMs })
}

onMounted(() => {
  timer = window.setInterval(tick, 1000)
})
onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <footer class="player-bar">
    <div class="now-playing">
      <template v-if="playback?.track">
        <img v-if="playback.track.album?.image" :src="playback.track.album.image" :alt="playback.track.album.name" />
        <span class="now-playing__text">
          <a :href="playback.track.spotifyUrl || undefined" target="_blank">{{ playback.track.name }}</a>
          <small>{{ playback.track.artists.map((artist) => artist.name).join(', ') }}</small>
        </span>
        <a v-if="playback.track.spotifyUrl" class="spotify-link" :href="playback.track.spotifyUrl" target="_blank" aria-label="Open in Spotify"><ExternalLink :size="15" /></a>
      </template>
      <template v-else>
        <span class="now-playing__empty"><ListMusic :size="22" /></span>
        <span class="now-playing__text"><strong>{{ connected ? 'Nothing playing' : 'Connect Spotify' }}</strong><small>{{ connected ? 'Start music on any device' : 'Live playback will appear here' }}</small></span>
      </template>
    </div>

    <div class="player-center">
      <div class="player-controls">
        <button :class="{ active: playback?.shuffle }" :disabled="!playback?.track" aria-label="Shuffle" @click="$emit('control', 'shuffle', { state: !playback?.shuffle })"><Shuffle /></button>
        <button :disabled="!playback?.track" aria-label="Previous track" @click="$emit('control', 'previous')"><SkipBack fill="currentColor" /></button>
        <button class="play-button" :disabled="!playback?.track" :aria-label="playback?.isPlaying ? 'Pause' : 'Play'" @click="$emit('control', playback?.isPlaying ? 'pause' : 'play')">
          <Pause v-if="playback?.isPlaying" fill="currentColor" />
          <Play v-else fill="currentColor" />
        </button>
        <button :disabled="!playback?.track" aria-label="Next track" @click="$emit('control', 'next')"><SkipForward fill="currentColor" /></button>
        <button :class="{ active: playback?.repeat !== 'off' }" :disabled="!playback?.track" aria-label="Repeat" @click="$emit('control', 'repeat', { state: playback?.repeat === 'off' ? 'context' : 'off' })"><Repeat2 /></button>
      </div>
      <div class="progress-row">
        <time>{{ formatTime(displayProgress) }}</time>
        <input
          type="range"
          min="0"
          :max="duration || 1"
          :value="displayProgress"
          :style="{ '--range-progress': `${progressPercent}%` }"
          :disabled="!playback?.track"
          aria-label="Track progress"
          @change="seek"
        />
        <time>{{ formatTime(duration) }}</time>
      </div>
    </div>

    <div class="player-extras">
      <button v-if="sdkReady" class="device-button" @click="$emit('transfer')"><Laptop2 :size="17" /><span>Listen here</span></button>
      <span v-else-if="playback?.device" class="device-name"><Laptop2 :size="16" />{{ playback.device.name }}</span>
      <Volume2 :size="18" />
      <input
        class="volume-slider"
        type="range"
        min="0"
        max="100"
        :value="playback?.device?.volume ?? 70"
        aria-label="Volume"
        @change="$emit('control', 'volume', { volume: Number(($event.target as HTMLInputElement).value) })"
      />
      <button aria-label="Fullscreen"><Maximize2 :size="16" /></button>
    </div>
  </footer>
</template>
