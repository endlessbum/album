import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Palette, 
  MessageSquare, 
  Bell, 
  Calendar, 
  Gamepad2,
  Users,
  Moon,
  Sun,
  Lock,
  Eye,
  UserPlus,
  Copy,
  Loader2
} from "lucide-react";
import { CHAT_BACKGROUNDS, type ChatBackgroundKey } from "@/lib/chatBackgrounds";
import { applyUiFont } from "@/lib/fonts";
import { AVAILABLE_ANIMATIONS, DEFAULT_WORD_ANIMATIONS, type AnimationKey, type WordAnimation } from "@/lib/wordAnimations";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme, toggleTheme: _toggleTheme } = useTheme();
  const { toast } = useToast();
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [selectedFont, setSelectedFont] = useState("Inter");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  // Приватность
  const [memoriesVisibleForGuests, setMemoriesVisibleForGuests] = useState(false);
  const [commentsAllowedForGuests, setCommentsAllowedForGuests] = useState(true);
  // Доп. уведомления
  const [soundNotifications, setSoundNotifications] = useState(true);
  const [eventReminders, setEventReminders] = useState(true);
  // События/интеграции
  const [calendarIntegration, setCalendarIntegration] = useState(false);
  // Игры
  const [gameSounds, setGameSounds] = useState(true);
  const [chatBackground, setChatBackground] = useState<ChatBackgroundKey>(() => {
    try {
      return (localStorage.getItem('ui:chatBackground') as ChatBackgroundKey) || 'none';
    } catch {
      return 'none';
    }
  });
  // Настраиваемая подсказка для кода приглашения
  const DEFAULT_INVITE_PLACEHOLDER = "Сгенерируйте код приглашения";
  const [invitePlaceholder, setInvitePlaceholder] = useState<string>(DEFAULT_INVITE_PLACEHOLDER);
  // Слова с анимациями
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
  const [newWord, setNewWord] = useState<string>("");
  const [newWordAnim, setNewWordAnim] = useState<AnimationKey>('pulse');

  // Dirty state baseline (persist across renders)
  const baselineRef = useRef<{
    animationsEnabled: boolean;
    selectedFont: string;
    emailNotifications: boolean;
    pushNotifications: boolean;
    chatBackground: ChatBackgroundKey;
  theme: string;
  memoriesVisibleForGuests: boolean;
  commentsAllowedForGuests: boolean;
  soundNotifications: boolean;
  eventReminders: boolean;
  calendarIntegration: boolean;
  gameSounds: boolean;
  wordAnimations: WordAnimation[];
  invitePlaceholder: string;
  }>({
    animationsEnabled,
    selectedFont,
    emailNotifications,
    pushNotifications,
  chatBackground,
  theme,
  memoriesVisibleForGuests,
  commentsAllowedForGuests,
  soundNotifications,
  eventReminders,
  calendarIntegration,
  gameSounds,
  wordAnimations,
  invitePlaceholder,
  });

  // Первоночальные настройки (по умолчанию): фиксируются при первом входе
  const defaultsRef = useRef<{
    animationsEnabled: boolean;
    selectedFont: string;
    emailNotifications: boolean;
    pushNotifications: boolean;
    chatBackground: ChatBackgroundKey;
    theme: string;
    memoriesVisibleForGuests: boolean;
    commentsAllowedForGuests: boolean;
    soundNotifications: boolean;
    eventReminders: boolean;
    calendarIntegration: boolean;
    gameSounds: boolean;
  wordAnimations: WordAnimation[];
  invitePlaceholder: string;
  } | null>(null);

  // Один раз пробуем прочитать зафиксированные по умолчанию настройки из localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ui:defaultsSettings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          defaultsRef.current = parsed as any;
        }
      }
    } catch {}
  }, []);

  // Fetch current invite code
  const { data: inviteCodeData, refetch: _refetchInviteCode } = useQuery({
    queryKey: ['/api/couple/invite-code'],
    enabled: user?.role === 'main_admin'
  });
  // Загрузка сохранённых настроек пары
  const { data: settingsData } = useQuery<{ settings?: Record<string, any>}>({
    queryKey: ['/api/settings'],
  });

  // Применяем настройки при загрузке
  useEffect(() => {
    if (!settingsData?.settings) return;
    const s = settingsData.settings as any;
    // Тема
    if (s.theme && s.theme !== theme) setTheme(s.theme);
    // Общие
    if (typeof s.animations === 'boolean') setAnimationsEnabled(s.animations);
    if (typeof s.font === 'string') { setSelectedFont(s.font); try { localStorage.setItem('ui:font', s.font); applyUiFont(s.font); } catch {} }
    if (typeof s.chatBackground === 'string') setChatBackground(s.chatBackground);
    if (typeof s.emailNotifications === 'boolean') setEmailNotifications(s.emailNotifications);
    if (typeof s.pushNotifications === 'boolean') setPushNotifications(s.pushNotifications);
    // Приватность
    if (s.privacy) {
      if (typeof s.privacy.memoriesVisibleForGuests === 'boolean') setMemoriesVisibleForGuests(s.privacy.memoriesVisibleForGuests);
      if (typeof s.privacy.commentsAllowedForGuests === 'boolean') setCommentsAllowedForGuests(s.privacy.commentsAllowedForGuests);
    }
    // Доп. уведомления и интеграции
    if (typeof s.soundNotifications === 'boolean') setSoundNotifications(s.soundNotifications);
    if (typeof s.eventReminders === 'boolean') setEventReminders(s.eventReminders);
    if (typeof s.calendarIntegration === 'boolean') setCalendarIntegration(s.calendarIntegration);
    // Игры
    if (typeof s.gameSounds === 'boolean') setGameSounds(s.gameSounds);
    // Слова с анимациями
    if (Array.isArray(s.wordAnimations)) {
      setWordAnimations(s.wordAnimations);
      try { localStorage.setItem('ui:wordAnimations', JSON.stringify(s.wordAnimations)); } catch {}
    }
  // Подсказка для кода приглашения
  if (typeof s.invitePlaceholder === 'string') setInvitePlaceholder(s.invitePlaceholder);

    // Синхронизируем baseline после применения настроек
    baselineRef.current = {
      animationsEnabled: typeof s.animations === 'boolean' ? s.animations : animationsEnabled,
      selectedFont: typeof s.font === 'string' ? s.font : selectedFont,
      emailNotifications: typeof s.emailNotifications === 'boolean' ? s.emailNotifications : emailNotifications,
      pushNotifications: typeof s.pushNotifications === 'boolean' ? s.pushNotifications : pushNotifications,
      chatBackground: (typeof s.chatBackground === 'string' ? s.chatBackground : chatBackground) as ChatBackgroundKey,
      theme: s.theme ?? theme,
      memoriesVisibleForGuests: s.privacy?.memoriesVisibleForGuests ?? memoriesVisibleForGuests,
      commentsAllowedForGuests: s.privacy?.commentsAllowedForGuests ?? commentsAllowedForGuests,
      soundNotifications: s.soundNotifications ?? soundNotifications,
      eventReminders: s.eventReminders ?? eventReminders,
      calendarIntegration: s.calendarIntegration ?? calendarIntegration,
      gameSounds: s.gameSounds ?? gameSounds,
  wordAnimations: Array.isArray(s.wordAnimations) ? s.wordAnimations : wordAnimations,
      invitePlaceholder: typeof s.invitePlaceholder === 'string' ? s.invitePlaceholder : invitePlaceholder,
    };

    // Если дефолты ещё не зафиксированы — фиксируем текущие сохранённые значения как "по умолчанию"
    if (!defaultsRef.current) {
      defaultsRef.current = { ...baselineRef.current };
      try { localStorage.setItem('ui:defaultsSettings', JSON.stringify(defaultsRef.current)); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsData]);

  const inviteCode = (inviteCodeData as any)?.inviteCode || "";

  // Generate invite code mutation
  const generateInviteMutation = useMutation({
    mutationFn: () => apiRequest('/api/couple/generate-invite', 'POST'),
  onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/couple/invite-code'] });
      toast({
        title: "Код приглашения создан",
        description: "Новый код приглашения успешно сгенерирован",
      });
    },
  onError: (err: any) => {
      toast({
        title: "Ошибка",
        description: err?.message || "Не удалось создать код приглашения",
        variant: "destructive",
      });
    }
  });

  // Revoke invite code mutation
  const revokeInviteMutation = useMutation({
    mutationFn: () => apiRequest('/api/couple/revoke-invite', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/couple/invite-code'] });
      toast({
        title: "Код приглашения отозван",
        description: "Код приглашения успешно деактивирован",
      });
    },
  onError: (err: any) => {
      toast({
        title: "Ошибка",
        description: err?.message || "Не удалось отозвать код приглашения",
        variant: "destructive",
      });
    }
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: (settings: any) => apiRequest('/api/settings', 'PUT', settings),
    onSuccess: () => {
      // Refresh baseline to current values
      baselineRef.current = {
        animationsEnabled,
        selectedFont,
        emailNotifications,
        pushNotifications,
  chatBackground,
  theme,
  memoriesVisibleForGuests,
  commentsAllowedForGuests,
  soundNotifications,
  eventReminders,
  calendarIntegration,
  gameSounds,
  wordAnimations,
  invitePlaceholder,
      };
      toast({
        title: "Настройки сохранены",
        description: "Ваши настройки успешно обновлены",
      });
    },
  onError: (error: any) => {
      toast({
        title: "Ошибка",
    description: error?.message || "Не удалось сохранить настройки",
        variant: "destructive",
      });
    }
  });

  const handleGenerateInviteCode = () => {
    generateInviteMutation.mutate();
  };

  const handleRevokeInviteCode = () => {
    revokeInviteMutation.mutate();
  };

  const handleCopyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      toast({
        title: "Скопировано",
        description: "Код приглашения скопирован в буфер обмена",
      });
  } catch {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать код",
        variant: "destructive",
      });
    }
  };

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  const handleSaveSettings = () => {
    const coupleSettings = {
      animations: animationsEnabled,
      font: selectedFont,
      chatBackground,
      emailNotifications,
      pushNotifications,
      theme,
      privacy: {
        memoriesVisibleForGuests,
        commentsAllowedForGuests,
      },
      soundNotifications,
      eventReminders,
      calendarIntegration,
  gameSounds,
  wordAnimations,
  invitePlaceholder,
    };
    // Persist UI settings locally so чат страница увидит изменения сразу
    try {
      localStorage.setItem('ui:chatBackground', chatBackground);
  localStorage.setItem('ui:font', selectedFont);
  applyUiFont(selectedFont as any);
  localStorage.setItem('ui:wordAnimations', JSON.stringify(wordAnimations));
      // Notify any listeners in the same tab
      window.dispatchEvent(new CustomEvent('chatBackgroundChanged', { detail: { key: chatBackground } }));
  window.dispatchEvent(new CustomEvent('wordAnimationsChanged', { detail: { items: wordAnimations } }));
    } catch {}

    saveSettingsMutation.mutate({
      coupleSettings
    });
  };

  // Показываем кнопку "Сбросить" только если текущая сохранённая база (baseline) отличается от дефолтных настроек
  const _showResetToDefaults = (() => {
    if (!defaultsRef.current) return false;
    const a = baselineRef.current;
    const b = defaultsRef.current;
    const shallowEq = (
      a.animationsEnabled === b.animationsEnabled &&
      a.selectedFont === b.selectedFont &&
      a.emailNotifications === b.emailNotifications &&
      a.pushNotifications === b.pushNotifications &&
      a.chatBackground === b.chatBackground &&
      a.theme === b.theme &&
      a.memoriesVisibleForGuests === b.memoriesVisibleForGuests &&
      a.commentsAllowedForGuests === b.commentsAllowedForGuests &&
      a.soundNotifications === b.soundNotifications &&
      a.eventReminders === b.eventReminders &&
      a.calendarIntegration === b.calendarIntegration &&
      a.gameSounds === b.gameSounds &&
  JSON.stringify(a.wordAnimations) === JSON.stringify(b.wordAnimations) &&
  (a.invitePlaceholder ?? DEFAULT_INVITE_PLACEHOLDER) === (b.invitePlaceholder ?? DEFAULT_INVITE_PLACEHOLDER)
    );
    return !shallowEq;
  })();

  const fontOptions = [
    { value: "Inter", label: "Inter" },
    { value: "Roboto", label: "Roboto" },
    { value: "Open Sans", label: "Open Sans" },
    { value: "Poppins", label: "Poppins" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Manrope", label: "Manrope" },
  { value: "Rubik", label: "Rubik" },
  { value: "Noto Sans", label: "Noto Sans" },
  { value: "Noto Serif", label: "Noto Serif" },
  { value: "Merriweather", label: "Merriweather" },
  { value: "IBM Plex Sans", label: "IBM Plex Sans" },
  { value: "PT Sans", label: "PT Sans" },
  { value: "Comfortaa", label: "Comfortaa" },
  { value: "Golos Text", label: "Golos Text" },
  { value: "Exo 2", label: "Exo 2" },
  { value: "Ubuntu", label: "Ubuntu" },
  { value: "Source Sans 3", label: "Source Sans 3" },
  ];

  // Read tab from query (?tab=messages|appearance|access|notifications|events|games)
  const initialTab = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tab');
      const allowed = new Set(['access','appearance','messages','notifications','events','games']);
      return allowed.has(t || '') ? (t as string) : 'access';
    } catch {
      return 'access';
    }
  })();

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const handleChatBackgroundChange = (value: string) => setChatBackground(value as ChatBackgroundKey);
  const handleFontChange = (value: string) => {
    setSelectedFont(value);
    // Мгновенный предпросмотр шрифта (без сохранения)
    applyUiFont(value as any);
  };
  
  // Derived dirty flag
  const isDirty = (
    animationsEnabled !== baselineRef.current.animationsEnabled ||
    selectedFont !== baselineRef.current.selectedFont ||
    emailNotifications !== baselineRef.current.emailNotifications ||
    pushNotifications !== baselineRef.current.pushNotifications ||
  chatBackground !== baselineRef.current.chatBackground ||
  theme !== baselineRef.current.theme ||
  memoriesVisibleForGuests !== baselineRef.current.memoriesVisibleForGuests ||
  commentsAllowedForGuests !== baselineRef.current.commentsAllowedForGuests ||
  soundNotifications !== baselineRef.current.soundNotifications ||
  eventReminders !== baselineRef.current.eventReminders ||
  calendarIntegration !== baselineRef.current.calendarIntegration ||
  gameSounds !== baselineRef.current.gameSounds ||
  JSON.stringify(wordAnimations) !== JSON.stringify((baselineRef.current as any).wordAnimations) ||
  invitePlaceholder !== baselineRef.current.invitePlaceholder
  );

  const handleResetSettings = () => {
  const d = defaultsRef.current;
  if (!d) return;
  setAnimationsEnabled(d.animationsEnabled);
  setSelectedFont(d.selectedFont);
  setEmailNotifications(d.emailNotifications);
  setPushNotifications(d.pushNotifications);
  setChatBackground(d.chatBackground);
  setTheme(d.theme as any);
  setMemoriesVisibleForGuests(d.memoriesVisibleForGuests);
  setCommentsAllowedForGuests(d.commentsAllowedForGuests);
  setSoundNotifications(d.soundNotifications);
  setEventReminders(d.eventReminders);
  setCalendarIntegration(d.calendarIntegration);
  setGameSounds(d.gameSounds);
  setWordAnimations(d.wordAnimations || DEFAULT_WORD_ANIMATIONS);
  setInvitePlaceholder(d.invitePlaceholder ?? DEFAULT_INVITE_PLACEHOLDER);
  // Применяем шрифт для мгновенного визуального отката
  applyUiFont(d.selectedFont as any);
  };

  useEffect(() => {
    const onPop = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('tab');
        const allowed = new Set(['access','appearance','messages','notifications','events','games']);
        setActiveTab(allowed.has(t || '') ? (t as string) : 'access');
      } catch {}
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const updateUrlTab = (value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    window.history.replaceState({}, '', url.toString());
    setActiveTab(value);
  };

  return (
    <div className="flex min-h-screen" data-testid="settings-page">
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8" data-testid="page-title">
            Настройки
          </h1>

          <Tabs value={activeTab} onValueChange={updateUrlTab} className="space-y-6">
            <TabsList className="grid grid-cols-6 w-full bg-background text-foreground rounded-md p-1">
              <TabsTrigger value="access" data-testid="tab-access">
                <Shield className="w-4 h-4 mr-2" />
                Доступ
              </TabsTrigger>
              <TabsTrigger value="appearance" data-testid="tab-appearance">
                <Palette className="w-4 h-4 mr-2" />
                Оформление
              </TabsTrigger>
              <TabsTrigger value="messages" data-testid="tab-messages">
                <MessageSquare className="w-4 h-4 mr-2" />
                Сообщения
              </TabsTrigger>
              <TabsTrigger value="notifications" data-testid="tab-notifications">
                <Bell className="w-4 h-4 mr-2" />
                Уведомления
              </TabsTrigger>
              <TabsTrigger value="events" data-testid="tab-events">
                <Calendar className="w-4 h-4 mr-2" />
                События
              </TabsTrigger>
              <TabsTrigger value="games" data-testid="tab-games">
                <Gamepad2 className="w-4 h-4 mr-2" />
                Игры
              </TabsTrigger>
            </TabsList>

            {/* Доступ */}
            <TabsContent value="access" className="space-y-6">
              <Card className="glass-strong">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Управление пользователями
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {user?.role === 'main_admin' && (
                    <>
                      <div>
                        <Label>Код приглашения</Label>
                        <div className="flex gap-2 mt-2">
                          <Input
                            value={inviteCode}
                            readOnly
                            placeholder={invitePlaceholder}
                            className="font-mono"
                            data-testid="input-invite-code"
                          />
                          <Button
                            variant="outline"
                            onClick={handleCopyInviteCode}
                            disabled={!inviteCode}
                            data-testid="button-copy-invite"
                            aria-label="Скопировать код приглашения"
                            title="Скопировать код приглашения"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={handleGenerateInviteCode}
                            disabled={generateInviteMutation.isPending}
                            data-testid="button-generate-invite"
                          >
                            {generateInviteMutation.isPending ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <UserPlus className="w-4 h-4 mr-2" />
                            )}
                            Создать
                          </Button>
                          {inviteCode && (
                            <Button
                              variant="destructive"
                              onClick={handleRevokeInviteCode}
                              disabled={revokeInviteMutation.isPending}
                              data-testid="button-revoke-invite"
                            >
                              {revokeInviteMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "Отозвать"
                              )}
                            </Button>
                          )}
                        </div>
                        {/* Удален блок редактирования текста подсказки */}
                      </div>

                      <div>
                        <Label className="text-base font-medium">Роли пользователей</Label>
                        <div className="space-y-3 mt-3">
                          <div className="flex items-center justify-between p-3 glass-strong rounded-lg">
                            <div>
                              <p className="font-medium">Главный администратор</p>
                              <p className="text-sm text-muted-foreground">Полные права управления</p>
                            </div>
                            <div className="text-primary font-medium">Вы</div>
                          </div>
                          {/* Пустое состояние вместо демо-пользователя */}
                          <div className="p-3 glass-strong rounded-lg">
                            <p className="text-sm text-muted-foreground">
                              Участники появятся после присоединения по коду приглашения.
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {user?.role !== 'main_admin' && (
                    <div className="text-center py-8">
                      <Lock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Только главный администратор может управлять доступом
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-strong">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Приватность контента
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Видимость воспоминаний для гостей</Label>
                        <p className="text-sm text-muted-foreground">
                          Могут ли гости видеть ваши воспоминания по умолчанию
                        </p>
                      </div>
                      <Switch
                        checked={memoriesVisibleForGuests}
                        onCheckedChange={setMemoriesVisibleForGuests}
                        aria-label="Видимость воспоминаний для гостей"
                        data-testid="switch-memories-visibility"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Возможность комментирования</Label>
                        <p className="text-sm text-muted-foreground">
                          Могут ли гости оставлять комментарии
                        </p>
                      </div>
                      <Switch
                        checked={commentsAllowedForGuests}
                        onCheckedChange={setCommentsAllowedForGuests}
                        aria-label="Возможность комментирования для гостей"
                        data-testid="switch-comments-visibility"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Оформление */}
            <TabsContent value="appearance" className="space-y-6">
              <Card className="glass-strong">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Внешний вид
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Темная тема</Label>
                      <p className="text-sm text-muted-foreground">
                        Переключение между светлой и темной темой
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      <Switch
                        checked={theme === "dark"}
                        onCheckedChange={handleThemeChange}
                        aria-label="Темная тема"
                        data-testid="switch-dark-mode"
                      />
                      <Moon className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Анимации переходов</Label>
                      <p className="text-sm text-muted-foreground">
                        Включить плавные анимации интерфейса
                      </p>
                    </div>
                    <Switch
                      checked={animationsEnabled}
                      onCheckedChange={setAnimationsEnabled}
                      aria-label="Анимации переходов"
                      data-testid="switch-animations"
                    />
                  </div>

                  <div>
                    <Label>Шрифт интерфейса</Label>
                    <Select value={selectedFont} onValueChange={handleFontChange}>
                      <SelectTrigger
                        className="mt-2"
                        data-testid="select-font"
                        aria-label="Шрифт интерфейса"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fontOptions.map((font) => (
                          <SelectItem key={font.value} value={font.value}>
                            {font.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Сообщения */}
            <TabsContent value="messages" className="space-y-6">
              <Card className="glass-strong">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Настройки чата
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Фон чата</Label>
                    <Select value={chatBackground} onValueChange={handleChatBackgroundChange}>
                      <SelectTrigger
                        className="mt-2"
                        data-testid="select-chat-background"
                        aria-label="Фон чата"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHAT_BACKGROUNDS.map((b) => (
                          <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Стоп-слово</Label>
                    <Input
                      placeholder="Введите стоп-слово с префиксом &"
                      defaultValue="&стоп"
                      className="mt-2"
                      data-testid="input-stop-word"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Блокирует чат на 10 минут (можно использовать раз в сутки)
                    </p>
                  </div>

                  <div>
                    <Label>Анимации совпадающих слов</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Настройте подсветку слов и выберите для них анимации
                    </p>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {wordAnimations.map(({ word, animation }, idx) => (
                          <div key={`${word}-${idx}`} className="flex items-center gap-2 px-2 py-1 bg-primary/10 rounded-full text-sm">
                            <span className="text-primary">{word}</span>
                            <Select value={animation} onValueChange={(val) => {
                              const next = [...wordAnimations];
                              next[idx] = { word, animation: val as AnimationKey };
                              setWordAnimations(next);
                            }}>
                              <SelectTrigger
                                className="h-7 w-40"
                                aria-label={`Анимация для слова ${word}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {AVAILABLE_ANIMATIONS.map(a => (
                                  <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Удалить слово ${word}`}
                                  title={`Удалить слово ${word}`}
                                  onClick={() => {
                              setWordAnimations(wordAnimations.filter((_, i) => i !== idx));
                                }}>×</Button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newWord}
                          onChange={e => setNewWord(e.target.value)}
                          placeholder="Добавить новое слово"
                          data-testid="input-animation-word"
                        />
                        <Select value={newWordAnim} onValueChange={(v) => setNewWordAnim(v as AnimationKey)}>
                          <SelectTrigger
                            className="w-44"
                            aria-label="Анимация"
                          >
                            <SelectValue placeholder="Анимация" />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_ANIMATIONS.map(a => (
                              <SelectItem key={a.key} value={a.key}>{a.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const w = newWord.trim();
                            if (!w) return;
                            // не добавляем дубликаты (обновим анимацию, если слово уже есть)
                            const idx = wordAnimations.findIndex(x => x.word.toLowerCase() === w.toLowerCase());
                            if (idx >= 0) {
                              const next = [...wordAnimations];
                              next[idx] = { word: next[idx].word, animation: newWordAnim };
                              setWordAnimations(next);
                            } else {
                              setWordAnimations([...wordAnimations, { word: w, animation: newWordAnim }]);
                            }
                            setNewWord("");
                          }}
                        >Добавить</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Подсказка: одинаковые анимации можно назначать разным словам.</p>
                    </div>
                  </div>

                  <div>
                    <Label>Пароль для личных сообщений</Label>
                    <div className="space-y-2 mt-2">
                      <Input
                        type="password"
                        placeholder="Текущий пароль"
                        data-testid="input-current-chat-password"
                      />
                      <Input
                        type="password"
                        placeholder="Новый пароль"
                        data-testid="input-new-chat-password"
                      />
                      <Input
                        type="password"
                        placeholder="Подтвердите новый пароль"
                        data-testid="input-confirm-chat-password"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Уведомления */}
            <TabsContent value="notifications" className="space-y-6">
              <Card className="glass-strong">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Уведомления
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email уведомления</Label>
                      <p className="text-sm text-muted-foreground">
                        Получать уведомления на электронную почту
                      </p>
                    </div>
                    <Switch
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                      aria-label="Email уведомления"
                      data-testid="switch-email-notifications"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Push уведомления</Label>
                      <p className="text-sm text-muted-foreground">
                        Мгновенные уведомления в браузере
                      </p>
                    </div>
                    <Switch
                      checked={pushNotifications}
                      onCheckedChange={setPushNotifications}
                      aria-label="Push уведомления"
                      data-testid="switch-push-notifications"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Звуковые уведомления</Label>
                      <p className="text-sm text-muted-foreground">
                        Проигрывать звуки при получении сообщений
                      </p>
                    </div>
                    <Switch
                      checked={soundNotifications}
                      onCheckedChange={setSoundNotifications}
                      aria-label="Звуковые уведомления"
                      data-testid="switch-sound-notifications"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Напоминания о событиях</Label>
                      <p className="text-sm text-muted-foreground">
                        Уведомления о важных датах и событиях
                      </p>
                    </div>
                    <Switch
                      checked={eventReminders}
                      onCheckedChange={setEventReminders}
                      aria-label="Напоминания о событиях"
                      data-testid="switch-event-reminders"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* События и счетчики */}
            <TabsContent value="events" className="space-y-6">
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    События и счетчики
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Активные счетчики</Label>
                    <div className="space-y-3 mt-3">
                      {/* Пустое состояние вместо демо-счетчиков */}
                      <div className="p-3 glass-strong rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Пока нет счетчиков. Добавьте свой ниже.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Добавить новый счетчик</Label>
                    <div className="space-y-2 mt-2">
                      <Input placeholder="Название счетчика" data-testid="input-counter-name" />
                      <div className="flex gap-2">
                        <Input type="number" placeholder="Значение" data-testid="input-counter-value" />
                        <Input type="date" placeholder="Целевая дата" data-testid="input-counter-date" />
                      </div>
                      <Button variant="outline" data-testid="button-add-counter">
                        Добавить счетчик
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Интеграция с календарем</Label>
                      <p className="text-sm text-muted-foreground">
                        Синхронизация событий с календарем устройства
                      </p>
                    </div>
                    <Switch
                      checked={calendarIntegration}
                      onCheckedChange={setCalendarIntegration}
                      aria-label="Интеграция с календарем"
                      data-testid="switch-calendar-integration"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Игры */}
            <TabsContent value="games" className="space-y-6">
              <Card className="glass-strong">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gamepad2 className="w-5 h-5" />
                    Настройки игр
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>"Правда или действие" - вопросы</Label>
                    <Textarea
                      placeholder="Введите свои вопросы (по одному на строку)"
                      className="mt-2 min-h-[100px]"
                      data-testid="textarea-truth-questions"
                    />
                  </div>

                  <div>
                    <Label>"Правда или действие" - действия</Label>
                    <Textarea
                      placeholder="Введите свои задания (по одному на строку)"
                      className="mt-2 min-h-[100px]"
                      data-testid="textarea-dare-actions"
                    />
                  </div>

                  <div>
                    <Label>"Угадай меня" - вопросы</Label>
                    <Textarea
                      placeholder="Введите вопросы о себе и партнере"
                      className="mt-2 min-h-[100px]"
                      data-testid="textarea-guess-questions"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Звуки в играх</Label>
                      <p className="text-sm text-muted-foreground">
                        Проигрывать звуковые эффекты в играх
                      </p>
                    </div>
                    <Switch
                      checked={gameSounds}
                      onCheckedChange={setGameSounds}
                      aria-label="Звуки в играх"
                      data-testid="switch-game-sounds"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Кнопки действий */}
          <div className="flex justify-end gap-4 mt-8">
            {isDirty && (
              <Button 
                variant="outline" 
                onClick={handleResetSettings}
                data-testid="button-reset-settings"
              >
                Сбросить
              </Button>
            )}
            <Button 
              onClick={handleSaveSettings} 
              className="btn-gradient" 
              disabled={!isDirty || saveSettingsMutation.isPending}
              data-testid="button-save-settings"
            >
              {saveSettingsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                "Сохранить настройки"
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
