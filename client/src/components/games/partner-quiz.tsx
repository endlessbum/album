import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Users, Trophy, Star, RefreshCw, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { createWebSocketUrl } from "@/lib/utils";
import { type PartnerResponse, type PartnerQuizMessage } from "@shared/schema";

interface PartnerQuizProps {
  gameId: string;
  onBack: () => void;
}

interface Question {
  id: string;
  text: string;
  type: 'choice' | 'text' | 'number';
  options?: string[];
  category: 'preferences' | 'memories' | 'dreams' | 'favorites';
}

interface Answer {
  questionId: string;
  answer: string;
  isCorrect?: boolean;
}

interface QuizRound {
  questions: Question[];
  myAnswers: Answer[];
  partnerAnswers: Answer[];
  score: number;
  completed: boolean;
}

// Pre-defined quiz questions
const quizQuestions: Question[] = [
  {
    id: '1',
    text: 'Какой любимый цвет вашего партнера?',
    type: 'choice',
    options: ['Красный', 'Синий', 'Зеленый', 'Желтый', 'Фиолетовый', 'Черный', 'Белый'],
    category: 'preferences'
  },
  {
    id: '2',
    text: 'Какое блюдо партнер заказал на вашем первом свидании?',
    type: 'text',
    category: 'memories'
  },
  {
    id: '3',
    text: 'О каком путешествии больше всего мечтает ваш партнер?',
    type: 'text',
    category: 'dreams'
  },
  {
    id: '4',
    text: 'Сколько часов в день партнер проводит в социальных сетях?',
    type: 'number',
    category: 'preferences'
  },
  {
    id: '5',
    text: 'Какой любимый фильм вашего партнера?',
    type: 'text',
    category: 'favorites'
  },
  {
    id: '6',
    text: 'Что партнер делает, когда нервничает?',
    type: 'choice',
    options: ['Грызет ногти', 'Ходит взад-вперед', 'Играет с волосами', 'Молчит', 'Много говорит', 'Ест'],
    category: 'preferences'
  },
  {
    id: '7',
    text: 'Какое самое яркое детское воспоминание партнера?',
    type: 'text',
    category: 'memories'
  },
  {
    id: '8',
    text: 'Какую суперспособность хотел бы иметь ваш партнер?',
    type: 'choice',
    options: ['Полет', 'Телепатия', 'Невидимость', 'Супер-сила', 'Телепортация', 'Чтение мыслей'],
    category: 'dreams'
  },
  {
    id: '9',
    text: 'Какая любимая музыкальная группа партнера?',
    type: 'text',
    category: 'favorites'
  },
  {
    id: '10',
    text: 'В каком возрасте партнер впервые влюбился?',
    type: 'number',
    category: 'memories'
  }
];

