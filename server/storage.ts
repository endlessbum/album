// Загружаем переменные окружения
import "./config";

import { users, couples, memories, comments, messages, games, counters, type User, type InsertUser, type Couple, type Memory, type InsertMemory, type Comment, type InsertComment, type Message, type InsertMessage, type Game, type InsertGame, type Counter, type InsertCounter, type CoupleSettings } from "@shared/schema";
import { randomUUID, randomBytes } from "crypto";
import session from "express-session";
import createMemoryStore from "memorystore";
import ConnectPgSimple from "connect-pg-simple";
import { db } from "./db";
import { eq, and, desc, asc, lte, count, sql, or, isNull, gt } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);
const PgSession = ConnectPgSimple(session);

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  getPartnerInfo(userId: string): Promise<User | undefined>;
  
  // Couple operations
  createCouple(mainAdminId: string): Promise<Couple>;
  getCoupleById(id: string): Promise<Couple | undefined>;
  getCoupleByUser(userId: string): Promise<Couple | undefined>;
  getCoupleByInviteCode(inviteCode: string): Promise<Couple | undefined>;
  generateInviteCode(coupleId: string): Promise<string>;
  revokeInviteCode(coupleId: string): Promise<void>;
  joinCouple(userId: string, inviteCode: string): Promise<void>;
  updateCoupleSettings(coupleId: string, settings: CoupleSettings): Promise<Couple>;
  
  // Memory operations
  getMemory(id: string): Promise<Memory | undefined>;
  getMemoriesForCouple(coupleId: string): Promise<Memory[]>;
  createMemory(memory: InsertMemory): Promise<Memory>;
  updateMemory(id: string, updates: Partial<Memory>): Promise<Memory>;
  deleteMemory(id: string): Promise<void>;
  
  // Comment operations
  getCommentsForMemory(memoryId: string): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  
  // Message operations
  getMessagesForCouple(coupleId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteExpiredMessages(): Promise<void>;
  
  // Game operations
  getGamesForCouple(coupleId: string): Promise<Game[]>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: string, updates: Partial<Game>): Promise<Game>;
  
  // Counter operations
  getCountersForCouple(coupleId: string): Promise<Counter[]>;
  createCounter(counter: InsertCounter): Promise<Counter>;
  updateCounter(id: string, updates: Partial<Counter>): Promise<Counter>;
  
  // Profile operations
  getProfileStats(userId: string, coupleId: string): Promise<{
    memoriesCount: number;
    messagesCount: number;
    gamesCount: number;
    daysInCouple: number;
    placesVisited: number;
  }>;
  
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private couples: Map<string, Couple> = new Map();
  private memories: Map<string, Memory> = new Map();
  private comments: Map<string, Comment> = new Map();
  private messages: Map<string, Message> = new Map();
  private games: Map<string, Game> = new Map();
  private counters: Map<string, Counter> = new Map();
  
  public sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    
    const user: User = {
      id,
      username: insertUser.username,
      email: insertUser.email,
      password: insertUser.password,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      profileImageUrl: insertUser.profileImageUrl || null,
      role: insertUser.role || "user",
      coupleId: insertUser.coupleId || null,
      isOnline: false,
      lastSeen: now,
      createdAt: now,
      updatedAt: now,
    };
    
    this.users.set(id, user);
    
    // Create couple for main admin
    if (!user.coupleId) {
      const couple = await this.createCouple(id);
      user.role = "main_admin";
      user.coupleId = couple.id;
      this.users.set(id, user);
    }
    
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    const updatedUser: User = {
      ...user,
      ...updates,
      id: user.id,
      updatedAt: new Date(),
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getPartnerInfo(userId: string): Promise<User | undefined> {
    const _user = this.users.get(userId);
    if (!_user?.coupleId) return undefined;
    const couple = this.couples.get(_user.coupleId);
    if (!couple) return undefined;
    const partnerIds = [couple.mainAdminId, couple.coAdminId].filter((id): id is string => id !== null && id !== userId);
    if (partnerIds.length === 0) return undefined;
    return this.users.get(partnerIds[0]);
  }

  async createCouple(mainAdminId: string): Promise<Couple> {
    const id = randomUUID();
    const couple: Couple = {
      id,
      mainAdminId,
      coAdminId: null,
      inviteCode: null,
      settings: {},
      createdAt: new Date(),
    };
    
    this.couples.set(id, couple);
    return couple;
  }

  async getCoupleById(id: string): Promise<Couple | undefined> {
    return this.couples.get(id);
  }

  async getCoupleByUser(userId: string): Promise<Couple | undefined> {
    const _user = await this.getUser(userId);
    if (!_user?.coupleId) return undefined;
    return this.getCoupleById(_user.coupleId);
  }

  async getCoupleByInviteCode(inviteCode: string): Promise<Couple | undefined> {
    return Array.from(this.couples.values()).find(c => c.inviteCode === inviteCode);
  }

  async generateInviteCode(coupleId: string): Promise<string> {
    const couple = this.couples.get(coupleId);
    if (!couple) throw new Error("Couple not found");
    
    // Generate cryptographically secure invite code using randomBytes
    const generateSecureCode = () => {
      const bytes = randomBytes(3);
      const num = parseInt(bytes.toString('hex'), 16);
      return num.toString(36).substring(0, 4).toUpperCase();
    };
    const inviteCode = `${generateSecureCode()}-${generateSecureCode()}-${generateSecureCode()}`;
    
    couple.inviteCode = inviteCode;
    this.couples.set(coupleId, couple);
    
    return inviteCode;
  }

  async revokeInviteCode(coupleId: string): Promise<void> {
    const couple = this.couples.get(coupleId);
    if (!couple) throw new Error("Couple not found");
    
    couple.inviteCode = null;
    this.couples.set(coupleId, couple);
  }

  async joinCouple(userId: string, inviteCode: string): Promise<void> {
    const couple = Array.from(this.couples.values()).find(c => c.inviteCode === inviteCode);
    if (!couple) throw new Error("Invalid invite code");
    
    const _user = this.users.get(userId);
    if (!_user) throw new Error("User not found");
    
    // Determine role based on current couple state
    let role: User["role"] = "guest";
    if (!couple.coAdminId) {
      couple.coAdminId = userId;
      role = "co_admin";
    }
    
  _user.coupleId = couple.id;
  _user.role = role;
    
  this.users.set(userId, _user);
    this.couples.set(couple.id, couple);
  }

  async updateCoupleSettings(coupleId: string, settings: CoupleSettings): Promise<Couple> {
    const couple = this.couples.get(coupleId);
    if (!couple) throw new Error("Couple not found");
    
    couple.settings = { ...(couple.settings || {}), ...settings };
    this.couples.set(coupleId, couple);
    return couple;
  }

  async getMemoriesForCouple(coupleId: string): Promise<Memory[]> {
    return Array.from(this.memories.values())
      .filter(memory => memory.coupleId === coupleId)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async getMemory(id: string): Promise<Memory | undefined> {
    return this.memories.get(id);
  }

  async createMemory(insertMemory: InsertMemory): Promise<Memory> {
    const id = randomUUID();
    const now = new Date();
    
    const memory: Memory = {
      id,
      coupleId: insertMemory.coupleId,
      authorId: insertMemory.authorId,
      title: insertMemory.title || null,
      content: insertMemory.content || null,
      type: insertMemory.type,
      mediaUrl: insertMemory.mediaUrl || null,
      thumbnailUrl: insertMemory.thumbnailUrl || null,
      visibility: insertMemory.visibility || {},
      tags: insertMemory.tags || null,
      createdAt: now,
      updatedAt: now,
    };
    
    this.memories.set(id, memory);
    return memory;
  }

  async updateMemory(id: string, updates: Partial<Memory>): Promise<Memory> {
    const memory = this.memories.get(id);
    if (!memory) throw new Error("Memory not found");
    
    const updatedMemory = { ...memory, ...updates, updatedAt: new Date() };
    this.memories.set(id, updatedMemory);
    return updatedMemory;
  }

  async deleteMemory(id: string): Promise<void> {
    this.memories.delete(id);
  }

  async getCommentsForMemory(memoryId: string): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter(comment => comment.memoryId === memoryId)
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = randomUUID();
    const comment: Comment = {
      ...insertComment,
      id,
      createdAt: new Date(),
    };
    
    this.comments.set(id, comment);
    return comment;
  }

  async getMessagesForCouple(coupleId: string): Promise<Message[]> {
    const now = new Date();
    return Array.from(this.messages.values())
      .filter(message => {
        // Filter by couple ID
        if (message.coupleId !== coupleId) return false;
        
        // SECURITY: Exclude expired ephemeral messages
        if (message.isEphemeral && message.expiresAt && message.expiresAt <= now) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      id,
      coupleId: insertMessage.coupleId,
      senderId: insertMessage.senderId,
      content: insertMessage.content || null,
      type: insertMessage.type,
      mediaUrl: insertMessage.mediaUrl || null,
      isEphemeral: insertMessage.isEphemeral || false,
      expiresAt: insertMessage.expiresAt || null,
      isRead: insertMessage.isRead || false,
      reactions: insertMessage.reactions || {},
      createdAt: new Date(),
    };
    
    this.messages.set(id, message);
    return message;
  }

  async deleteExpiredMessages(): Promise<void> {
    const now = new Date();
    Array.from(this.messages.entries()).forEach(([id, message]) => {
      if (message.isEphemeral && message.expiresAt && message.expiresAt <= now) {
        this.messages.delete(id);
      }
    });
  }

  async getGamesForCouple(coupleId: string): Promise<Game[]> {
    return Array.from(this.games.values())
      .filter(game => game.coupleId === coupleId)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async createGame(insertGame: InsertGame): Promise<Game> {
    const id = randomUUID();
    const now = new Date();
    
    const game: Game = {
      id,
      coupleId: insertGame.coupleId,
      type: insertGame.type,
      state: insertGame.state || {},
      currentPlayer: insertGame.currentPlayer || null,
      isActive: insertGame.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };
    
    this.games.set(id, game);
    return game;
  }

  async updateGame(id: string, updates: Partial<Game>): Promise<Game> {
    const game = this.games.get(id);
    if (!game) throw new Error("Game not found");
    
    const updatedGame = { ...game, ...updates, updatedAt: new Date() };
    this.games.set(id, updatedGame);
    return updatedGame;
  }

  async getCountersForCouple(coupleId: string): Promise<Counter[]> {
    return Array.from(this.counters.values())
      .filter(counter => counter.coupleId === coupleId);
  }

  async createCounter(insertCounter: InsertCounter): Promise<Counter> {
    const id = randomUUID();
    const counter: Counter = {
      id,
      coupleId: insertCounter.coupleId,
      name: insertCounter.name,
      value: insertCounter.value || 0,
      targetDate: insertCounter.targetDate || null,
      isVisible: insertCounter.isVisible ?? true,
      createdAt: new Date(),
    };
    
    this.counters.set(id, counter);
    return counter;
  }

  async updateCounter(id: string, updates: Partial<Counter>): Promise<Counter> {
    const counter = this.counters.get(id);
    if (!counter) throw new Error("Counter not found");
    
    const updatedCounter = { ...counter, ...updates };
    this.counters.set(id, updatedCounter);
    return updatedCounter;
  }

  async getProfileStats(userId: string, coupleId: string): Promise<{
    memoriesCount: number;
    messagesCount: number;
    gamesCount: number;
    daysInCouple: number;
    placesVisited: number;
  }> {
    // Get user and couple info for calculations
  const _user2 = this.users.get(userId);
    const couple = this.couples.get(coupleId);
    
    // Count memories for this couple
    const memoriesCount = Array.from(this.memories.values())
      .filter(memory => memory.coupleId === coupleId).length;
    
    // Count messages sent by this user
    const messagesCount = Array.from(this.messages.values())
      .filter(message => message.senderId === userId).length;
    
    // Count active games for this couple
    const gamesCount = Array.from(this.games.values())
      .filter(game => game.coupleId === coupleId && game.isActive).length;
    
    // Calculate days in couple (from couple creation date or user join date)
    let daysInCouple = 0;
    if (couple && couple.createdAt) {
      const coupleDate = new Date(couple.createdAt);
      const now = new Date();
      daysInCouple = Math.floor((now.getTime() - coupleDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    // Count unique places based on location tags (format: "location:<name>")
    const placeSet = new Set<string>();
    Array.from(this.memories.values())
      .filter(memory => memory.coupleId === coupleId && memory.tags)
      .forEach(memory => {
        (memory.tags || []).forEach(tag => {
          if (tag.startsWith('location:')) {
            placeSet.add(tag.toLowerCase());
          }
        });
      });
    const placesVisited = placeSet.size;
    
    return {
      memoriesCount,
      messagesCount,
      gamesCount,
      daysInCouple: Math.max(0, daysInCouple),
      placesVisited,
    };
  }
}

export class PgStorage implements IStorage {
  public sessionStore: session.Store;

  constructor() {
    // Validate DATABASE_URL is present and valid
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL environment variable is required for PostgreSQL storage. " +
        "Please ensure your database is properly configured in your Replit environment."
      );
    }

    // Validate DATABASE_URL format (basic check for postgresql:// protocol)
    if (!process.env.DATABASE_URL.startsWith('postgres://') && !process.env.DATABASE_URL.startsWith('postgresql://')) {
      throw new Error(
        "DATABASE_URL must be a valid PostgreSQL connection string starting with 'postgres://' or 'postgresql://'. " +
        `Received: ${process.env.DATABASE_URL.substring(0, 20)}...`
      );
    }

    try {
      this.sessionStore = new PgSession({
        conString: process.env.DATABASE_URL,
        tableName: 'session',
        createTableIfMissing: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize PostgreSQL session store: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
        "Please check your DATABASE_URL configuration and ensure the database is accessible."
      );
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const now = new Date();
    
    // If user has coupleId, just create user
    if (insertUser.coupleId) {
      const userResult = await db.insert(users).values({
        username: insertUser.username,
        email: insertUser.email,
        password: insertUser.password,
        firstName: insertUser.firstName || null,
        lastName: insertUser.lastName || null,
        profileImageUrl: insertUser.profileImageUrl || null,
        role: insertUser.role || "user",
        coupleId: insertUser.coupleId,
        isOnline: false,
        lastSeen: now,
      }).returning();
      
      return userResult[0];
    }
    
    // Create user and couple atomically in transaction
  return await db.transaction(async (tx: any) => {
      // First create the user
      const userResult = await tx.insert(users).values({
        username: insertUser.username,
        email: insertUser.email,
        password: insertUser.password,
        firstName: insertUser.firstName || null,
        lastName: insertUser.lastName || null,
        profileImageUrl: insertUser.profileImageUrl || null,
        role: "main_admin",
        coupleId: null, // Will be set after couple creation
        isOnline: false,
        lastSeen: now,
      }).returning();
      
      const user = userResult[0];
      
      // Then create couple with the actual user ID
      const coupleResult = await tx.insert(couples).values({
        mainAdminId: user.id,
        coAdminId: null,
        inviteCode: null,
        settings: {},
      }).returning();
      
      const couple = coupleResult[0];
      
      // Finally update user with couple ID
      const updatedUserResult = await tx.update(users)
        .set({ coupleId: couple.id })
        .where(eq(users.id, user.id))
        .returning();
      
      return updatedUserResult[0];
    });
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const result = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    if (result.length === 0) throw new Error("User not found");
    return result[0];
  }

  async getPartnerInfo(userId: string): Promise<User | undefined> {
  const _user = await this.getUser(userId);
    if (!_user?.coupleId) return undefined;
    
    const couple = await this.getCoupleById(_user.coupleId);
    if (!couple) return undefined;
    
    // Find the partner - the other user in the couple
  const partnerIds = [couple.mainAdminId, couple.coAdminId].filter((id): id is string => id !== null && id !== userId);
    
    if (partnerIds.length === 0) return undefined;
    
    return this.getUser(partnerIds[0]);
  }

  async createCouple(mainAdminId: string): Promise<Couple> {
    const result = await db.insert(couples).values({
      mainAdminId,
      coAdminId: null,
      inviteCode: null,
      settings: {},
    }).returning();
    
    return result[0];
  }

  async getCoupleById(id: string): Promise<Couple | undefined> {
    const result = await db.select().from(couples).where(eq(couples.id, id)).limit(1);
    return result[0];
  }

  async getCoupleByUser(userId: string): Promise<Couple | undefined> {
  const _user2 = await this.getUser(userId);
    if (!_user2?.coupleId) return undefined;
    return this.getCoupleById(_user2.coupleId);
  }

  async getCoupleByInviteCode(inviteCode: string): Promise<Couple | undefined> {
    const result = await db.select().from(couples).where(eq(couples.inviteCode, inviteCode)).limit(1);
    return result[0];
  }

  async generateInviteCode(coupleId: string): Promise<string> {
    // Generate cryptographically secure invite code using randomBytes
    const generateSecureCode = () => {
      const bytes = randomBytes(3);
      const num = parseInt(bytes.toString('hex'), 16);
      return num.toString(36).substring(0, 4).toUpperCase();
    };
    const inviteCode = `${generateSecureCode()}-${generateSecureCode()}-${generateSecureCode()}`;
    
    const result = await db.update(couples)
      .set({ inviteCode })
      .where(eq(couples.id, coupleId))
      .returning();
    
    if (result.length === 0) throw new Error("Couple not found");
    
    return inviteCode;
  }

  async revokeInviteCode(coupleId: string): Promise<void> {
    const result = await db.update(couples)
      .set({ inviteCode: null })
      .where(eq(couples.id, coupleId))
      .returning();
    
    if (result.length === 0) throw new Error("Couple not found");
  }

  async joinCouple(userId: string, inviteCode: string): Promise<void> {
  return await db.transaction(async (tx: any) => {
      const couple = await tx.select().from(couples).where(eq(couples.inviteCode, inviteCode)).limit(1);
      if (couple.length === 0) throw new Error("Invalid invite code");
      
      const user = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0) throw new Error("User not found");
      
      const coupleData = couple[0];
      let role = "guest";
      
      // Try to atomically claim co_admin position if available
      if (!coupleData.coAdminId) {
        const updateResult = await tx.update(couples)
          .set({ coAdminId: userId })
          .where(and(
            eq(couples.id, coupleData.id),
            sql`${couples.coAdminId} IS NULL` // Additional guard against race condition
          ))
          .returning();
        
        // If update succeeded, user becomes co_admin
        if (updateResult.length > 0) {
          role = "co_admin";
        }
        // If update failed (0 rows affected), another user already claimed co_admin position
        // User will remain as guest
      }
      
      // Update user with couple info and role
      await tx.update(users)
        .set({ coupleId: coupleData.id, role })
        .where(eq(users.id, userId));
    });
  }

  async updateCoupleSettings(coupleId: string, settings: CoupleSettings): Promise<Couple> {
    const result = await db.update(couples)
      .set({ settings })
      .where(eq(couples.id, coupleId))
      .returning();
    
    if (result.length === 0) throw new Error("Couple not found");
    return result[0];
  }

  async getMemoriesForCouple(coupleId: string): Promise<Memory[]> {
    return db.select().from(memories)
      .where(eq(memories.coupleId, coupleId))
      .orderBy(desc(memories.createdAt));
  }

  async getMemory(id: string): Promise<Memory | undefined> {
    const result = await db.select().from(memories).where(eq(memories.id, id)).limit(1);
    return result[0];
  }

  async createMemory(insertMemory: InsertMemory): Promise<Memory> {
    const result = await db.insert(memories).values(insertMemory).returning();
    return result[0];
  }

  async updateMemory(id: string, updates: Partial<Memory>): Promise<Memory> {
    const result = await db.update(memories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(memories.id, id))
      .returning();
    
    if (result.length === 0) throw new Error("Memory not found");
    return result[0];
  }

  async deleteMemory(id: string): Promise<void> {
    await db.delete(memories).where(eq(memories.id, id));
  }

  async getCommentsForMemory(memoryId: string): Promise<Comment[]> {
    return db.select().from(comments)
      .where(eq(comments.memoryId, memoryId))
      .orderBy(asc(comments.createdAt));
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values(insertComment).returning();
    return result[0];
  }

  async getMessagesForCouple(coupleId: string): Promise<Message[]> {
    const now = new Date();
    return db.select().from(messages)
      .where(and(
        eq(messages.coupleId, coupleId),
        or(
          eq(messages.isEphemeral, false),
          isNull(messages.expiresAt),
          gt(messages.expiresAt, now)
        )
      ))
      .orderBy(asc(messages.createdAt));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(insertMessage).returning();
    return result[0];
  }

  async deleteExpiredMessages(): Promise<void> {
    const now = new Date();
    await db.delete(messages)
      .where(and(
        eq(messages.isEphemeral, true),
        lte(messages.expiresAt, now)
      ));
  }

  async getGamesForCouple(coupleId: string): Promise<Game[]> {
    return db.select().from(games)
      .where(eq(games.coupleId, coupleId))
      .orderBy(desc(games.createdAt));
  }

  async createGame(insertGame: InsertGame): Promise<Game> {
    const result = await db.insert(games).values(insertGame).returning();
    return result[0];
  }

  async updateGame(id: string, updates: Partial<Game>): Promise<Game> {
    const result = await db.update(games)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(games.id, id))
      .returning();
    
    if (result.length === 0) throw new Error("Game not found");
    return result[0];
  }

  async getCountersForCouple(coupleId: string): Promise<Counter[]> {
    return db.select().from(counters).where(eq(counters.coupleId, coupleId));
  }

  async createCounter(insertCounter: InsertCounter): Promise<Counter> {
    const result = await db.insert(counters).values(insertCounter).returning();
    return result[0];
  }

  async updateCounter(id: string, updates: Partial<Counter>): Promise<Counter> {
    const result = await db.update(counters)
      .set(updates)
      .where(eq(counters.id, id))
      .returning();
    
    if (result.length === 0) throw new Error("Counter not found");
    return result[0];
  }

  async getProfileStats(userId: string, coupleId: string): Promise<{
    memoriesCount: number;
    messagesCount: number;
    gamesCount: number;
    daysInCouple: number;
    placesVisited: number;
  }> {
    // Get user and couple info for calculations
  const _user = await this.getUser(userId);
    const couple = await this.getCoupleById(coupleId);
    
    // Count memories for this couple
    const memoriesResult = await db.select({ count: count() }).from(memories)
      .where(eq(memories.coupleId, coupleId));
    const memoriesCount = memoriesResult[0]?.count || 0;
    
    // Count messages sent by this user
    const messagesResult = await db.select({ count: count() }).from(messages)
      .where(eq(messages.senderId, userId));
    const messagesCount = messagesResult[0]?.count || 0;
    
    // Count active games for this couple
    const gamesResult = await db.select({ count: count() }).from(games)
      .where(and(eq(games.coupleId, coupleId), eq(games.isActive, true)));
    const gamesCount = gamesResult[0]?.count || 0;
    
    // Calculate days in couple (from couple creation date or user join date)
    let daysInCouple = 0;
    if (couple && couple.createdAt) {
      const coupleDate = new Date(couple.createdAt);
      const now = new Date();
      daysInCouple = Math.floor((now.getTime() - coupleDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    // Count unique places (distinct location tags, case-insensitive)
    const placesResult: any = await db.execute(sql`
      SELECT COUNT(DISTINCT LOWER(tag)) AS count
      FROM memories
      CROSS JOIN LATERAL unnest(memories.tags) AS tag
      WHERE memories.couple_id = ${coupleId}
        AND tag LIKE 'location:%'
    `);
    const placesVisited = Number(placesResult.rows?.[0]?.count || 0);
    
    return {
      memoriesCount: Number(memoriesCount),
      messagesCount: Number(messagesCount),
      gamesCount: Number(gamesCount),
      daysInCouple: Math.max(0, daysInCouple),
      placesVisited: Number(placesVisited),
    };
  }
}

export const storage =
  process.env.DATABASE_URL || process.env.NODE_ENV === 'production'
    ? new PgStorage()
    : new MemStorage();
