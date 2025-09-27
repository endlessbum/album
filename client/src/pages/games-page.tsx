import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HelpCircle, Eye, Lightbulb, Hand } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Game } from "@shared/schema";

// Import game components
import TruthOrDareGame from "@/components/games/truth-or-dare";
import TwentyQuestionsGame from "@/components/games/twenty-questions";
import RolePlayingGame from "@/components/games/role-playing";
import PartnerQuizGame from "@/components/games/partner-quiz";
import InvitePartnerButton from "@/components/games/invite-partner-button";
import GameInvitationNotification from "@/components/games/game-invitation-notification";

export default function GamesPage() {
  const queryClient = useQueryClient();
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);

  const { data: _games = [], isLoading } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const createGameMutation = useMutation({
    mutationFn: async (gameType: string) => {
      const res = await apiRequest("/api/games", "POST", { 
        type: gameType,
        state: {},
        isActive: true 
      });
      return await res.json();
    },
    onSuccess: (game: Game) => {
      setCurrentGameId(game.id);
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });
    },
  });

  const gamesList = [
    {
      id: 'truth-or-dare',
      title: 'Правда или действие',
      description: 'Узнайте друг друга лучше',
      icon: HelpCircle,
      color: 'from-red-500 to-pink-500',
    },
    {
      id: 'twenty-questions',
      title: '20 вопросов',
      description: 'Угадайте что загадал партнер',
      icon: Eye,
      color: 'from-blue-500 to-purple-500',
    },
    {
      id: 'role-playing',
      title: 'Ролевая игра',
      description: 'Сыграйте роли в разных сценариях',
      icon: Lightbulb,
      color: 'from-green-500 to-teal-500',
    },
    {
      id: 'partner-quiz',
      title: 'Викторина о партнере',
      description: 'Насколько хорошо вы знаете друг друга?',
      icon: Hand,
      color: 'from-orange-500 to-red-500',
    }
  ];

  const handleStartGame = (gameId: string) => {
    setSelectedGame(gameId);
    createGameMutation.mutate(gameId);
  };

  const handleBackToGames = () => {
    setSelectedGame(null);
    setCurrentGameId(null);
  };

  const handleAcceptInvitation = (gameType: string) => {
    setSelectedGame(gameType);
    createGameMutation.mutate(gameType);
  };

  // Render selected game component
  const renderSelectedGame = () => {
    if (!currentGameId) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      );
    }

    switch (selectedGame) {
      case 'truth-or-dare':
        return <TruthOrDareGame gameId={currentGameId} onBack={handleBackToGames} />;
      case 'twenty-questions':
        return <TwentyQuestionsGame gameId={currentGameId} onBack={handleBackToGames} />;
      case 'role-playing':
        return <RolePlayingGame gameId={currentGameId} onBack={handleBackToGames} />;
      case 'partner-quiz':
        return <PartnerQuizGame gameId={currentGameId} onBack={handleBackToGames} />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
  <div className="min-h-screen flex items-center justify-center" data-testid="games-page">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If a game is selected, show only that game
  if (selectedGame) {
    return (
      <div className="flex min-h-screen" data-testid="games-page">
        <main className="flex-1 p-6">
          {renderSelectedGame()}
        </main>
      </div>
    );
  }

  // Show games grid - either existing database games or available games to start
  return (
    <div className="flex min-h-screen" data-testid="games-page">
      <main className="flex-1 p-6">
        <GameInvitationNotification onAcceptInvitation={handleAcceptInvitation} />
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">Игры для пар</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6" data-testid="games-grid">
            {gamesList.map((game) => {
              const Icon = game.icon;
              return (
                <Card 
                  key={game.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer glass" 
                  onClick={() => handleStartGame(game.id)}
                  data-testid={`game-card-${game.id}`}
                >
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${game.color} flex items-center justify-center mb-4`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">{game.title}</h3>
                    <p className="text-muted-foreground mb-4">{game.description}</p>
                    <div className="space-y-2">
                      <Button 
                        className="w-full btn-gradient" 
                        disabled={createGameMutation.isPending}
                        data-testid={`button-start-${game.id}`}
                      >
                        {createGameMutation.isPending ? 'Создание...' : 'Начать игру'}
                      </Button>
                      <InvitePartnerButton gameType={game.id} gameTitle={game.title} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
