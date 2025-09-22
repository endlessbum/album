export default function CreatePage() {
  return (
    <main className="flex-1 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Создать воспоминание</h1>

        <div className="glass rounded-xl p-6 hover-lift">
          <p className="text-muted-foreground">
            Добавьте фото, видео или текст — мы красиво покажем это в вашей ленте.
          </p>
          <p className="text-muted-foreground mt-2">
            Совет: используйте понятные названия и теги, чтобы легче находить записи.
          </p>
        </div>

        {/* Здесь позже можно встроить форму/модал создания. Пока — простой заглушечный блок. */}
        <div className="glass rounded-xl p-6 border border-border/50">
          <div className="text-sm text-muted-foreground">
            Форма создания в разработке. Зайдите в ленту, чтобы добавить воспоминание из быстрого действия.
          </div>
        </div>
      </div>
    </main>
  );
}