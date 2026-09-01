/**
 * Mural (OrdemTools) - IndexedDB Audio Persistence Service
 * Stores audio file Blobs and playlist metadata across browser/app restarts.
 */

import type { AudioPlaylist, AudioTrack } from '../../types';

const DB_NAME = 'mural_audio_db';
const DB_VERSION = 1;
const STORE_BLOBS = 'audio_blobs';
const STORE_PLAYLISTS = 'audio_playlists';

interface StoredTrackRecord {
  id: string;
  title: string;
  artist?: string;
  category?: 'music' | 'ambience';
  blob: Blob;
  mimeType: string;
  duration?: number;
}

interface StoredPlaylistRecord {
  id: string;
  name: string;
  category?: AudioPlaylist['category'];
  trackIds: string[];
  loop?: boolean;
}

class AudioStorageService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.reject(new Error('IndexedDB not available'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
          db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  async saveTrackBlob(id: string, file: File | Blob, title: string, artist?: string, category: 'music' | 'ambience' = 'music'): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_BLOBS], 'readwrite');
        const store = tx.objectStore(STORE_BLOBS);
        const record: StoredTrackRecord = {
          id,
          title,
          artist,
          category,
          blob: file,
          mimeType: file.type || 'audio/mpeg',
        };
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('[AudioStorage] Error saving track blob:', e);
    }
  }

  async saveCustomPlaylists(playlists: AudioPlaylist[]): Promise<void> {
    try {
      const db = await this.getDB();
      const customOnly = playlists.filter((p) => !p.id.startsWith('pl-combat') && !p.id.startsWith('pl-mystery') && !p.id.startsWith('pl-exploration') && !p.id.startsWith('pl-tavern'));

      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_PLAYLISTS], 'readwrite');
        const store = tx.objectStore(STORE_PLAYLISTS);
        store.clear(); // replace with current state

        for (const pl of customOnly) {
          const record: StoredPlaylistRecord = {
            id: pl.id,
            name: pl.name,
            category: pl.category,
            trackIds: pl.tracks.map((t) => t.id),
            loop: pl.loop,
          };
          store.put(record);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[AudioStorage] Error saving custom playlists:', e);
    }
  }

  async loadPersistedPlaylists(): Promise<AudioPlaylist[]> {
    try {
      const db = await this.getDB();

      // 1. Fetch all track blobs
      const allBlobs: Map<string, StoredTrackRecord> = await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_BLOBS], 'readonly');
        const store = tx.objectStore(STORE_BLOBS);
        const req = store.getAll();
        req.onsuccess = () => {
          const map = new Map<string, StoredTrackRecord>();
          for (const item of req.result as StoredTrackRecord[]) {
            map.set(item.id, item);
          }
          resolve(map);
        };
        req.onerror = () => reject(req.error);
      });

      // 2. Fetch all stored custom playlists
      const storedPlaylists: StoredPlaylistRecord[] = await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_PLAYLISTS], 'readonly');
        const store = tx.objectStore(STORE_PLAYLISTS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as StoredPlaylistRecord[]);
        req.onerror = () => reject(req.error);
      });

      // 3. Reconstruct playlists with fresh Object URLs
      const resultPlaylists: AudioPlaylist[] = [];

      for (const pl of storedPlaylists) {
        const tracks: AudioTrack[] = [];
        for (const tid of pl.trackIds) {
          const stored = allBlobs.get(tid);
          if (stored && stored.blob) {
            const objectUrl = URL.createObjectURL(stored.blob);
            tracks.push({
              id: stored.id,
              title: stored.title,
              artist: stored.artist || 'Ficheiro Local',
              src: objectUrl,
              category: stored.category || 'music',
              duration: stored.duration || 180,
            });
          }
        }

        resultPlaylists.push({
          id: pl.id,
          name: pl.name,
          category: pl.category || 'custom',
          loop: pl.loop ?? true,
          tracks,
        });
      }

      return resultPlaylists;
    } catch (e) {
      console.warn('[AudioStorage] Error restoring playlists from IndexedDB:', e);
      return [];
    }
  }

  async deleteTrackBlob(trackId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_BLOBS], 'readwrite');
      tx.objectStore(STORE_BLOBS).delete(trackId);
    } catch (e) {
      console.warn('[AudioStorage] Error deleting track blob:', e);
    }
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction([STORE_PLAYLISTS], 'readwrite');
      tx.objectStore(STORE_PLAYLISTS).delete(playlistId);
    } catch (e) {
      console.warn('[AudioStorage] Error deleting playlist record:', e);
    }
  }
}

export const audioStorage = new AudioStorageService();
