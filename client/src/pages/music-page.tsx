import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Loader2, Search as SearchIcon, MoreVertical, Trash2, Pencil, Play, Pause, Music as MusicIcon, X, Users, Download, ArrowLeft, Heart, Album } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAudioPlayer } from '@/hooks/use-audio-player';

// Local item type
type AudioItem = {
  id: string;
  url: string;
  title: string;
  artist?: string;
  coverUrl?: string;
  createdAt: number;
};

export default function MusicPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const player = useAudioPlayer();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const [viewingPartnerMusic, setViewingPartnerMusic] = useState(false);
  const [currentView, setCurrentView] = useState<'all' | 'favorites' | string>('all'); // 'all', 'favorites', or album id
  // DnD state for reordering
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [_loadingList, setLoadingList] = useState(false);
  // DnD state for album tabs ordering
  const [albumDraggingId, setAlbumDraggingId] = useState<string | null>(null);
  const [albumOverId, setAlbumOverId] = useState<string | null>(null);

  // Albums and favorites management
  const [albums, setAlbums] = useState<Array<{id: string, name: string, tracks: string[]}>>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showNewAlbumDialog, setShowNewAlbumDialog] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');

  // Get partner info
  const { data: partnerData, isLoading: isPartnerLoading, error: _partnerError } = useQuery<{partner: {id: string, username: string, firstName?: string} | null}>({
    queryKey: ["/api/partner"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Debug partner data
  // console.warn('Partner data:', partnerData);
  // console.warn('Partner loading:', isPartnerLoading);
  // console.error('Partner error:', partnerError);

  // TEMPORARY: Mock partner data for testing (remove in production)
  const mockPartnerForTesting = {
    partner: {
      id: 'test-partner-id',
      username: 'testpartner',
      firstName: 'Анна'
    }
  };
  
  // Force use mock data for testing (always show partner button)
  const effectivePartnerData = mockPartnerForTesting;

  // Check M4A support in browser
  const checkM4ASupport = useCallback(() => {
    const audio = document.createElement('audio');
    const canPlay = {
      m4a: audio.canPlayType('audio/mp4'),
      aac: audio.canPlayType('audio/aac'),
      m4a_alt: audio.canPlayType('audio/m4a')
    };
    return canPlay;
  }, []);

  // Function to decline name to genitive case (possessive)
  const _declineName = (name: string): string => {
    if (!name) return name;
    
    const lowerName = name.toLowerCase();
    
    // For names ending with consonants - add 'а'
    const consonants = ['б', 'в', 'г', 'д', 'ж', 'з', 'к', 'л', 'м', 'н', 'п', 'р', 'с', 'т', 'ф', 'х', 'ц', 'ч', 'ш', 'щ'];
    
    // Special cases for common names
    const specialCases: Record<string, string> = {
      'александр': 'Александра',
      'андрей': 'Андрея', 
      'алексей': 'Алексея',
      'дмитрий': 'Дмитрия',
      'евгений': 'Евгения',
      'николай': 'Николая',
      'сергей': 'Сергея',
      'игорь': 'Игоря',
      'павел': 'Павла',
      'анна': 'Анны',
      'мария': 'Марии',
      'елена': 'Елены',
      'наталья': 'Натальи',
      'ольга': 'Ольги',
      'татьяна': 'Татьяны',
      'ирина': 'Ирины'
    };

    if (specialCases[lowerName]) {
      return specialCases[lowerName];
    }

    const lastChar = name.slice(-1).toLowerCase();
    
    // For names ending with 'а', 'я' - change to 'ы', 'и'  
    if (lastChar === 'а') {
      return name.slice(0, -1) + 'ы';
    }
    if (lastChar === 'я') {
      return name.slice(0, -1) + 'и';
    }
    
    // For names ending with consonants - add 'а'
    if (consonants.includes(lastChar)) {
      return name + 'а';
    }
    
    // Default - return as is
    return name;
  };

  // Persist simple metadata locally (url -> {title, artist, coverUrl})
  const getCurrentUserId = () => viewingPartnerMusic ? partnerData?.partner?.id || 'partner' : 'own';
  const META_KEY = `music_meta_v1_${getCurrentUserId()}`;
  const ORDER_KEY = `music_order_v1_${getCurrentUserId()}`;
  const FAVORITES_KEY = `music_favorites_v1_${getCurrentUserId()}`;
  const ALBUMS_KEY = `music_albums_v1_${getCurrentUserId()}`;
  
  const getMetaMap = useCallback((): Record<string, { title: string; artist?: string; coverUrl?: string }> => {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {};
    } catch { return {}; }
  }, [META_KEY]);
  const getOrder = useCallback((): string[] => {
    try { return JSON.parse(localStorage.getItem(ORDER_KEY) || '[]') || []; } catch { return []; }
  }, [ORDER_KEY]);
  const saveOrder = useCallback((urls: string[]) => {
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(urls)); } catch {}
  }, [ORDER_KEY]);

  // Favorites management
  const getFavorites = useCallback((): string[] => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]') || []; } catch { return []; }
  }, [FAVORITES_KEY]);
  const saveFavorites = useCallback((favorites: string[]) => {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch {}
  }, [FAVORITES_KEY]);

  // Albums management  
  const getAlbums = useCallback((): Array<{id: string, name: string, tracks: string[]}> => {
    try { return JSON.parse(localStorage.getItem(ALBUMS_KEY) || '[]') || []; } catch { return []; }
  }, [ALBUMS_KEY]);
  const saveAlbums = useCallback((albums: Array<{id: string, name: string, tracks: string[]}>) => {
    try { localStorage.setItem(ALBUMS_KEY, JSON.stringify(albums)); } catch {}
  }, [ALBUMS_KEY]);
  const applySavedOrder = useCallback((items: AudioItem[]): AudioItem[] => {
    const order = getOrder();
    if (!order.length) return items;
    const indexMap = new Map(order.map((u, i) => [u, i] as const));
    return [...items].sort((a, b) => {
      const ai = indexMap.get(a.url);
      const bi = indexMap.get(b.url);
      if (ai == null && bi == null) return 0;
      if (ai == null) return 1;
      if (bi == null) return -1;
      return ai - bi;
    });
  }, [getOrder]);
  const upsertMeta = (url: string, meta: { title: string; artist?: string; coverUrl?: string }) => {
    try {
      const map = getMetaMap();
      map[url] = { title: meta.title, artist: meta.artist, coverUrl: meta.coverUrl };
      localStorage.setItem(META_KEY, JSON.stringify(map));
    } catch {}
  };
  const removeMeta = (url: string) => {
    try {
      const map = getMetaMap();
      if (map[url]) {
        delete map[url];
        localStorage.setItem(META_KEY, JSON.stringify(map));
      }
    } catch {}
  };

  // Upload dialog state
  const [metaOpen, setMetaOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaArtist, setMetaArtist] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<AudioItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [clearCover, setClearCover] = useState(false);

  const onClickAdd = () => fileInputRef.current?.click();

  const isPlayingUrl = (url: string) => player.current?.url === url && player.playing;
  const onToggleItem = (item: AudioItem) => {
    if (player.current?.url === item.url) {
      player.toggle();
      return;
    }
    // Build queue from current filtered list, start from clicked index
    const idx = filtered.findIndex(f => f.id === item.id);
    const queue = filtered.map(f => ({ url: f.url, title: f.title, artist: f.artist, coverUrl: f.coverUrl }));
    player.playList(queue, Math.max(0, idx));
  };

  const deleteAudio = async (item: AudioItem) => {
    try {
      // Stop global player if this track is current
      if (player.current?.url === item.url) {
        player.stop();
      }

      const urlParam = encodeURIComponent(item.url);
      const res = await fetch(`/api/audios?url=${urlParam}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || 'Не удалось удалить аудио');
      }
      // Remove from UI и метаданных (по URL — надёжнее, чем по id)
      setAudios((prev) => {
        const next = prev.filter(a => a.url !== item.url);
        saveOrder(next.map(x => x.url));
        return next;
      });
      removeMeta(item.url);
      toast({ title: 'Удалено', description: item.title });
    } catch (e: any) {
      toast({ title: 'Ошибка удаления', description: e.message || 'Попробуйте снова', variant: 'destructive' });
    }
  };

  const copyTrackToMyLibrary = (item: AudioItem) => {
    if (!viewingPartnerMusic) return;
    
    // Switch to own music library keys
    const ownMetaKey = 'music_meta_v1_own';
    const ownOrderKey = 'music_order_v1_own';
    
    try {
      // Get current own library metadata
      const ownMetaMap = JSON.parse(localStorage.getItem(ownMetaKey) || '{}');
      const ownOrder = JSON.parse(localStorage.getItem(ownOrderKey) || '[]');
      
      // Check if track already exists in own library
      if (ownMetaMap[item.url]) {
        toast({ 
          title: 'Трек уже добавлен', 
          description: 'Этот трек уже есть в вашей библиотеке',
          variant: 'destructive'
        });
        return;
      }
      
      // Add track metadata to own library
      ownMetaMap[item.url] = {
        title: item.title,
        artist: item.artist,
        coverUrl: item.coverUrl
      };
      
      // Add to order (at the end)
      if (!ownOrder.includes(item.url)) {
        ownOrder.push(item.url);
      }
      
      // Save to localStorage
      localStorage.setItem(ownMetaKey, JSON.stringify(ownMetaMap));
      localStorage.setItem(ownOrderKey, JSON.stringify(ownOrder));
      
      toast({ 
        title: 'Трек добавлен', 
        description: `"${item.title}" добавлен в вашу библиотеку` 
      });
      
  } catch (_error) {
      toast({ 
        title: 'Ошибка', 
        description: 'Не удалось добавить трек в библиотеку',
        variant: 'destructive'
      });
    }
  };

  const downloadTrack = async (item: AudioItem) => {
    try {
      // Создаем имя файла с метаданными
      let fileName = item.title;
      if (item.artist) {
        fileName = `${item.artist} - ${item.title}`;
      }
      
      // Очищаем имя файла от недопустимых символов
      fileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
      
      // Получаем расширение файла из URL
      const urlParts = item.url.split('.');
      let extension = urlParts.length > 1 ? `.${urlParts[urlParts.length - 1].split('?')[0]}` : '.mp3';
      
      // Нормализуем расширение для M4A
      if (extension.toLowerCase() === '.m4a' || extension.toLowerCase() === '.mp4') {
        extension = '.m4a';
      }
      fileName += extension;

      // Загружаем файл
      const response = await fetch(item.url);
      if (!response.ok) {
        throw new Error('Не удалось загрузить файл');
      }

      const blob = await response.blob();
      
      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      
      // Добавляем в DOM, кликаем и удаляем
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Освобождаем память
      window.URL.revokeObjectURL(url);
      
      toast({ 
        title: 'Скачивание началось', 
        description: `Файл "${fileName}" загружается` 
      });
      
  } catch (_error: any) {
      toast({ 
        title: 'Ошибка скачивания', 
    description: _error.message || 'Не удалось скачать файл',
        variant: 'destructive'
      });
    }
  };

  // Toggle favorite status
  const toggleFavorite = (trackUrl: string) => {
    const currentFavorites = getFavorites();
    const newFavorites = currentFavorites.includes(trackUrl)
      ? currentFavorites.filter(url => url !== trackUrl)
      : [...currentFavorites, trackUrl];
    
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
    
    const action = newFavorites.includes(trackUrl) ? 'добавлен в' : 'удален из';
    const track = audios.find(a => a.url === trackUrl);
    toast({
      title: `Трек ${action} избранное`,
      description: track?.title || 'Трек'
    });
  };

  // Create new album
  const createAlbum = (name: string) => {
    if (!name.trim()) return;
    
    const newAlbum = {
      id: Date.now().toString(),
      name: name.trim(),
      tracks: []
    };
    
    const currentAlbums = getAlbums();
    const newAlbums = [...currentAlbums, newAlbum];
    
    setAlbums(newAlbums);
    saveAlbums(newAlbums);
    
    toast({
      title: 'Альбом создан',
      description: `Альбом "${name}" успешно создан`
    });
  };

  // Delete album
  const deleteAlbum = (albumId: string) => {
    const currentAlbums = getAlbums();
    const album = currentAlbums.find(a => a.id === albumId);
    const newAlbums = currentAlbums.filter(a => a.id !== albumId);
    
    setAlbums(newAlbums);
    saveAlbums(newAlbums);
    
    // Return to all music view if current album was deleted
    if (currentView === albumId) {
      setCurrentView('all');
    }
    
    toast({
      title: 'Альбом удален',
      description: `Альбом "${album?.name}" удален`
    });
  };

  // Add track to album
  const addToAlbum = (trackUrl: string, albumId: string) => {
    const currentAlbums = getAlbums();
    const newAlbums = currentAlbums.map(album => {
      if (album.id === albumId && !album.tracks.includes(trackUrl)) {
        return { ...album, tracks: [...album.tracks, trackUrl] };
      }
      return album;
    });
    
    setAlbums(newAlbums);
    saveAlbums(newAlbums);
    
    const album = newAlbums.find(a => a.id === albumId);
    const track = audios.find(a => a.url === trackUrl);
    toast({
      title: 'Трек добавлен в альбом',
      description: `"${track?.title}" добавлен в альбом "${album?.name}"`
    });
  };

  const resetFilePicker = () => { if (fileInputRef.current) fileInputRef.current.value = ''; };
  const resetCoverPicker = () => {
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/opus',
      'audio/webm', 'audio/aac', 'audio/mp4', 'audio/flac', 'audio/x-flac', 'application/octet-stream'
    ];
    if (!allowed.includes(file.type)) {
      toast({ title: 'Неподдерживаемый формат', description: 'Допустимые: MP3, WAV, OGG/OPUS, M4A/AAC, FLAC, WebM', variant: 'destructive' });
      resetFilePicker();
      return;
    }
    // Prepare metadata dialog
    const baseName = file.name.replace(/\.[^.]+$/, '');
    setSelectedFile(file);
    setMetaTitle(baseName);
    setMetaArtist('');
    resetCoverPicker();
    setMetaOpen(true);
  };

  const uploadWithMeta = (file: File, title: string, artist?: string) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload/audio');
    xhr.withCredentials = true;
    const fd = new FormData();
    fd.append('audio', file);

    setIsUploading(true);
    setUploadProgress(0);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      setIsUploading(false);
      setUploadProgress(null);
      try {
        const json = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && json?.url) {
          const baseItem: AudioItem = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            url: json.url as string,
            title: title.trim() || file.name,
            artist: artist?.trim() || undefined,
            createdAt: Date.now(),
          };
          // Optionally upload cover and then finalize
          const finish = (coverUrl?: string) => {
            const item: AudioItem = { ...baseItem, coverUrl };
            setAudios((prev) => {
              const next = [item, ...prev];
              saveOrder(next.map(x => x.url));
              return next;
            });
            upsertMeta(item.url, { title: item.title, artist: item.artist, coverUrl });
            const desc = item.artist ? `${item.artist} — ${item.title}` : item.title;
            toast({ title: 'Аудио загружено', description: desc });
          };
          if (coverFile) {
            const fd2 = new FormData();
            fd2.append('image', coverFile);
            fetch('/api/upload/audio-cover', { method: 'POST', body: fd2, credentials: 'include' })
              .then(r => r.json().then(j => ({ ok: r.ok, j })))
              .then(({ ok, j }) => {
                if (ok && j?.url) finish(j.url as string); else finish(undefined);
              })
              .catch(() => finish(undefined))
              .finally(() => { resetCoverPicker(); });
          } else {
            finish(undefined);
          }
        } else {
          throw new Error(json?.message || 'Ошибка загрузки аудио');
        }
      } catch (err: any) {
        toast({ title: 'Ошибка', description: err.message || 'Не удалось загрузить аудио', variant: 'destructive' });
      } finally {
        setMetaOpen(false);
        setSelectedFile(null);
        resetFilePicker();
        resetCoverPicker();
      }
    };
    xhr.onerror = () => {
      setIsUploading(false);
      setUploadProgress(null);
      toast({ title: 'Сеть недоступна', description: 'Проверьте соединение и попробуйте снова', variant: 'destructive' });
      setMetaOpen(false);
      setSelectedFile(null);
      resetFilePicker();
    };
    xhr.send(fd);
  };

  const openEdit = (item: AudioItem) => {
    setEditItem(item);
    setEditTitle(item.title);
    setEditArtist(item.artist || '');
    setEditCoverFile(null);
    setEditCoverPreview(null);
    setClearCover(false);
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!editItem) return;
    const newTitle = editTitle.trim() || editItem.title;
    const newArtist = editArtist.trim() || undefined;
    const apply = (coverUrl?: string) => {
      const next = { ...editItem, title: newTitle, artist: newArtist, coverUrl: clearCover ? undefined : (coverUrl ?? editItem.coverUrl) } as AudioItem;
      setAudios((prev) => prev.map(a => a.id === editItem.id ? next : a));
      upsertMeta(editItem.url, { title: newTitle, artist: newArtist, coverUrl: next.coverUrl });
      try { (player as any).updateTrackMeta?.(editItem.url, { title: newTitle, artist: newArtist, coverUrl: next.coverUrl }); } catch {}
      toast({ title: 'Сохранено', description: newArtist ? `${newArtist} — ${newTitle}` : newTitle });
      setEditOpen(false);
      setEditItem(null);
      setEditCoverFile(null);
      setEditCoverPreview(null);
      setClearCover(false);
    };
    if (clearCover) {
      apply(undefined);
      return;
    }
    if (editCoverFile) {
      const fd = new FormData();
      fd.append('image', editCoverFile);
      fetch('/api/upload/audio-cover', { method: 'POST', body: fd, credentials: 'include' })
        .then(r => r.json().then(j => ({ ok: r.ok, j })))
        .then(({ ok, j }) => apply(ok && j?.url ? (j.url as string) : undefined))
        .catch(() => apply(undefined));
      return;
    }
    apply(undefined);
  };

  // Check audio format support on mount
  useEffect(() => {
    checkM4ASupport();
  }, [checkM4ASupport]);

  // Load favorites and albums from localStorage
  useEffect(() => {
    setFavorites(getFavorites());
    setAlbums(getAlbums());
  }, [getFavorites, getAlbums, viewingPartnerMusic, partnerData?.partner?.id]);

  // Initial fetch of existing files so list survives refresh in dev
  useEffect(() => {
    let canceled = false;
    const load = async () => {
      setLoadingList(true);
      try {
        const res = await fetch('/api/audios', { credentials: 'include' });
        const data = await res.json().catch(() => ({ audios: [] }));
        if (canceled) return;
    const meta = getMetaMap();
  const itemsRaw: AudioItem[] = (data?.audios || []).map((a: any) => {
          const baseName = (a.name || '').replace(/\.[^.]+$/, '') || 'Аудио';
          const m = meta[a.url];
          return {
            id: a.url, // stable id per file
            url: a.url as string,
            title: (m?.title || baseName) as string,
            artist: m?.artist,
            coverUrl: m?.coverUrl,
            createdAt: a.modifiedAt ? Date.parse(a.modifiedAt) : Date.now(),
          } as AudioItem;
        });
    const items = applySavedOrder(itemsRaw);
    setAudios(items);
      } catch {
        if (!canceled) setAudios([]);
      } finally {
        if (!canceled) setLoadingList(false);
      }
    };
    load();
    return () => { canceled = true; };
  }, [applySavedOrder, getMetaMap, viewingPartnerMusic, partnerData?.partner?.id]); // Reload when switching users

  const filtered = useMemo(() => {
    let baseList = audios;
    
    // Filter by current view (all, favorites, or album)
    if (currentView === 'favorites') {
      baseList = audios.filter(a => favorites.includes(a.url));
    } else if (currentView !== 'all') {
      // Viewing specific album
      const album = albums.find(a => a.id === currentView);
      if (album) {
        baseList = audios.filter(a => album.tracks.includes(a.url));
      }
    }
    
    // Apply search filter
    if (!query.trim()) return baseList;
    const q = query.trim().toLowerCase();
    return baseList.filter(a =>
      a.title.toLowerCase().includes(q) || (a.artist ? a.artist.toLowerCase().includes(q) : false)
    );
  }, [query, audios, currentView, favorites, albums]);

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden">
      <main className="flex-1 p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          {/* Header layout: three columns on desktop, stacked on mobile */}
          <div className="mb-4 sm:mb-6 relative flex flex-col sm:grid sm:grid-cols-[auto,1fr,auto] items-center gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground w-full sm:w-auto text-center sm:text-left">
              {(() => {
                if (viewingPartnerMusic && effectivePartnerData?.partner) {
                  return 'Музыка партнера';
                }
                if (currentView === 'favorites') return 'Избранное';
                if (currentView !== 'all') {
                  const album = albums.find(a => a.id === currentView);
                  return album ? `Альбом: ${album.name}` : 'Музыка';
                }
                return 'Музыка';
              })()}
            </h1>
            {/* Centered to viewport */}
      <div className="w-full sm:w-auto sm:absolute sm:left-1/2 sm:-translate-x-1/2 z-10 order-3 sm:order-none mt-2 sm:mt-0">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-20" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск..."
        className="px-8 w-full sm:w-[27rem] max-w-full sm:max-w-[90vw] glass focus-ring text-center placeholder:text-center"
              />
            </div>
      <div className="w-full sm:w-auto flex justify-center sm:justify-end order-2 sm:order-none">
              {!viewingPartnerMusic && (
                <Button onClick={onClickAdd} className="btn-gradient" disabled={isUploading}>
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Добавить
                </Button>
              )}
            </div>
          </div>

          {/* Partner music toggle */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {viewingPartnerMusic ? (
              // When viewing partner's music - show back button
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingPartnerMusic(false)}
                className="flex items-center gap-2 hover-lift"
              >
                <ArrowLeft className="h-4 w-4" />
                Моя музыка
              </Button>
            ) : (
              // When viewing own music - show partner music button (if partner exists)
              (effectivePartnerData?.partner || isPartnerLoading) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewingPartnerMusic(true)}
                  className="flex items-center gap-2 hover-lift"
                  disabled={isPartnerLoading}
                >
                  <Users className="h-4 w-4" />
                  {isPartnerLoading ? 'Загрузка...' : 'Музыка партнера'}
                </Button>
              )
            )}
            {/* Debug info - remove in production */}
            {!viewingPartnerMusic && (
              <div className="text-xs text-muted-foreground">
                Тестовый режим: используются mock-данные партнера
              </div>
            )}
          </div>

          {/* Navigation tabs (centered above playlist) */}
          {!viewingPartnerMusic && (
            <div className="mb-4 flex w-full justify-center">
              <div className="flex w-full max-w-[700px] flex-nowrap sm:flex-wrap items-center justify-start sm:justify-center gap-2 px-1 overflow-x-auto no-scrollbar">
                <Button
                  variant={currentView === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentView('all')}
                  className="flex items-center gap-2"
                >
                  <MusicIcon className="h-4 w-4" />
                  Все треки ({audios.length})
                </Button>

                <Button
                  variant={currentView === 'favorites' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentView('favorites')}
                  className="flex items-center gap-2"
                >
                  <Heart className="h-4 w-4" />
                  Избранное ({favorites.length})
                </Button>

                {albums.map(album => (
                  <Button
                    key={album.id}
                    variant={currentView === album.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentView(album.id)}
                    className={`flex items-center gap-2 ${albumDraggingId === album.id ? 'opacity-60' : ''} ${albumOverId === album.id ? 'ring-2 ring-primary/50' : ''}`}
                    draggable
                    onDragStart={(e) => { setAlbumDraggingId(album.id); try { e.dataTransfer.setData('text/plain', album.id); } catch {} e.dataTransfer.effectAllowed = 'move'; }}
                    onDragOver={(e) => { e.preventDefault(); setAlbumOverId(album.id); e.dataTransfer.dropEffect = 'move'; }}
                    onDragLeave={() => { setAlbumOverId((v) => v === album.id ? null : v); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const srcId = albumDraggingId || e.dataTransfer.getData('text/plain');
                      if (!srcId || srcId === album.id) { setAlbumDraggingId(null); setAlbumOverId(null); return; }
                      setAlbums((prev) => {
                        const srcIndex = prev.findIndex(x => x.id === srcId);
                        const dstIndex = prev.findIndex(x => x.id === album.id);
                        if (srcIndex < 0 || dstIndex < 0) return prev;
                        const next = [...prev];
                        const [moved] = next.splice(srcIndex, 1);
                        next.splice(dstIndex, 0, moved);
                        saveAlbums(next);
                        return next;
                      });
                      setAlbumDraggingId(null);
                      setAlbumOverId(null);
                    }}
                    onDragEnd={() => { setAlbumDraggingId(null); setAlbumOverId(null); }}
                    style={{ cursor: 'grab' }}
                    title={`Альбом: ${album.name}`}
                  >
                    <Album className="h-4 w-4" />
                    {album.name} ({album.tracks.length})
                  </Button>
                ))}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewAlbumDialog(true)}
                  className="flex items-center gap-2 border-2 border-dashed border-muted-foreground/50"
                  title="Новый альбом"
                  aria-label="Новый альбом"
                >
                  <Plus className="h-4 w-4" />
                  {/* sr-only text for accessibility, visually only '+' */}
                  <span className="sr-only">Новый альбом</span>
                </Button>
              </div>
            </div>
          )}

          {/* Album delete button (moved below playlist) */}

          {/* Upload progress */}
          {isUploading && (
            <div className="mb-4">
              <div className="h-2 w-full bg-muted rounded">
                <div className="h-2 bg-primary rounded transition-all" style={{ width: `${uploadProgress ?? 0}%` }} />
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mp3,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/opus,audio/webm,audio/aac,audio/mp4,audio/m4a,audio/x-m4a,audio/flac,audio/x-flac,.mp3,.wav,.ogg,.oga,.opus,.webm,.m4a,.aac,.flac"
          onChange={handleFiles}
          className="hidden"
        />

        {/* Vertical list: single shared background */}
        <div className={`flex justify-center ${filtered.length === 0 ? 'mt-6' : ''}`}>
          {filtered.length === 0 ? (
            <div className="glass rounded-xl p-6 sm:p-8 text-center w-full max-w-[900px]">
              <p className="text-muted-foreground text-lg">Аудио не найдено. Добавьте файл или измените запрос.</p>
            </div>
          ) : (
            <div className="glass rounded-xl w-full max-w-[700px] divide-y divide-border/50 overflow-hidden" data-testid="music-list">
              {filtered.map((a) => (
                <div
                  key={a.id}
                  className={`px-4 py-2 flex flex-col gap-1.5 group transition-transform hover-lift ${draggingId === a.id ? 'opacity-60' : ''} ${overId === a.id ? 'bg-accent/30' : ''}`}
                  data-testid={`music-row-${a.id}`}
                  draggable
                  onDragStart={(e) => { setDraggingId(a.id); try { e.dataTransfer.setData('text/plain', a.id); } catch {} e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={(e) => { e.preventDefault(); setOverId(a.id); e.dataTransfer.dropEffect = 'move'; }}
                  onDragLeave={() => { setOverId((v) => v === a.id ? null : v); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const srcId = draggingId || e.dataTransfer.getData('text/plain');
                    if (!srcId || srcId === a.id) { setDraggingId(null); setOverId(null); return; }
                    setAudios((prev) => {
                      const srcIndex = prev.findIndex(x => x.id === srcId);
                      const dstIndex = prev.findIndex(x => x.id === a.id);
                      if (srcIndex < 0 || dstIndex < 0) return prev;
                      const next = [...prev];
                      const [moved] = next.splice(srcIndex, 1);
                      next.splice(dstIndex, 0, moved);
                      // persist order by URL
                      saveOrder(next.map(x => x.url));
                      return next;
                    });
                    setDraggingId(null);
                    setOverId(null);
                  }}
                  onDragEnd={() => { setDraggingId(null); setOverId(null); }}
                  style={{ cursor: 'grab' }}
                >
                  <div className="flex items-center justify-between gap-3 min-w-0 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative h-9 w-9 shrink-0">
                        {/* Cover tile */}
                        {a.coverUrl ? (
                          <img src={a.coverUrl} alt="Обложка" className="h-9 w-9 rounded object-cover border border-border/50" />
                        ) : (
                          <div className="h-9 w-9 rounded bg-muted/60 flex items-center justify-center text-muted-foreground border border-border/50">
                            <MusicIcon className="h-4 w-4" />
                          </div>
                        )}
                        {/* Overlay play/pause button */}
                        {(() => {
                          const isCurrent = player.current?.url === a.url;
                          const isPlaying = isPlayingUrl(a.url);
                          const alwaysVisible = isPlaying || isCurrent;
                          return (
                            <button
                              type="button"
                              onClick={() => onToggleItem(a)}
                              title={isPlaying ? 'Пауза' : 'Воспроизвести'}
                              aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}
                              className={`absolute inset-0 rounded flex items-center justify-center bg-background/40 backdrop-blur-sm transition-opacity ${alwaysVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                            >
                              {isPlaying ? <Pause className="h-4 w-4 text-foreground drop-shadow" /> : <Play className="h-4 w-4 text-foreground drop-shadow" />}
                            </button>
                          );
                        })()}
                      </div>
                      <div className="font-medium text-sm leading-tight truncate break-all" title={a.artist ? `${a.title} ${a.artist}` : a.title}>
                        <span className="text-foreground">{a.title}</span>
                        {a.artist ? (
                          <>
                            <span className="ml-1 text-muted-foreground">{a.artist}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <div className="hidden sm:block text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Дополнительно">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {viewingPartnerMusic ? (
                            // Partner's music - show "Add to my library"
                            <DropdownMenuItem onClick={() => copyTrackToMyLibrary(a)}>
                              <Plus className="h-4 w-4" /> Добавить себе
                            </DropdownMenuItem>
                          ) : (
                            // Own music - show edit, download, favorite and delete
                            <>
                              {currentView === 'favorites' ? (
                                // In Favorites show only: remove from favorites and download
                                <>
                                  <DropdownMenuItem onClick={() => toggleFavorite(a.url)}>
                                    <Heart className={`h-4 w-4 ${favorites.includes(a.url) ? 'fill-current text-red-500' : ''}`} />
                                    {favorites.includes(a.url) ? 'Убрать из избранного' : 'В избранное'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => downloadTrack(a)}>
                                    <Download className="h-4 w-4" /> Скачать
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                // In other views keep full menu
                                <>
                                  <DropdownMenuItem onClick={() => toggleFavorite(a.url)}>
                                    <Heart className={`h-4 w-4 ${favorites.includes(a.url) ? 'fill-current text-red-500' : ''}`} />
                                    {favorites.includes(a.url)
                                      ? (currentView === 'all' ? 'В избранном' : 'Убрать из избранного')
                                      : 'В избранное'}
                                  </DropdownMenuItem>
                                  {albums.length > 0 && (
                                    <>
                                      <div className="px-2 py-1 text-xs text-muted-foreground">Добавить в альбом:</div>
                                      {albums.map(album => (
                                        <DropdownMenuItem 
                                          key={album.id} 
                                          onClick={() => addToAlbum(a.url, album.id)}
                                          disabled={album.tracks.includes(a.url)}
                                        >
                                          <Album className="h-4 w-4" />
                                          {album.name} {album.tracks.includes(a.url) && '(уже добавлен)'}
                                        </DropdownMenuItem>
                                      ))}
                                    </>
                                  )}
                                  <DropdownMenuItem onClick={() => openEdit(a)}>
                                    <Pencil className="h-4 w-4" /> Изменить
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => downloadTrack(a)}>
                                    <Download className="h-4 w-4" /> Скачать
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => deleteAudio(a)} className="text-red-600 focus:text-red-600">
                                    <Trash2 className="h-4 w-4" /> Удалить
                                  </DropdownMenuItem>
                                </>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Bottom-centered album delete button */}
        {!viewingPartnerMusic && currentView !== 'all' && currentView !== 'favorites' && (
          <div className="mt-4 flex w-full justify-center">
            <div className="w-full max-w-[700px] flex justify-center">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteAlbum(currentView)}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Удалить альбом
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Metadata dialog */}
      <Dialog open={metaOpen} onOpenChange={(o) => { if (!isUploading) setMetaOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Детали трека</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Название</Label>
              <Input id="title" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} disabled={isUploading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="artist">Исполнитель (необязательно)</Label>
              <Input id="artist" value={metaArtist} onChange={(e) => setMetaArtist(e.target.value)} disabled={isUploading} />
            </div>
            <div className="space-y-2">
              <Label>Обложка (необязательно)</Label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (!f) { resetCoverPicker(); return; }
                    if (!['image/png','image/jpeg','image/webp'].includes(f.type)) {
                      toast({ title: 'Неподдерживаемый формат', description: 'Допустимы: PNG, JPEG, WEBP', variant: 'destructive' });
                      return;
                    }
                    if (f.size > 15 * 1024 * 1024) {
                      toast({ title: 'Слишком большой файл', description: 'До 15 МБ', variant: 'destructive' });
                      return;
                    }
                    setCoverFile(f);
                    if (coverPreview) URL.revokeObjectURL(coverPreview);
                    setCoverPreview(URL.createObjectURL(f));
                  }}
                  disabled={isUploading}
                />
                {coverPreview ? (
                  <div className="relative">
                    <img src={coverPreview} alt="Обложка" className="h-16 w-16 rounded object-cover" />
                    <button
                      type="button"
                      className="absolute -top-2 -right-2 bg-background/80 hover:bg-background text-foreground rounded-full p-1 shadow"
                      onClick={() => resetCoverPicker()}
                      aria-label="Убрать обложку"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded bg-muted/60 flex items-center justify-center text-muted-foreground">
                    <MusicIcon className="h-6 w-6" />
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { if (selectedFile) uploadWithMeta(selectedFile, metaTitle, metaArtist); }} disabled={!selectedFile || !metaTitle.trim() || isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Загрузить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изменить трек</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Название</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-artist">Исполнитель (необязательно)</Label>
              <Input id="edit-artist" value={editArtist} onChange={(e) => setEditArtist(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Обложка</Label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setClearCover(false);
                    if (!f) { setEditCoverFile(null); if (editCoverPreview) URL.revokeObjectURL(editCoverPreview); setEditCoverPreview(null); return; }
                    if (!['image/png','image/jpeg','image/webp'].includes(f.type)) {
                      toast({ title: 'Неподдерживаемый формат', description: 'Допустимы: PNG, JPEG, WEBP', variant: 'destructive' });
                      return;
                    }
                    if (f.size > 15 * 1024 * 1024) {
                      toast({ title: 'Слишком большой файл', description: 'До 15 МБ', variant: 'destructive' });
                      return;
                    }
                    setEditCoverFile(f);
                    if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
                    setEditCoverPreview(URL.createObjectURL(f));
                  }}
                />
                {(editCoverPreview || editItem?.coverUrl) ? (
                  <div className="relative">
                    <img src={editCoverPreview || editItem?.coverUrl || ''} alt="Обложка" className="h-16 w-16 rounded object-cover" />
                    <button
                      type="button"
                      className="absolute -top-2 -right-2 bg-background/80 hover:bg-background text-foreground rounded-full p-1 shadow"
                      onClick={() => { setEditCoverFile(null); if (editCoverPreview) URL.revokeObjectURL(editCoverPreview); setEditCoverPreview(null); setClearCover(true); }}
                      aria-label="Убрать обложку"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded bg-muted/60 flex items-center justify-center text-muted-foreground">
                    <MusicIcon className="h-6 w-6" />
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveEdit} disabled={!editTitle.trim()}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Album dialog */}
      <Dialog open={showNewAlbumDialog} onOpenChange={setShowNewAlbumDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать альбом</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="album-name">Название альбома</Label>
              <Input 
                id="album-name" 
                value={newAlbumName} 
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Введите название альбома"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newAlbumName.trim()) {
                    createAlbum(newAlbumName);
                    setNewAlbumName('');
                    setShowNewAlbumDialog(false);
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNewAlbumDialog(false);
                setNewAlbumName('');
              }}
            >
              Отмена
            </Button>
            <Button 
              onClick={() => {
                if (newAlbumName.trim()) {
                  createAlbum(newAlbumName);
                  setNewAlbumName('');
                  setShowNewAlbumDialog(false);
                }
              }} 
              disabled={!newAlbumName.trim()}
            >
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
