import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Users, Clock, Star } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { createWebSocketUrl } from "@/lib/utils";
import type { PartnerResponse, TruthOrDareMessage } from "@shared/schema";

interface TruthOrDareProps {
  gameId: string;
  onBack: () => void;
}

interface GameAction {
  type: 'truth' | 'dare';
  content: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'relationship' | 'fun' | 'deep' | 'spicy';
}

// Pre-defined questions and dares in Russian
const truthQuestions: GameAction[] = [
  {
    type: 'truth',
    content: 'Что было самым романтичным в наших отношениях?',
    difficulty: 'easy',
    category: 'relationship'
  },
  {
    type: 'truth', 
    content: 'О чем ты мечтаешь, когда мы вместе?',
    difficulty: 'medium',
    category: 'deep'
  },
  {
    type: 'truth',
    content: 'Какую черту характера партнера ты больше всего ценишь?',
    difficulty: 'easy',
    category: 'relationship'
  },
  {
    type: 'truth',
    content: 'Какое место ты хотел(а) бы посетить вместе со мной?',
    difficulty: 'medium',
    category: 'fun'
  },
  {
    type: 'truth',
    content: 'Что ты чувствовал(а) при нашей первой встрече?',
    difficulty: 'medium',
    category: 'deep'
  },
  {
    type: 'truth',
    content: 'Какой твой любимый момент из наших отношений?',
    difficulty: 'easy',
    category: 'relationship'
  },
  {
    type: 'truth',
    content: 'О чем ты никогда мне не рассказывал(а)?',
    difficulty: 'hard',
    category: 'deep'
  },
  {
    type: 'truth',
    content: 'Что бы ты изменил(а) в наших отношениях?',
    difficulty: 'hard',
    category: 'relationship'
  }
];

const dareActions: GameAction[] = [
  {
    type: 'dare',
    content: 'Обними партнера в течение минуты без слов',
    difficulty: 'easy',
    category: 'relationship'
  },
  {
    type: 'dare',
    content: 'Станцуй медленный танец с партнером',
    difficulty: 'medium',
    category: 'fun'
  },
  {
    type: 'dare',
    content: 'Напиши партнеру любовное сообщение и отправь прямо сейчас',
    difficulty: 'easy',
    category: 'relationship'
  },
  {
    type: 'dare',
    content: 'Изобрази животное, а партнер должен угадать какое',
    difficulty: 'medium',
    category: 'fun'
  },
  {
    type: 'dare',
    content: 'Расскажи партнеру комплимент на другом языке',
    difficulty: 'medium',
    category: 'fun'
  },
  {
    type: 'dare',
    content: 'Устрой романтический ужин прямо сейчас',
    difficulty: 'hard',
    category: 'relationship'
  },
  {
    type: 'dare',
    content: 'Спой песню, которая напоминает о партнере',
    difficulty: 'medium',
    category: 'relationship'
  },
  {
    type: 'dare',
    content: 'Сделай массаж плеч партнеру в течение 2 минут',
    difficulty: 'easy',
    category: 'relationship'
  }
];

