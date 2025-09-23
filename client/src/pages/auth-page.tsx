import { useState, useEffect } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff } from "lucide-react";
import logoUrl from "@/assets/logo.png";

export default function AuthPage() {
  const { user, isLoading, loginMutation, registerMutation, joinWithInviteMutation, registerWithInviteMutation } = useAuth();
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [inviteMode, setInviteMode] = useState<'existing' | 'new'>('existing');
  const [agreeRegister, setAgreeRegister] = useState(false);
  const [agreeInviteNew, setAgreeInviteNew] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && user) {
      // Will be handled by redirect below
    }
  }, [user, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  const togglePasswordVisibility = (field: string) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    loginMutation.mutate({
      username: formData.get('username') as string,
      password: formData.get('password') as string,
    });
  };

  const handleRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agreeRegister) {
      alert('Пожалуйста, подтвердите согласие с Политикой конфиденциальности');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    
    if (password !== confirmPassword) {
      alert('Пароли не совпадают');
      return;
    }

    registerMutation.mutate({
      email: formData.get('email') as string,
      username: formData.get('username') as string,
      password: password,
    });
  };

  const handleJoinWithInvite = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    joinWithInviteMutation.mutate({
      username: formData.get('username') as string,
      password: formData.get('password') as string,
      inviteCode: formData.get('inviteCode') as string,
    });
  };

  const handleRegisterWithInvite = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agreeInviteNew) {
      alert('Пожалуйста, подтвердите согласие с Политикой конфиденциальности');
      return;
    }
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    
    if (password !== confirmPassword) {
      alert('Пароли не совпадают');
      return;
    }

    registerWithInviteMutation.mutate({
      email: formData.get('email') as string,
      username: formData.get('username') as string,
      password: password,
      inviteCode: formData.get('inviteCode') as string,
    });
  };

  return (
  <div className="min-h-screen flex items-center justify-center p-4" data-testid="auth-page">
      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Левая панель с логотипом и манифестом */}
        <div className="w-full md:flex-1 flex flex-col justify-center items-center glass-strong rounded-2xl p-6 md:p-8 floating mb-4 md:mb-0">
          <div className="text-center">
            {/* Оригинальный логотип без изменений */}
            <img 
              src={logoUrl} 
              alt="Endlessalbum Logo"
              className="w-20 h-20 mx-auto mb-6 rounded-full object-contain"
            />
            <h1 className="text-4xl font-bold text-foreground mb-4">Endlessalbum</h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-md">
              Бесконечный альбом ваших воспоминаний. Создавайте, делитесь и храните самые важные моменты вместе.
            </p>
          </div>
        </div>

        {/* Правая панель с формой авторизации */}
  <div className="w-full md:flex-1">
          <div className="glass-strong rounded-2xl p-6 md:p-8">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger className="flex-1" value="login" data-testid="tab-login">Вход</TabsTrigger>
                <TabsTrigger className="flex-1" value="register" data-testid="tab-register">Регистрация</TabsTrigger>
                <TabsTrigger className="flex-1" value="invite" data-testid="tab-invite">Приглашение</TabsTrigger>
              </TabsList>

              {/* Форма входа */}
              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4" data-testid="form-login">
                  <div>
                    <Label htmlFor="login-username">Email или никнейм</Label>
                    <Input
                      id="login-username"
                      name="username"
                      type="text"
                      placeholder="Введите email или никнейм"
                      required
                      data-testid="input-username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Пароль</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        name="password"
                        type={showPassword.loginPassword ? "text" : "password"}
                        placeholder="Введите пароль"
                        required
                        data-testid="input-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => togglePasswordVisibility('loginPassword')}
                        data-testid="button-toggle-password"
                      >
                        {showPassword.loginPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full btn-gradient" 
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? 'Вход...' : 'Войти'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full"
                    data-testid="button-forgot-password"
                  >
                    Забыли пароль?
                  </Button>
                </form>
              </TabsContent>

              {/* Форма регистрации */}
              <TabsContent value="register" className="space-y-4">
                <form onSubmit={handleRegister} className="space-y-4" data-testid="form-register">
                  <div>
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      name="email"
                      type="email"
                      placeholder="Введите email"
                      required
                      data-testid="input-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-username">Никнейм</Label>
                    <Input
                      id="register-username"
                      name="username"
                      type="text"
                      placeholder="Выберите никнейм"
                      required
                      data-testid="input-register-username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-password">Пароль</Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        name="password"
                        type={showPassword.registerPassword ? "text" : "password"}
                        placeholder="Создайте пароль"
                        required
                        data-testid="input-register-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => togglePasswordVisibility('registerPassword')}
                        data-testid="button-toggle-register-password"
                      >
                        {showPassword.registerPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="confirm-password">Подтверждение пароля</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        name="confirmPassword"
                        type={showPassword.confirmPassword ? "text" : "password"}
                        placeholder="Повторите пароль"
                        required
                        data-testid="input-confirm-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => togglePasswordVisibility('confirmPassword')}
                        data-testid="button-toggle-confirm-password"
                      >
                        {showPassword.confirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Checkbox id="agree-register" checked={agreeRegister} onCheckedChange={(v) => setAgreeRegister(Boolean(v))} />
                    <label htmlFor="agree-register" className="leading-5">
                      Продолжая, вы соглашаетесь с нашей {" "}
                      <a href="/privacy" className="underline hover:text-foreground">Политикой конфиденциальности</a>.
                    </label>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full btn-gradient" 
                    disabled={registerMutation.isPending || !agreeRegister}
                    data-testid="button-register"
                  >
                    {registerMutation.isPending ? 'Регистрация...' : 'Зарегистрироваться'}
                  </Button>
                </form>
              </TabsContent>

              {/* Форма приглашения */}
              <TabsContent value="invite" className="space-y-4">
                <div className="mb-6">
                  <Tabs value={inviteMode} onValueChange={(value) => setInviteMode(value as 'existing' | 'new')}>
                    <TabsList className="w-full">
                      <TabsTrigger className="flex-1" value="existing" data-testid="invite-existing">У меня есть аккаунт</TabsTrigger>
                      <TabsTrigger className="flex-1" value="new" data-testid="invite-new">У меня нет аккаунта</TabsTrigger>
                    </TabsList>

                    <TabsContent value="existing" className="space-y-4 mt-4">
                      <form onSubmit={handleJoinWithInvite} className="space-y-4" data-testid="invite-existing-form">
                        <div>
                          <Label htmlFor="invite-existing-username">Email или никнейм</Label>
                          <Input
                            id="invite-existing-username"
                            name="username"
                            type="text"
                            placeholder="Введите email или никнейм"
                            required
                            data-testid="input-invite-username"
                          />
                        </div>
                        <div>
                          <Label htmlFor="invite-existing-password">Пароль</Label>
                          <div className="relative">
                            <Input
                              id="invite-existing-password"
                              name="password"
                              type={showPassword.inviteExistingPassword ? "text" : "password"}
                              placeholder="Введите пароль"
                              required
                              data-testid="input-invite-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => togglePasswordVisibility('inviteExistingPassword')}
                              data-testid="button-toggle-invite-password"
                            >
                              {showPassword.inviteExistingPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="invite-existing-code">Код приглашения</Label>
                          <Input
                            id="invite-existing-code"
                            name="inviteCode"
                            type="text"
                            placeholder="XXXX-XXXX-XXXX"
                            className="font-mono tracking-wider uppercase"
                            required
                            data-testid="input-invite-code"
                          />
                        </div>
                        <Button 
                          type="submit" 
                          className="w-full btn-gradient"
                          disabled={joinWithInviteMutation.isPending}
                          data-testid="button-join-existing"
                        >
                          {joinWithInviteMutation.isPending ? 'Присоединение...' : 'Присоединиться'}
                        </Button>
                      </form>
                    </TabsContent>

                    <TabsContent value="new" className="space-y-4 mt-4">
                      <form onSubmit={handleRegisterWithInvite} className="space-y-4" data-testid="invite-new-form">
                        <div>
                          <Label htmlFor="invite-new-email">Email</Label>
                          <Input
                            id="invite-new-email"
                            name="email"
                            type="email"
                            placeholder="Введите email"
                            required
                            data-testid="input-invite-email"
                          />
                        </div>
                        <div>
                          <Label htmlFor="invite-new-username">Никнейм</Label>
                          <Input
                            id="invite-new-username"
                            name="username"
                            type="text"
                            placeholder="Выберите никнейм"
                            required
                            data-testid="input-invite-new-username"
                          />
                        </div>
                        <div>
                          <Label htmlFor="invite-new-password">Пароль</Label>
                          <div className="relative">
                            <Input
                              id="invite-new-password"
                              name="password"
                              type={showPassword.inviteNewPassword ? "text" : "password"}
                              placeholder="Создайте пароль"
                              required
                              data-testid="input-invite-new-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => togglePasswordVisibility('inviteNewPassword')}
                              data-testid="button-toggle-invite-new-password"
                            >
                              {showPassword.inviteNewPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="invite-new-confirm">Подтверждение пароля</Label>
                          <div className="relative">
                            <Input
                              id="invite-new-confirm"
                              name="confirmPassword"
                              type={showPassword.inviteNewConfirm ? "text" : "password"}
                              placeholder="Повторите пароль"
                              required
                              data-testid="input-invite-confirm-password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                              onClick={() => togglePasswordVisibility('inviteNewConfirm')}
                              data-testid="button-toggle-invite-confirm"
                            >
                              {showPassword.inviteNewConfirm ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="invite-new-code">Код приглашения</Label>
                          <Input
                            id="invite-new-code"
                            name="inviteCode"
                            type="text"
                            placeholder="XXXX-XXXX-XXXX"
                            className="font-mono tracking-wider uppercase"
                            required
                            data-testid="input-invite-new-code"
                          />
                        </div>
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Checkbox id="agree-invite-new" checked={agreeInviteNew} onCheckedChange={(v) => setAgreeInviteNew(Boolean(v))} />
                          <label htmlFor="agree-invite-new" className="leading-5">
                            Продолжая, вы соглашаетесь с нашей {" "}
                            <a href="/privacy" className="underline hover:text-foreground">Политикой конфиденциальности</a>.
                          </label>
                        </div>
                        <Button 
                          type="submit" 
                          className="w-full btn-gradient"
                          disabled={registerWithInviteMutation.isPending || !agreeInviteNew}
                          data-testid="button-join-new"
                        >
                          {registerWithInviteMutation.isPending ? 'Присоединение...' : 'Зарегистрироваться и присоединиться'}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Футер */}
  <footer className="fixed bottom-0 left-0 right-0 text-center py-4 pb-safe text-sm text-muted-foreground">
        © 2025 — {new Date().getFullYear()} Endlessalbum · Создано с заботой о пользователях
        <span className="block mt-1">
          <a href="/privacy" className="hover:text-foreground transition-colors" data-testid="link-privacy">
            Политика конфиденциальности
          </a>
          {' '}
          ·
          {' '}
          <a href="/terms" className="hover:text-foreground transition-colors" data-testid="link-terms">
            Пользовательское соглашение
          </a>
        </span>
      </footer>
    </div>
  );
}
