export interface Profile {
  id: string
  name: string
  image: string | null
  product?: string
  spotifyUrl?: string | null
  isBot?: boolean
  tagline?: string
  currentArtist?: string
  currentTrack?: string
  topArtists?: string[]
}

export interface Artist {
  id: string
  name: string
  spotifyUrl?: string | null
}

export interface Track {
  id: string
  uri: string
  name: string
  type: string
  durationMs: number
  explicit: boolean
  artists: Artist[]
  album: {
    id: string
    name: string
    image: string | null
    spotifyUrl?: string | null
  } | null
  spotifyUrl?: string | null
}

export interface Playback {
  available: boolean
  isPlaying: boolean
  progressMs: number
  timestamp: number
  shuffle: boolean
  repeat: 'off' | 'track' | 'context'
  device: {
    id: string | null
    name: string
    type: string
    volume: number
    active: boolean
  } | null
  track: Track | null
}

export interface LibraryItem {
  id: string
  uri?: string
  name: string
  type: string
  detail?: string
  image?: string | null
  album?: { image: string | null }
  artists?: Artist[]
  spotifyUrl?: string | null
}

export interface Library {
  playlists: LibraryItem[]
  tracks: LibraryItem[]
  albums: LibraryItem[]
  artists: LibraryItem[]
}

export interface ChatMessage {
  id: string
  user: Profile
  message: string
  sentAt: string
  demo?: boolean
}

export interface ChatRoom {
  id: string
  artistId?: string
  name: string
}

export interface ActiveRoom extends ChatRoom {
  listenerCount: number
  participants: Profile[]
}

export interface PlaylistDetail {
  id: string
  uri: string
  name: string
  description: string
  image: string | null
  owner: string
  total: number
  tracks: Track[]
}