export default function TruthOrDareGame({ gameId, onBack }: TruthOrDareProps) {
  const { user } = useAuth();
  
  const wsRef = useRef<WebSocket | null>(null);
  const [currentAction, setCurrentAction] = useState<GameAction | null>(null);
  const [selectedType, setSelectedType] = useState<'truth' | 'dare' | null>(null);
  // const [waitingForPartner, setWaitingForPartner] = useState(false);
  const [gameState, setGameState] = useState({
    score: { truth: 0, dare: 0 },
    round: 1,
    currentPlayer: user?.id,
    partnerOnline: false
  });

  // Fetch partner info
  const { data: _partnerData } = useQuery<PartnerResponse>({
    queryKey: ["/api/partner"],
  });

  const handleGameMessage = (data: TruthOrDareMessage) => {
    switch (data.action) {
      case 'new_action':
        setCurrentAction(data.actionData);
        break;
      case 'action_completed':
        setGameState(prev => ({
          ...prev,
          score: data.score,
          round: prev.round + 1,
          currentPlayer: data.nextPlayer
        }));
        break;
      case 'partner_joined':
        setGameState(prev => ({ ...prev, partnerOnline: true }));
        break;
    }
  };

  // WebSocket connection for real-time game synchronization
  useEffect(() => {
    const wsUrl = createWebSocketUrl("/ws");
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'game_action' && data.gameType === 'truth-or-dare') {
        handleGameMessage(data);
      } else if (data.type === 'partner_status_change') {
        setGameState(prev => ({ ...prev, partnerOnline: data.isOnline }));
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const sendGameMessage = (action: string, data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'game_action',
        gameType: 'truth-or-dare',
        gameId,
        action,
        data,
        senderId: user?.id
      }));
    }
  };

  const getRandomAction = (type: 'truth' | 'dare') => {
    const actions = type === 'truth' ? truthQuestions : dareActions;
    return actions[Math.floor(Math.random() * actions.length)];
  };

  const handleChooseAction = (type: 'truth' | 'dare') => {
    const action = getRandomAction(type);
    setCurrentAction(action);
    setSelectedType(type);
    
    // Send to partner
    sendGameMessage('new_action', action);
  };

  const handleCompleteAction = () => {
    const newScore = { ...gameState.score };
    if (selectedType) {
      newScore[selectedType]++;
    }
    
  const nextPlayer = gameState.currentPlayer === user?.id ? _partnerData?.partner?.id : user?.id;
    
    setGameState(prev => ({
      ...prev,
      score: newScore,
      round: prev.round + 1,
      currentPlayer: nextPlayer
    }));
    
    sendGameMessage('action_completed', {
      score: newScore,
      nextPlayer
    });
    
    setCurrentAction(null);
    setSelectedType(null);
  };

  const handleSkipAction = () => {
    setCurrentAction(null);
    setSelectedType(null);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'hard': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'relationship': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      case 'fun': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'deep': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'spicy': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button 
            variant="ghost" 
            onClick={onBack}
            data-testid="button-back"
          >
            ← Назад к играм
          </Button>
          <h1 className="text-3xl font-bold text-foreground mt-2">Правда или Действие</h1>
          <p className="text-muted-foreground">Узнайте друг друга лучше</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span className={`text-sm ${gameState.partnerOnline ? 'text-green-600' : 'text-red-600'}`}>
              {gameState.partnerOnline ? 'Партнер в игре' : 'Ждем партнера...'}
            </span>
          </div>
        </div>
      </div>

      {/* Game Stats */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{gameState.score.truth}</div>
              <div className="text-sm text-muted-foreground">Правда</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{gameState.round}</div>
              <div className="text-sm text-muted-foreground">Раунд</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{gameState.score.dare}</div>
              <div className="text-sm text-muted-foreground">Действие</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Action Display */}
      {currentAction ? (
        <Card className="glass" data-testid="phase-action">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${currentAction.type === 'truth' ? 'bg-blue-500' : 'bg-red-500'}`} />
              {currentAction.type === 'truth' ? 'Правда' : 'Действие'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-lg text-foreground p-4 rounded-lg bg-muted/50">
              {currentAction.content}
            </div>
            
            <div className="flex gap-2">
              <Badge className={getDifficultyColor(currentAction.difficulty)}>
                {currentAction.difficulty === 'easy' ? 'Легко' : 
                 currentAction.difficulty === 'medium' ? 'Средне' : 'Сложно'}
              </Badge>
              <Badge className={getCategoryColor(currentAction.category)}>
                {currentAction.category === 'relationship' ? 'Отношения' :
                 currentAction.category === 'fun' ? 'Веселье' :
                 currentAction.category === 'deep' ? 'Глубоко' : 'Остро'}
              </Badge>
            </div>
            
            <div className="flex gap-3">
              <Button 
                onClick={handleCompleteAction}
                className="flex-1"
                data-testid="button-complete"
              >
                <Star className="h-4 w-4 mr-2" />
                Выполнено!
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSkipAction}
                data-testid="button-skip"
              >
                Пропустить
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Action Selection */
        <Card className="glass" data-testid="phase-selection">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Выберите действие
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                size="lg"
                className="h-24 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                onClick={() => handleChooseAction('truth')}
                disabled={!gameState.partnerOnline}
                data-testid="button-truth"
              >
                <div className="text-center">
                  <div className="text-xl font-bold">ПРАВДА</div>
                  <div className="text-sm opacity-90">Ответьте честно</div>
                </div>
              </Button>
              
              <Button
                size="lg"
                className="h-24 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                onClick={() => handleChooseAction('dare')}
                disabled={!gameState.partnerOnline}
                data-testid="button-dare"
              >
                <div className="text-center">
                  <div className="text-xl font-bold">ДЕЙСТВИЕ</div>
                  <div className="text-sm opacity-90">Выполните задание</div>
                </div>
              </Button>
            </div>
            
            {!gameState.partnerOnline && (
              <div className="text-center mt-4 text-muted-foreground">
                <Clock className="h-5 w-5 mx-auto mb-2" />
                Ждем подключения партнера...
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}