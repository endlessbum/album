import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AvatarUpload } from "@/components/avatar-upload";
import { useAuth } from "@/hooks/use-auth";
import { Heart, Calendar, MapPin, Loader2, AlertCircle, Trash, MessageCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type UpdateProfile } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
 
// Allow http(s) URLs and relative '/uploads/*' paths
const isHttpUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

type ProfileData = {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  coupleId: string;
  createdAt: string;
  stats: {
    memoriesCount: number;
    messagesCount: number;
    gamesCount: number;
    daysInCouple: number;
    placesVisited: number;
  };
};

export default function ProfilePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  

  // Fetch profile data
  const { data: profile, isLoading, error } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  

  // Local composite schema: server fields + local-only fields (status, wishlist)
  const profileFormSchema = z.object({
    // Разрешаем пустые строки для необязательных полей: трактуем как undefined (не отправляем на сервер)
    username: z
      .union([z.string().trim().min(1, "Никнейм обязателен").max(50, "Никнейм не может быть длиннее 50 символов"), z.literal("")])
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
    firstName: z
      .string()
      .max(100, "Имя не может быть длиннее 100 символов")
      .optional()
      .nullable(),
    lastName: z
      .string()
      .max(100, "Фамилия не может быть длиннее 100 символов")
      .optional()
      .nullable(),
    profileImageUrl: z
      .union([
        z
          .string()
          .trim()
          .refine(
            (v) => isHttpUrl(v) || v.startsWith("/uploads/"),
            { message: "Некорректный URL изображения" }
          ),
        z.literal(""),
      ])
      .transform((v) => (v === "" ? undefined : v))
      .optional()
      .nullable(),
    email: z
      .union([z.string().trim().email("Некорректный email"), z.literal("")])
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
    status: z.string().max(1000, "Статус слишком длинный").optional().nullable(),
    wishlist: z
      .array(
        z.object({
          title: z.string().min(1, "Название обязательно"),
          link: z
            .string()
            .url("Некорректная ссылка")
            .optional()
            .or(z.literal(""))
            .transform((v) => (v ? v : undefined)),
        })
      )
      .optional()
      .default([]),
  });

  type ProfileFormValues = z.infer<typeof profileFormSchema>;

  // Form setup
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      profileImageUrl: null,
      status: "",
      wishlist: [],
    },
  });

  // Wishlist field array helpers
  const { fields: wishlistFields, remove, /* append */ } = useFieldArray({
    control: form.control,
    name: "wishlist",
  });

  // Local inputs for adding wishlist items
  const [newWishTitle, setNewWishTitle] = React.useState("");
  const [newWishLink, setNewWishLink] = React.useState("");

  // Track if there are unsaved changes
  const { isDirty } = form.formState;

  // Watch local-only fields to detect differences vs persisted values
  const watchedStatus = form.watch("status");
  const watchedWishlist = form.watch("wishlist");

  // Determine if Save should be enabled: either form has dirty server fields
  // or local-only fields differ from what's persisted in localStorage
  const canSave = React.useMemo(() => {
    if (!profile) return false;
    const statusKey = `profile:${profile.id}:status`;
    const wishlistKey = `profile:${profile.id}:wishlist`;
    let prevLocalStatus = "";
    let prevLocalWishlist: Array<{ title: string; link?: string }> = [];
    try {
      const s = localStorage.getItem(statusKey);
      if (typeof s === "string") prevLocalStatus = s;
      const wl = localStorage.getItem(wishlistKey);
      if (typeof wl === "string") prevLocalWishlist = JSON.parse(wl);
    } catch {}
    const localDiff =
      (watchedStatus ?? "") !== prevLocalStatus ||
      JSON.stringify(watchedWishlist ?? []) !== JSON.stringify(prevLocalWishlist);
    return isDirty || localDiff;
  }, [profile, isDirty, watchedStatus, watchedWishlist]);

  // Helper: storage keys for local-only fields
  const getStatusKey = React.useCallback(
    (id: string) => `profile:${id}:status`,
    []
  );
  const getWishlistKey = React.useCallback(
    (id: string) => `profile:${id}:wishlist`,
    []
  );

  // Update form values when profile data loads (plus hydrate local-only fields)
  React.useEffect(() => {
    if (profile) {
      // Load local-only fields
      let localStatus = "";
      let localWishlist: Array<{ title: string; link?: string }> = [];
      try {
        const s = localStorage.getItem(getStatusKey(profile.id));
        if (typeof s === "string") localStatus = s;
        const wl = localStorage.getItem(getWishlistKey(profile.id));
        if (typeof wl === "string") localWishlist = JSON.parse(wl);
      } catch {}

      form.reset({
        username: profile.username,
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email,
        profileImageUrl: profile.profileImageUrl,
        status: localStatus,
        wishlist: localWishlist,
      });
    }
  }, [profile, form, getStatusKey, getWishlistKey]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: UpdateProfile) => {
      const res = await apiRequest("/api/profile", "PUT", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Профиль обновлен",
        description: "Ваши изменения успешно сохранены",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  onError: async (_error: any) => {
      // error.message may contain "<status>: <json or text>"
      let message = error?.message || "Не удалось обновить профиль";
      try {
        const colonIdx = message.indexOf(": ");
        const maybeJson = colonIdx >= 0 ? message.slice(colonIdx + 2) : "";
        if (maybeJson.startsWith("{")) {
          const parsed = JSON.parse(maybeJson);
          if (Array.isArray(parsed.details)) {
            for (const d of parsed.details) {
              const field = d.field as keyof ProfileFormValues;
              const msg = d.message || parsed.message || "Некорректные данные";
              if (field) {
                form.setError(field, { message: msg });
              }
            }
            message = parsed.message || message;
          } else if (parsed.message) {
            message = parsed.message;
          }
        }
      } catch {}
      toast({
        title: "Ошибка",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    // Split server-updated fields and local-only fields
    const { status, wishlist, ...serverFields } = data;

    // Normalize: trim strings; drop empty strings; allow nulls to pass through
    const normalizedEntries = Object.entries(serverFields).map(([k, v]) => {
      if (typeof v === "string") {
        const t = v.trim();
        return [k, t === "" ? undefined : t];
      }
      return [k, v];
    });
    const cleanServerData = Object.fromEntries(
      normalizedEntries.filter(([_, value]) => value !== undefined && value !== null)
    ) as Partial<UpdateProfile>;

    // Detect local changes robustly (compare with persisted values)
    let prevLocalStatus = "";
    let prevLocalWishlist: Array<{ title: string; link?: string }> = [];
    if (profile) {
      try {
        const s = localStorage.getItem(getStatusKey(profile.id));
        if (typeof s === "string") prevLocalStatus = s;
        const wl = localStorage.getItem(getWishlistKey(profile.id));
        if (typeof wl === "string") prevLocalWishlist = JSON.parse(wl);
      } catch {}
    }
    const localActuallyChanged =
      (status ?? "") !== prevLocalStatus ||
      JSON.stringify(wishlist ?? []) !== JSON.stringify(prevLocalWishlist);

    const hasServerChanges = Object.keys(cleanServerData).length > 0;
    const hasLocalChanges =
      form.getFieldState("status").isDirty ||
      form.getFieldState("wishlist").isDirty ||
      localActuallyChanged;

    if (!hasServerChanges && !hasLocalChanges) {
      toast({
        title: "Нет изменений",
        description: "Нет данных для обновления",
        variant: "destructive",
      });
      return;
    }

    try {
      // 1) Save server-side fields if any
      const didServerUpdate = Object.keys(cleanServerData).length > 0;
      let updatedFromServer: Partial<ProfileData> | null = null;
      if (didServerUpdate) {
        // Capture updated profile returned by API
        const res = await updateProfileMutation.mutateAsync(
          cleanServerData as UpdateProfile,
        );
        updatedFromServer = res as Partial<ProfileData>;
        // Optimistically update cache to reflect changes immediately
        try {
          const merged = (old: any) =>
            old
              ? { ...old, ...cleanServerData, ...updatedFromServer }
              : { ...cleanServerData, ...updatedFromServer };
          queryClient.setQueryData(["/api/profile"], merged);
          queryClient.setQueryData(["/api/user"], merged);
        } catch {}
      }

      // 2) Save local-only fields (always, idempotent)
      if (profile) {
        try {
          localStorage.setItem(getStatusKey(profile.id), status ?? "");
          localStorage.setItem(
            getWishlistKey(profile.id),
            JSON.stringify(wishlist ?? [])
          );
        } catch {}
      }

      // 3) Reset form state to current values (to clear isDirty)
  const base = (updatedFromServer || profile) as Partial<ProfileData> | undefined;
      form.reset({
        ...(base
          ? {
      username: (cleanServerData as any).username ?? base.username ?? "",
      firstName: (cleanServerData as any).firstName ?? base.firstName ?? "",
      lastName: (cleanServerData as any).lastName ?? base.lastName ?? "",
      email: (cleanServerData as any).email ?? base.email ?? "",
              profileImageUrl: base.profileImageUrl ?? null,
            }
          : {}),
        status: status ?? "",
        wishlist: wishlist ?? [],
      });

      // If only local fields changed, provide feedback here
      if (!didServerUpdate) {
        toast({
          title: "Профиль обновлен",
          description: "Изменения сохранены",
        });
      }
      // Keep data fresh
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
  } catch (_error: any) {
      toast({
        title: "Ошибка",
    description: _error?.message || "Не удалось обновить профиль",
        variant: "destructive",
      });
    }
  };

  // Function to save wishlist immediately
  const saveWishlistImmediately = (newItem: { title: string; link?: string }) => {
    if (profile) {
      const currentWishlist = form.getValues("wishlist") || [];
      const updatedWishlist = [...currentWishlist, newItem];
      
      try {
        localStorage.setItem(
          getWishlistKey(profile.id),
          JSON.stringify(updatedWishlist)
        );
        
        // Update form without marking as dirty since we already saved
        form.setValue("wishlist", updatedWishlist, { shouldDirty: false });
        
        toast({
          title: "Элемент добавлен",
          description: "Новый элемент вишлиста сохранен",
        });
  } catch (_error) {
        toast({
          title: "Ошибка",
          description: "Не удалось сохранить элемент вишлиста",
          variant: "destructive",
        });
      }
    }
  };

  // Function to remove wishlist item immediately
  const removeWishlistItemImmediately = (index: number) => {
    if (profile) {
      const currentWishlist = form.getValues("wishlist") || [];
      const updatedWishlist = currentWishlist.filter((_, idx) => idx !== index);
      
      try {
        localStorage.setItem(
          getWishlistKey(profile.id),
          JSON.stringify(updatedWishlist)
        );
        
        // Update form without marking as dirty since we already saved
        form.setValue("wishlist", updatedWishlist, { shouldDirty: false });
        
        // Also remove from field array to update UI
        remove(index);
        
        toast({
          title: "Элемент удален",
          description: "Элемент вишлиста удален",
        });
  } catch (_error) {
        toast({
          title: "Ошибка",
          description: "Не удалось удалить элемент вишлиста",
          variant: "destructive",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <main className="flex-1 p-6" data-testid="profile-page">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Загрузка профиля...</span>
          </div>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="flex-1 p-6" data-testid="profile-page">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64 text-destructive">
            <AlertCircle className="h-8 w-8" />
            <span className="ml-2">Не удалось загрузить профиль</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6" data-testid="profile-page">
      <div className="max-w-4xl mx-auto">
        <h1
          className="text-3xl font-bold text-foreground mb-8"
          data-testid="page-title"
        >
          Профиль
        </h1>

  <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              const first = Object.keys(errors)[0] as keyof typeof errors | undefined;
              const msg = first && (errors as any)[first]?.message ? (errors as any)[first].message : "Исправьте ошибки формы";
              // Toast about validation issue
              toast({ title: "Проверка не пройдена", description: String(msg), variant: "destructive" });
              // Try to focus the first invalid field
              try {
                const map: Record<string, string> = {
                  username: 'input-username',
                  email: 'input-email',
                  firstName: 'input-first-name',
                  lastName: 'input-last-name',
                  status: 'input-status',
                };
                if (first && map[first as string]) {
                  const el = document.querySelector(`[data-testid="${map[first as string]}"]`) as HTMLElement | null;
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el?.focus();
                }
              } catch {}
            })}
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Основная информация */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="glass hover-lift">
                  <CardHeader>
                    <CardTitle>Основная информация</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Никнейм</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              data-testid="input-username"
                              placeholder="Введите никнейм"
                              className="focus-ring"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              data-testid="input-email"
                              placeholder="Введите email"
                              className="focus-ring"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Имя</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              data-testid="input-first-name"
                              placeholder="Введите имя"
                              className="focus-ring"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Фамилия</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              data-testid="input-last-name"
                              placeholder="Введите фамилию"
                              className="focus-ring"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card className="glass hover-lift">
                  <CardHeader>
                    <CardTitle>Статус</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ваш статус</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value || ""}
                              placeholder="Напишите что-нибудь о себе..."
                              className="mt-2 focus-ring"
                              data-testid="input-status"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card className="glass hover-lift">
                  <CardHeader>
                    <CardTitle>Вишлист</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Добавьте то, что хотели бы приобрести или получить в подарок
                      </p>

                      {/* Existing items */}
                      {wishlistFields.length > 0 && (
                        <div className="space-y-2">
                          {wishlistFields.map((item, idx) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 border rounded-md p-2 transition-all hover:shadow-sm"
                            >
                              <div className="flex-1 overflow-hidden">
                                <div className="font-medium truncate">
                                  {form.watch(`wishlist.${idx}.title`) || "(без названия)"}
                                </div>
                                {form.watch(`wishlist.${idx}.link`) && (
                                  <a
                                    href={form.watch(`wishlist.${idx}.link`) as string}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-primary truncate"
                                  >
                                    {form.watch(`wishlist.${idx}.link`) as string}
                                  </a>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Удалить"
                                title="Удалить"
                                onClick={() => removeWishlistItemImmediately(idx)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add new item */}
                      <div className="space-y-3">
                        <Input
                          placeholder="Название желания"
                          value={newWishTitle}
                          onChange={(e) => setNewWishTitle(e.target.value)}
                          className="focus-ring"
                          data-testid="input-wishlist-item"
                        />
                        <Input
                          placeholder="Ссылка (необязательно)"
                          value={newWishLink}
                          onChange={(e) => setNewWishLink(e.target.value)}
                          className="focus-ring"
                          data-testid="input-wishlist-link"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!newWishTitle.trim()) return;
                            const newItem = { 
                              title: newWishTitle.trim(), 
                              link: newWishLink.trim() || undefined 
                            };
                            
                            // Save immediately to localStorage and update form
                            saveWishlistImmediately(newItem);
                            
                            // Clear input fields
                            setNewWishTitle("");
                            setNewWishLink("");
                          }}
                          className="hover-lift"
                          data-testid="button-add-wishlist"
                        >
                          Добавить
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Боковая панель (аватар + статистика + роль) */}
              <div className="space-y-6">
                <Card className="glass-strong hover-lift">
                  <CardHeader>
                    <CardTitle>Аватар</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AvatarUpload
                      currentAvatarUrl={profile?.profileImageUrl}
                      username={profile?.username}
                      onAvatarChange={(newUrl) => {
                        form.setValue("profileImageUrl", newUrl, { shouldDirty: true });
                        queryClient.setQueryData(
                          ["/api/profile"],
                          (oldData: any) =>
                            oldData
                              ? { ...oldData, profileImageUrl: newUrl }
                              : oldData
                        );
                        queryClient.invalidateQueries({
                          queryKey: ["/api/profile"],
                        });
                        queryClient.invalidateQueries({
                          queryKey: ["/api/user"],
                        });
                      }}
                    />
                  </CardContent>
                </Card>

                <Card className="glass-strong hover-lift">
                  <CardHeader>
                    <CardTitle>Статистика</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Heart className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="text-sm font-medium">Дней вместе</p>
                        <p
                          className="text-2xl font-bold text-black dark:text-white"
                          data-testid="stat-days-together"
                        >
                          {profile?.stats.daysInCouple || 0}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium">Воспоминаний</p>
                        <p
                          className="text-2xl font-bold text-black dark:text-white"
                          data-testid="stat-memories"
                        >
                          {profile?.stats.memoriesCount || 0}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">Мест посещено</p>
                        <p
                          className="text-2xl font-bold text-black dark:text-white"
                          data-testid="stat-places"
                        >
                          {profile?.stats.placesVisited || 0}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MessageCircle className="h-5 w-5 text-purple-500" />
                      <div>
                        <p className="text-sm font-medium">Сообщений</p>
                        <p
                          className="text-2xl font-bold text-black dark:text-white"
                          data-testid="stat-messages"
                        >
                          {profile?.stats.messagesCount || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-strong hover-lift">
                  <CardHeader>
                    <CardTitle>Роль</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary"
                        data-testid="user-role"
                      >
                        {profile?.role === "main_admin" &&
                          "Администратор"}
                        {profile?.role === "co_admin" &&
                          "Равноправный администратор"}
                        {profile?.role === "guest" && "Гость"}
                        {profile?.role === "user" && "Пользователь"}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {profile?.role === "main_admin" &&
                          "Может управлять приглашениями и правами"}
                        {profile?.role === "co_admin" &&
                          "Полный доступ ко всем функциям"}
                        {profile?.role === "guest" &&
                          "Ограниченный доступ к контенту"}
                        {profile?.role === "user" &&
                          "Стандартный доступ к функциям"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Настройки перенесены ниже, над разделом "Аккаунт" */}
              </div>
            </div>

            {/* Кнопки действий */}
            <div className="flex justify-center gap-4 my-8">
              {isDirty && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!profile) return form.reset();
                    let localStatus = "";
                    let localWishlist: Array<{ title: string; link?: string }> = [];
                    try {
                      const s = localStorage.getItem(getStatusKey(profile.id));
                      if (typeof s === "string") localStatus = s;
                      const wl = localStorage.getItem(getWishlistKey(profile.id));
                      if (typeof wl === "string") localWishlist = JSON.parse(wl);
                    } catch {}
                    form.reset({
                      username: profile.username,
                      firstName: profile.firstName || "",
                      lastName: profile.lastName || "",
                      email: profile.email,
                      profileImageUrl: profile.profileImageUrl,
                      status: localStatus,
                      wishlist: localWishlist,
                    });
                  }}
                  data-testid="button-cancel"
                className="hover-lift focus-ring">
                  Отмена
                </Button>
              )}
              <Button
                type="submit"
                className="btn-gradient"
                disabled={updateProfileMutation.isPending || !canSave}
                aria-disabled={updateProfileMutation.isPending || !canSave}
                data-testid="button-save-profile"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  "Сохранить изменения"
                )}
              </Button>
            </div>
          </form>
        </Form>

        

        {/* Кнопка выхода без контейнера "Аккаунт", сохраняем вертикальное расстояние */}
    <div className="mt-12 pt-6 flex justify-center">
          <Button
            variant="destructive"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
      className="hover-lift focus-ring bg-red-700 hover:bg-red-800 text-white"
            data-testid="button-logout"
          >
            {logoutMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Выход...
              </>
            ) : (
              "Выйти из аккаунта"
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}