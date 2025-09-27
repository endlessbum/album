// Загружаем переменные окружения
import "./config";

import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { parse as parseCookie } from "cookie";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertMemorySchema, insertUserSchema, insertMessageSchema, insertGameSchema, wsGameActionSchema, updateProfileSchema } from "@shared/schema";
import { z } from "zod";
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import crypto from 'crypto';

// Extend Express namespace for proper req.user typing
declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: string;
      coupleId: string | null;
      isOnline: boolean | null;
      lastSeen: Date | null;
      createdAt: Date | null;
      updatedAt: Date | null;
    }
  }
}

// Create server-side memory validation schema
const serverMemorySchema = insertMemorySchema.omit({
  coupleId: true,
  authorId: true,
}).extend({
  // Разрешаем пустое содержимое для фото/видео; для текста/цитаты проверим ниже
  content: z.string().optional().nullable().transform(v => (v && v.trim() !== '' ? v.trim() : '')),
  // Allow both absolute URLs and relative "/uploads/..." for images
  mediaUrl: z.string().optional().nullable().transform(v => v && v.trim() === '' ? null : v),
}).superRefine((v, ctx) => {
  const isAbsoluteUrl = (s?: string | null) => !!s && /^https?:\/\//i.test(s);
  const isUploadsPath = (s?: string | null) => !!s && s.startsWith('/uploads/');

  if (v.type === 'text' || v.type === 'quote') {
    if (!v.content || v.content.trim() === '') {
      ctx.addIssue({ code: 'custom', path: ['content'], message: 'Содержимое обязательно для текста и цитаты' });
    }
  }

  if (v.type === 'photo' || v.type === 'video') {
    if (!v.mediaUrl) {
      ctx.addIssue({ code: 'custom', path: ['mediaUrl'], message: 'URL медиа обязателен для фото/видео' });
      return;
    }
    if (v.type === 'video' && !(isAbsoluteUrl(v.mediaUrl) || isUploadsPath(v.mediaUrl))) {
      ctx.addIssue({ code: 'custom', path: ['mediaUrl'], message: 'Некорректный URL видео' });
    }
    if (v.type === 'photo' && !(isAbsoluteUrl(v.mediaUrl) || isUploadsPath(v.mediaUrl))) {
      ctx.addIssue({ code: 'custom', path: ['mediaUrl'], message: 'Некорректный URL изображения' });
    }
  }
});

// Create server-side message validation schema - SECURITY: ignores client expiresAt
const serverMessageSchema = insertMessageSchema.omit({
  coupleId: true,
  senderId: true,
  expiresAt: true, // SECURITY: Server controls expiration time
}).extend({
  content: z.string().optional().nullable(),
  type: z.enum(['text', 'image', 'video', 'voice', 'ephemeral_image', 'ephemeral_video', 'document']),
  mediaUrl: z.string().url().optional().nullable(),
  isEphemeral: z.boolean().optional().default(false),
}).superRefine((v, ctx) => {
  if ((v.type === "image" || v.type === "video" || v.type === "ephemeral_image" || v.type === "ephemeral_video" || v.type === 'document') && !v.mediaUrl) {
    ctx.addIssue({code: "custom", path: ["mediaUrl"], message: "URL медиа обязателен для изображений и видео"});
  }
  if (v.type === "text" && (!v.content || v.content.trim() === "")) {
    ctx.addIssue({code: "custom", path: ["content"], message: "Содержимое обязательно для текстовых сообщений"});
  }
});

// Create server-side game validation schema (client doesn't send coupleId/currentPlayer)
const serverGameSchema = insertGameSchema.omit({
  coupleId: true,
  currentPlayer: true,
});

