import React from "react";
import { Link } from "wouter";
import { Home, MessageCircle, User, Plus } from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="hidden lg:block fixed left-0 top-0 h-screen w-64 p-4">
      <div className="h-full glass-strong rounded-2xl p-4 flex flex-col">
        <h2 className="text-lg font-semibold mb-4">Навигация</h2>
        <nav className="space-y-2">
          <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/40">
            <Home className="h-4 w-4" />
            <span>Главная</span>
          </Link>
          <Link href="/create" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/40">
            <Plus className="h-4 w-4" />
            <span>Создать</span>
          </Link>
          <Link href="/messages" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/40">
            <MessageCircle className="h-4 w-4" />
            <span>Сообщения</span>
          </Link>
          <Link href="/profile" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/40">
            <User className="h-4 w-4" />
            <span>Профиль</span>
          </Link>
        </nav>
        <div className="mt-auto text-xs text-muted-foreground">
          Используйте нижнее меню на мобильных устройствах.
        </div>
      </div>
    </aside>
  );
}
