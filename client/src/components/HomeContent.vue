<script setup lang="ts">
import { ArrowLeft, Clock3, MessageCircle, Music2, Play, Radio, Sparkles, UserCheck, UserPlus, Users } from 'lucide-vue-next'
import type { PlaylistDetail, Profile } from '../types'

defineProps<{
  profile: Profile | null
  selectedProfile: Profile | null
  selectedPlaylist: PlaylistDetail | null
  isFriend: boolean
}>()
defineEmits<{
  connect: []
  openChat: []
  closeProfile: []
  closePlaylist: []
  toggleFriend: []
  playContext: [uri: string]
  playTrack: [uri: string]
}>()

const mixes = [
  { title: 'Discover Weekly', copy: 'Your shortcut to hidden gems, deep cuts, and new favorites.', className: 'mix--violet' },
  { title: 'Artist Radio', copy: 'A station built around the artists you have on repeat.', className: 'mix--green' },
  { title: 'Daily Mix 01', copy: 'Your favorite tracks and artists, all in one mix.', className: 'mix--orange' },
  { title: 'Daily Mix 02', copy: 'A fresh mix shaped by what you listen to.', className: 'mix--blue' },
]
</script>

<template>
  <main class="home-panel panel">
    <section v-if="selectedPlaylist" class="playlist-view">
      <button class="profile-back" @click="$emit('closePlaylist')"><ArrowLeft :size="18" /> Home</button>
      <div class="playlist-hero">
        <img v-if="selectedPlaylist.image" :src="selectedPlaylist.image" :alt="selectedPlaylist.name" />
        <span v-else class="playlist-hero__fallback"><Music2 /></span>
        <div>
          <small>Playlist</small>
          <h1>{{ selectedPlaylist.name }}</h1>
          <p v-if="selectedPlaylist.description">{{ selectedPlaylist.description }}</p>
          <strong>{{ selectedPlaylist.owner }}</strong>
          <span> · {{ selectedPlaylist.total }} songs</span>
        </div>
      </div>
      <div class="playlist-actions">
        <button class="playlist-play" aria-label="Play playlist" @click="$emit('playContext', selectedPlaylist.uri)">
          <Play fill="currentColor" />
        </button>
      </div>
      <div class="track-table">
        <div class="track-table__header"><span>#</span><span>Title</span><span>Album</span><Clock3 :size="15" /></div>
        <button
          v-for="(track, index) in selectedPlaylist.tracks"
          :key="track.id"
          class="track-row"
          @dblclick="$emit('playTrack', track.uri)"
        >
          <span class="track-row__index">{{ index + 1 }}</span>
          <span class="track-row__title">
            <strong>{{ track.name }}</strong>
            <small>{{ track.artists.map((artist) => artist.name).join(', ') }}</small>
          </span>
          <span class="track-row__album">{{ track.album?.name }}</span>
          <time>{{ Math.floor(track.durationMs / 60000) }}:{{ String(Math.floor(track.durationMs / 1000) % 60).padStart(2, '0') }}</time>
        </button>
        <p v-if="!selectedPlaylist.tracks.length" class="playlist-empty">This playlist has no available tracks.</p>
      </div>
    </section>

    <section v-else-if="selectedProfile" class="listener-profile">
      <button class="profile-back" @click="$emit('closeProfile')"><ArrowLeft :size="18" /> Home</button>
      <div class="profile-hero">
        <div class="profile-avatar">
          <img v-if="selectedProfile.image" :src="selectedProfile.image" :alt="selectedProfile.name" />
          <span v-else>{{ selectedProfile.name.slice(0, 1) }}</span>
        </div>
        <div class="profile-hero__copy">
          <span>Public profile <template v-if="selectedProfile.isBot">· Demo listener</template></span>
          <h1>{{ selectedProfile.name }}</h1>
          <p>{{ selectedProfile.tagline || 'Listening along on Spotify Chat Roulette' }}</p>
        </div>
      </div>
      <div class="profile-actions">
        <button class="hero-button" @click="$emit('toggleFriend')">
          <UserCheck v-if="isFriend" :size="18" />
          <UserPlus v-else :size="18" />
          {{ isFriend ? 'Friends' : 'Add friend' }}
        </button>
        <span v-if="selectedProfile.currentArtist">
          Listening to <strong>{{ selectedProfile.currentTrack || selectedProfile.currentArtist }}</strong>
          by {{ selectedProfile.currentArtist }}
        </span>
      </div>
      <section class="profile-section">
        <div class="section-heading"><h2>Top artists this month</h2><span>Demo profile</span></div>
        <div class="profile-artists">
          <article v-for="(artist, index) in selectedProfile.topArtists || [selectedProfile.currentArtist || 'Discovering music']" :key="artist">
            <span :class="`profile-artist profile-artist--${index + 1}`">{{ artist.slice(0, 1) }}</span>
            <strong>{{ artist }}</strong>
            <small>Artist</small>
          </article>
        </div>
      </section>
      <section class="profile-section profile-about">
        <h2>About</h2>
        <p>Met through a shared artist room. Friend connections in this prototype are saved only in your browser.</p>
      </section>
    </section>

    <template v-else>
    <section class="hero-card">
      <div class="hero-card__eyebrow"><Sparkles :size="14" /> Spotify Chat Roulette</div>
      <h1>Same artist.<br />New conversation.</h1>
      <p>Meet listeners who are playing the same artist right now. When your music changes, your room changes with it.</p>
      <div class="hero-card__actions">
        <button v-if="!profile" class="hero-button" @click="$emit('connect')">Connect Spotify</button>
        <button v-else class="hero-button" @click="$emit('openChat')"><MessageCircle :size="18" /> Open artist chat</button>
        <span v-if="profile">Made for {{ profile.name }}</span>
      </div>
      <div class="hero-orbit hero-orbit--one"><Music2 /></div>
      <div class="hero-orbit hero-orbit--two"><Users /></div>
      <div class="hero-orbit hero-orbit--three"><Radio /></div>
    </section>

    <nav class="content-filters" aria-label="Content type">
      <button class="filter-chip filter-chip--active">All</button>
      <button class="filter-chip">Music</button>
      <button class="filter-chip">Podcasts</button>
      <button class="filter-chip">Audiobooks</button>
    </nav>

    <section>
      <div class="section-heading">
        <h2>Made for {{ profile?.name || 'you' }}</h2>
        <button>Show all</button>
      </div>
      <div class="mix-grid">
        <article v-for="(mix, index) in mixes" :key="mix.title" class="mix-card">
          <div :class="['mix-art', mix.className]">
            <span>0{{ index + 1 }}</span>
            <Music2 :size="54" :stroke-width="1.5" />
            <b>{{ mix.title }}</b>
          </div>
          <strong>{{ mix.title }}</strong>
          <p>{{ mix.copy }}</p>
        </article>
      </div>
    </section>

    <section class="feature-row">
      <div>
        <span class="feature-icon"><Users /></span>
        <strong>Listening together</strong>
        <p>Your artist becomes your lobby.</p>
      </div>
      <div>
        <span class="feature-icon"><MessageCircle /></span>
        <strong>Chat that follows</strong>
        <p>Switch artists and the room follows automatically.</p>
      </div>
      <div>
        <span class="feature-icon"><Radio /></span>
        <strong>Live Spotify session</strong>
        <p>Your player remains in sync across devices.</p>
      </div>
    </section>
    </template>
  </main>
</template>
