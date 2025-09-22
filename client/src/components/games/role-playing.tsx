import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Theater, Users, RefreshCw, MessageCircle, Camera } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { createWebSocketUrl } from "@/lib/utils";
import { type PartnerResponse, type RolePlayingMessage } from "@shared/schema";

interface RolePlayingProps {
  gameId: string;
  onBack: () => void;
}

interface Scenario {
  id: string;
  title: string;
  description: string;
  roles: [string, string];
  setting: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'romantic' | 'adventure' | 'comedy' | 'mystery';
  prompts: string[];
}

interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
  isInCharacter: boolean;
}

// Pre-defined role-playing scenarios
const scenarios: Scenario[] = [
  {
    id: '1',
    title: 'Первое свидание в кафе',
    description: 'Вы встречаетесь в уютном кафе на первом свидании',
    roles: ['Стеснительный посетитель', 'Уверенный знакомый'],
    setting: 'Уютное кафе с видом на парк',
    difficulty: 'easy',
    category: 'romantic',
    prompts: [
      'Расскажите о своем любимом хобби',
      'Опишите идеальные выходные',
      'Что вас больше всего впечатляет в людях?'
    ]
  },
  {
    id: '2', 
    title: 'Детективы-напарники',
    description: 'Вы - детективы, расследующие загадочное исчезновение',
    roles: ['Опытный детектив', 'Молодой стажер'],
    setting: 'Офис полицейского участка',
    difficulty: 'medium',
    category: 'mystery',
    prompts: [
      'Обсудите первые улики',
      'Выдвиньте теорию происшествия',
      'Планируйте следующий шаг расследования'
    ]
  },
  {
    id: '3',
    title: 'Путешественники во времени',
    description: 'Вы оказались в прошлом и должны вернуться в свое время',
    roles: ['Ученый-изобретатель', 'Скептичный компаньон'],
    setting: '1950-е годы, маленький городок',
    difficulty: 'hard',
    category: 'adventure',
    prompts: [
      'Как объяснить местным ваше появление?',
      'Что делать с поломанной машиной времени?',
      'Как не изменить историю?'
    ]
  },
  {
    id: '4',
    title: 'Комедийный дуэт',
    description: 'Вы - комики, готовящиеся к выступлению',
    roles: ['Забывчивый комик', 'Перфекционист-партнер'],
    setting: 'Гримерная перед выходом на сцену',
    difficulty: 'medium',
    category: 'comedy',
    prompts: [
      'Репетируйте номер про отпуск',
      'Импровизируйте диалог о еде',
      'Придумайте шутку про технологии'
    ]
  },
  {
    id: '5',
    title: 'Замок и принцесса',
    description: 'Средневековая история о рыцаре и принцессе',
    roles: ['Отважный рыцарь', 'Мудрая принцесса'],
    setting: 'Королевский замок в средние века',
    difficulty: 'easy',
    category: 'romantic',
    prompts: [
      'Обсудите планы защиты королевства',
      'Поделитесь мечтами о будущем',
      'Расскажите о своих страхах'
    ]
  }
];

