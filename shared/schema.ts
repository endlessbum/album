import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  role: text("role", { enum: ["main_admin", "co_admin", "guest", "user"] }).notNull().default("guest"),
  coupleId: varchar("couple_id"),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const couples = pgTable("couples", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mainAdminId: varchar("main_admin_id").notNull(),
  coAdminId: varchar("co_admin_id"),
  inviteCode: text("invite_code").unique(),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memories = pgTable("memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coupleId: varchar("couple_id").notNull(),
  authorId: varchar("author_id").notNull(),
  title: text("title"),
  content: text("content"),
  type: text("type").notNull(), // 'photo', 'video', 'text', 'quote'
  mediaUrl: text("media_url"),
  thumbnailUrl: text("thumbnail_url"),
  visibility: jsonb("visibility").default({}), // guest permissions
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  memoryId: varchar("memory_id").notNull(),
  authorId: varchar("author_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coupleId: varchar("couple_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  content: text("content"),
  type: text("type").notNull(), // 'text', 'image', 'video', 'voice', 'ephemeral_image', 'ephemeral_video'
  mediaUrl: text("media_url"),
  isEphemeral: boolean("is_ephemeral").default(false),
  expiresAt: timestamp("expires_at"),
  isRead: boolean("is_read").default(false),
  reactions: jsonb("reactions").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const games = pgTable("games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coupleId: varchar("couple_id").notNull(),
  type: text("type").notNull(),
  state: jsonb("state").default({}),
  currentPlayer: varchar("current_player"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const counters = pgTable("counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coupleId: varchar("couple_id").notNull(),
  name: text("name").notNull(),
  value: integer("value").default(0),
  targetDate: timestamp("target_date"),
  isVisible: boolean("is_visible").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSeen: true,
  isOnline: true,
});

export const insertCoupleSchema = createInsertSchema(couples).omit({
  id: true,
  createdAt: true,
});

export const insertMemorySchema = createInsertSchema(memories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  coupleId: z.string().uuid(),
  type: z.enum(['truth-or-dare', 'twenty-questions', 'role-playing', 'partner-quiz'], {
    errorMap: () => ({ message: 'Недопустимый тип игры' })
  }),
  state: z.record(z.any()).optional().default({}),
  currentPlayer: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

// WebSocket game action validation schema
export const wsGameActionSchema = z.object({
  type: z.literal('game_action'),
  gameType: z.enum(['truth-or-dare', 'twenty-questions', 'role-playing', 'partner-quiz']),
  gameId: z.string().uuid(),
  action: z.string().min(1).max(50), // Limit action name length
  data: z.record(z.any()).refine(
    (obj) => JSON.stringify(obj).length <= 10000, // Limit payload size to 10KB
    { message: 'Данные игрового действия слишком велики (макс. 10KB)' }
  ),
  senderId: z.string().uuid(),
});

export const insertCounterSchema = createInsertSchema(counters).omit({
  id: true,
  createdAt: true,
});

// Profile update schema
const isHttpUrl = (s: string) => {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
};

export const updateProfileSchema = z.object({
  username: z.string().min(1, 'Никнейм обязателен').max(50, 'Никнейм не может быть длиннее 50 символов').optional(),
  firstName: z.string().max(100, 'Имя не может быть длиннее 100 символов').optional().nullable(),
  lastName: z.string().max(100, 'Фамилия не может быть длиннее 100 символов').optional().nullable(),
  // Разрешаем абсолютные http(s) URL и относительные '/uploads/...'
  profileImageUrl: z.string().refine(
    (v) => isHttpUrl(v) || v.startsWith('/uploads/'),
    { message: 'Некорректный URL изображения' }
  ).optional().nullable(),
  email: z.string().email('Некорректный email').optional(),
}).refine(
  (data) => Object.values(data).some(value => value !== undefined),
  { message: 'Должно быть обновлено хотя бы одно поле' }
);

// Profile statistics type
export const profileStatsSchema = z.object({
  memoriesCount: z.number().min(0),
  messagesCount: z.number().min(0),
  gamesCount: z.number().min(0),
  daysInCouple: z.number().min(0),
  placesVisited: z.number().min(0),
});

// Couple settings schema
export const coupleSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.enum(['ru', 'en']).optional(),
  notifications: z.object({
    memories: z.boolean(),
    messages: z.boolean(),
    games: z.boolean(),
  }).optional(),
  privacy: z.object({
    guestCanViewMemories: z.boolean(),
    guestCanComment: z.boolean(),
    guestCanPlayGames: z.boolean(),
  }).optional(),
  relationshipStartDate: z.string().optional().nullable(), // ISO date string
}).partial();

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Couple = typeof couples.$inferSelect;
export type InsertCouple = z.infer<typeof insertCoupleSchema>;
export type Memory = typeof memories.$inferSelect;
export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Counter = typeof counters.$inferSelect;
export type InsertCounter = z.infer<typeof insertCounterSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type ProfileStats = z.infer<typeof profileStatsSchema>;
export type CoupleSettings = z.infer<typeof coupleSettingsSchema>;

// Partner info type for API responses (JSON-safe)
export interface PartnerInfo {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isOnline: boolean | null;
  lastSeen: string | null; // ISO date string for JSON compatibility
  role: string;
}

export interface PartnerResponse {
  partner: PartnerInfo | null;
}

// WebSocket Game Message Types
export interface BaseGameMessage {
  type: 'game_action';
  gameType: string;
  gameId: string;
  senderId: string;
  action: string;
}

// Partner Quiz Messages
export interface PartnerQuizRoundStarted extends BaseGameMessage {
  gameType: 'partner-quiz';
  action: 'round_started';
  questions: Array<{
    id: string;
    text: string;
    type: 'choice' | 'text' | 'number';
    options?: string[];
    category: 'preferences' | 'memories' | 'dreams' | 'favorites';
  }>;
}

export interface PartnerQuizAnswersSubmitted extends BaseGameMessage {
  gameType: 'partner-quiz';
  action: 'answers_submitted';
  answers: Array<{
    questionId: string;
    answer: string;
  }>;
}

export interface PartnerQuizGuessesSubmitted extends BaseGameMessage {
  gameType: 'partner-quiz';
  action: 'guesses_submitted';
  guesses: Array<{
    questionId: string;
    answer: string;
  }>;
}

// Role Playing Messages
export interface RolePlayingScenarioSelected extends BaseGameMessage {
  gameType: 'role-playing';
  action: 'scenario_selected';
  scenarioId: string;
}

export interface RolePlayingRolesAssigned extends BaseGameMessage {
  gameType: 'role-playing';
  action: 'roles_assigned';
  myRole: string;
  partnerRole: string;
}

export interface RolePlayingMessageSent extends BaseGameMessage {
  gameType: 'role-playing';
  action: 'message_sent';
  content: string;
  inCharacter: boolean;
}

export interface RolePlayingNewPrompt extends BaseGameMessage {
  gameType: 'role-playing';
  action: 'new_prompt';
  prompt: string;
}

// Truth or Dare Messages
export interface TruthOrDareNewAction extends BaseGameMessage {
  gameType: 'truth-or-dare';
  action: 'new_action';
  actionData: {
    type: 'truth' | 'dare';
    content: string;
    difficulty: 'easy' | 'medium' | 'hard';
    category: 'relationship' | 'fun' | 'deep' | 'spicy';
  };
}

export interface TruthOrDareActionCompleted extends BaseGameMessage {
  gameType: 'truth-or-dare';
  action: 'action_completed';
  score: { truth: number; dare: number; };
  nextPlayer: string;
}

// Twenty Questions Messages
export interface TwentyQuestionsWordSet extends BaseGameMessage {
  gameType: 'twenty-questions';
  action: 'word_set';
}

export interface TwentyQuestionsQuestionAsked extends BaseGameMessage {
  gameType: 'twenty-questions';
  action: 'question_asked';
  question: string;
}

export interface TwentyQuestionsQuestionAnswered extends BaseGameMessage {
  gameType: 'twenty-questions';
  action: 'question_answered';
  questionId: string;
  answer: 'yes' | 'no';
}

export interface TwentyQuestionsFinalGuess extends BaseGameMessage {
  gameType: 'twenty-questions';
  action: 'final_guess';
  guess: string;
}

export interface TwentyQuestionsGuessResult extends BaseGameMessage {
  gameType: 'twenty-questions';
  action: 'guess_result';
  correct: boolean;
  guesser: string;
}

// Common Messages
export interface PartnerJoinedMessage extends BaseGameMessage {
  action: 'partner_joined';
}

// Union types for each game
export type PartnerQuizMessage = 
  | PartnerQuizRoundStarted 
  | PartnerQuizAnswersSubmitted 
  | PartnerQuizGuessesSubmitted 
  | PartnerJoinedMessage;

export type RolePlayingMessage = 
  | RolePlayingScenarioSelected 
  | RolePlayingRolesAssigned 
  | RolePlayingMessageSent 
  | RolePlayingNewPrompt 
  | PartnerJoinedMessage;

export type TruthOrDareMessage = 
  | TruthOrDareNewAction 
  | TruthOrDareActionCompleted 
  | PartnerJoinedMessage;

export type TwentyQuestionsMessage = 
  | TwentyQuestionsWordSet 
  | TwentyQuestionsQuestionAsked 
  | TwentyQuestionsQuestionAnswered 
  | TwentyQuestionsFinalGuess 
  | TwentyQuestionsGuessResult 
  | PartnerJoinedMessage;

// Complete game message union
export type GameMessage = 
  | PartnerQuizMessage 
  | RolePlayingMessage 
  | TruthOrDareMessage 
  | TwentyQuestionsMessage;
