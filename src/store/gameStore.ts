import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Player {
  id: string;
  name: string;
  score: number;
  room_id?: string;
  stats?: {
    totalPoints: number;
    correctAnswers: number;
    totalAnswers: number;
    averageResponseTimeMs: number;
  };
}

interface GameState {
  players: Player[];
  isLiveMode: boolean;
  currentActivation: string | null;
  currentPlayerId: string | null;
  currentRoomId: string | null;
  setPlayers: (players: Player[]) => void;
  setLiveMode: (isLive: boolean) => void;
  setCurrentActivation: (activation: string | null) => void;
  setCurrentPlayerId: (playerId: string | null) => void;
  setCurrentRoomId: (roomId: string | null) => void;
  addPlayer: (player: Player) => void;
  updatePlayerScore: (playerId: string, score: number) => void;
  getCurrentPlayer: () => Player | undefined;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      players: [],
      isLiveMode: true,
      currentActivation: null,
      currentPlayerId: null,
      currentRoomId: null,
      setPlayers: (players) => set({ players }),
      setLiveMode: (isLive) => set({ isLiveMode: isLive }),
      setCurrentActivation: (activation) => set({ currentActivation: activation }),
      setCurrentPlayerId: (playerId) => set({ currentPlayerId: playerId }),
      setCurrentRoomId: (roomId) => set({ currentRoomId: roomId }),
      addPlayer: (player) => set((state) => {
        // Check if player already exists
        const playerExists = state.players.some(p => p.id === player.id);
        if (playerExists) {
          // Update the existing player instead of adding a new one
          return { 
            players: state.players.map(p => 
              p.id === player.id ? player : p
            ) 
          };
        }
        
        // Initialize stats if they don't exist
        const playerWithStats = {
          ...player,
          stats: player.stats || {
            totalPoints: 0,
            correctAnswers: 0,
            totalAnswers: 0,
            averageResponseTimeMs: 0
          }
        };
        
        return { players: [...state.players, playerWithStats] };
      }),
      updatePlayerScore: (playerId, score) =>
        set((state) => ({
          players: state.players.map((p) =>
            p.id === playerId ? { ...p, score } : p
          ),
        })),
      getCurrentPlayer: () => {
        const { players, currentPlayerId } = get();
        return players.find(player => player.id === currentPlayerId);
      }
    }),
    {
      name: 'game-storage',
      partialize: (state) => ({
        currentPlayerId: state.currentPlayerId,
        currentRoomId: state.currentRoomId
      }),
    }
  )
);