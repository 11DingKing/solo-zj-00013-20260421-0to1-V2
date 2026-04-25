import { LoginResponse, Room, Booking, RecurrenceRule, ConflictResponse } from '@/types';

const API_BASE = '/api';

export class ApiError extends Error {
  public readonly status: number;
  public readonly response: any;

  constructor(message: string, status: number, response: any = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }

  isConflict(): this is ApiError & { response: ConflictResponse } {
    return this.status === 409 && this.response?.conflict !== undefined;
  }
}

export interface CreateBookingRequest {
  roomId: string;
  title: string;
  startTime: string;
  endTime: string;
  attendees: number;
  recurrenceRule?: RecurrenceRule;
}

export interface CreateBookingResponse {
  bookings: Booking[];
  count: number;
  recurrenceRule: RecurrenceRule;
}

class ApiClient {
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.error || `请求失败: ${response.status}`,
        response.status,
        errorData
      );
    }

    if (response.status === 204) {
      return null as T;
    }

    return response.json();
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async getRooms(): Promise<Room[]> {
    return this.request<Room[]>('/rooms');
  }

  async getRoom(id: string): Promise<Room> {
    return this.request<Room>(`/rooms/${id}`);
  }

  async createRoom(data: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>): Promise<Room> {
    return this.request<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRoom(id: string, data: Partial<Omit<Room, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Room> {
    return this.request<Room>(`/rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteRoom(id: string): Promise<void> {
    return this.request<void>(`/rooms/${id}`, {
      method: 'DELETE',
    });
  }

  async getBookings(date: string, roomId?: string): Promise<Booking[]> {
    const params = new URLSearchParams({ date });
    if (roomId) params.append('roomId', roomId);
    return this.request<Booking[]>(`/bookings/by-date?${params.toString()}`);
  }

  async getBookingsByWeek(weekStart: string, roomId?: string): Promise<Booking[]> {
    const params = new URLSearchParams({ weekStart });
    if (roomId) params.append('roomId', roomId);
    return this.request<Booking[]>(`/bookings/by-week?${params.toString()}`);
  }

  async getMyBookings(): Promise<Booking[]> {
    return this.request<Booking[]>('/bookings/my');
  }

  async createBooking(data: CreateBookingRequest): Promise<CreateBookingResponse> {
    return this.request<CreateBookingResponse>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelBooking(id: string): Promise<void> {
    return this.request<void>(`/bookings/${id}`, {
      method: 'DELETE',
    });
  }

  async getBooking(id: string): Promise<Booking> {
    return this.request<Booking>(`/bookings/${id}`);
  }
}

export const api = new ApiClient();
