export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum Equipment {
  PROJECTOR = 'PROJECTOR',
  WHITEBOARD = 'WHITEBOARD',
  VIDEO_CONFERENCE = 'VIDEO_CONFERENCE',
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  floor: number;
  equipment: Equipment[];
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  title: string;
  startTime: string;
  endTime: string;
  attendees: number;
  room: Room;
  user?: {
    id: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export const equipmentLabels: Record<Equipment, string> = {
  [Equipment.PROJECTOR]: '投影仪',
  [Equipment.WHITEBOARD]: '白板',
  [Equipment.VIDEO_CONFERENCE]: '视频会议',
};

export const isAdmin = (user: User | null): boolean => {
  return user?.role === UserRole.ADMIN;
};
