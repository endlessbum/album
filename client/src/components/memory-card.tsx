import { type Memory } from "@shared/schema";
import { Music as MusicIcon } from "lucide-react";
import { Calendar, User, Image as ImageIcon, Video as VideoIcon, Quote as QuoteIcon, FileText } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface MemoryCardProps {
  memory: Memory;
  onClick: () => void;
  'data-testid'?: string;
}

export default function MemoryCard({ memory, onClick, 'data-testid': testId }: MemoryCardProps) {
  // Resolve author username (nickname) from current user/partner; fallback to short id
  const { user: me } = useAuth();
  const { data: partnerResp } = useQuery<{ partner: { id: string; username: string } | null }>({
    queryKey: ["/api/partner"],
    queryFn: async () => {
      const res = await apiRequest("/api/partner", "GET");
      if (!res.ok) return { partner: null } as any;
      return await res.json();
    },
  });

  const formatDate = (date: Date | null) => {
    if (!date) return '';
  const s = new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
  });
  // Удаляем автоматически добавляемое «г.» в русской локали
  return s.replace(/[\u00A0 ]?г\.?$/, '');
  };

  const authorUsername = (() => {
    if (me && memory.authorId === me.id) return me.username;
    const p = partnerResp?.partner;
    if (p && memory.authorId === p.id) return p.username;
    return memory.authorId?.slice(0, 8) || 'user';
  })();

  const renderTypeIcon = () => {
    const className = "w-8 h-8 text-muted-foreground";
    switch (memory.type) {
      case 'photo':
        return <ImageIcon className={className} />;
      case 'video':
        return <VideoIcon className={className} />;
      case 'quote':
        return <QuoteIcon className={className} />;
      case 'text':
      default:
        return <FileText className={className} />;
    }
  };

  const getAttachedAudioUrl = (): string | null => {
    const asAny: any = memory as any;
    const extraUrl: string | undefined = asAny?.visibility?.extra?.audioUrl;
    if (extraUrl && typeof extraUrl === 'string') return extraUrl;
    const tag = memory.tags?.find(t => t?.startsWith('audio_url:')) || null;
    if (tag) return tag.slice('audio_url:'.length);
    return null;
  };

  const getMusicMeta = (url: string): { title: string; artist?: string; coverUrl?: string } => {
    try {
      const raw = localStorage.getItem('music_meta_v1');
      const map = raw ? JSON.parse(raw) as Record<string, { title: string; artist?: string; coverUrl?: string }> : {};
      const m = map[url];
      if (m && m.title) return m;
    } catch {}
    // Если не нашли в localStorage, пробуем из тегов
    const titleTag = memory.tags?.find(t => t.startsWith('audio_title:'));
    const artistTag = memory.tags?.find(t => t.startsWith('audio_artist:'));
    const coverTag = memory.tags?.find(t => t.startsWith('audio_cover:'));
    return {
      title: titleTag ? titleTag.slice('audio_title:'.length) : (url.split('/').pop() || 'Аудио').replace(/\.[^.]+$/, '') || 'Аудио',
      artist: artistTag ? artistTag.slice('audio_artist:'.length) : undefined,
      coverUrl: coverTag ? coverTag.slice('audio_cover:'.length) : undefined,
    };
  };

  const renderFront = () => {
    // If music attached, prefer cover + title overlay for any type lacking media preview
    const attachedUrl = getAttachedAudioUrl();
    const musicMeta = attachedUrl ? getMusicMeta(attachedUrl) : null;

    const getCardObjectPosition = () => {
      const tx = memory.tags?.find(t => t.startsWith('card_pos_x:'))?.slice('card_pos_x:'.length) || '';
      const ty = memory.tags?.find(t => t.startsWith('card_pos_y:'))?.slice('card_pos_y:'.length) || '';
      const x = Math.max(0, Math.min(100, parseInt(tx || '50', 10)));
      const y = Math.max(0, Math.min(100, parseInt(ty || '50', 10)));
      return `${x}% ${y}%`;
    };

    if (memory.type === 'photo' && memory.mediaUrl) {
      return (
        <div className="flip-card-front glass rounded-xl overflow-hidden relative">
          <img src={memory.mediaUrl} alt={memory.title || 'Воспоминание'} className="w-full h-full object-cover" style={{ objectPosition: getCardObjectPosition() }} />
          {musicMeta && (
            <div className="absolute left-2 bottom-2 max-w-[85%] flex items-center gap-2">
              {musicMeta.coverUrl ? (
                <img src={musicMeta.coverUrl} alt="Обложка" className="h-5 w-5 rounded object-cover" />
              ) : (
                <MusicIcon className="h-4 w-4 text-white/90" />
              )}
              <div className="text-xs font-medium truncate text-white" title={musicMeta.title}>{musicMeta.title}</div>
            </div>
          )}
        </div>
      );
    }

    if (memory.type === 'video' && memory.mediaUrl) {
      return (
        <div className="flip-card-front glass rounded-xl overflow-hidden relative">
          {/* Используем превью-изображение, чтобы применить object-position */}
          {memory.thumbnailUrl ? (
            <img
              src={memory.thumbnailUrl}
              alt={memory.title || 'Видео'}
              className="w-full h-full object-cover bg-muted"
              style={{ objectPosition: getCardObjectPosition() }}
            />
          ) : (
            <div className="w-full h-full bg-muted" />
          )}
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
              <div className="w-0 h-0 border-l-[12px] border-l-gray-800 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent ml-1"></div>
            </div>
          </div>
          {musicMeta && (
            <div className="absolute left-2 bottom-2 max-w-[85%] flex items-center gap-2">
              {musicMeta.coverUrl ? (
                <img src={musicMeta.coverUrl} alt="Обложка" className="h-5 w-5 rounded object-cover" />
              ) : (
                <MusicIcon className="h-4 w-4 text-white/90" />
              )}
              <div className="text-xs font-medium truncate text-white" title={musicMeta.title}>{musicMeta.title}</div>
            </div>
          )}
        </div>
      );
    }

    if (memory.type === 'quote') {
      // Try to read quote author from tags: ["quote_author:<value>"]
      const rawAuthorTag = memory.tags?.find(t => t?.startsWith('quote_author:')) || null;
      const authorRaw = rawAuthorTag ? rawAuthorTag.slice('quote_author:'.length).trim() : '';
      // Show @ for usernames (no spaces) or keep as provided for free-form names
      const author = authorRaw
        ? (/^\S+$/.test(authorRaw) ? `@${authorRaw}` : authorRaw)
        : '';
      return (
        <div className="flip-card-front glass rounded-xl p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-primary/10 to-secondary/10 relative">
          {/* Кавычки автоматически */}
          <p className="text-lg font-medium text-foreground">"{memory.content}"</p>
          {author && (
            <p className="mt-2 text-sm text-muted-foreground">{author}</p>
          )}
          {musicMeta && (
            <div className="absolute left-2 bottom-2 max-w-[85%] flex items-center gap-2">
              {musicMeta.coverUrl ? (
                <img src={musicMeta.coverUrl} alt="Обложка" className="h-5 w-5 rounded object-cover" />
              ) : (
                <MusicIcon className="h-4 w-4 text-white/90" />
              )}
              <div className="text-xs font-medium truncate text-white" title={musicMeta.title}>{musicMeta.title}</div>
            </div>
          )}
        </div>
      );
    }

    if (memory.type === 'text') {
      return (
        <div className="flip-card-front glass rounded-xl p-6 flex flex-col justify-center relative">
          {memory.title && (
            <h3 className="text-lg font-semibold text-foreground mb-2">{memory.title}</h3>
          )}
          <p className="text-sm text-muted-foreground line-clamp-4">{memory.content}</p>
          {musicMeta && (
            <div className="absolute left-2 bottom-2 max-w-[85%] flex items-center gap-2">
              {musicMeta.coverUrl ? (
                <img src={musicMeta.coverUrl} alt="Обложка" className="h-5 w-5 rounded object-cover" />
              ) : (
                <MusicIcon className="h-4 w-4 text-white/90" />
              )}
              <div className="text-xs font-medium truncate text-white" title={musicMeta.title}>{musicMeta.title}</div>
            </div>
          )}
        </div>
      );
    }

    // Прочие типы — лишь иконка из пакета lucide-react
    return (
      <div className="flip-card-front glass rounded-xl p-6 flex items-center justify-center relative">
        {renderTypeIcon()}
        {musicMeta && (
          <div className="absolute left-2 bottom-2 max-w-[85%] flex items-center gap-2">
            {musicMeta.coverUrl ? (
              <img src={musicMeta.coverUrl} alt="Обложка" className="h-5 w-5 rounded object-cover" />
            ) : (
              <MusicIcon className="h-4 w-4 text-white/90" />
            )}
            <div className="text-xs font-medium truncate text-white" title={musicMeta.title}>{musicMeta.title}</div>
          </div>
        )}
      </div>
    );
  };

  // Determine card layout from new ratio/orientation tags; fallback to legacy card_layout
  const ratioTag = (memory.tags || []).find(t => typeof t === 'string' && t.startsWith('card_ratio:')) as string | undefined;
  const orientTag = (memory.tags || []).find(t => typeof t === 'string' && t.startsWith('card_orient:')) as string | undefined;
  const ratioRaw = ratioTag ? ratioTag.slice('card_ratio:'.length) : undefined; // e.g., "3:4"
  const orientRaw = orientTag ? orientTag.slice('card_orient:'.length) : undefined; // "horizontal" | "vertical"
  const allowedRatios = new Set(['9:16','4:5','5:7','3:4','3:5','2:3']);

  let sizeClass = '';
  if (ratioRaw && allowedRatios.has(ratioRaw)) {
    const rKey = ratioRaw.replace(':', '-');
    const oShort = (orientRaw === 'vertical') ? 'v' : 'h'; // default to horizontal
    sizeClass = `card-ar-${rKey}-${oShort}`;
  } else {
    // Legacy mapping for older memories stored with card_layout
    const layoutTag = (memory.tags || []).find(t => typeof t === 'string' && t.startsWith('card_layout:')) as string | undefined;
    const layout = layoutTag ? layoutTag.slice('card_layout:'.length) : undefined;
    sizeClass = layout === 'portrait' ? 'card-size-portrait' :
                layout === 'landscape' ? 'card-size-landscape' :
                layout === 'wide' ? 'card-size-wide' :
                layout === 'tall' ? 'card-size-tall' :
                layout === 'large' ? 'card-size-large' :
                'card-size-square';
  }

  // Make particularly wide horizontal cards span 2 columns on larger screens
  let spanClass = '';
  if (ratioRaw && (orientRaw !== 'vertical')) {
    const wide = new Set(['9:16','3:5','2:3']); // -> 16:9, 5:3, 3:2
    if (wide.has(ratioRaw)) {
      spanClass = 'lg:col-span-2 xl:col-span-2 2xl:col-span-2';
    }
  } else {
    // Legacy mapping: widen explicit 'wide'
    const layoutTag2 = (memory.tags || []).find(t => typeof t === 'string' && t.startsWith('card_layout:')) as string | undefined;
    const layout2 = layoutTag2 ? layoutTag2.slice('card_layout:'.length) : undefined;
    if (layout2 === 'wide') spanClass = 'lg:col-span-2 xl:col-span-2 2xl:col-span-2';
  }

  return (
    <div className={`flip-card cursor-pointer ${sizeClass} ${spanClass}`} onClick={onClick} data-testid={testId}>
      <div className="flip-card-inner">
        {renderFront()}
        
        {/* Задняя сторона карточки: вся информация и без кнопки */}
        <div className="flip-card-back glass-strong rounded-xl p-5 flex flex-col justify-center text-center">
          <h3 className="text-base font-semibold text-foreground mb-2">
            {memory.title || (memory.type === 'quote' ? 'Цитата' : 'Воспоминание')}
          </h3>
          <p className="text-sm text-foreground mb-3 line-clamp-4">
            {memory.type === 'quote'
              ? (memory.content ? `"${memory.content}"` : 'Нет описания')
              : (memory.content || 'Нет описания')}
          </p>
          {/* Строка с пользователем */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            <span>@{authorUsername}</span>
          </div>
          {/* ID карточки отдельной строкой под пользователем */}
          <div className="text-xs text-muted-foreground mt-1">ID: #{memory.id.slice(0, 8)}</div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
            <Calendar className="w-3 h-3" />
            <span>{formatDate(memory.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
