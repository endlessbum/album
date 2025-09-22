import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvitePartnerButtonProps {
  gameType: string;
  gameTitle: string;
  onInviteSent?: () => void;
  disabled?: boolean;
}

export default function InvitePartnerButton({ 
  gameType, 
  gameTitle, 
  onInviteSent,
  disabled = false 
}: InvitePartnerButtonProps) {
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const { toast } = useToast();

  const sendInvitation = () => {
    if (disabled || isInviting) return;

    setIsInviting(true);

    // Send invitation through WebSocket
    if (window.wsConnection?.readyState === WebSocket.OPEN) {
      try {
        const invitationData = {
          type: 'game_invitation',
          gameType,
          gameTitle,
          message: `Приглашение поиграть в "${gameTitle}"`
        };

        window.wsConnection.send(JSON.stringify(invitationData));
        
        // Set up listener for confirmation
        const handleMessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'invitation_sent' && data.gameType === gameType) {
              setIsInviting(false);
              setInviteSent(true);
              
              toast({
                title: "Приглашение отправлено!",
                description: `Ваш партнер получил приглашение в игру "${gameTitle}"`,
              });

              onInviteSent?.();
              
              // Reset the sent state after 3 seconds
              setTimeout(() => {
                setInviteSent(false);
              }, 3000);

              // Remove listener
              window.wsConnection?.removeEventListener('message', handleMessage);
            }
          } catch (_error) {
            // Swallow parse errors to avoid noisy logs in production
          }
        };

        window.wsConnection.addEventListener('message', handleMessage);

        // Timeout fallback
        setTimeout(() => {
          if (isInviting) {
            setIsInviting(false);
            toast({
              title: "Ошибка отправки",
              description: "Не удалось отправить приглашение. Попробуйте снова.",
              variant: "destructive"
            });
            window.wsConnection?.removeEventListener('message', handleMessage);
          }
        }, 5000);

  } catch (_error) {
        setIsInviting(false);
        toast({
          title: "Ошибка",
          description: "Не удалось отправить приглашение",
          variant: "destructive"
        });
      }
    } else {
      setIsInviting(false);
      toast({
        title: "Нет соединения",
        description: "Отсутствует соединение с сервером",
        variant: "destructive"
      });
    }
  };

  return (
    <Button 
      onClick={sendInvitation}
      disabled={disabled || isInviting || inviteSent}
      variant={inviteSent ? "default" : "outline"}
      size="sm"
      className={`
        flex items-center gap-2 transition-all duration-200
        ${inviteSent ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
      `}
    >
      {isInviting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Отправка...
        </>
      ) : inviteSent ? (
        <>
          <Check className="h-4 w-4" />
          Отправлено
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Пригласить партнера
        </>
      )}
    </Button>
  );
}

// Extend the global Window interface for WebSocket
declare global {
  interface Window {
    wsConnection?: WebSocket;
  }
}
