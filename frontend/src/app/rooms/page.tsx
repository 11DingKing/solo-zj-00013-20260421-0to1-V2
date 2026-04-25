'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Room, Booking, equipmentLabels } from '@/types';
import { Timeline } from '@/components/Timeline';

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const formatDateDisplay = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  };
  return date.toLocaleDateString('zh-CN', options);
};

const BookingModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  initialRoomId?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  onBookingCreated: () => void;
}> = ({
  isOpen,
  onClose,
  rooms,
  initialRoomId,
  initialStartTime,
  initialEndTime,
  onBookingCreated,
}) => {
  const [roomId, setRoomId] = useState(initialRoomId || '');
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(initialStartTime || '');
  const [endTime, setEndTime] = useState(initialEndTime || '');
  const [attendees, setAttendees] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialRoomId) setRoomId(initialRoomId);
    if (initialStartTime) setStartTime(initialStartTime);
    if (initialEndTime) setEndTime(initialEndTime);
  }, [initialRoomId, initialStartTime, initialEndTime]);

  const selectedRoom = rooms.find((r) => r.id === roomId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.createBooking({
        roomId,
        title,
        startTime,
        endTime,
        attendees,
      });
      onBookingCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || '预约失败');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">预约会议室</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label className="form-label">会议室</label>
              <select
                className="form-input"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
              >
                <option value="">请选择会议室</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} ({room.capacity}人)
                  </option>
                ))}
              </select>
              {selectedRoom && (
                <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#64748b' }}>
                  <span>{selectedRoom.floor}楼 | </span>
                  <span>容量: {selectedRoom.capacity}人 | </span>
                  <span>
                    设备: {selectedRoom.equipment.map((eq) => equipmentLabels[eq]).join('、')}
                  </span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">会议主题</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="请输入会议主题"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">开始时间</label>
              <input
                type="datetime-local"
                className="form-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">结束时间</label>
              <input
                type="datetime-local"
                className="form-input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">参会人数</label>
              <input
                type="number"
                className="form-input"
                value={attendees}
                onChange={(e) => setAttendees(parseInt(e.target.value) || 1)}
                min={1}
                max={selectedRoom?.capacity || 100}
                required
              />
              {selectedRoom && attendees > selectedRoom.capacity && (
                <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: 4 }}>
                  参会人数超过会议室容量（最大{selectedRoom.capacity}人）
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? '预约中...' : '确认预约'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const BookingDetailModal: React.FC<{
  booking: Booking | null;
  onClose: () => void;
  onCancel: () => void;
}> = ({ booking, onClose, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!booking) return null;

  const isPast = new Date(booking.startTime) <= new Date();

  const handleCancel = async () => {
    if (isPast) return;
    setError('');
    setLoading(true);

    try {
      await api.cancelBooking(booking.id);
      onCancel();
      onClose();
    } catch (err: any) {
      setError(err.message || '取消失败');
    } finally {
      setLoading(false);
    }
  };

  const startTime = new Date(booking.startTime);
  const endTime = new Date(booking.endTime);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">预约详情</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>
              {booking.title}
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.875rem' }}>
                会议室:
              </span>
              <span style={{ marginLeft: 8, color: '#1e293b' }}>
                {booking.room?.name || '-'}
              </span>
            </div>

            <div>
              <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.875rem' }}>
                时间:
              </span>
              <span style={{ marginLeft: 8, color: '#1e293b' }}>
                {startTime.getMonth() + 1}月{startTime.getDate()}日{' '}
                {startTime.getHours().toString().padStart(2, '0')}:
                {startTime.getMinutes().toString().padStart(2, '0')} -
                {endTime.getHours().toString().padStart(2, '0')}:
                {endTime.getMinutes().toString().padStart(2, '0')}
              </span>
            </div>

            <div>
              <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.875rem' }}>
                参会人数:
              </span>
              <span style={{ marginLeft: 8, color: '#1e293b' }}>
                {booking.attendees}人
              </span>
            </div>

            <div>
              <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.875rem' }}>
                预约人:
              </span>
              <span style={{ marginLeft: 8, color: '#1e293b' }}>
                {booking.user?.username || '-'}
              </span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            关闭
          </button>
          {!isPast && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleCancel}
              disabled={loading}
            >
              {loading ? '取消中...' : '取消预约'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date());
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
  const [selectedStartTime, setSelectedStartTime] = useState<string | undefined>();
  const [selectedEndTime, setSelectedEndTime] = useState<string | undefined>();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [roomsData, bookingsData] = await Promise.all([
        api.getRooms(),
        api.getBookings(formatDate(date)),
      ]);
      setRooms(roomsData);
      setBookings(bookingsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [date, user, fetchData]);

  const handleSlotClick = (roomId: string, startTime: string, endTime: string) => {
    setSelectedRoomId(roomId);
    setSelectedStartTime(startTime);
    setSelectedEndTime(endTime);
    setBookingModalOpen(true);
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
  };

  const goToPrevDay = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() - 1);
    setDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 1);
    setDate(newDate);
  };

  const goToToday = () => {
    setDate(new Date());
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">会议室预约</h1>
        <div className="date-picker">
          <button className="date-picker-btn" onClick={goToPrevDay}>
            ← 前一天
          </button>
          <button className="date-picker-btn" onClick={goToToday}>
            今天
          </button>
          <button className="date-picker-btn" onClick={goToNextDay}>
            后一天 →
          </button>
          <input
            type="date"
            className="date-picker-input"
            value={formatDate(date)}
            onChange={(e) => setDate(new Date(e.target.value))}
          />
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
            {formatDateDisplay(date)}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏢</div>
          <div className="empty-state-text">暂无会议室</div>
          <div className="empty-state-hint">请联系管理员添加会议室</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <Timeline
            rooms={rooms}
            bookings={bookings}
            date={formatDate(date)}
            onSlotClick={handleSlotClick}
            onBookingClick={handleBookingClick}
          />
        </div>
      )}

      <div
        style={{
          marginTop: 24,
          display: 'flex',
          gap: 24,
          fontSize: '0.875rem',
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 20,
              height: 20,
              backgroundColor: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: 4,
            }}
          />
          <span>他人预约</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 20,
              height: 20,
              backgroundColor: '#dcfce7',
              border: '1px solid #86efac',
              borderRadius: 4,
            }}
          />
          <span>我的预约</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>点击时间轴空白区域可创建预约</span>
        </div>
      </div>

      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        rooms={rooms}
        initialRoomId={selectedRoomId}
        initialStartTime={selectedStartTime}
        initialEndTime={selectedEndTime}
        onBookingCreated={fetchData}
      />

      <BookingDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onCancel={fetchData}
      />
    </div>
  );
}