// Create validation schemas for auth endpoints
const _registerWithInviteSchema = insertUserSchema.pick({
  email: true,
  username: true,
  password: true,
}).extend({
  inviteCode: z.string().min(1, 'Код приглашения обязателен'),
});

  const joinCoupleSchema = z.object({
  inviteCode: z.string().min(1, 'Код приглашения обязателен'),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Health/version (no auth)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV || "development" });
  });

  app.get("/api/version", async (_req, res) => {
    try {
      const pkgPath = path.join(process.cwd(), "package.json");
      const raw = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(raw);
      res.json({ name: pkg.name, version: pkg.version });
    } catch {
      res.status(500).json({ error: "version_unavailable" });
    }
  });

  // Memory routes
  app.get("/api/memories", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      if (!user.coupleId) {
        return res.status(400).json({ error: "User is not part of a couple" });
      }
      const memories = await storage.getMemoriesForCouple(user.coupleId);
      res.json(memories);
    } catch (error) {
      console.error("Error fetching memories:", error);
      res.status(500).json({ error: "Failed to fetch memories" });
    }
  });

  app.post("/api/memories", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      
      // Validate request body with server schema
      const validationResult = serverMemorySchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      if (!user.coupleId) {
        return res.status(400).json({ error: "User is not part of a couple" });
      }
      
      const memory = await storage.createMemory({
        ...validationResult.data,
        coupleId: user.coupleId,
        authorId: user.id,
      });
      res.json(memory);
    } catch (error) {
      console.error("Error creating memory:", error);
      res.status(500).json({ error: "Failed to create memory" });
    }
  });

  // Update memory
  app.put("/api/memories/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      const id = req.params.id;
      
      // Validate request body with server schema
      const validationResult = serverMemorySchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      // Check if memory exists and user has permission
      const existingMemory = await storage.getMemory(id);
      if (!existingMemory) {
        return res.status(404).json({ error: "Memory not found" });
      }
      
      // SECURITY: ensure same couple
      if (!user.coupleId || existingMemory.coupleId !== user.coupleId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      // Update the memory
      const updatedMemory = await storage.updateMemory(id, {
        ...validationResult.data,
        coupleId: user.coupleId,
        authorId: user.id,
      });
      
      res.json(updatedMemory);
    } catch (error) {
      console.error("Error updating memory:", error);
      res.status(500).json({ error: "Failed to update memory" });
    }
  });

  // Delete memory
  app.delete("/api/memories/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user!;
      const id = req.params.id;
      const memory = await storage.getMemory(id);
      if (!memory) {
        return res.status(404).json({ error: "Memory not found" });
      }
      // SECURITY: ensure same couple
      if (!user.coupleId || memory.coupleId !== user.coupleId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Best-effort file cleanup for local uploads
      const maybePaths: (string | null | undefined)[] = [memory.mediaUrl, memory.thumbnailUrl];
      for (const p of maybePaths) {
        if (p && p.startsWith('/uploads/')) {
          const abs = path.join(process.cwd(), 'public', p.replace(/^\/uploads\//, 'uploads/'));
          try { await fs.unlink(abs); } catch {}
        }
      }

      await storage.deleteMemory(id);
      return res.json({ success: true });
    } catch (error) {
      console.error('Error deleting memory:', error);
      return res.status(500).json({ error: 'Failed to delete memory' });
    }
  });

  // Comment routes
  app.get("/api/memories/:memoryId/comments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const comments = await storage.getCommentsForMemory(req.params.memoryId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/memories/:memoryId/comments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      const comment = await storage.createComment({
        memoryId: req.params.memoryId,
        authorId: user.id,
        content: req.body.content,
      });
      res.json(comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // Message routes
  app.get("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      
      // SECURITY: Auto-cleanup expired messages before fetching
      await storage.deleteExpiredMessages();
      
      if (!user.coupleId) {
        return res.status(400).json({ error: "User is not part of a couple" });
      }
      const messages = await storage.getMessagesForCouple(user.coupleId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      
      // SECURITY: Validate request body with server schema
      const validationResult = serverMessageSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      const messageData: any = {
        ...validationResult.data,
        coupleId: user.coupleId,
        senderId: user.id,
      };
      
      // SECURITY: Server-side expiration time calculation for ephemeral messages (2 минуты)
      if (messageData.isEphemeral) {
        const expirationTime = new Date();
        expirationTime.setMinutes(expirationTime.getMinutes() + 2);
        messageData.expiresAt = expirationTime;
      }
      
      const message = await storage.createMessage(messageData);
      res.json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

    // Update message
    app.put("/api/messages/:id", async (req, res) => {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      try {
        const user = req.user!;
        const id = req.params.id;
        // Validate request body
        const validationResult = serverMessageSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({
            error: "Validation failed",
            details: validationResult.error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message
            }))
          });
        }
        // Получаем сообщение и проверяем права
        const existingMessages = await storage.getMessagesForCouple(user.coupleId!);
        const message = existingMessages.find(m => m.id === id);
        if (!message) {
          return res.status(404).json({ error: "Message not found" });
        }
        if (message.senderId !== user.id) {
          return res.status(403).json({ error: "Forbidden" });
        }
        // Обновляем сообщение
        const updatedMessage = await storage.updateMessage(id, validationResult.data);
        res.json(updatedMessage);
      } catch (error) {
        console.error("Error updating message:", error);
        res.status(500).json({ error: "Failed to update message" });
      }
    });

    // Delete message
    app.delete("/api/messages/:id", async (req, res) => {
      if (!req.isAuthenticated()) return res.sendStatus(401);
      try {
        const user = req.user!;
        const id = req.params.id;
        const existingMessages = await storage.getMessagesForCouple(user.coupleId!);
        const message = existingMessages.find(m => m.id === id);
        if (!message) {
          return res.status(404).json({ error: "Message not found" });
        }
        if (message.senderId !== user.id) {
          return res.status(403).json({ error: "Forbidden" });
        }
        await storage.deleteMessage(id);
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting message:", error);
        res.status(500).json({ error: "Failed to delete message" });
      }
    });

  // Partner info route
  app.get("/api/partner", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      const partner = await storage.getPartnerInfo(user.id);
      
      if (!partner) {
        return res.json({ partner: null });
      }
      
      // Return partner info without sensitive data
      const partnerInfo = {
        id: partner.id,
        username: partner.username,
        firstName: partner.firstName,
        lastName: partner.lastName,
        profileImageUrl: partner.profileImageUrl,
        isOnline: partner.isOnline,
        lastSeen: partner.lastSeen,
        role: partner.role
      };
      
      res.json({ partner: partnerInfo });
    } catch (error) {
      console.error("Error fetching partner info:", error);
      res.status(500).json({ error: "Failed to fetch partner info" });
    }
  });

  // Settings routes
  app.get("/api/couple/invite-code", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      
      // Only main admin can access invite codes
      if (user.role !== 'main_admin') {
        return res.status(403).json({ error: "Only main admin can manage invite codes" });
      }
      
      const couple = await storage.getCoupleByUser(user.id);
      if (!couple) {
        return res.status(404).json({ error: "Couple not found" });
      }
      
      res.json({ inviteCode: couple.inviteCode });
    } catch (error) {
      console.error("Error fetching invite code:", error);
      res.status(500).json({ error: "Failed to fetch invite code" });
    }
  });

  app.post("/api/couple/generate-invite", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      
      // Only main admin can generate invite codes
      if (user.role !== 'main_admin') {
        return res.status(403).json({ error: "Only main admin can generate invite codes" });
      }
      
      if (!user.coupleId) {
        return res.status(400).json({ error: "User is not part of a couple" });
      }
      const inviteCode = await storage.generateInviteCode(user.coupleId);
      res.json({ inviteCode });
    } catch (error) {
      console.error("Error generating invite code:", error);
      res.status(500).json({ error: "Failed to generate invite code" });
    }
  });

  app.post("/api/couple/revoke-invite", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      
      // Only main admin can revoke invite codes
      if (user.role !== 'main_admin') {
        return res.status(403).json({ error: "Only main admin can revoke invite codes" });
      }
      
      if (!user.coupleId) {
        return res.status(400).json({ error: "User is not part of a couple" });
      }
      await storage.revokeInviteCode(user.coupleId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error revoking invite code:", error);
      res.status(500).json({ error: "Failed to revoke invite code" });
    }
  });

  // Return current settings
  app.get("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const user = req.user!;
      if (!user.coupleId) {
        return res.status(404).json({ error: "User is not part of a couple" });
      }
      const couple = await storage.getCoupleById(user.coupleId);
      if (!couple) {
        return res.status(404).json({ error: "Couple not found" });
      }
      return res.json({ settings: couple.settings || {} });
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      const { userSettings, coupleSettings } = req.body;
      
  let updatedUser = user;
      let updatedCouple = null;
      
      // Update user settings if provided
      if (userSettings) {
        // Validate user settings
        const allowedUserFields = ['firstName', 'lastName', 'profileImageUrl'];
        const filteredUserSettings = Object.keys(userSettings)
          .filter(key => allowedUserFields.includes(key))
          .reduce((obj: any, key) => {
            obj[key] = userSettings[key];
            return obj;
          }, {});
        
        if (Object.keys(filteredUserSettings).length > 0) {
          updatedUser = await storage.updateUser(user.id, filteredUserSettings);
        }
      }
      
      // Update couple settings if provided and user has permission
      if (coupleSettings && ['main_admin', 'co_admin'].includes(user.role)) {
        if (!user.coupleId) {
          return res.status(400).json({ error: "User is not part of a couple" });
        }
        updatedCouple = await storage.updateCoupleSettings(user.coupleId, coupleSettings);
      }
      
      res.json({ 
        user: updatedUser,
        couple: updatedCouple,
        success: true 
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Profile routes
  app.get("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      const fullUser = await storage.getUser(user.id);
      
      if (!fullUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Get profile statistics  
      const stats = user.coupleId 
        ? await storage.getProfileStats(user.id, user.coupleId)
        : null;
      
      // Return profile info without sensitive data
      const profileInfo = {
        id: fullUser.id,
        username: fullUser.username,
        email: fullUser.email,
        firstName: fullUser.firstName,
        lastName: fullUser.lastName,
        profileImageUrl: fullUser.profileImageUrl,
        role: fullUser.role,
        coupleId: fullUser.coupleId,
        createdAt: fullUser.createdAt,
        stats
      };
      
      res.json(profileInfo);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.put("/api/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      
      // Validate request body with server schema
      const validationResult = updateProfileSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      // SECURITY: Check if username is being changed and if it's already taken
      if (validationResult.data.username) {
        const existingUser = await storage.getUserByUsername(validationResult.data.username);
        if (existingUser && existingUser.id !== user.id) {
          return res.status(409).json({ 
            error: "Username already taken",
            message: "Этот никнейм уже занят",
            details: [{ field: "username", message: "Этот никнейм уже занят" }]
          });
        }
      }
      
      // SECURITY: Check if email is being changed and if it's already taken  
      if (validationResult.data.email) {
        const existingUser = await storage.getUserByEmail(validationResult.data.email);
        if (existingUser && existingUser.id !== user.id) {
          return res.status(409).json({ 
            error: "Email already taken",
            message: "Этот email уже используется", 
            details: [{ field: "email", message: "Этот email уже используется" }]
          });
        }
      }
      
  const updatedUser = await storage.updateUser(user.id, {
        ...validationResult.data,
        updatedAt: new Date()
      });
      
      // Return updated profile without sensitive data
      const profileInfo = {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        profileImageUrl: updatedUser.profileImageUrl,
        role: updatedUser.role,
        coupleId: updatedUser.coupleId,
        updatedAt: updatedUser.updatedAt
      };
      
      res.json(profileInfo);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // SECURITY: Enhanced avatar upload configuration
  const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 15 * 1024 * 1024, // 15MB limit
      fieldSize: 10 * 1024, // 10KB field size limit
      fields: 1, // Only allow 1 field
      files: 1, // Only allow 1 file
    },
    fileFilter: (req, file, cb) => {
      // SECURITY: Strict MIME type validation for images only
      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp'
      ];
      
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const ext = path.extname(file.originalname).toLowerCase();
      
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error('UNSUPPORTED_MEDIA_TYPE'));
      }
      
      if (!allowedExtensions.includes(ext)) {
        return cb(new Error('UNSUPPORTED_EXTENSION'));
      }
      
      cb(null, true);
    }
  });

  // SECURITY: Enhanced avatar upload endpoint with proper error handling
  app.post("/api/upload/avatar", (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) {
        // SECURITY: Handle specific multer errors with proper HTTP status codes
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: "File too large",
            message: "Максимальный размер файла: 5MB"
          });
        }
        
        if (err.message === 'UNSUPPORTED_MEDIA_TYPE' || err.message === 'UNSUPPORTED_EXTENSION') {
          return res.status(415).json({
            error: "Unsupported media type",
            message: "Поддерживаются только изображения: JPG, PNG, GIF, WebP"
          });
        }
        
        if (err.code === 'LIMIT_FIELD_COUNT' || err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            error: "Too many files/fields",
            message: "Можно загружать только один файл"
          });
        }
        
        return res.status(400).json({
          error: "Upload error",
          message: err.message || "Ошибка загрузки файла"
        });
      }
      next();
    });
  }, async (req, res) => {
    // SECURITY: Authentication check
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ 
          error: "No file uploaded",
          message: "Файл не был загружен" 
        });
      }
      
      // SECURITY: Generate cryptographically random filename (not user-controlled)
      const randomBytes = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `avatar_${randomBytes}${ext}`;
      
      // SECURITY: Ensure upload directory exists with proper permissions
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
      
      try {
        await fs.access(uploadsDir);
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true, mode: 0o755 });
      }
      
      const filePath = path.join(uploadsDir, filename);
      
      // SECURITY: Write file with restricted permissions
      await fs.writeFile(filePath, file.buffer, { mode: 0o644 });
      
      // Generate URL for the uploaded file
      const avatarUrl = `/uploads/avatars/${filename}`;
      
      // SECURITY: Update user profile using validated user.id from session
  const _updatedUser = await storage.updateUser(user.id, {
        profileImageUrl: avatarUrl,
        updatedAt: new Date()
      });
      
      res.json({ 
        url: avatarUrl,
        message: "Avatar uploaded successfully"
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      res.status(500).json({ 
        error: "Failed to upload avatar",
        message: "Не удалось загрузить аватар" 
      });
    }
  });

  // Memory image upload configuration (similar to avatar, separate dest)
  const memoryImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB for memory images
      fieldSize: 10 * 1024,
      fields: 1,
      files: 1,
    },
    fileFilter: (req, file, cb) => {
      const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp'
      ];
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error('UNSUPPORTED_MEDIA_TYPE'));
      }
      if (!allowedExtensions.includes(ext)) {
        return cb(new Error('UNSUPPORTED_EXTENSION'));
      }
      cb(null, true);
    }
  });

  // Upload memory image endpoint
  app.post("/api/upload/memory-image", (req, res, next) => {
    memoryImageUpload.single('image')(req, res, (err) => {
      if (err) {
        if ((err as any).code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File too large', message: 'Максимальный размер файла: 10MB' });
        }
        if ((err as any).message === 'UNSUPPORTED_MEDIA_TYPE' || (err as any).message === 'UNSUPPORTED_EXTENSION') {
          return res.status(415).json({ error: 'Unsupported media type', message: 'Поддерживаются только изображения: JPG, PNG, GIF, WebP' });
        }
        if ((err as any).code === 'LIMIT_FIELD_COUNT' || (err as any).code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Too many files/fields', message: 'Можно загружать только один файл' });
        }
        return res.status(400).json({ error: 'Upload error', message: (err as any).message || 'Ошибка загрузки файла' });
      }
      next();
    });
  }, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded', message: 'Файл не был загружен' });
      }

      const randomBytesHex = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `memory_${Date.now()}_${randomBytesHex}${ext}`;

      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'memories');
      try {
        await fs.access(uploadsDir);
      } catch {
        await fs.mkdir(uploadsDir, { recursive: true, mode: 0o755 });
      }

      const filePath = path.join(uploadsDir, filename);
      await fs.writeFile(filePath, file.buffer, { mode: 0o644 });

      const url = `/uploads/memories/${filename}`;
      return res.json({ url, message: 'Image uploaded successfully' });
    } catch (error) {
      console.error('Error uploading memory image:', error);
      return res.status(500).json({ error: 'Failed to upload image', message: 'Не удалось загрузить изображение' });
    }
  });

  // Memory video upload configuration
  // Потоковая запись больших видео на диск
  const memoryVideoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'memories');
      fsSync.mkdir(uploadsDir, { recursive: true }, (err) => cb(err || null, uploadsDir));
    },
    filename: (req, file, cb) => {
      const randomBytesHex = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
      const filename = `memory_${Date.now()}_${randomBytesHex}${ext}`;
      cb(null, filename);
    }
  });
  const memoryVideoUpload = multer({
    storage: memoryVideoStorage,
    limits: {
      fileSize: 1024 * 1024 * 1024, // ~1GB
      fieldSize: 10 * 1024,
      fields: 1,
      files: 1,
    },
    fileFilter: (req, file, cb) => {
      const allowedMimeTypes = [
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska',
        'video/x-msvideo', 'video/x-flv', 'application/octet-stream'
      ];
      const allowedExtensions = ['.mp4', '.webm', '.ogg', '.ogv', '.mov', '.m4v', '.mkv', '.avi', '.flv'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedMimeTypes.includes(file.mimetype) && !allowedExtensions.includes(ext)) {
        return cb(new Error('UNSUPPORTED_MEDIA_TYPE'));
      }
      cb(null, true);
    }
  });

  // Upload memory video endpoint
  app.post("/api/upload/memory-video", (req, res, next) => {
    memoryVideoUpload.single('video')(req, res, (err) => {
      if (err) {
        if ((err as any).code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File too large', message: 'Максимальный размер видео: 200MB' });
        }
        if ((err as any).message === 'UNSUPPORTED_MEDIA_TYPE') {
          return res.status(415).json({ error: 'Unsupported media type', message: 'Поддерживаются видео: MP4, WebM, OGG, MOV, MKV, AVI, FLV' });
        }
        return res.status(400).json({ error: 'Upload error', message: (err as any).message || 'Ошибка загрузки файла' });
      }
      next();
    });
  }, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded', message: 'Файл не был загружен' });
      }

      // Файл уже записан потоково на диск diskStorage
      const url = `/uploads/memories/${file.filename}`;
      return res.json({ url, message: 'Video uploaded successfully' });
    } catch (error) {
      console.error('Error uploading memory video:', error);
      return res.status(500).json({ error: 'Failed to upload video', message: 'Не удалось загрузить видео' });
    }
  });

  // ===== Documents upload =====
  const documentsStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
      fsSync.mkdir(uploadsDir, { recursive: true }, (err) => cb(err || null, uploadsDir));
    },
    filename: (req, file, cb) => {
      const randomBytesHex = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase() || '';
      const filename = `doc_${Date.now()}_${randomBytesHex}${ext}`;
      cb(null, filename);
    }
  });
  const documentUpload = multer({
    storage: documentsStorage,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
      fieldSize: 10 * 1024,
      fields: 1,
      files: 1,
    },
    fileFilter: (req, file, cb) => {
      // Разрешаем базовые форматы документов и файлов: PDF, текст, офисные
      const allowed = [
        'application/pdf', 'text/plain',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed', 'application/x-rar-compressed'
      ];
      if (allowed.includes(file.mimetype) || path.extname(file.originalname)) {
        // Минимальная проверка по расширению/тиpu, детальную антивирус-проверку вне рамок демо
        return cb(null, true);
      }
      return cb(new Error('UNSUPPORTED_DOCUMENT_TYPE'));
    }
  });

  app.post('/api/upload/document', (req, res, next) => {
    documentUpload.single('document')(req, res, (err) => {
      if (err) {
        if ((err as any).code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File too large', message: 'Максимальный размер файла: 50MB' });
        }
        return res.status(400).json({ error: 'Upload error', message: (err as any).message || 'Ошибка загрузки файла' });
      }
      next();
    });
  }, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded', message: 'Файл не был загружен' });
      }
      const url = `/uploads/documents/${file.filename}`;
      return res.json({ url, message: 'Document uploaded successfully' });
    } catch (error) {
      console.error('Error uploading document:', error);
      return res.status(500).json({ error: 'Failed to upload document', message: 'Не удалось загрузить документ' });
    }
  });

  // Couple routes
  // ===== Audio upload (music) =====
  // Use diskStorage similar to video (audio files can be large)
  const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'audios');
      fsSync.mkdir(uploadsDir, { recursive: true }, (err) => cb(err || null, uploadsDir));
    },
    filename: (req, file, cb) => {
      const randomBytesHex = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase() || '.mp3';
      const filename = `audio_${Date.now()}_${randomBytesHex}${ext}`;
      cb(null, filename);
    }
  });
  const audioUpload = multer({
    storage: audioStorage,
    limits: {
      fileSize: 200 * 1024 * 1024, // 200MB
      fields: 2,
      files: 1,
    },
    fileFilter: (req, file, cb) => {
      const allowedMimeTypes = [
        'audio/mpeg', // mp3
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/ogg',
        'audio/opus',
        'audio/webm',
        'audio/aac',
        'audio/mp4', // m4a files
        'audio/m4a', // alternative m4a MIME type
        'audio/x-m4a', // alternative m4a MIME type
        'audio/flac',
        'audio/x-flac',
        'application/octet-stream'
      ];
      const allowedExtensions = ['.mp3', '.wav', '.ogg', '.oga', '.opus', '.webm', '.m4a', '.aac', '.flac'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedMimeTypes.includes(file.mimetype) && !allowedExtensions.includes(ext)) {
        return cb(new Error('UNSUPPORTED_MEDIA_TYPE'));
      }
      cb(null, true);
    }
  });

  // Upload audio endpoint
  app.post('/api/upload/audio', (req, res, next) => {
    audioUpload.single('audio')(req, res, (err) => {
      if (err) {
        if ((err as any).code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File too large', message: 'Максимальный размер аудио: 200MB' });
        }
        if ((err as any).message === 'UNSUPPORTED_MEDIA_TYPE') {
          return res.status(415).json({ error: 'Unsupported media type', message: 'Поддерживаются аудио: MP3, WAV, OGG/OPUS, M4A/AAC, FLAC, WebM' });
        }
        return res.status(400).json({ error: 'Upload error', message: (err as any).message || 'Ошибка загрузки файла' });
      }
      next();
    });
  }, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded', message: 'Файл не был загружен' });
      }
      const url = `/uploads/audios/${file.filename}`;
      return res.json({ url, originalName: file.originalname, message: 'Audio uploaded successfully' });
    } catch (error) {
      console.error('Error uploading audio:', error);
      return res.status(500).json({ error: 'Failed to upload audio', message: 'Не удалось загрузить аудио' });
    }
  });

  // Upload audio cover (image) endpoint
  const audioCoverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'audios', 'covers');
      fsSync.mkdir(uploadsDir, { recursive: true }, (err) => cb(err || null, uploadsDir));
    },
    filename: (req, file, cb) => {
      const randomBytesHex = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      const filename = `cover_${Date.now()}_${randomBytesHex}${ext}`;
      cb(null, filename);
    }
  });
  const audioCoverUpload = multer({
    storage: audioCoverStorage,
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      const allowed = ['image/png','image/jpeg','image/webp'];
      const allowedExt = ['.png','.jpg','.jpeg','.webp'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowed.includes(file.mimetype) && !allowedExt.includes(ext)) {
        return cb(new Error('UNSUPPORTED_IMAGE'));
      }
      cb(null, true);
    }
  });
  app.post('/api/upload/audio-cover', (req, res, next) => {
    audioCoverUpload.single('image')(req, res, (err) => {
      if (err) {
        if ((err as any).code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File too large', message: 'Максимальный размер изображения: 15MB' });
        }
        if ((err as any).message === 'UNSUPPORTED_IMAGE') {
          return res.status(415).json({ error: 'Unsupported media type', message: 'Поддерживаются PNG, JPEG, WEBP' });
        }
        return res.status(400).json({ error: 'Upload error', message: (err as any).message || 'Ошибка загрузки изображения' });
      }
      next();
    });
  }, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ error: 'No file', message: 'Файл не был загружен' });
      const url = `/uploads/audios/covers/${file.filename}`;
      return res.json({ url });
    } catch (e) {
      console.error('Error uploading audio cover:', e);
      return res.status(500).json({ error: 'Failed', message: 'Не удалось загрузить изображение' });
    }
  });

  // List uploaded audios
  app.get('/api/audios', async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const dir = path.join(process.cwd(), 'public', 'uploads', 'audios');
      let entries: any[] = [];
      try {
        const files = await fs.readdir(dir, { withFileTypes: true });
        for (const f of files) {
          if (!f.isFile()) continue;
          const ext = path.extname(f.name).toLowerCase();
          if (!['.mp3', '.wav', '.ogg', '.oga', '.opus', '.webm', '.m4a', '.aac', '.flac'].includes(ext)) continue;
          const full = path.join(dir, f.name);
          let stat: any = null;
          try { stat = await fs.stat(full); } catch {}
          entries.push({
            url: `/uploads/audios/${f.name}`,
            name: f.name,
            size: stat?.size ?? null,
            modifiedAt: stat?.mtimeMs ? new Date(stat.mtimeMs).toISOString() : null,
          });
        }
        // Sort by modified desc
        entries.sort((a, b) => (b.modifiedAt || '').localeCompare(a.modifiedAt || ''));
      } catch {
        // directory may not exist yet
        entries = [];
      }
      return res.json({ audios: entries });
    } catch (e) {
      console.error('Error listing audios:', e);
      return res.status(500).json({ error: 'Failed to list audios' });
    }
  });

  // Delete an uploaded audio by URL (e.g., /uploads/audios/filename.mp3)
  app.delete('/api/audios', async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const url = (req.query.url as string) || (req.body && (req.body.url as string));
      if (!url || typeof url !== 'string' || !url.startsWith('/uploads/audios/')) {
        return res.status(400).json({ error: 'Bad request', message: 'Invalid audio url' });
      }
      // Normalize and ensure path stays within audios dir
      const rel = url.replace(/^\/+/, ''); // remove leading slashes
      const baseDir = path.join(process.cwd(), 'public');
      const full = path.join(baseDir, rel);
      const audiosDir = path.join(baseDir, 'uploads', 'audios');
      if (!full.startsWith(audiosDir)) {
        return res.status(400).json({ error: 'Bad request', message: 'Path escapes audios directory' });
      }

      try {
        await fs.unlink(full);
      } catch (err: any) {
        if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
          return res.status(404).json({ error: 'Not found', message: 'Audio file not found' });
        }
        throw err;
      }

      return res.json({ success: true });
    } catch (e) {
      console.error('Error deleting audio:', e);
      return res.status(500).json({ error: 'Failed to delete audio' });
    }
  });

  app.get("/api/couple", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      if (!user.coupleId) {
        return res.status(400).json({ error: "User is not part of a couple" });
      }
      const couple = await storage.getCoupleById(user.coupleId);
      res.json(couple);
    } catch (error) {
      console.error("Error fetching couple:", error);
      res.status(500).json({ error: "Failed to fetch couple" });
    }
  });

  app.post("/api/couple/invite", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      if (user.role !== "main_admin") {
        return res.status(403).json({ error: "Only main admin can generate invite codes" });
      }
      
      if (!user.coupleId) {
        return res.status(400).json({ error: "User is not part of a couple" });
      }
      const inviteCode = await storage.generateInviteCode(user.coupleId);
      res.json({ inviteCode });
    } catch (error) {
      console.error("Error generating invite code:", error);
      res.status(500).json({ error: "Failed to generate invite code" });
    }
  });

  app.post("/api/couple/join", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Validate request body
      const validationResult = joinCoupleSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }

      const user = req.user!;
      const { inviteCode } = validationResult.data;
      
      await storage.joinCouple(user.id, inviteCode);
      res.json({ success: true });
    } catch (error) {
      console.error("Error joining couple:", error);
      res.status(500).json({ error: "Failed to join couple" });
    }
  });

  // Counters routes
  app.get("/api/counters", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      if (!user.coupleId) {
        return res.status(400).json({ error: "User is not part of a couple" });
      }
      const counters = await storage.getCountersForCouple(user.coupleId);
      res.json(counters);
    } catch (error) {
      console.error("Error fetching counters:", error);
      res.status(500).json({ error: "Failed to fetch counters" });
    }
  });

  // Games routes
  app.get("/api/games", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      if (!user.coupleId) {
        return res.status(400).json({ error: "User is not part of a couple" });
      }
      const games = await storage.getGamesForCouple(user.coupleId);
      res.json(games);
    } catch (error) {
      console.error("Error fetching games:", error);
      res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  app.post("/api/games", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const user = req.user!;
      
      // Validate request body with server schema
  const validationResult = serverGameSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      
      if (!user.coupleId) {
        return res.status(400).json({ error: "User is not part of a couple" });
      }
      
  const gameData = {
        ...validationResult.data,
        coupleId: user.coupleId,
      };
      
      const game = await storage.createGame(gameData);
      res.json(game);
    } catch (error) {
      console.error("Error creating game:", error);
      res.status(500).json({ error: "Failed to create game" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time chat with authentication
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    verifyClient: (info, next) => {
      try {
        // Check Origin to prevent cross-site WebSocket attacks
        const host = info.req.headers.host;
        const origin = info.origin;
        
        if (!host) {
          console.warn('WebSocket connection rejected: No host header');
          return next(false, 400, 'Bad Request');
        }
        
        // Check origin more flexibly - accept both http and https from same host
        const allowedOrigins = [
          `http://${host}`,
          `https://${host}`
        ];
        
        if (!origin || !allowedOrigins.includes(origin)) {
          console.warn(`WebSocket connection rejected: Origin mismatch. Allowed: ${allowedOrigins.join(', ')}, Got: ${origin}`);
          return next(false, 403, 'Forbidden');
        }

        // Parse cookies from the request
        const cookies = parseCookie(info.req.headers.cookie || '');
        const sessionCookie = cookies['connect.sid'];
        
        if (!sessionCookie) {
          console.warn('WebSocket connection rejected: No session cookie');
          return next(false, 401, 'Unauthorized');
        }

        // Decode session ID (remove 's:' prefix and signature)
        const sessionId = sessionCookie.startsWith('s:') 
          ? sessionCookie.slice(2).split('.')[0] 
          : sessionCookie;

        // Get session from store
        storage.sessionStore.get(sessionId, (err: any, session: any) => {
          if (err) {
            console.error('WebSocket session error:', err);
            return next(false, 500, 'Internal Server Error');
          }
          
          if (!session || !session.passport || !session.passport.user) {
            console.warn('WebSocket connection rejected: Invalid session');
            return next(false, 401, 'Unauthorized');
          }

          // Store user info for this connection
          (info.req as any).userId = session.passport.user;
          next(true);
        });
        
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        next(false, 500, 'Internal Server Error');
      }
    }
  });

  // Track authenticated WebSocket connections с признаком активности (heartbeat)
  // Все комментарии на русском 🇷🇺
  const authenticatedConnections = new Map<any, { userId: string; coupleId: string; ws: any; isAlive?: boolean }>();

  // HEARTBEAT: периодический ping/pong для отлова «мертвых» соединений
  const HEARTBEAT_INTERVAL_MS = 30_000; // 30 секунд — компромисс между чувствительностью и нагрузкой
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      const meta = authenticatedConnections.get(ws);
      // Если ранее помечали как не отвечающий — закрываем
      if (meta && meta.isAlive === false) {
        try { ws.terminate(); } catch {}
        authenticatedConnections.delete(ws);
        return;
      }
      // Ставим флаг ожидания и шлём ping
      if (meta) meta.isAlive = false;
      try { ws.ping(); } catch {}
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('connection', async (ws, req) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      
      if (!user || !user.coupleId) {
        ws.close(1008, 'User not found or not in a couple');
        return;
      }

      // Store connection info
      const connectionInfo = {
        userId: user.id,
        coupleId: user.coupleId,
        ws: ws,
        isAlive: true
      };
      authenticatedConnections.set(ws, connectionInfo);

      // Update user online status
      await storage.updateUser(user.id, { isOnline: true });
      
  console.warn(`WebSocket connected: User ${user.username} from couple ${user.coupleId}`);
      
      // Notify partner about online status change
      authenticatedConnections.forEach((connInfo, clientWs) => {
        if (connInfo.coupleId === connectionInfo.coupleId && 
            connInfo.userId !== connectionInfo.userId && 
            clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({
            type: 'partner_status_change',
            partnerId: user.id,
            isOnline: true,
            timestamp: new Date().toISOString()
          }));
        }
      });

      // Also notify THIS client about a partner already online (if any)
      // This ensures late joiners immediately see partnerOnline = true
      authenticatedConnections.forEach((connInfo, _clientWs) => {
        if (connInfo.coupleId === connectionInfo.coupleId &&
            connInfo.userId !== connectionInfo.userId) {
          ws.send(JSON.stringify({
            type: 'partner_status_change',
            partnerId: connInfo.userId,
            isOnline: true,
            timestamp: new Date().toISOString()
          }));
        }
      });

      // Любой ответ pong со стороны клиента помечает соединение «живым»
      ws.on('pong', () => {
        const meta = authenticatedConnections.get(ws);
        if (meta) meta.isAlive = true;
      });

      ws.on('message', async (message) => {
        try {
          const raw = message.toString();
          // SECURITY: Ограничиваем максимальный размер входящего сообщения
          if (raw.length > 64 * 1024) {
            ws.send(JSON.stringify({ type: 'error', message: 'Сообщение слишком большое' }));
            return;
          }
          let data: any;
          try {
            data = JSON.parse(raw);
          } catch {
            ws.send(JSON.stringify({ type: 'error', message: 'Некорректный JSON' }));
            return;
          }
          // SECURITY: Белый список типов сообщений
          const allowedTypes = new Set([
            'chat_message',
            'game_action',
            'game_invitation',
            'typing_start',
            'typing_stop',
            'presence_ping',
          ]);
          if (!data || typeof data !== 'object' || !allowedTypes.has(data.type)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Недопустимый тип сообщения' }));
            return;
          }
          
          if (data.type === 'chat_message') {
            // Broadcast message only to other clients in the same couple
            authenticatedConnections.forEach((connInfo, clientWs) => {
              if (clientWs !== ws && 
                  connInfo.coupleId === connectionInfo.coupleId && 
                  clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify(data));
              }
            });
          } else if (data.type === 'game_action') {
            // SECURITY: Validate game action with schema
            const validationResult = wsGameActionSchema.safeParse(data);
            
            if (!validationResult.success) {
              console.error('Invalid game action received:', validationResult.error.errors);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Недопустимое игровое действие',
                details: validationResult.error.errors.map(err => ({
                  field: err.path.join('.'),
                  message: err.message
                }))
              }));
              return;
            }
            
            const validatedData = validationResult.data;
            
            // SECURITY: Verify the senderId matches the authenticated user
            if (validatedData.senderId !== user.id) {
              console.error(`Game action sender mismatch: expected ${user.id}, got ${validatedData.senderId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Неавторизованное игровое действие'
              }));
              return;
            }
            
            // Handle real-time game actions
            console.warn(`Game action received: ${validatedData.gameType} - ${validatedData.action} from user ${user.username}`);
            
            // Broadcast game action to partner in the same couple
            authenticatedConnections.forEach((connInfo, clientWs) => {
              if (clientWs !== ws && 
                  connInfo.coupleId === connectionInfo.coupleId && 
                  clientWs.readyState === WebSocket.OPEN) {
                
                // Forward the complete game action to partner
                const gameMessage = {
                  type: 'game_action',
                  gameType: validatedData.gameType,
                  gameId: validatedData.gameId,
                  action: validatedData.action,
                  data: validatedData.data,
                  senderId: validatedData.senderId,
                  timestamp: new Date().toISOString()
                };
                
                clientWs.send(JSON.stringify(gameMessage));
                console.warn(`Game action forwarded to partner in couple ${connectionInfo.coupleId}`);
              }
            });
            
            // Optionally persist game state changes for certain actions
            if (validatedData.gameId && (validatedData.action === 'game_completed' || validatedData.action === 'round_finished')) {
              try {
                // Update game state in database
                await storage.updateGame(validatedData.gameId, {
                  state: validatedData.data.gameState || {},
                  updatedAt: new Date()
                });
              } catch (gameUpdateError) {
                console.error('Failed to update game state:', gameUpdateError);
              }
            }
            
          } else if (data.type === 'game_invitation') {
            // Handle game invitations
            console.warn(`Game invitation received: ${data.gameType} from user ${user.username}`);
            
            // Validate game invitation data
            if (!data.gameType || typeof data.gameType !== 'string') {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Некорректные данные приглашения'
              }));
              return;
            }
            
            // Send invitation to partner in the same couple
            authenticatedConnections.forEach((connInfo, clientWs) => {
              if (clientWs !== ws && 
                  connInfo.coupleId === connectionInfo.coupleId && 
                  clientWs.readyState === WebSocket.OPEN) {
                
                const invitationMessage = {
                  type: 'game_invitation',
                  gameType: data.gameType,
                  gameTitle: data.gameTitle || 'Игра',
                  inviterName: user.username,
                  inviterId: user.id,
                  message: data.message || `${user.username} приглашает вас поиграть в "${data.gameTitle || data.gameType}"`,
                  timestamp: new Date().toISOString()
                };
                
                clientWs.send(JSON.stringify(invitationMessage));
                console.warn(`Game invitation sent to partner in couple ${connectionInfo.coupleId}`);
              }
            });
            
            // Send confirmation back to sender
            ws.send(JSON.stringify({
              type: 'invitation_sent',
              gameType: data.gameType,
              timestamp: new Date().toISOString()
            }));
            
          } else if (data.type === 'typing_start' || data.type === 'typing_stop') {
            // Handle typing indicators
            authenticatedConnections.forEach((connInfo, clientWs) => {
              if (clientWs !== ws && 
                  connInfo.coupleId === connectionInfo.coupleId && 
                  clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: data.type,
                  userId: user.id,
                  timestamp: new Date().toISOString()
                }));
              }
            });
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', async () => {
        authenticatedConnections.delete(ws);
  console.warn(`WebSocket disconnected: User ${user.username}`);
        
        // Update user online status to offline
        await storage.updateUser(user.id, { 
          isOnline: false, 
          lastSeen: new Date() 
        });
        
        // Notify partner about offline status change
        authenticatedConnections.forEach((connInfo, clientWs) => {
          if (connInfo.coupleId === connectionInfo.coupleId && 
              connInfo.userId !== connectionInfo.userId && 
              clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'partner_status_change',
              partnerId: user.id,
              isOnline: false,
              lastSeen: new Date().toISOString(),
              timestamp: new Date().toISOString()
            }));
          }
        });
      });

      ws.on('error', async (error) => {
        console.error('WebSocket error:', error);
        authenticatedConnections.delete(ws);
        
        // Update user online status to offline on error
        await storage.updateUser(user.id, { 
          isOnline: false, 
          lastSeen: new Date() 
        });
        
        // Notify partner about offline status change
        authenticatedConnections.forEach((connInfo, clientWs) => {
          if (connInfo.coupleId === connectionInfo.coupleId && 
              connInfo.userId !== connectionInfo.userId && 
              clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'partner_status_change',
              partnerId: user.id,
              isOnline: false,
              lastSeen: new Date().toISOString(),
              timestamp: new Date().toISOString()
            }));
          }
        });
      });

    } catch (error) {
      console.error('WebSocket connection setup error:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  // Корректная очистка интервала при остановке сервера (на всякий случай)
  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  return httpServer;
}
