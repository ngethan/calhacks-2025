import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";

export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ChatSession = {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

type ChatState = {
  sessions: ChatSession[];
  activeSessionId: string | null;

  // Actions
  createSession: (name?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateLastMessage: (sessionId: string, content: string) => void;
  clearSession: (sessionId: string) => void;
};

export const useChatStore = create<ChatState>()(
  persist(
    immer((set, get) => ({
      sessions: [],
      activeSessionId: null,

      createSession: (name?: string) => {
        const id = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();

        // Generate chat number based on existing sessions
        const chatNumber = get().sessions.length + 1;
        const sessionName = name || `Chat ${chatNumber}`;

        set((state) => {
          state.sessions.push({
            id,
            name: sessionName,
            messages: [],
            createdAt: now,
            updatedAt: now,
          });
          state.activeSessionId = id;
        });

        return id;
      },

      deleteSession: (id: string) => {
        set((state) => {
          const index = state.sessions.findIndex((s) => s.id === id);
          if (index !== -1) {
            state.sessions.splice(index, 1);

            // If we deleted the active session, switch to another one
            if (state.activeSessionId === id) {
              state.activeSessionId = state.sessions.length > 0 ? state.sessions[0]!.id : null;
            }
          }
        });
      },

      setActiveSession: (id: string) => {
        set((state) => {
          state.activeSessionId = id;
        });
      },

      renameSession: (id: string, name: string) => {
        set((state) => {
          const session = state.sessions.find((s) => s.id === id);
          if (session) {
            session.name = name;
            session.updatedAt = Date.now();
          }
        });
      },

      addMessage: (sessionId: string, message: Message) => {
        set((state) => {
          const session = state.sessions.find((s) => s.id === sessionId);
          if (session) {
            session.messages.push(message);
            session.updatedAt = Date.now();
          }
        });
      },

      updateLastMessage: (sessionId: string, content: string) => {
        set((state) => {
          const session = state.sessions.find((s) => s.id === sessionId);
          if (session && session.messages.length > 0) {
            const lastMessage = session.messages[session.messages.length - 1];
            if (lastMessage) {
              lastMessage.content = content;
              session.updatedAt = Date.now();
            }
          }
        });
      },

      clearSession: (sessionId: string) => {
        set((state) => {
          const session = state.sessions.find((s) => s.id === sessionId);
          if (session) {
            session.messages = [];
            session.updatedAt = Date.now();
          }
        });
      },
    })),
    {
      name: "chat-sessions-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
