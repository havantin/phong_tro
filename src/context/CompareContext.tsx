import React, { createContext, useContext, useState, useEffect } from 'react';
import { Room } from '../types';

interface CompareContextType {
  compareRooms: Room[];
  addToCompare: (room: Room) => boolean;
  removeFromCompare: (roomId: string) => void;
  isInCompare: (roomId: string) => boolean;
  clearCompare: () => void;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export const CompareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [compareRooms, setCompareRooms] = useState<Room[]>(() => {
    try {
      const saved = localStorage.getItem('phongtro_tn_compare');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('phongtro_tn_compare', JSON.stringify(compareRooms));
  }, [compareRooms]);

  const addToCompare = (room: Room): boolean => {
    if (compareRooms.length >= 3) {
      alert('Bạn chỉ có thể so sánh tối đa 3 phòng trọ cùng lúc!');
      return false;
    }
    if (!compareRooms.some((r) => r.id === room.id)) {
      setCompareRooms([...compareRooms, room]);
      return true;
    }
    return false;
  };

  const removeFromCompare = (roomId: string) => {
    setCompareRooms(compareRooms.filter((r) => r.id !== roomId));
  };

  const isInCompare = (roomId: string) => {
    return compareRooms.some((r) => r.id === roomId);
  };

  const clearCompare = () => {
    setCompareRooms([]);
  };

  return (
    <CompareContext.Provider
      value={{
        compareRooms,
        addToCompare,
        removeFromCompare,
        isInCompare,
        clearCompare,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
};

export function useCompare() {
  const context = useContext(CompareContext);
  if (!context) {
    throw new Error('useCompare must be used within CompareProvider');
  }
  return context;
}
