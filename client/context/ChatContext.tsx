/**
 * Chat Context
 * Manages chat messages between users and admin support
 * Uses server-side storage for real-time sync between users and admin
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthContext";
import { fetchApi } from "@/lib/api";

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
  sender: "user" | "admin" | "delivery";
  timestamp: string;
  read: boolean;
  attachments?: ChatAttachment[];
  orderId?: string | null;
}

export interface UserChat {
  userId: string;
  userName: string;
  userEmail: string;
  messages: ChatMessage[];
  lastMessageAt: string;
  unreadCount: number;
  orderId?: string | null;
}

interface ChatContextType {
  // For users
  userMessages: ChatMessage[];
  sendUserMessage: (userId: string, userName: string, userEmail: string, text: string, attachments?: ChatAttachment[], orderId?: string, senderType?: "user" | "delivery") => void;
  markUserMessagesAsRead: (userId: string, orderId?: string) => void;
  userUnreadCount: number;
  loadUserMessages: (userId: string, orderId?: string) => Promise<void>;

  // For admin
  allChats: UserChat[];
  sendAdminMessage: (userId: string, text: string, attachments?: ChatAttachment[], orderId?: string) => void;
  markAdminMessagesAsRead: (userId: string, orderId?: string) => void;
  totalUnreadForAdmin: number;
  getUnreadCountForUser: (userId: string, orderId?: string) => number;
  refreshChats: (orderId?: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Convert API message to ChatMessage format
const apiToMessage = (msg: any): ChatMessage => {
  let attachments = msg.attachments;
  if (typeof attachments === 'string') {
    try {
      attachments = JSON.parse(attachments);
    } catch (e) {
      attachments = [];
    }
  }

  return {
    id: msg.id,
    text: msg.text,
    sender: msg.sender,
    timestamp: msg.createdAt,
    read: msg.sender === 'admin' ? msg.readByUser : (msg.sender === 'delivery' ? msg.readByUser : msg.readByAdmin),
    attachments: Array.isArray(attachments) ? attachments : [],
    orderId: msg.orderId || null,
  };
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allChats, setAllChats] = useState<UserChat[]>([]);
  const [userMessages, setUserMessages] = useState<ChatMessage[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all chats for admin
  const refreshChats = useCallback(async (orderId?: string) => {
    try {
      const query = orderId ? `?orderId=${orderId}` : '';
      const data = await fetchApi<any[]>(`/chat/all${query}`);
      // Reduced logging - only log on errors or first fetch
      if (data.success && data.data) {
        const chats: UserChat[] = data.data.map((chat: any) => ({
          userId: chat.userId,
          userName: chat.userName,
          userEmail: chat.userEmail,
          messages: chat.messages.map(apiToMessage),
          lastMessageAt: chat.lastMessageAt,
          unreadCount: chat.unreadCount,
          orderId: chat.orderId,
        }));
        setAllChats(chats);
      }
    } catch (err) {
      console.error('[Chat Admin] Failed to fetch chats:', err);
    }
  }, []);

  // Fetch messages for a specific user
  const loadUserMessages = useCallback(async (userId: string, orderId?: string) => {
    setCurrentUserId(userId);
    setCurrentOrderId(orderId || null);
    try {
      const query = orderId ? `?orderId=${orderId}` : '';
      const data = await fetchApi<any[]>(`/chat/${userId}${query}`);
      if (data.success && data.data) {
        const messages = data.data.map(apiToMessage);
        setUserMessages(messages);
      }
    } catch (err) {
      console.error('Failed to fetch user messages:', err);
    }
  }, []);

  // Determine if user is admin
  const { isAdmin: authIsAdmin, isLoggedIn } = useAuth();

  // Poll for updates every 15 seconds (reduced from 5 to minimize API calls)
  useEffect(() => {
    // Both admin and current user should poll if logged in
    if (!isLoggedIn) return;

    // Use a ref to track if we've already fetched to avoid duplicates on re-render
    let isMounted = true;

    // Initial fetch
    const doInitialFetch = async () => {
      if (authIsAdmin && isMounted) {
        await refreshChats();
      }
      if (currentUserId && isMounted) {
        await loadUserMessages(currentUserId);
      }
    };
    doInitialFetch();

    const interval = setInterval(() => {
      if (!isMounted) return;
      if (authIsAdmin) {
        refreshChats();
      }
      if (currentUserId) {
        loadUserMessages(currentUserId);
      }
    }, 15000); // Increased to 15 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshChats, loadUserMessages, currentUserId, authIsAdmin, isLoggedIn]);

  // Send message from user to admin
  const sendUserMessage = useCallback(async (userId: string, userName: string, userEmail: string, text: string, attachments?: ChatAttachment[], orderId?: string, senderType: "user" | "delivery" = "user") => {
    try {
      // Optimistically add to local state
      const tempMessage: ChatMessage = {
        id: `temp_${Date.now()}`,
        text,
        sender: senderType,
        timestamp: new Date().toISOString(),
        read: false,
        attachments,
        orderId
      };
      setUserMessages(prev => [...prev, tempMessage]);

      // Send to API
      console.log('[Chat] Sending message to API:', { userId, userName, text: text.substring(0, 50), orderId, senderType });
      const data = await fetchApi<any>('/chat/send', {
        method: 'POST',
        body: JSON.stringify({ userId, userName, userEmail, text, sender: senderType, attachments, orderId }),
      });

      if (data.success) {
        // Notify admin
        fetchApi('/chat/notify-admin', {
          method: 'POST',
          body: JSON.stringify({
            userId,
            userName,
            message: text,
            orderId,
            hasAttachments: attachments && attachments.length > 0
          }),
        }).catch(() => { });

        // If a driver sent this message, also notify the customer
        if (senderType === 'delivery') {
          fetchApi('/chat/notify-user', {
            method: 'POST',
            body: JSON.stringify({
              userId,
              message: text,
              orderId,
              hasAttachments: attachments && attachments.length > 0
            }),
          }).catch(() => { });
        }

        // Refresh to get the real message
        loadUserMessages(userId, orderId);
      }
    } catch (err) {
      console.error('[Chat] Failed to send message:', err);
    }
  }, [loadUserMessages]);

  // Send message from admin to user
  const sendAdminMessage = useCallback(async (userId: string, text: string, attachments?: ChatAttachment[], orderId?: string) => {
    try {
      const chat = allChats.find(c => c.userId === userId && (!orderId || c.orderId === orderId));

      // Send to API
      const data = await fetchApi<any>('/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          userName: chat?.userName || 'Customer',
          userEmail: chat?.userEmail || '',
          text,
          sender: 'admin',
          attachments,
          orderId
        }),
      });

      if (data.success) {
        // Notify user
        fetchApi('/chat/notify-user', {
          method: 'POST',
          body: JSON.stringify({
            userId,
            message: text,
            orderId,
            hasAttachments: attachments && attachments.length > 0
          }),
        }).catch(() => { });

        // Refresh chats
        refreshChats(orderId);
      }
    } catch (err) {
      console.error('Failed to send admin message:', err);
    }
  }, [allChats, refreshChats]);

  // Mark all admin/driver messages as read by user
  const markUserMessagesAsRead = useCallback(async (userId: string, orderId?: string) => {
    try {
      await fetchApi(`/chat/${userId}/read-user`, {
        method: 'POST',
        body: JSON.stringify({ orderId })
      });
      // Update local state
      setUserMessages(prev => prev.map(msg =>
        (msg.sender === 'admin' || msg.sender === 'delivery') ? { ...msg, read: true } : msg
      ));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  // Mark all user messages as read by admin
  const markAdminMessagesAsRead = useCallback(async (userId: string, orderId?: string) => {
    try {
      await fetchApi(`/chat/${userId}/read-admin`, {
        method: 'POST',
        body: JSON.stringify({ orderId })
      });
      // Update local state
      setAllChats(prev => prev.map(chat =>
        chat.userId === userId && (!orderId || chat.orderId === orderId)
          ? { ...chat, unreadCount: 0, messages: chat.messages.map(m => ({ ...m, read: true })) }
          : chat
      ));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  // Get unread count for user (messages from admin that user hasn't read)
  const getUnreadCountForUser = useCallback((userId: string): number => {
    const chat = allChats.find(c => c.userId === userId);
    if (!chat) return 0;
    return chat.messages.filter(m => m.sender === "admin" && !m.read).length;
  }, [allChats]);

  // Total unread for admin (all unread messages from all users)
  const totalUnreadForAdmin = allChats.reduce((sum, chat) => sum + chat.unreadCount, 0);

  // Unread count for current user
  const userUnreadCount = userMessages.filter(m => m.sender === 'admin' && !m.read).length;

  return (
    <ChatContext.Provider
      value={{
        userMessages,
        sendUserMessage,
        markUserMessagesAsRead,
        userUnreadCount,
        loadUserMessages,
        allChats,
        sendAdminMessage,
        markAdminMessagesAsRead,
        totalUnreadForAdmin,
        getUnreadCountForUser,
        refreshChats,
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
  const { userMessages, sendUserMessage, markUserMessagesAsRead, loadUserMessages, userUnreadCount } = useChat();

  // Load messages when userId changes
  useEffect(() => {
    if (userId) {
      loadUserMessages(userId);
    }
  }, [userId, loadUserMessages]);

  // Use userUnreadCount from context (computed from userMessages) instead of getUnreadCountForUser
  // which relies on allChats that is only populated for admin
  const unreadCount = userId ? userUnreadCount : 0;

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
    messages: userMessages,
    unreadCount,
    sendMessage,
    markAsRead,
  };
};

// Hook for admin chat management
export const useAdminChat = () => {
  const {
    allChats,
    sendAdminMessage,
    markAdminMessagesAsRead,
    totalUnreadForAdmin,
    refreshChats,
    userMessages,
    loadUserMessages
  } = useChat();

  // Sort chats by last message time (newest first)
  const sortedChats = [...allChats].sort(
    (a, b) => (new Date(b.lastMessageAt).getTime() || 0) - (new Date(a.lastMessageAt).getTime() || 0)
  );

  return {
    chats: sortedChats,
    sendMessage: sendAdminMessage,
    markAsRead: markAdminMessagesAsRead,
    totalUnread: totalUnreadForAdmin,
    refresh: refreshChats,
    userMessages,
    loadUserMessages
  };
};

// Hook for order-specific chat (Customer <-> Driver/Admin)
export const useOrderChat = (orderId: string | undefined, userId: string | undefined, senderType: "user" | "delivery" = "user") => {
  const { userMessages, sendUserMessage, markUserMessagesAsRead, loadUserMessages, userUnreadCount } = useChat();

  const loadMessages = useCallback(() => {
    if (userId && orderId) {
      loadUserMessages(userId, orderId);
    }
  }, [userId, orderId, loadUserMessages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const sendMessage = useCallback((userName: string, userEmail: string, text: string, attachments?: ChatAttachment[]) => {
    if (userId && orderId) {
      sendUserMessage(userId, userName, userEmail, text, attachments, orderId, senderType);
    }
  }, [userId, orderId, sendUserMessage, senderType]);

  const markAsRead = useCallback(() => {
    if (userId && orderId) {
      markUserMessagesAsRead(userId, orderId);
    }
  }, [userId, orderId, markUserMessagesAsRead]);

  return {
    messages: userMessages.filter(m => m.orderId === orderId),
    unreadCount: userMessages.filter(m => m.orderId === orderId && (senderType === 'user' ? (m.sender === 'admin' || m.sender === 'delivery') : m.sender === 'user') && !m.read).length,
    sendMessage,
    markAsRead,
    refresh: loadMessages
  };
};

// Hook for driver chat management
export const useDriverChat = (driverId: string | undefined) => {
  const { userMessages, sendUserMessage, markUserMessagesAsRead, loadUserMessages, userUnreadCount, refreshChats, allChats } = useChat();

  // Drivers act like "mini-admins" for their assigned orders
  // or they just chat as 'delivery' sender in a user's thread

  const sendMessage = useCallback(async (userId: string, userName: string, userEmail: string, text: string, orderId: string, attachments?: ChatAttachment[]) => {
    try {
      // Send as 'delivery'
      await fetchApi('/chat/send', {
        method: 'POST',
        body: JSON.stringify({ userId, userName, userEmail, text, sender: 'delivery', attachments, orderId }),
      });

      // Notify user
      fetchApi('/chat/notify-user', {
        method: 'POST',
        body: JSON.stringify({ userId, message: text, orderId, hasAttachments: attachments && attachments.length > 0 }),
      }).catch(() => { });

      if (userId === userId) { // current focused user
        loadUserMessages(userId, orderId);
      }
    } catch (err) {
      console.error('Driver failed to send message:', err);
    }
  }, [loadUserMessages]);

  return {
    sendMessage,
    loadUserMessages,
    refreshChats,
    allChats
  };
};
