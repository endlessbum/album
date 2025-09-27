import { toast } from '@/hooks/use-toast';
import React, { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface Message {
  id: string;
  content: string;
  createdAt: string | number | Date;
  type?: string;
  mediaUrl?: string;
  isEphemeral?: boolean;
  expiresAt?: string | number | Date;
}

interface WordAnimation {
  word: string;
  animation: string;
}

const DEFAULT_WORD_ANIMATIONS: WordAnimation[] = [
  { word: "люблю", animation: "pulse" },
  { word: "счастье", animation: "blush" }
];

function getAnimationClass(anim: string) {
  if (anim === "blush") return "bg-red-100 text-red-600 px-1 rounded";
  return "bg-yellow-100 text-yellow-700 px-1 rounded animate-pulse";
}

function formatTime(date: Date | string | number | null) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}


// Форматирует оставшееся время (минуты:секунды или секунды)
function _formatTimeRemaining(seconds: number) {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
  return `${seconds}s`;
}

export default function ChatMessage({ message, isOwn, dataTestId }: {
  message: Message;
  isOwn: boolean;
  dataTestId?: string;
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || "");
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [wordAnimations, setWordAnimations] = useState<WordAnimation[]>(() => {
    try {
      const raw = localStorage.getItem('ui:wordAnimations');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return DEFAULT_WORD_ANIMATIONS;
  });
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!message.isEphemeral || !message.expiresAt) {
      setTimeRemaining(null);
      return;
    }
    const updateTimer = () => {
      const now = new Date();
      const expiresAt = new Date(message.expiresAt!);
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setTimeRemaining(remaining);
    };
    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    return () => clearInterval(intervalId);
  }, [message.isEphemeral, message.expiresAt]);

  // Эфемерная защита: блокировка при уходе с вкладки/экрана
  useEffect(() => {
    if (!message.isEphemeral) return;
    const onVis = () => {
      const visible = document.visibilityState === 'visible';
      if (!visible) {
        setBlocked(true);
        setUnlocked(false);
      } else {
        setBlocked(false);
      }
    };
    const onBlur = () => {
      setBlocked(true);
      setUnlocked(false);
    };
    const onFocus = () => {
      setBlocked(false);
    };
    const onFs = () => {
      if (document.fullscreenElement) {
        setBlocked(true);
        setUnlocked(false);
      } else {
        setBlocked(false);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, [message.isEphemeral]);

  useEffect(() => {
    const onStorage = () => {
      try {
        const raw = localStorage.getItem('ui:wordAnimations');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setWordAnimations(parsed);
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    const onCustom = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (detail?.items && Array.isArray(detail.items)) {
          setWordAnimations(detail.items as WordAnimation[]);
        }
      } catch {}
    };
    window.addEventListener('wordAnimationsChanged', onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('wordAnimationsChanged', onCustom as EventListener);
    };
  }, []);

  const hasBlushWord = (() => {
    if (!message.content) return false;
    const blushWords = wordAnimations.filter(w => w.animation === 'blush').map(w => w.word.toLowerCase());
    if (blushWords.length === 0) return false;
    const pattern = new RegExp(`\\b(${blushWords.map(w => w.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
    return pattern.test(message.content);
  })();

  function renderHighlightedText(text: string): React.ReactNode[] {
    const loveWords = wordAnimations.map(w => w.word.toLowerCase());
    if (loveWords.length === 0) return [text];
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const pattern = new RegExp(`\\b(${loveWords.map(w => w.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const word = match[0];
      const anim = wordAnimations.find(w => w.word.toLowerCase() === word.toLowerCase());
      const cls = getAnimationClass(anim?.animation || 'pulse');
      parts.push(<span key={`highlight-${match.index}`} className={cls}>{word}</span>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
// ...existing code...
// (Оставлен только один импорт и одна декларация интерфейса Message)
      parts.push(text.substring(lastIndex));
    }
    return parts.length > 0 ? parts : [text];
  }

  const editMutation = useMutation({
    mutationFn: async (newContent: string) => {
      // Always send 'type' field for validation
      const payload = { content: newContent, type: message.type || 'text', mediaUrl: message.mediaUrl };
      const res = await apiRequest(`/api/messages/${message.id}`, 'PUT', payload);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Ошибка редактирования');
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      setIsEditing(false);
    },
    onError: (err: any) => {
  toast({ title: 'Ошибка редактирования', description: err?.message || 'Ошибка редактирования', variant: 'destructive' });
    },
  });

  function handleEditSave() {
    setLoading(true);
    editMutation.mutate(editContent, {
      onSettled: () => setLoading(false),
    });
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Send 'type' for validation (if required by backend)
      const payload = { type: message.type || 'text' };
      const res = await apiRequest(`/api/messages/${message.id}`, 'DELETE', payload);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Ошибка удаления');
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      setDeleteOpen(false);
    },
    onError: (err: any) => {
  toast({ title: 'Ошибка удаления', description: err?.message || 'Ошибка удаления', variant: 'destructive' });
    },
  });

  function handleDelete() {
    setLoading(true);
    deleteMutation.mutate(undefined, {
      onSettled: () => setLoading(false),
    });
  }

  function renderMessageContent() {
    if (message.type === 'image' && message.mediaUrl) {
      return <img src={message.mediaUrl} alt="Изображение" className="max-w-sm rounded-lg" />;
    }
    if (message.type === 'video' && message.mediaUrl) {
      return <video src={message.mediaUrl} controls className="max-w-sm rounded-lg" />;
    }
    if (message.type === 'document' && message.mediaUrl) {
      return <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary underline">Документ</a>;
    }
    if (message.type === 'ephemeral_image' || message.type === 'ephemeral_video') {
      if (timeRemaining === 0) {
        return <div className="flex items-center justify-center p-4 text-muted-foreground"><span className="text-sm">Медиа исчезло</span></div>;
      }
      const showOverlay = !unlocked || blocked;
      return <div className="relative"><div className={`relative max-w-xs overflow-hidden rounded-lg ${showOverlay ? 'blur-sm' : ''}`}>{message.type === 'ephemeral_image' ? (<img src={message.mediaUrl || undefined} alt="Эфемерное фото" className="w-full" />) : (<video src={message.mediaUrl || undefined} className="w-full" controls={!showOverlay} />)}</div>{showOverlay && (<button type="button" className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white text-sm gap-2 rounded-lg" onClick={() => { if (!blocked) setUnlocked(true); }}>Нажмите для просмотра</button>)}</div>;
    }
    // Обычный текст
    return <p className="text-foreground">{renderHighlightedText(message.content || '')}</p>;
  }

  return (
    <div className={`flex gap-3 message-animation ${isOwn ? 'justify-end' : ''}`} data-testid={dataTestId}>
      {!isOwn && (
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">А</div>
      )}
      <div className={`flex-1 ${isOwn ? 'flex justify-end' : ''}`}>
        <div className={`rounded-2xl p-3 max-w-md ${isOwn ? 'glass rounded-tr-sm ml-auto' : 'glass-strong rounded-tl-sm'} ${hasBlushWord ? 'blush-bubble' : ''}`}>
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea className="w-full rounded border p-2 text-sm" value={editContent} onChange={e => setEditContent(e.target.value)} disabled={loading} rows={2} />
              <div className="flex gap-2">
                <button className="text-xs px-2 py-1 rounded bg-green-100 text-green-600 hover:bg-green-200" onClick={handleEditSave} disabled={loading}>Сохранить</button>
                <button className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200" onClick={() => setIsEditing(false)} disabled={loading}>Отмена</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {renderMessageContent()}
              <p className={`text-xs mt-1 ${isOwn ? 'opacity-70' : 'text-muted-foreground'}`}>{formatTime(message.createdAt)}</p>
              {isOwn && (
                <div className="flex gap-2 justify-end mt-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-1 rounded-full hover:bg-muted transition-colors"
                        aria-label="Действия с сообщением"
                        data-testid={`${dataTestId}-actions-menu`}
                        disabled={loading}
                      >
                        <MoreVertical className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={4} className="min-w-[140px]">
                      <DropdownMenuItem
                        onClick={() => setIsEditing(true)}
                        disabled={loading}
                        className="flex items-center gap-2"
                        data-testid={`${dataTestId}-edit-action`}
                      >
                        <Edit2 className="w-4 h-4 mr-1 text-blue-600" />
                        <span>Изменить</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteOpen(true)}
                        disabled={loading}
                        className="flex items-center gap-2 text-destructive"
                        data-testid={`${dataTestId}-delete-action`}
                      >
                        <Trash2 className="w-4 h-4 mr-1 text-red-600" />
                        <span>Удалить...</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Реакция "сердце" для чужих сообщений */}
        {!isOwn && (
          <div className="flex gap-1 mt-1">
            <button className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full hover:bg-red-200 transition-all" data-testid={`${dataTestId}-reaction-heart`}>❤️</button>
          </div>
        )}
      </div>
      {isOwn && (
        <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">А</div>
      )}
      {/* Диалог подтверждения удаления */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-popover rounded-xl shadow-xl p-6 min-w-[320px] max-w-[90vw] flex flex-col gap-4">
            <div className="text-lg font-medium">Удалить сообщение?</div>
            <div className="text-muted-foreground text-sm mb-2">Это действие необратимо. Вы уверены, что хотите удалить сообщение?</div>
            <div className="flex gap-2 justify-end">
              <button className="px-3 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200" onClick={() => setDeleteOpen(false)} disabled={loading}>Отмена</button>
              <button className="px-3 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200" onClick={handleDelete} disabled={loading}>Удалить</button>
            </div>
          </div>
        </div>
      )}
      {/* Диалог ошибки */}
  {/* Ошибка теперь показывается только через тост/уведомление, без модального окна */}
    </div>
  );
}
