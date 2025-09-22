import React, { useCallback, useMemo, useState } from "react";
// Date helper dictionaries hoisted to module scope to avoid recreating arrays
const monthNom = [
  "январь","февраль","март","апрель","май","июнь",
  "июль","август","сентябрь","октябрь","ноябрь","декабрь"
];
const monthGen = [
  "января","февраля","марта","апреля","мая","июня",
  "июля","августа","сентября","октября","ноября","декабря"
];
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
// Pure helper (no React deps): match various RU/ISO date formats
function dateMatchesToken(d: Date, token: string): boolean {
  const q = token.toLowerCase();
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();
  const variants: string[] = [
    `${pad(day)}.${pad(month + 1)}.${year}`,
    `${year}-${pad(month + 1)}-${pad(day)}`,
    `${day} ${monthGen[month]} ${year}`.toLowerCase(),
    `${monthNom[month]} ${year}`.toLowerCase(),
    `${monthGen[month]} ${year}`.toLowerCase(),
    `${day} ${monthGen[month]}`.toLowerCase(),
    `${year}`,
    monthNom[month],
    monthGen[month],
  ];
  for (let i = 0; i < variants.length; i++) {
    if (variants[i].includes(q)) return true;
  }
  return false;
}
import { useQuery } from "@tanstack/react-query";
import MemoryCard from "@/components/memory-card";
import MemoryModal from "@/components/memory-modal";
import CreateMemoryModal from "@/components/create-memory-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import type { Memory, Counter } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function HomePage() {
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [query, setQuery] = useState("");

  const { data: memories = [], isLoading: memoriesLoading } = useQuery<Memory[]>({
    queryKey: ["/api/memories"],
  });

  const { data: counters = [], isLoading: countersLoading } = useQuery<Counter[]>({
    queryKey: ["/api/counters"],
  });

  // Fetch me and partner to resolve author usernames for @ search
  const { data: me } = useQuery<{ id: string; username: string } | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await apiRequest("/api/user", "GET");
      if (!res.ok) return null;
      return await res.json();
    },
  });
  const { data: partnerResp } = useQuery<{ partner: { id: string; username: string } | null}>({
    queryKey: ["/api/partner"],
    queryFn: async () => {
      const res = await apiRequest("/api/partner", "GET");
      if (!res.ok) return { partner: null } as any;
      return await res.json();
    },
  });

  const resolveAuthorUsername = useCallback((m: Memory): string | null => {
    if (me && m.authorId === me.id) return me.username;
    const p = partnerResp?.partner;
    if (p && m.authorId === p.id) return p.username;
    return null;
  }, [me, partnerResp?.partner]);

  // dateMatchesToken moved to module scope

  const filteredMemories = useMemo(() => {
    const q = (query || "").trim();
    if (!q) return memories;
    const tokens = q.split(/\s+/).filter(Boolean);
    const tokenPredicates = tokens.map((t) => {
      const isAt = t.startsWith("@") && t.length > 1;
      const isHash = t.startsWith("#") && t.length > 1;
      const needle = (isAt || isHash) ? t.slice(1).toLowerCase() : t.toLowerCase();
      return (m: Memory) => {
        const title = (m.title || "").toLowerCase();
        const content = (m.content || "").toLowerCase();
        const tags = (m.tags || []).map((x) => (x || "").toLowerCase());

        // @username
        if (isAt) {
          const uname = (resolveAuthorUsername(m) || "").toLowerCase();
          if (uname.includes(needle)) return true;
        }
        // #hashtag
        if (isHash) {
          if (tags.some((tg) => tg.replace(/^#/, "").includes(needle))) return true;
        }
        // Date match (supports year/month/day variants)
        const created = m.createdAt ? new Date(m.createdAt as any) : null;
        if (created && dateMatchesToken(created, t)) return true;
        // Title/content
        if (title.includes(needle) || content.includes(needle)) return true;
        return false;
      };
    });

    return memories.filter((m) => tokenPredicates.every((p) => p(m)));
  }, [memories, query, resolveAuthorUsername]);

  const handleCreateMemory = () => {
    setIsCreateModalOpen(true);
  };

  const handleEditMemory = (memory: Memory) => {
    setSelectedMemory(null); // Close view modal
    setEditingMemory(memory);
    setIsCreateModalOpen(true); // Open edit modal
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setEditingMemory(null); // Clear editing state
  };

  // TODO: Реализовать поиск по заголовку/контенту/тегам (клиентский фильтр или серверный параметр)

  if (memoriesLoading || countersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" data-testid="home-page">
      <main className="flex-1 p-4 md:p-6">
        {/* Заголовок с кнопками */}
        <div className="mb-8">
          <div className="grid grid-cols-[auto,1fr,auto] items-center gap-4 mb-6 relative">
            <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">
              Наша история
            </h1>
            {/* Desktop search centered to viewport */}
            <div className="absolute left-1/2 -translate-x-1/2 z-10 hidden md:block">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-20" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по хэштегу и ключевым словам"
                className="px-8 w-[27rem] max-w-[90vw] glass focus-ring text-center placeholder:text-center"
                data-testid="search-input-desktop"
              />
            </div>
            <div className="justify-self-end">
              <Button 
                onClick={handleCreateMemory}
                className="btn-gradient"
                data-testid="button-create-memory"
              >
                <Plus className="mr-2 h-4 w-4" />
                Создать
              </Button>
            </div>
          </div>

          {/* Mobile search below the header */}
          <div className="md:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск"
                className="pl-9 pr-3 py-2 w-full glass focus-ring"
                data-testid="search-input-mobile"
              />
            </div>
          </div>

          {/* Счетчики и таймеры (показываем только если есть данные) */}
          {counters.length > 0 && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-testid="counters-section">
              {counters.slice(0, 3).map((counter, index) => (
        <div key={counter.id} className="glass rounded-xl p-4 text-center hover-lift">
                  <div
                    className={`text-2xl font-bold mb-2 ${
                      index === 0 ? 'text-primary' :
                      index === 1 ? 'text-secondary' :
                      'text-accent-foreground'
                    }`}
                    data-testid={`counter-value-${index}`}
                  >
                    {counter.value}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid={`counter-name-${index}`}>
                    {counter.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Лента воспоминаний с адаптивной кладкой и автогруппировкой по дате */}
        <div
          className={`masonry-grid gap-2 sm:gap-3 md:gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 auto-rows-auto ${
            filteredMemories.length === 0 ? 'mt-6' : ''
          }`}
          data-testid="memories-grid"
        >
          {filteredMemories.length === 0 ? (
            <div className="col-span-full glass rounded-xl p-8 text-center">
              <p className="text-muted-foreground text-lg" data-testid="empty-state">
                У вас пока нет воспоминаний. Создайте первое!
              </p>
            </div>
          ) : (
            // Group by year-month for subtle grouping
            Object.entries(
              filteredMemories.reduce((acc, m) => {
                const d = m.createdAt ? new Date(m.createdAt as any) : null;
                const ym = d ? `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}` : 'unknown';
                (acc[ym] ||= []).push(m);
                return acc;
              }, {} as Record<string, typeof filteredMemories>)
            ).sort(([a],[b]) => a < b ? 1 : -1).map(([bucket, list]) => (
              <React.Fragment key={`grp-${bucket}`}>
                <div className="col-span-full sticky top-0 z-0">
                  <div className="text-sm text-muted-foreground px-1">{bucket === 'unknown' ? 'Без даты' : bucket}</div>
                </div>
                {list.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onClick={() => setSelectedMemory(memory)}
                    data-testid={`memory-card-${memory.id}`}
                  />
                ))}
              </React.Fragment>
            ))
          )}
        </div>
  </main>

      {/* Модальное окно воспоминания */}
      {selectedMemory && (
        <MemoryModal
          memory={selectedMemory}
          isOpen={!!selectedMemory}
          onClose={() => setSelectedMemory(null)}
          onEdit={handleEditMemory}
          data-testid="memory-modal"
        />
      )}

      {/* Модальное окно создания/редактирования воспоминания */}
      <CreateMemoryModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        editMemory={editingMemory}
        data-testid="create-memory-modal"
      />
    </div>
  );
}
