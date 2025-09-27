import { Home, Music, PlusSquare, Mail, User, Settings, Pause, Play, SkipBack, SkipForward, Volume2, Shuffle, Repeat, Repeat1, Gamepad2, X, Type, ImageIcon, VideoIcon, Quote } from "lucide-react";
import { MarqueeText } from "@/components/MarqueeText";
import { Link, useLocation } from "wouter";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useEffect, useRef, useState } from "react";
import CreateMemoryModal from "@/components/create-memory-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function BottomNav() {
  const navRef = useRef<HTMLDivElement | null>(null);
  const [location] = useLocation();
  const player = useAudioPlayer();
  const [volOpen, setVolOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [initialType, setInitialType] = useState<"text" | "photo" | "video" | "quote">("text");
  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const hasTrack = !!player.current?.url;
  const currentUrl = player.current?.url || "";
  const currentTitle = player.current?.title || (currentUrl ? currentUrl.split('/').pop() || "Аудио" : "");
  const currentArtist = player.current?.artist || "";
  const currentCover = (player.current as any)?.coverUrl as string | undefined;

  const fmt = (n: number) => {
    const s = Math.max(0, Math.floor(n || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  // Keep CSS var --bottom-nav-h in sync with actual nav height (mini-player may expand)
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const setVar = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--bottom-nav-h', `${Math.ceil(h)}px`);
    };
    setVar();
    const ro = new ResizeObserver(setVar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasTrack, volOpen]);

  return (
    // Убрали hover-lift, чтобы панель не «прыгала» при наведении
    <nav ref={navRef} className="fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[60] w-[min(560px,calc(100%-1.5rem))] rounded-2xl glass shadow-lg px-2">
      <div className="relative flex flex-col items-stretch">
        {/* Mini player */}
  <div className={`transition-[max-height,opacity,transform] duration-300 overflow-hidden px-3 ${hasTrack ? 'pt-2 max-h-20 opacity-100 translate-y-0' : 'pt-0 max-h-0 opacity-0 -translate-y-2'}`}>
          {hasTrack && (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex items-center gap-1">
                <button
                  aria-label="Предыдущий"
                  className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                  onClick={player.prev}
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  aria-label={player.playing ? 'Пауза' : 'Воспроизвести'}
                  className={`shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors ${currentCover ? 'text-white' : 'text-muted-foreground hover:text-foreground'}`}
                  style={currentCover ? { backgroundImage: `url(${currentCover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                  onClick={player.toggle}
                  title={player.playing ? 'Пауза' : 'Воспроизвести'}
                >
                  {player.playing ? <Pause className="h-4 w-4 drop-shadow" /> : <Play className="h-4 w-4 drop-shadow" />}
                </button>
                <button
                  aria-label="Следующий"
                  className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                  onClick={player.next}
                >
                  <SkipForward className="h-4 w-4" />
                </button>
                {/* Shuffle */}
                <button
                  aria-label="Перемешивание"
                  className={`shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors ${player.shuffle ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={player.toggleShuffle}
                  title="Перемешивание"
                >
                  <Shuffle className="h-4 w-4" />
                </button>
                {/* Repeat cycle: none -> all -> one */}
                <button
                  aria-label="Повтор"
                  className={`shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors ${player.repeat !== 'none' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => player.setRepeat(player.repeat === 'none' ? 'all' : player.repeat === 'all' ? 'one' : 'none')}
                  title={player.repeat === 'none' ? 'Без повтора' : player.repeat === 'all' ? 'Повтор всего' : 'Повтор одного'}
                >
                  {player.repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
                </button>
              </div>
              <div className="min-w-0 flex-1">
                {/* Одна строка: Название — исполнитель (исполнитель притушен) */}
        <div className="w-full max-w-full min-w-0">
          <MarqueeText className="w-full max-w-full">
            <span className="text-foreground">{currentTitle}</span>
            {currentArtist ? (
              <>
                <span className="ml-1 text-muted-foreground">{currentArtist}</span>
              </>
            ) : null}
          </MarqueeText>
        </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, Math.round(player.duration))}
                  value={Math.round(player.currentTime)}
                  onChange={(e) => player.seek(parseInt(e.target.value || '0', 10))}
                  className="w-full h-1.5 accent-primary"
                />
                <div className="flex items-center justify-between mt-0.5 text-[10px] text-muted-foreground">
                  <span>{fmt(player.currentTime)}</span>
                  <span>{fmt(player.duration)}</span>
                </div>
              </div>
              {/* Volume: hidden until toggled, no reserved width when hidden */}
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  aria-label={volOpen ? 'Скрыть громкость' : 'Показать громкость'}
                  className={`inline-flex items-center justify-center h-8 w-8 rounded-full ${volOpen ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'} transition-colors`}
                  onClick={() => setVolOpen((v) => !v)}
                  title="Громкость"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
                {volOpen && (
                  <div className="flex flex-col items-stretch mt-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={player.volume}
                      onChange={(e) => player.setVolume(parseFloat(e.target.value || '0'))}
                      className="w-[160px] h-1.5 accent-primary"
                      aria-label="Громкость"
                      onBlur={() => setVolOpen(false)}
                    />
                    <div className="text-[10px] text-muted-foreground text-center mt-0.5">{Math.round((player.volume || 0) * 100)}%</div>
                  </div>
                )}
              </div>
              {/* Кнопка закрытия мини-плеера */}
              <button
                aria-label="Закрыть плеер"
                className="ml-auto shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => player.close()}
                title="Закрыть плеер"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        {/* Делаем этот контейнер relative, чтобы шестерёнка выравнивалась по строке и не скакала при разворачивании плеера */}
  <div className="relative h-14">
  <ul className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center gap-8">
          <li>
            <Link
              href="/"
              aria-label="Главная"
              title="Главная"
      className={`flex items-center justify-center leading-none transition-colors focus-ring ${
                isActive("/") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
      <Home className="h-6 w-6 block" />
            </Link>
          </li>
          <li>
            <Link
              href="/music"
              aria-label="Музыка"
              title="Музыка"
      className={`flex items-center justify-center leading-none transition-colors focus-ring ${
                isActive("/music") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
      <Music className="h-6 w-6 block" />
            </Link>
          </li>
          <li>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Добавить воспоминание"
                  title="Добавить"
                  className={`flex items-center justify-center leading-none transition-colors focus-ring ${
                    "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <PlusSquare className="h-6 w-6 block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onClick={() => { setInitialType("text"); setCreateOpen(true); }}>
                  <Type className="h-4 w-4 mr-2" /> Текст
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInitialType("photo"); setCreateOpen(true); }}>
                  <ImageIcon className="h-4 w-4 mr-2" /> Фото
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInitialType("video"); setCreateOpen(true); }}>
                  <VideoIcon className="h-4 w-4 mr-2" /> Видео
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setInitialType("quote"); setCreateOpen(true); }}>
                  <Quote className="h-4 w-4 mr-2" /> Цитата
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
          <li>
            <Link
              href="/games"
              aria-label="Игры"
              title="Игры"
      className={`flex items-center justify-center leading-none transition-colors focus-ring ${
                isActive("/games") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
      <Gamepad2 className="h-6 w-6 block" />
            </Link>
          </li>
          <li>
            <Link
              href="/messages"
              aria-label="Сообщения"
              title="Сообщения"
      className={`flex items-center justify-center leading-none transition-colors focus-ring ${
                isActive("/messages") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
      <Mail className="h-6 w-6 block" />
            </Link>
          </li>
          <li>
            <Link
              href="/profile"
              aria-label="Профиль"
              title="Профиль"
      className={`flex items-center justify-center leading-none transition-colors focus-ring ${
                isActive("/profile") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
      <User className="h-6 w-6 block" />
            </Link>
          </li>
        </ul>
  {/* Settings gear in the far right (вертикально по центру строки) */}
  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          <Link
            href="/settings"
            aria-label="Настройки"
            title="Настройки"
            className={`flex items-center justify-center leading-none transition-colors focus-ring ${
              location.startsWith("/settings") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className="h-6 w-6 block" />
          </Link>
        </div>
  </div>
  </div>
  {/* Create memory modal from BottomNav */}
  <CreateFromNavModal open={createOpen} onOpenChange={setCreateOpen} type={initialType} />
  </nav>
  );
}

// Render the modal near the nav to avoid portal issues
function CreateFromNavModal({ open, onOpenChange, type }: { open: boolean; onOpenChange: (v: boolean) => void; type: "text" | "photo" | "video" | "quote" }) {
  // CreateMemoryModal currently expects isOpen/onClose only; we will extend it to accept initialType
  // For now, we render it and rely on default 'text' until the modal supports initialType
  return (
    <CreateMemoryModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
  data-testid="create-memory-modal-from-nav"
  initialType={type}
    />
  );
}

// Mount modal at bottom to avoid layout shift
export function BottomNavModals() { return null; }