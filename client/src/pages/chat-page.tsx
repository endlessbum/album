import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ChatMessage from "@/components/chat-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Palette, Paperclip, Image, Mic, Send, Timer, Camera, FileText, Video } from "lucide-react";
import { getChatBackgroundStyle, type ChatBackgroundKey } from "@/lib/chatBackgrounds";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { createWebSocketUrl } from "@/lib/utils";
import type { Message, User } from "@shared/schema";
import EphemeralCapture from "@/components/ephemeral-capture";
import EphemeralUpload from "@/components/ephemeral-upload";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type PartnerResponse = {
  partner: Pick<User, 'id' | 'username' | 'firstName' | 'lastName' | 'profileImageUrl' | 'isOnline' | 'lastSeen' | 'role'> | null;
};

export default function ChatPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [ephemeralMode, setEphemeralMode] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const fileInputImageRef = useRef<HTMLInputElement | null>(null);
  const fileInputVideoRef = useRef<HTMLInputElement | null>(null);
  const fileInputDocRef = useRef<HTMLInputElement | null>(null);
  // Removed ephemeralDuration - server now controls expiration time for security
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [chatBgKey, setChatBgKey] = useState<ChatBackgroundKey>(() => {
    try {
      return (localStorage.getItem('ui:chatBackground') as ChatBackgroundKey) || 'none';
    } catch {
      return 'none';
    }
  });

  // SECURITY FIX: Removed inefficient 1-second polling - rely only on WebSocket updates
  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    // No refetchInterval - use WebSocket updates for real-time functionality
  });

  // Fetch partner information
  const { data: partnerData } = useQuery<PartnerResponse>({
    queryKey: ["/api/partner"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { 
      content: string; 
      type: string; 
      isEphemeral?: boolean; 
      expiresAt?: string;
      mediaUrl?: string | null;
    }) => {
      const res = await apiRequest("/api/messages", "POST", messageData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      setNewMessage("");
      setEphemeralMode(false);
    },
  });

  // Загрузка эфемерных медиа (фото/видео) и отправка сообщения
  const sendEphemeralMedia = async (file: File, kind: 'photo' | 'video') => {
    try {
      const fd = new FormData();
      const isPhoto = kind === 'photo';
      fd.append(isPhoto ? 'image' : 'video', file);
      const endpoint = isPhoto ? '/api/upload/memory-image' : '/api/upload/memory-video';
      const res = await fetch(endpoint, { method: 'POST', credentials: 'include', body: fd });
      const j = await res.json();
      if (!res.ok || !j?.url) throw new Error(j?.message || 'Ошибка загрузки');
  const msgType = isPhoto ? 'ephemeral_image' : 'ephemeral_video';
  // Сервер сам выставит expiresAt на 2 минуты — клиент не отправляет это поле
  const mediaUrlAbs = j.url && (j.url.startsWith('http') ? j.url : new URL(j.url, window.location.origin).toString());
  sendMessageMutation.mutate({ content: '', type: msgType, isEphemeral: true, mediaUrl: mediaUrlAbs });
  } catch (_e) {
      // no-op toast here to avoid coupling to hooks; UI feedback can be added later
    }
  };

  // Обычная загрузка фото/видео/документа и отправка сообщения (не эфемерное)
  const sendRegularUpload = async (file: File, kind: 'image' | 'video' | 'document') => {
    try {
      const fd = new FormData();
      let endpoint = '';
      if (kind === 'image') { fd.append('image', file); endpoint = '/api/upload/memory-image'; }
      else if (kind === 'video') { fd.append('video', file); endpoint = '/api/upload/memory-video'; }
      else { fd.append('document', file); endpoint = '/api/upload/document'; }

      const res = await fetch(endpoint, { method: 'POST', credentials: 'include', body: fd });
      const j = await res.json();
      if (!res.ok || !j?.url) throw new Error(j?.message || 'Ошибка загрузки');

      const mediaUrlAbs = j.url && (j.url.startsWith('http') ? j.url : new URL(j.url, window.location.origin).toString());
      const typeMap = { image: 'image', video: 'video', document: 'document' } as const;
      sendMessageMutation.mutate({ content: '', type: typeMap[kind], mediaUrl: mediaUrlAbs });
  } catch (_e) {
      // TODO: показать тост об ошибке
    }
  };

  // WebSocket connection
  useEffect(() => {
    const wsUrl = createWebSocketUrl("/ws");
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      } else if (data.type === 'typing_start') {
        setPartnerTyping(true);
      } else if (data.type === 'typing_stop') {
        setPartnerTyping(false);
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen to localStorage changes (when user changes background in settings/profile)
  useEffect(() => {
    const onStorage = () => {
      try {
        const key = (localStorage.getItem('ui:chatBackground') as ChatBackgroundKey) || 'none';
        setChatBgKey(key);
      } catch {}
    };
    const onCustom = (e: Event) => {
      const ce = e as CustomEvent<{ key: ChatBackgroundKey }>;
      if (ce.detail?.key) setChatBgKey(ce.detail.key);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('chatBackgroundChanged', onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('chatBackgroundChanged', onCustom as EventListener);
    };
  }, []);

  // Handle typing indicator
  const handleTyping = () => {
    if (!isTyping && wsRef.current?.readyState === WebSocket.OPEN) {
      setIsTyping(true);
      wsRef.current.send(JSON.stringify({ type: 'typing_start' }));
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping && wsRef.current?.readyState === WebSocket.OPEN) {
        setIsTyping(false);
        wsRef.current.send(JSON.stringify({ type: 'typing_stop' }));
      }
    }, 2000);
  };

  // Partner info helpers
  const getPartnerInitials = () => {
    if (!partnerData?.partner) return '?';
    const partner = partnerData.partner;
    if (partner.firstName && partner.lastName) {
      return (partner.firstName.charAt(0) + partner.lastName.charAt(0)).toUpperCase();
    }
    return partner.username.charAt(0).toUpperCase();
  };

  const getPartnerDisplayName = () => {
    if (!partnerData?.partner) return 'Партнер';
    const partner = partnerData.partner;
    if (partner.firstName && partner.lastName) {
      return `${partner.firstName} ${partner.lastName}`;
    }
    return partner.username;
  };

  const getPartnerStatusText = () => {
    if (!partnerData?.partner) return 'Не в сети';
    if (partnerTyping) return 'Печатает...';
    return partnerData.partner.isOnline ? 'В сети' : 'Не в сети';
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    // Stop typing indicator
    if (isTyping && wsRef.current?.readyState === WebSocket.OPEN) {
      setIsTyping(false);
      wsRef.current.send(JSON.stringify({ type: 'typing_stop' }));
    }

  const messageData: any = {
      content: newMessage.trim(),
      type: 'text'
    };

  // SECURITY: Server now controls ephemeral message expiration time (2 минуты)
    if (ephemeralMode) {
      messageData.isEphemeral = true;
  // expiresAt выставляется сервером по безопасности (2 минуты)
    }

    sendMessageMutation.mutate(messageData);

    // Send via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        ...messageData,
        type: 'chat_message',
        senderId: user?.id
      }));
    }
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    if (value.trim()) {
      handleTyping();
    }
  };

  const handleVoiceMessage = () => {
    setIsRecording(!isRecording);
    // TODO: Реализация записи голоса (микрофон)
  };

  const handleFileUpload = () => {
    // Открываем меню через кнопку-"скрепку" — обработчик пустой
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden w-full overflow-x-hidden" data-testid="chat-page">
      <main className="flex-1 flex">
        {/* Центрированный контейнер */}
  <div className="max-w-4xl w-full mx-auto px-3 sm:px-6 lg:px-0 h-full box-border pb-[88px] flex flex-col overflow-x-hidden">
        {/* Заголовок чата */}
  <div className="glass-strong p-3 sm:p-4 mt-2 sm:mt-3 mb-3 rounded-xl hover-lift" data-testid="chat-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                {partnerData?.partner?.profileImageUrl ? (
                  <img 
                    src={partnerData.partner.profileImageUrl} 
                    alt={getPartnerDisplayName()}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-white font-bold">
                    {getPartnerInitials()}
                  </div>
                )}
                {partnerData?.partner?.isOnline && (
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 bg-online rounded-full border-2 border-background ${partnerTyping ? 'animate-pulse' : 'pulse-online'}`} data-testid="partner-online-status"></div>
                )}
              </div>
              <div>
                <h2 className="font-semibold text-foreground" data-testid="partner-name">
                  {getPartnerDisplayName()}
                </h2>
                <p className={`text-sm ${partnerTyping ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} data-testid="partner-status">
                  {getPartnerStatusText()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Настройки чата"
                title="Настройки чата"
                className="text-muted-foreground hover:text-foreground focus-ring"
                onClick={() => setLocation('/settings?tab=messages')}
                data-testid="button-chat-theme"
              >
                <Palette className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Область сообщений */}
        <div 
          className="flex-1 min-h-0 glass mb-3 rounded-xl p-3 sm:p-4 overflow-y-auto hide-scrollbar hover-lift"
          style={getChatBackgroundStyle(chatBgKey)}
          data-testid="messages-container"
        >
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground" data-testid="empty-chat-state">
                  Начните ваш разговор!
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === user?.id}
                  data-testid={`message-${message.id}`}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

  {/* Поле ввода сообщения */}
  <div className="glass-strong mb-0 rounded-xl p-3 sm:p-4 hover-lift" data-testid="message-input-container">
          <form onSubmit={handleSendMessage} className="flex flex-wrap gap-2 sm:gap-3 items-center md:items-end w-full">
            {/* Меню вложений: обычные файлы + эфемерные опции */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleFileUpload}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="button-attach-file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => fileInputImageRef.current?.click()} data-testid="attach-regular-image">
                  <Image className="mr-2 h-4 w-4" />
                  <span>Изображение</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputVideoRef.current?.click()} data-testid="attach-regular-video">
                  <Video className="mr-2 h-4 w-4" />
                  <span>Видео</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputDocRef.current?.click()} data-testid="attach-document">
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Документ</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setUploadOpen(true)} data-testid="attach-ephemeral-upload">
                  <Image className="mr-2 h-4 w-4" />
                  <span>Эфемерное фото/видео (с устройства)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCaptureOpen(true)} data-testid="attach-ephemeral-camera">
                  <Camera className="mr-2 h-4 w-4" />
                  <span>Эфемерная камера</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant={ephemeralMode ? "default" : "ghost"}
              size="icon"
              onClick={() => setEphemeralMode(!ephemeralMode)}
              className={ephemeralMode ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}
              data-testid="button-ephemeral-mode"
              title="Текстовые сообщения как эфемерные"
            >
              <Timer className="h-4 w-4" />
            </Button>
  <div className="flex-1 min-w-0 w-full md:w-auto">
              <div className="space-y-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  // Сервер удалит через 2 минуты — отражаем это в плейсхолдере
                  placeholder={ephemeralMode ? "Эфемерное сообщение (исчезнет через 2 мин)..." : "Напишите сообщение..."}
                  className={`min-h-[44px] max-h-32 resize-none w-full break-words ${ephemeralMode ? 'border-primary/50 bg-primary/10' : ''}`}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  data-testid="input-message"
                />
        {ephemeralMode && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Timer className="h-3 w-3" />
          <span>Сообщение исчезнет автоматически через 2 минуты</span>
                  </div>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleVoiceMessage}
              className={`text-muted-foreground hover:text-foreground ${isRecording ? 'text-destructive' : ''}`}
              data-testid="button-voice-message"
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Button
              type="submit"
              size="icon"
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
              className="bg-primary text-primary-foreground"
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
        </div>
      </main>
      {/* Скрытые input для обычных загрузок */}
      <input ref={fileInputImageRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]; if (f) sendRegularUpload(f, 'image'); e.currentTarget.value = '';
      }} />
      <input ref={fileInputVideoRef} type="file" accept="video/*" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]; if (f) sendRegularUpload(f, 'video'); e.currentTarget.value = '';
      }} />
      <input ref={fileInputDocRef} type="file" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]; if (f) sendRegularUpload(f, 'document'); e.currentTarget.value = '';
      }} />
      {/* Модалка для эфемерной камеры */}
      <EphemeralCapture
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        onCaptured={(file, kind) => sendEphemeralMedia(file, kind)}
      />
      {/* Модалка выбора с устройства (с обрезкой видео до 10с) */}
      <EphemeralUpload
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={(file, kind) => sendEphemeralMedia(file, kind)}
      />
    </div>
  );
}
