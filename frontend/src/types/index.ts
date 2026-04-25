export enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

export enum Equipment {
  PROJECTOR = "PROJECTOR",
  WHITEBOARD = "WHITEBOARD",
  VIDEO_CONFERENCE = "VIDEO_CONFERENCE",
}

export enum RecurrenceRule {
  NONE = "NONE",
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
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
  availableStartTime: string;
  availableEndTime: string;
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
  recurrenceRule: RecurrenceRule;
  recurrenceGroupId?: string;
  room: Room;
  user?: {
    id: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ConflictInfo {
  title: string;
  username: string;
  startTime: string;
  endTime: string;
}

export interface ConflictResponse {
  error: string;
  conflict: {
    date: string;
    title: string;
    username: string;
    startTime: string;
    endTime: string;
  };
  allConflicts: Array<{
    date: string;
    conflicts: ConflictInfo[];
  }>;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export const equipmentLabels: Record<Equipment, string> = {
  [Equipment.PROJECTOR]: "投影仪",
  [Equipment.WHITEBOARD]: "白板",
  [Equipment.VIDEO_CONFERENCE]: "视频会议",
};

export const recurrenceRuleLabels: Record<RecurrenceRule, string> = {
  [RecurrenceRule.NONE]: "不重复",
  [RecurrenceRule.DAILY]: "每天",
  [RecurrenceRule.WEEKLY]: "每周",
  [RecurrenceRule.MONTHLY]: "每月",
};

export const isAdmin = (user: User | null): boolean => {
  return user?.role === UserRole.ADMIN;
};
