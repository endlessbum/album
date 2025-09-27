import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  username?: string;
  onAvatarChange?: (newAvatarUrl: string) => void;
}

export function AvatarUpload({ currentAvatarUrl, username, onAvatarChange }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('avatar', file);
      
      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || 'Failed to upload avatar');
  } catch {
          // Fallback to text if JSON parsing fails
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to upload avatar');
        }
      }
      
      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "Аватар обновлен",
        description: "Ваш аватар успешно загружен"
      });
      if (onAvatarChange) {
        onAvatarChange(data.url);
      }
      setIsUploading(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка загрузки",
        description: error.message || "Не удалось загрузить аватар",
        variant: "destructive"
      });
      setIsUploading(false);
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Неверный тип файла",
        description: "Пожалуйста, выберите изображение",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (15MB max)
    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "Файл слишком большой",
        description: "Максимальный размер файла: 15MB",
        variant: "destructive"
      });
      return;
    }

    uploadMutation.mutate(file);
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="text-center">
      <div className="relative inline-block">
        {currentAvatarUrl ? (
          <img
            src={currentAvatarUrl}
            alt="Avatar"
            className="w-32 h-32 rounded-full object-cover mx-auto mb-4"
          />
        ) : (
          <div className="w-32 h-32 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-white text-4xl font-bold mx-auto mb-4">
            {username?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
        
        <Button
          size="icon"
          className="absolute bottom-2 right-2 rounded-full"
          onClick={handleCameraClick}
          disabled={isUploading}
          aria-label="Загрузить аватар"
          title="Загрузить аватар"
          data-testid="button-upload-avatar"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-avatar-file"
      />
    </div>
  );
}