export default function RolePlayingGame({ gameId, onBack }: RolePlayingProps) {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [gamePhase, setGamePhase] = useState<'selection' | 'roleAssignment' | 'playing'>('selection');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [myRole, setMyRole] = useState<string>('');
  const [partnerRole, setPartnerRole] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [inCharacter, setInCharacter] = useState(true);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  // const [waitingForPartner, setWaitingForPartner] = useState(false);

  // Fetch partner info
  const { data: _partnerData } = useQuery<PartnerResponse>({
    queryKey: ["/api/partner"],
  });

  // Define functions used by handlers first to avoid use-before-declare
  const sendGameMessage = useCallback((action: string, data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'game_action',
        gameType: 'role-playing',
        gameId,
        action,
        data,
        senderId: user?.id
      }));
    }
  }, [gameId, user?.id]);

  // Function declaration to avoid use-before-declare with effects below
  const assignRoles = React.useCallback((scenario: Scenario) => {
    // Randomly assign roles
    const randomIndex = Math.floor(Math.random() * 2);
    const myAssignedRole = scenario.roles[randomIndex];
    const partnerAssignedRole = scenario.roles[1 - randomIndex];
    
    setMyRole(myAssignedRole);
    setPartnerRole(partnerAssignedRole);
    
    sendGameMessage('roles_assigned', { 
      myRole: myAssignedRole, 
      partnerRole: partnerAssignedRole 
    });
  }, [sendGameMessage]);

  const startWithPrompt = React.useCallback(() => {
    if (selectedScenario && selectedScenario.prompts.length > 0) {
      const firstPrompt = selectedScenario.prompts[0];
      setCurrentPrompt(firstPrompt);
      sendGameMessage('new_prompt', { prompt: firstPrompt });
    }
    setGamePhase('playing');
  }, [selectedScenario, sendGameMessage]);

  // WebSocket connection (placed after handlers defined)
  useEffect(() => {
    const wsUrl = createWebSocketUrl("/ws");
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'game_action' && data.gameType === 'role-playing') {
        const msg = data as RolePlayingMessage;
        switch (msg.action) {
          case 'scenario_selected':
            if (msg.senderId !== user?.id) {
              const scenario = scenarios.find(s => s.id === msg.scenarioId);
              if (scenario) {
                setSelectedScenario(scenario);
                assignRoles(scenario);
                setGamePhase('roleAssignment');
              }
            }
            break;
          case 'roles_assigned':
            if (msg.senderId !== user?.id) {
              setMyRole(msg.partnerRole);
              setPartnerRole(msg.myRole);
              setGamePhase('playing');
              startWithPrompt();
            }
            break;
          case 'message_sent':
            if (msg.senderId !== user?.id) {
              const newMessage: ChatMessage = {
                id: Date.now().toString(),
                senderId: msg.senderId,
                content: msg.content,
                timestamp: new Date(),
                isInCharacter: msg.inCharacter
              };
              setMessages(prev => [...prev, newMessage]);
            }
            break;
          case 'new_prompt':
            setCurrentPrompt(msg.prompt);
            break;
          case 'partner_joined':
            setPartnerOnline(true);
            break;
        }
      } else if (data.type === 'partner_status_change') {
        setPartnerOnline(data.isOnline);
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user?.id, assignRoles, startWithPrompt]);

  

  const handleSelectScenario = useCallback((scenario: Scenario) => {
    setSelectedScenario(scenario);
    assignRoles(scenario);
    setGamePhase('roleAssignment');
    
    sendGameMessage('scenario_selected', { scenarioId: scenario.id });
  }, [assignRoles, sendGameMessage]);

  

  

  const handleSendMessage = () => {
    if (currentMessage.trim()) {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        senderId: user?.id || '',
        content: currentMessage,
        timestamp: new Date(),
        isInCharacter: inCharacter
      };
      
      setMessages(prev => [...prev, newMessage]);
      sendGameMessage('message_sent', { 
        content: currentMessage, 
        inCharacter: inCharacter 
      });
      setCurrentMessage('');
    }
  };

  const getNewPrompt = useCallback(() => {
    if (selectedScenario) {
      const randomPrompt = selectedScenario.prompts[
        Math.floor(Math.random() * selectedScenario.prompts.length)
      ];
      setCurrentPrompt(randomPrompt);
      sendGameMessage('new_prompt', { prompt: randomPrompt });
    }
  }, [selectedScenario, sendGameMessage]);

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
      case 'romantic': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      case 'adventure': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'comedy': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'mystery': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={onBack} data-testid="button-back">
            ← Назад к играм
          </Button>
          <h1 className="text-3xl font-bold text-foreground mt-2">Ролевая игра</h1>
          <p className="text-muted-foreground">Сыграйте роли и погрузитесь в историю</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span className={`text-sm ${partnerOnline ? 'text-green-600' : 'text-red-600'}`}>
              {partnerOnline ? 'Партнер в игре' : 'Ждем партнера...'}
            </span>
          </div>
        </div>
      </div>

      {/* Scenario Selection */}
      {gamePhase === 'selection' && (
        <div className="space-y-4" data-testid="phase-selection">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Theater className="h-5 w-5" />
                Выберите сценарий
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scenarios.map((scenario) => (
                  <Card 
                    key={scenario.id}
                    className="cursor-pointer hover:scale-105 transition-all glass border-2 hover:border-primary/50"
                    onClick={() => handleSelectScenario(scenario)}
                    data-testid={`scenario-${scenario.id}`}
                  >
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground mb-2">{scenario.title}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{scenario.description}</p>
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                          <strong>Роли:</strong> {scenario.roles.join(' и ')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <strong>Место:</strong> {scenario.setting}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Badge className={getDifficultyColor(scenario.difficulty)}>
                            {scenario.difficulty === 'easy' ? 'Легко' : 
                             scenario.difficulty === 'medium' ? 'Средне' : 'Сложно'}
                          </Badge>
                          <Badge className={getCategoryColor(scenario.category)}>
                            {scenario.category === 'romantic' ? 'Романтика' :
                             scenario.category === 'adventure' ? 'Приключения' :
                             scenario.category === 'comedy' ? 'Комедия' : 'Детектив'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Role Assignment */}
      {gamePhase === 'roleAssignment' && selectedScenario && (
        <Card className="glass" data-testid="phase-role-assignment">
          <CardContent className="p-8 text-center">
            <Theater className="h-16 w-16 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-4">{selectedScenario.title}</h3>
            <div className="bg-muted/50 p-4 rounded-lg mb-6">
              <p className="text-muted-foreground mb-2">
                <strong>Сеттинг:</strong> {selectedScenario.setting}
              </p>
              <p className="text-foreground">{selectedScenario.description}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Card className="border-2 border-primary">
                <CardContent className="p-4 text-center">
                  <h4 className="font-semibold mb-2">Ваша роль</h4>
                  <Badge className="bg-primary text-primary-foreground">
                    {myRole}
                  </Badge>
                </CardContent>
              </Card>
              
              <Card className="border-2 border-muted">
                <CardContent className="p-4 text-center">
                  <h4 className="font-semibold mb-2">Роль партнера</h4>
                  <Badge variant="outline">
                    {partnerRole}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            <Button 
              onClick={startWithPrompt} 
              size="lg"
              data-testid="button-start-roleplay"
            >
              Начать игру!
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Playing Phase */}
      {gamePhase === 'playing' && selectedScenario && (
        <div className="space-y-4" data-testid="phase-playing">
          {/* Current Scenario Info */}
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{selectedScenario.title}</h3>
                <Badge className="bg-primary text-primary-foreground">
                  {myRole}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{selectedScenario.setting}</p>
            </CardContent>
          </Card>

          {/* Current Prompt */}
          {currentPrompt && (
            <Card className="glass border-2 border-yellow-500/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1 flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-yellow-500" />
                      Текущее задание
                    </h4>
                    <p className="text-foreground">{currentPrompt}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={getNewPrompt}
                    data-testid="button-new-prompt"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chat Messages */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Диалог в ролях
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Начните диалог в своих ролях
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div 
                      key={msg.id}
                      className={`p-3 rounded-lg ${
                        msg.senderId === user?.id 
                          ? 'bg-primary/10 ml-8' 
                          : 'bg-muted/30 mr-8'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={msg.isInCharacter ? "default" : "outline"}>
                          {msg.senderId === user?.id ? myRole : partnerRole}
                        </Badge>
                        {!msg.isInCharacter && (
                          <Badge variant="secondary" className="text-xs">
                            вне роли
                          </Badge>
                        )}
                      </div>
                      <p className="text-foreground">{msg.content}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Message Input */}
          <Card className="glass">
            <CardContent className="p-4">
              <div className="space-y-3">
                <Tabs defaultValue="character" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger 
                      value="character" 
                      onClick={() => setInCharacter(true)}
                      data-testid="tab-character"
                    >
                      В роли ({myRole})
                    </TabsTrigger>
                    <TabsTrigger 
                      value="outofcharacter" 
                      onClick={() => setInCharacter(false)}
                      data-testid="tab-out-of-character"
                    >
                      Вне роли
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <div className="flex gap-3">
                  <Textarea
                    placeholder={inCharacter 
                      ? `Говорите как ${myRole}...` 
                      : "Обычное сообщение..."}
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    className="flex-1"
                    data-testid="input-message"
                  />
                  <Button 
                    onClick={handleSendMessage} 
                    disabled={!currentMessage.trim()}
                    data-testid="button-send-message"
                  >
                    Отправить
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}