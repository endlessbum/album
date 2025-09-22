import { type Message } from "@shared/schema";
import { DEFAULT_WORD_ANIMATIONS, getAnimationClass, type WordAnimation } from "@/lib/wordAnimations";
import { Play, Pause, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ChatMessageProps {
  message: Message;
  isOwn: boolean;
  'data-testid'?: string;
}

export default function ChatMessage({ message, isOwn, 'data-testid': testId }: ChatMessageProps) {
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  // Состояние разблокировки просмотра эфемерного медиа (тачем)
  const [unlocked, setUnlocked] = useState(false);
  // Состояние блокировки при попытке записи/скриншота (чёрный экран)
  const [blocked, setBlocked] = useState(false);

  // Update ephemeral timer in real-time
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
      
      if (remaining === 0) {
        clearInterval(intervalId);
      }
    };

    // Update immediately
    updateTimer();
    
    // Update every second
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [message.isEphemeral, message.expiresAt]);

  // Безопасность: чёрный экран при скрытии вкладки/окна (best-effort защита от записи экрана)
  useEffect(() => {
    if (!message.isEphemeral) return;
    const onVis = () => {
      const visible = document.visibilityState === 'visible';
      if (!visible) {
        // При уходе с экрана — блокируем показ и сбрасываем разблокировку
        setBlocked(true);
        setUnlocked(false);
      } else {
        // Возврат на экран — снимаем блокировку, оставляем в замке
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
      // В полноэкранном режиме блокируем показ (уменьшаем риск записи)
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
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [message.isEphemeral]);

  const formatTime = (date: Date | null) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTimeRemaining = (seconds: number) => {
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };

  // Читаем список анимируемых слов из localStorage, с дефолтами
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
    // same-tab custom event updates (when settings saved without storage event firing)
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

  // Определяем, содержит ли сообщение слово с анимацией "покраснение"
  const hasBlushWord = (() => {
    if (!message.content) return false;
    const blushWords = wordAnimations.filter(w => w.animation === 'blush').map(w => w.word.toLowerCase());
    if (blushWords.length === 0) return false;
    const pattern = new RegExp(`\\b(${blushWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
    return pattern.test(message.content);
  })();

  // Безопасное выделение слов с использованием React элементов - предотвращает XSS атаки
  const renderHighlightedText = (text: string): React.ReactNode[] => {
    const loveWords = wordAnimations.map(w => w.word.toLowerCase());
  if (loveWords.length === 0) return [text];
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Создаем регулярное выражение для всех "любовных" слов
    const pattern = new RegExp(`\\b(${loveWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      // Добавляем текст до совпадения
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      // Добавляем выделенное слово как React элемент
      const word = match[0];
      const anim = wordAnimations.find(w => w.word.toLowerCase() === word.toLowerCase());
      const cls = getAnimationClass(anim?.animation || 'pulse');
      parts.push(
        <span 
          key={`highlight-${match.index}`}
          className={cls}
        >
          {word}
        </span>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Добавляем оставшийся текст
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : [text];
  };

  const renderMessageContent = () => {
    if (message.type === 'ephemeral_image' || message.type === 'ephemeral_video') {
      if (timeRemaining === 0) {
        return (
          <div className="flex items-center justify-center p-4 text-muted-foreground">
            <span className="text-sm">
              {message.type === 'ephemeral_image' ? '📷 Фото исчезло' : '🎬 Видео исчезло'}
            </span>
          </div>
        );
      }

      // Размытое превью до разблокировки; логотип поверх; таймер рядом
      const showOverlay = !unlocked || blocked;
      const overlayLabel = blocked ? 'Запись экрана запрещена' : 'Нажмите для просмотра';
      return (
        <div 
          className="relative"
          data-testid={`${testId}-ephemeral-media`}
          onContextMenu={(e) => { 
            // Блокируем контекстное меню над эфемерным медиа
            e.preventDefault(); 
          }}
        >
          {timeRemaining !== null && (
            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full z-10" data-testid={`${testId}-ephemeral-timer`}>
              {formatTimeRemaining(timeRemaining)}
            </div>
          )}
          <div className={`relative max-w-xs overflow-hidden rounded-lg ${showOverlay ? 'blur-sm' : ''}`}>
            {message.type === 'ephemeral_image' ? (
              <img 
                src={message.mediaUrl || undefined} 
                alt="Эфемерное фото" 
                className="w-full"
              />
            ) : (
              <video 
                src={message.mediaUrl || undefined}
                className="w-full"
                controls={!showOverlay}
              />
            )}
          </div>
      {showOverlay && (
            <button
              type="button"
        className={`absolute inset-0 flex flex-col items-center justify-center ${blocked ? 'bg-black' : 'bg-black/60'} text-white text-sm gap-2 rounded-lg`}
              onClick={() => { if (!blocked) setUnlocked(true); }}
              data-testid={`${testId}-ephemeral-lock-overlay`}
            >
              {/* Логотип эфемерных сообщений (пузырь + пламя) */}
              <svg width="48" height="48" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="drop-shadow">
                <g fill="#FFFFFF">
                  {/* Пузырь чата */}
                  <path d="M8 10c0-2.21 1.79-4 4-4h40c2.21 0 4 1.79 4 4v26c0 2.21-1.79 4-4 4H28l-10 9c-1.78 1.6-4 .39-4-1.8V40h-2c-2.21 0-4-1.79-4-4V10z"/>
                  {/* Пламя внутри пузыря */}
                  <path d="M36 18c-1.8 2.6-2.7 4.8-2.7 6.4 0 1.6.7 2.9 2.1 4 1.4 1.1 2.1 2.4 2.1 3.9 0 2.9-2 5.2-6.1 6.9 5.6-.3 9.5-2.6 11.7-6.9 1.2-2.3 1.3-4.6.3-7-.6-1.4-1.5-2.7-2.6-3.8-1.1-1.1-2.3-2.1-3.6-3.5z"/>
                </g>
              </svg>
              <span>{overlayLabel}</span>
            </button>
          )}
        </div>
      );
    }

    // Обычное текстовое сообщение с таймером для эфемерных
    if (message.isEphemeral && timeRemaining !== null) {
      if (timeRemaining === 0) {
        return (
          <div className="flex items-center justify-center p-2 text-muted-foreground">
            <span className="text-sm italic">Сообщение исчезло</span>
          </div>
        );
      }
      
      return (
        <div className="relative">
          <div className="absolute -top-2 right-0 bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded-full" data-testid={`${testId}-ephemeral-timer`}>
            {formatTimeRemaining(timeRemaining)}
          </div>
          <p className="text-foreground pr-12">
            {renderHighlightedText(message.content || '')}
          </p>
        </div>
      );
    }

    if (message.type === 'voice') {
      return (
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"
            onClick={() => setIsPlayingVoice(!isPlayingVoice)}
            data-testid={`${testId}-play-voice`}
          >
            {isPlayingVoice ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
          <div className="flex-1">
            <div className="h-1 bg-white/20 rounded-full">
              <div 
                className="h-1 bg-white/60 rounded-full transition-all" 
                style={{ width: isPlayingVoice ? '60%' : '30%' }}
              ></div>
            </div>
          </div>
          <span className="text-xs opacity-70">0:15</span>
        </div>
      );
    }

    if (message.type === 'image' && message.mediaUrl) {
      return (
        <img 
          src={message.mediaUrl} 
          alt="Изображение" 
          className="max-w-sm rounded-lg"
        />
      );
    }

    if (message.type === 'video' && message.mediaUrl) {
      return (
        <video 
          src={message.mediaUrl}
          controls
          className="max-w-sm rounded-lg"
        >
          Ваш браузер не поддерживает видео.
        </video>
      );
    }

    if (message.type === 'document' && message.mediaUrl) {
      const fileName = (() => {
        try { return decodeURIComponent(new URL(message.mediaUrl, window.location.origin).pathname.split('/').pop() || 'document'); } catch { return 'document'; }
      })();
      return (
        <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary underline">
          <FileText className="h-4 w-4" />
          <span>{fileName}</span>
        </a>
      );
    }

    // Обычное текстовое сообщение 
    return (
      <p className="text-foreground">
        {renderHighlightedText(message.content || '')}
      </p>
    );
  };

  return (
    <div 
      className={`flex gap-3 message-animation ${isOwn ? 'justify-end' : ''}`}
      data-testid={testId}
    >
      {!isOwn && (
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          А
        </div>
      )}
      
      <div className={`flex-1 ${isOwn ? 'flex justify-end' : ''}`}>
        <div 
          className={`rounded-2xl p-3 max-w-md ${
            isOwn 
              ? 'glass rounded-tr-sm ml-auto' 
              : 'glass-strong rounded-tl-sm'
          } ${hasBlushWord ? 'blush-bubble' : ''}`}
        >
          {renderMessageContent()}
          <p className={`text-xs mt-1 ${isOwn ? 'opacity-70' : 'text-muted-foreground'}`}>
            {formatTime(message.createdAt)}
          </p>
        </div>
        
        {/* Реакции (только для сообщений партнера) */}
        {!isOwn && (
          <div className="flex gap-1 mt-1">
            <button 
              className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full hover:bg-red-200 transition-all"
              data-testid={`${testId}-reaction-heart`}
            >
              ❤️
            </button>
          </div>
        )}
      </div>

      {isOwn && (
        <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          А
        </div>
      )}
    </div>
  );
}