export default function PartnerQuizGame({ gameId, onBack }: PartnerQuizProps) {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const roundRef = useRef<QuizRound | null>(null);
  const [gamePhase, setGamePhase] = useState<'setup' | 'answering' | 'guessing' | 'results'>('setup');
  const [currentRound, setCurrentRound] = useState<QuizRound>({
    questions: [],
    myAnswers: [],
    partnerAnswers: [],
    score: 0,
    completed: false
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [totalScore, setTotalScore] = useState(0);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [waitingForPartner, setWaitingForPartner] = useState(false);
  const [isAnsweringPhase, setIsAnsweringPhase] = useState(true);

  // Fetch partner info
  const { data: _partnerData } = useQuery<PartnerResponse>({
    queryKey: ["/api/partner"],
  });

  // keep a stable ref for reads inside callbacks
  useEffect(() => { roundRef.current = currentRound; }, [currentRound]);

  // Calculate results (stable)
  const calculateResults = React.useCallback((myGuesses: Answer[]) => {
    const snapshot = roundRef.current;
    let score = 0;
    const resultsWithCorrectness = myGuesses.map((guess, index) => {
      const partnerAnswer = snapshot?.partnerAnswers[index];
      const isCorrect = !!(partnerAnswer &&
        guess.answer.toLowerCase().trim() === partnerAnswer.answer.toLowerCase().trim());
      if (isCorrect) score++;
      return { ...guess, isCorrect };
    });

    setCurrentRound(prev => ({
      ...prev,
      myAnswers: resultsWithCorrectness,
      score,
      completed: true
    }));
    setTotalScore(prev => prev + score);
    setGamePhase('results');
  }, []);

  // WebSocket connection (after handlers are defined)
  useEffect(() => {
    const wsUrl = createWebSocketUrl("/ws");
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'game_action' && data.gameType === 'partner-quiz') {
        const msg = data as PartnerQuizMessage;
        switch (msg.action) {
          case 'round_started':
            if (msg.senderId !== user?.id) {
              setCurrentRound({
                questions: msg.questions,
                myAnswers: [],
                partnerAnswers: [],
                score: 0,
                completed: false
              });
              setCurrentQuestionIndex(0);
              setGamePhase('answering');
              setIsAnsweringPhase(true);
            }
            break;
          case 'answers_submitted':
            if (msg.senderId !== user?.id) {
              setCurrentRound(prev => ({ 
                ...prev, 
                partnerAnswers: msg.answers 
              }));
              if ((roundRef.current?.myAnswers.length || 0) > 0) {
                setGamePhase('guessing');
                setCurrentQuestionIndex(0);
                setIsAnsweringPhase(false);
              }
            }
            break;
          case 'guesses_submitted':
            if (msg.senderId !== user?.id) {
              calculateResults(msg.guesses);
            }
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
      wsRef.current?.close();
    };
  }, [user?.id, calculateResults]);

  const sendGameMessage = (action: string, data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'game_action',
        gameType: 'partner-quiz',
        gameId,
        action,
        data,
        senderId: user?.id
      }));
    }
  };

  const startNewRound = () => {
    const selectedQuestions = [...quizQuestions]
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);
    
    const newRound: QuizRound = {
      questions: selectedQuestions,
      myAnswers: [],
      partnerAnswers: [],
      score: 0,
      completed: false
    };
    
    setCurrentRound(newRound);
    setCurrentQuestionIndex(0);
    setGamePhase('answering');
    setIsAnsweringPhase(true);
    
    sendGameMessage('round_started', { questions: selectedQuestions });
  };

  const submitAnswer = () => {
    if (currentAnswer.trim()) {
      const answer: Answer = {
        questionId: currentRound.questions[currentQuestionIndex].id,
        answer: currentAnswer
      };
      
      const updatedAnswers = [...currentRound.myAnswers, answer];
      setCurrentRound(prev => ({ ...prev, myAnswers: updatedAnswers }));
      setCurrentAnswer('');
      
      if (currentQuestionIndex < currentRound.questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        // All questions answered, send to partner
        sendGameMessage('answers_submitted', { answers: updatedAnswers });
        setWaitingForPartner(true);
        
        // Check if partner already submitted answers
        if (currentRound.partnerAnswers.length > 0) {
          setGamePhase('guessing');
          setCurrentQuestionIndex(0);
          setIsAnsweringPhase(false);
        }
      }
    }
  };

  const submitGuess = () => {
    if (currentAnswer.trim()) {
      const guess: Answer = {
        questionId: currentRound.questions[currentQuestionIndex].id,
        answer: currentAnswer
      };
      
      const updatedGuesses = [...currentRound.myAnswers];
      updatedGuesses[currentQuestionIndex] = guess;
      setCurrentRound(prev => ({ ...prev, myAnswers: updatedGuesses }));
      setCurrentAnswer('');
      
      if (currentQuestionIndex < currentRound.questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        // All guesses made, send to partner for comparison
        sendGameMessage('guesses_submitted', { guesses: updatedGuesses });
    calculateResults(updatedGuesses);
      }
    }
  };

  

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'preferences': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'memories': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'dreams': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'favorites': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'preferences': return 'Предпочтения';
      case 'memories': return 'Воспоминания';
      case 'dreams': return 'Мечты';
      case 'favorites': return 'Любимое';
      default: return 'Общее';
    }
  };

  const currentQuestion = currentRound.questions[currentQuestionIndex];
  const progress = currentRound.questions.length > 0 ? 
    ((currentQuestionIndex + 1) / currentRound.questions.length) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={onBack} data-testid="button-back">
            ← Назад к играм
          </Button>
          <h1 className="text-3xl font-bold text-foreground mt-2">Викторина о партнере</h1>
          <p className="text-muted-foreground">Насколько хорошо вы знаете друг друга?</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span className={`text-sm ${partnerOnline ? 'text-green-600' : 'text-red-600'}`}>
              {partnerOnline ? 'Партнер в игре' : 'Ждем партнера...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            <span className="text-sm">Очки: {totalScore}</span>
          </div>
        </div>
      </div>

      {/* Setup Phase */}
      {gamePhase === 'setup' && (
        <Card className="glass" data-testid="phase-setup">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Готовы проверить знания?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              В этой игре вы будете отвечать на вопросы о себе, а затем пытаться угадать ответы партнера.
              Чем больше совпадений - тем выше счет!
            </p>
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Правила игры:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Каждый отвечает на 5 вопросов о себе</li>
                <li>• Затем пытайтесь угадать ответы партнера</li>
                <li>• За каждое совпадение получаете 1 очко</li>
                <li>• Можно играть несколько раундов</li>
              </ul>
            </div>
            <Button 
              onClick={startNewRound} 
              disabled={!partnerOnline}
              className="w-full"
              size="lg"
              data-testid="button-start-quiz"
            >
              Начать викторину!
            </Button>
            {!partnerOnline && (
              <div className="text-center text-muted-foreground">
                Ждем подключения партнера...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Answering Phase */}
      {gamePhase === 'answering' && currentQuestion && (
        <div className="space-y-4" data-testid="phase-answering">
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Отвечайте о себе
                </CardTitle>
                <Badge className={getCategoryColor(currentQuestion.category)}>
                  {getCategoryLabel(currentQuestion.category)}
                </Badge>
              </div>
              <Progress value={progress} className="mt-2" />
              <p className="text-sm text-muted-foreground">
                Вопрос {currentQuestionIndex + 1} из {currentRound.questions.length}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-foreground">
                  {currentQuestion.text}
                </h3>
              </div>
              
              {currentQuestion.type === 'choice' && currentQuestion.options ? (
                <div className="grid grid-cols-2 gap-3">
                  {currentQuestion.options.map((option, index) => (
                    <Button
                      key={index}
                      variant={currentAnswer === option ? "default" : "outline"}
                      onClick={() => setCurrentAnswer(option)}
                      data-testid={`option-${index}`}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              ) : (
                <Input
                  placeholder={
                    currentQuestion.type === 'number' 
                      ? 'Введите число...' 
                      : 'Ваш ответ...'
                  }
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  type={currentQuestion.type === 'number' ? 'number' : 'text'}
                  data-testid="input-answer"
                />
              )}
              
              <Button 
                onClick={submitAnswer} 
                disabled={!currentAnswer.trim()}
                className="w-full"
                data-testid="button-submit-answer"
              >
                {currentQuestionIndex < currentRound.questions.length - 1 
                  ? 'Следующий вопрос' 
                  : 'Завершить ответы'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Guessing Phase */}
      {gamePhase === 'guessing' && currentQuestion && (
        <div className="space-y-4" data-testid="phase-guessing">
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Угадайте ответ партнера
                </CardTitle>
                <Badge className={getCategoryColor(currentQuestion.category)}>
                  {getCategoryLabel(currentQuestion.category)}
                </Badge>
              </div>
              <Progress value={progress} className="mt-2" />
              <p className="text-sm text-muted-foreground">
                Вопрос {currentQuestionIndex + 1} из {currentRound.questions.length}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-primary/10 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-foreground">
                  {currentQuestion.text.replace('вашего партнера', 'партнера').replace('ваш партнер', 'партнер')}
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Что ответил ваш партнер на этот вопрос?
                </p>
              </div>
              
              {currentQuestion.type === 'choice' && currentQuestion.options ? (
                <div className="grid grid-cols-2 gap-3">
                  {currentQuestion.options.map((option, index) => (
                    <Button
                      key={index}
                      variant={currentAnswer === option ? "default" : "outline"}
                      onClick={() => setCurrentAnswer(option)}
                      data-testid={`guess-option-${index}`}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              ) : (
                <Input
                  placeholder={
                    currentQuestion.type === 'number' 
                      ? 'Введите число...' 
                      : 'Ваша догадка...'
                  }
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  type={currentQuestion.type === 'number' ? 'number' : 'text'}
                  data-testid="input-guess"
                />
              )}
              
              <Button 
                onClick={submitGuess} 
                disabled={!currentAnswer.trim()}
                className="w-full"
                data-testid="button-submit-guess"
              >
                {currentQuestionIndex < currentRound.questions.length - 1 
                  ? 'Следующий вопрос' 
                  : 'Завершить догадки'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Phase */}
      {gamePhase === 'results' && (
        <div className="space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Результаты раунда
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-primary mb-2">
                  {currentRound.score} / {currentRound.questions.length}
                </div>
                <p className="text-muted-foreground">
                  Правильных ответов в этом раунде
                </p>
              </div>
              
              <div className="space-y-3">
                {currentRound.questions.map((question, index) => {
                  const myGuess = currentRound.myAnswers[index];
                  const partnerAnswer = currentRound.partnerAnswers[index];
                  const isCorrect = myGuess?.isCorrect;
                  
                  return (
                    <div key={question.id} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {isCorrect ? (
                          <Check className="h-5 w-5 text-green-500" />
                        ) : (
                          <X className="h-5 w-5 text-red-500" />
                        )}
                        <Badge className={getCategoryColor(question.category)}>
                          {getCategoryLabel(question.category)}
                        </Badge>
                      </div>
                      <p className="font-medium mb-2">{question.text}</p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Ваша догадка:</p>
                          <p className="font-medium">{myGuess?.answer}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Ответ партнера:</p>
                          <p className="font-medium">{partnerAnswer?.answer}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex gap-3">
                <Button 
                  onClick={startNewRound} 
                  className="flex-1"
                  data-testid="button-new-round"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Новый раунд
                </Button>
                <Button 
                  variant="outline" 
                  onClick={onBack}
                  data-testid="button-finish-quiz"
                >
                  Завершить игру
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {waitingForPartner && (
        <Card className="glass">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold mb-2">Ждем партнера</h3>
            <p className="text-muted-foreground">
              Партнер завершает {isAnsweringPhase ? 'ответы' : 'догадки'}...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}