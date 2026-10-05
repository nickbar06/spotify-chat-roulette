import { onBeforeUnmount, ref } from 'vue'
import { api } from './api'

interface SpotifyPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(event: string, callback: (payload: any) => void): boolean
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string
        getOAuthToken: (callback: (token: string) => void) => void
        volume: number
      }) => SpotifyPlayer
    }
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

let sdkPromise: Promise<void> | null = null

function loadSdk() {
  if (window.Spotify) return Promise.resolve()
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = resolve
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    script.onerror = () => reject(new Error('Could not load Spotify Web Playback SDK'))
    document.head.appendChild(script)
  })
  return sdkPromise
}

export function useSpotifyPlayer() {
  const ready = ref(false)
  const deviceId = ref<string | null>(null)
  const error = ref<string | null>(null)
  let player: SpotifyPlayer | null = null

  async function initialize() {
    try {
      await loadSdk()
      if (!window.Spotify || player) return

      player = new window.Spotify.Player({
        name: 'Spotify Chat Roulette',
        volume: 0.7,
        getOAuthToken: async (callback) => {
          try {
            const response = await api.get<{ accessToken: string }>('/api/player/token')
            callback(response.accessToken)
          } catch (tokenError) {
            error.value = tokenError instanceof Error ? tokenError.message : 'Could not authorize player'
          }
        },
      })

      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        deviceId.value = device_id
        ready.value = true
      })
      player.addListener('not_ready', () => {
        ready.value = false
      })
      player.addListener('authentication_error', ({ message }: { message: string }) => {
        error.value = message
      })
      player.addListener('account_error', () => {
        error.value = 'Spotify Premium is required for browser playback.'
      })
      player.addListener('initialization_error', ({ message }: { message: string }) => {
        error.value = message
      })

      const connected = await player.connect()
      if (!connected) error.value = 'Spotify browser player could not connect.'
    } catch (sdkError) {
      error.value = sdkError instanceof Error ? sdkError.message : 'Spotify player is unavailable'
    }
  }

  onBeforeUnmount(() => player?.disconnect())

  return { ready, deviceId, error, initialize }
}
