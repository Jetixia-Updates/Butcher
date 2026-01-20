/**
 * Chat Context
 * Manages chat messages between users and admin support
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface ChatAttachment {
  id: string;
  name: string;
  type: string; // MIME type
  size: number;
  url: string; // Base64 data URL or blob URL
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "admin";
  timestamp: string;
  read: boolean;
  attachments?: ChatAttachment[];
}

export interface UserChat {
  userId: string;
  userName: string;
  userEmail: string;
  messages: ChatMessage[];
  lastMessageAt: string;
  unreadCount: number;
}

interface ChatContextType {
  // For users
  userMessages: ChatMessage[];
  sendUserMessage: (userId: string, userName: string, userEmail: string, text: string, attachments?: ChatAttachment[]) => void;
  markUserMessagesAsRead: (userId: string) => void;
  userUnreadCount: number;
  
  // For admin
  allChats: UserChat[];
  sendAdminMessage: (userId: string, text: string, attachments?: ChatAttachment[]) => void;
  markAdminMessagesAsRead: (userId: string) => void;
  totalUnreadForAdmin: number;
  getUnreadCountForUser: (userId: string) => number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_KEY = "butcher_chat_messages";

// Helper to generate unique ID
const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allChats, setAllChats] = useState<UserChat[]>([]);

  // Load chats from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserChat[];
        setAllChats(parsed);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save to localStorage whenever chats change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allChats));
    } catch {
      // Ignore storage errors
    }
  }, [allChats]);

  // Get messages for a specific user
  const getUserChat = useCallback((userId: string): UserChat | undefined => {
    return allChats.find(chat => chat.userId === userId);
  }, [allChats]);

  // Send message from user to admin
  const sendUserMessage = useCallback((userId: string, userName: string, userEmail: string, text: string, attachments?: ChatAttachment[]) => {
    const newMessage: ChatMessage = {
      id: generateId(),
      text,
      sender: "user",
      timestamp: new Date().toISOString(),
      read: false, // Admin hasn't read it yet
      attachments,
    };

    setAllChats(prev => {
      const existingChatIndex = prev.findIndex(chat => chat.userId === userId);
      
      if (existingChatIndex >= 0) {
        // Update existing chat
        const updated = [...prev];
        updated[existingChatIndex] = {
          ...updated[existingChatIndex],
          messages: [...updated[existingChatIndex].messages, newMessage],
          lastMessageAt: newMessage.timestamp,
          unreadCount: updated[existingChatIndex].unreadCount + 1,
        };
        return updated;
      } else {
        // Create new chat
        return [...prev, {
          userId,
          userName,
          userEmail,
          messages: [newMessage],
          lastMessageAt: newMessage.timestamp,
          unreadCount: 1,
        }];
      }
    });

    // Notify admin via API (fire and forget)
    fetch('/api/chat/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName, message: text }),
    }).catch(() => {
      // Ignore errors - notification is best-effort
    });
  }, []);

  // Send message from admin to user
  const sendAdminMessage = useCallback((userId: string, text: string, attachments?: ChatAttachment[]) => {
    const newMessage: ChatMessage = {
      id: generateId(),
      text,
      sender: "admin",
      timestamp: new Date().toISOString(),
      read: false, // User hasn't read it yet
      attachments,
    };

    setAllChats(prev => {
      const existingChatIndex = prev.findIndex(chat => chat.userId === userId);
      
      if (existingChatIndex >= 0) {
        const updated = [...prev];
        updated[existingChatIndex] = {
          ...updated[existingChatIndex],
          messages: [...updated[existingChatIndex].messages, newMessage],
          lastMessageAt: newMessage.timestamp,
        };
        return updated;
      }
      return prev;
    });

    // Notify user via API (fire and forget)
    fetch('/api/chat/notify-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message: text }),
    }).catch(() => {
      // Ignore errors - notification is best-effort
    });
  }, []);

  // Mark all admin messages as read (called by user when they open chat)
  const markUserMessagesAsRead = useCallback((userId: string) => {
    setAllChats(prev => {
      const chatIndex = prev.findIndex(chat => chat.userId === userId);
      if (chatIndex >= 0) {
        const updated = [...prev];
        updated[chatIndex] = {
          ...updated[chatIndex],
          messages: updated[chatIndex].messages.map(msg => 
            msg.sender === "admin" ? { ...msg, read: true } : msg
          ),
        };
        return updated;
      }
      return prev;
    });
  }, []);

  // Mark all user messages as read (called by admin when they open a chat)
  const markAdminMessagesAsRead = useCallback((userId: string) => {
    setAllChats(prev => {
      const chatIndex = prev.findIndex(chat => chat.userId === userId);
      if (chatIndex >= 0) {
        const updated = [...prev];
        updated[chatIndex] = {
          ...updated[chatIndex],
          messages: updated[chatIndex].messages.map(msg => 
            msg.sender === "user" ? { ...msg, read: true } : msg
          ),
          unreadCount: 0,
        };
        return updated;
      }
      return prev;
    });
  }, []);

  // Get user messages (for user view)
  const getUserMessages = useCallback((userId: string): ChatMessage[] => {
    const chat = allChats.find(c => c.userId === userId);
    return chat?.messages || [];
  }, [allChats]);

  // Get unread count for user (messages from admin that user hasn't read)
  const getUnreadCountForUser = useCallback((userId: string): number => {
    const chat = allChats.find(c => c.userId === userId);
    if (!chat) return 0;
    return chat.messages.filter(m => m.sender === "admin" && !m.read).length;
  }, [allChats]);

  // Total unread for admin (all unread messages from all users)
  const totalUnreadForAdmin = allChats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  // Create a userMessages getter that can be used with a userId
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const userMessages = currentUserId ? getUserMessages(currentUserId) : [];
  const userUnreadCount = currentUserId ? getUnreadCountForUser(currentUserId) : 0;

  return (
    <ChatContext.Provider
      value={{
        userMessages,
        sendUserMessage,
        markUserMessagesAsRead,
        userUnreadCount,
        allChats,
        sendAdminMessage,
        markAdminMessagesAsRead,
        totalUnreadForAdmin,
        getUnreadCountForUser,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

// Hook for user-specific chat
export const useUserChat = (userId: string | undefined) => {
  const { allChats, sendUserMessage, markUserMessagesAsRead, getUnreadCountForUser } = useChat();
  
  const chat = allChats.find(c => c.userId === userId);
  const messages = chat?.messages || [];
  const unreadCount = userId ? getUnreadCountForUser(userId) : 0;

  const sendMessage = useCallback((userName: string, userEmail: string, text: string, attachments?: ChatAttachment[]) => {
    if (userId) {
      sendUserMessage(userId, userName, userEmail, text, attachments);
    }
  }, [userId, sendUserMessage]);

  const markAsRead = useCallback(() => {
    if (userId) {
      markUserMessagesAsRead(userId);
    }
  }, [userId, markUserMessagesAsRead]);

  return {
    messages,
    unreadCount,
    sendMessage,
    markAsRead,
  };
};

// Hook for admin chat management
export const useAdminChat = () => {
  const { allChats, sendAdminMessage, markAdminMessagesAsRead, totalUnreadForAdmin } = useChat();

  // Sort chats by last message time (newest first)
  const sortedChats = [...allChats].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );

  return {
    chats: sortedChats,
    sendMessage: sendAdminMessage,
    markAsRead: markAdminMessagesAsRead,
    totalUnread: totalUnreadForAdmin,
  };
};
