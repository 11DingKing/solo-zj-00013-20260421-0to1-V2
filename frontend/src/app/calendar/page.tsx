'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api, CreateBookingRequest } from '@/lib/api';
import { Room, Booking, RecurrenceRule, recurrenceRuleLabels, isAdmin } from '@/types';

const START_HOUR = 8;
const END_HOUR = 18;
const TOTAL_SLOTS = (END_HOUR - START_HOUR) * 2;

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五'];

const userColors = [
  { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
  { bg: '#dcfce7', border: '#86efac', text: '#166534' },
  { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' },
  { bg: '#fce7f3', border: '#f9a8d4', text: '#9f1239' },
  { bg: '#e0e7ff', border: '#a5b4fc', text: '#3730a3' },
  { bg: '#fed7aa', border: '#fdba74', text: '#9a3412' },
];

const formatTime = (slotIndex: number): string => {
  const hour = START_HOUR + Math.floor(slotIndex / 2);
  const minute = (slotIndex % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getDateForDay = (weekStart: Date, dayIndex: number): Date => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  return d;
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const formatDateDisplay = (date: Date): string => {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
};

const formatDateTimeInput = (date: Date, hour: number, minute: number): string => {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString().slice(0, 16);
};

const getUserColor = (userId: string, index: number): typeof userColors[0] => {
  return userColors[index % userColors.length];
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
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(RecurrenceRule.NONE);
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
      const request: CreateBookingRequest = {
        roomId,
        title,
        startTime,
        endTime,
        attendees,
        recurrenceRule,
      };

      const response = await api.createBooking(request);
      
      if (response.count > 1) {
        alert(`成功创建 ${response.count} 个重复预约`);
      }
      
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
                  <span>可用时间: {selectedRoom.availableStartTime} - {selectedRoom.availableEndTime}</span>
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
            </div>

            <div className="form-group">
              <label className="form-label">重复规则</label>
              <select
                className="form-input"
                value={recurrenceRule}
                onChange={(e) => setRecurrenceRule(e.target.value as RecurrenceRule)}
              >
                {Object.entries(recurrenceRuleLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {recurrenceRule !== RecurrenceRule.NONE && (
                <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#64748b' }}>
                  将自动生成未来4周的预约记录
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
  const now = new Date();
  const thirtyMinutesBefore = new Date(new Date(booking.startTime).getTime() - 30 * 60 * 1000);
  const canCancel = now < thirtyMinutesBefore;

  const handleCancel = async () => {
    if (isPast || !canCancel) return;
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

            {booking.recurrenceRule !== RecurrenceRule.NONE && (
              <div>
                <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.875rem' }}>
                  重复规则:
                </span>
                <span style={{ marginLeft: 8, color: '#1e293b' }}>
                  {recurrenceRuleLabels[booking.recurrenceRule]}
                </span>
              </div>
            )}
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
              disabled={loading || !canCancel}
            >
              {loading ? '取消中...' : canCancel ? '取消预约' : '开始前30分钟内不可取消'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function CalendarPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
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

  const weekDates = useMemo(() => {
    return DAY_NAMES.map((_, index) => getDateForDay(weekStart, index));
  }, [weekStart]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const weekStartStr = formatDate(weekStart);
      const [roomsData, bookingsData] = await Promise.all([
        api.getRooms(),
        api.getBookingsByWeek(weekStartStr),
      ]);
      setRooms(roomsData);
      setBookings(bookingsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [weekStart, user, fetchData]);

  const bookingsByRoomAndDay = useMemo(() => {
    const map: Record<string, Record<string, Booking[]>> = {};
    
    for (const booking of bookings) {
      if (!map[booking.roomId]) {
        map[booking.roomId] = {};
      }
      const bookingDate = formatDate(new Date(booking.startTime));
      if (!map[booking.roomId][bookingDate]) {
        map[booking.roomId][bookingDate] = [];
      }
      map[booking.roomId][bookingDate].push(booking);
    }
    
    return map;
  }, [bookings]);

  const userColorMap = useMemo(() => {
    const map: Record<string, typeof userColors[0]> = {};
    let colorIndex = 0;
    
    for (const booking of bookings) {
      if (!map[booking.userId]) {
        map[booking.userId] = getUserColor(booking.userId, colorIndex);
        colorIndex++;
      }
    }
    
    return map;
  }, [bookings]);

  const handleSlotClick = (roomId: string, dayIndex: number, slotIndex: number) => {
    const date = weekDates[dayIndex];
    const hour = START_HOUR + Math.floor(slotIndex / 2);
    const minute = (slotIndex % 2) * 30;
    
    const startTime = formatDateTimeInput(date, hour, minute);
    const endTime = formatDateTimeInput(date, hour + 1, minute);
    
    setSelectedRoomId(roomId);
    setSelectedStartTime(startTime);
    setSelectedEndTime(endTime);
    setBookingModalOpen(true);
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
  };

  const goToPrevWeek = () => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() - 7);
    setWeekStart(getWeekStart(newDate));
  };

  const goToNextWeek = () => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() + 7);
    setWeekStart(getWeekStart(newDate));
  };

  const goToThisWeek = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  const getBookingPosition = (booking: Booking): { top: number; height: number } | null => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const baseMinutes = START_HOUR * 60;
    
    const slotHeight = 40;
    const totalMinutes = (END_HOUR - START_HOUR) * 60;
    
    const top = ((startMinutes - baseMinutes) / totalMinutes) * (TOTAL_SLOTS * slotHeight);
    const height = ((endMinutes - startMinutes) / totalMinutes) * (TOTAL_SLOTS * slotHeight);
    
    return { top: Math.max(0, top), height: Math.max(slotHeight / 2, height) };
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">周视图日历</h1>
        <div className="date-picker">
          <button className="date-picker-btn" onClick={goToPrevWeek}>
            ← 上一周
          </button>
          <button className="date-picker-btn" onClick={goToThisWeek}>
            本周
          </button>
          <button className="date-picker-btn" onClick={goToNextWeek}>
            下一周 →
          </button>
          <span style={{ fontSize: '0.875rem', color: '#64748b', marginLeft: 16 }}>
            {formatDateDisplay(weekDates[0])} - {formatDateDisplay(weekDates[4])}
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
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: 800,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    padding: 12,
                    textAlign: 'left',
                    backgroundColor: '#f8fafc',
                    borderBottom: '2px solid #e2e8f0',
                    fontWeight: 600,
                    color: '#475569',
                    minWidth: 150,
                  }}
                >
                  会议室
                </th>
                {weekDates.map((date, dayIndex) => {
                  const isToday = formatDate(date) === formatDate(new Date());
                  return (
                    <th
                      key={dayIndex}
                      style={{
                        padding: 12,
                        textAlign: 'center',
                        backgroundColor: isToday ? '#eff6ff' : '#f8fafc',
                        borderBottom: '2px solid #e2e8f0',
                        fontWeight: 600,
                        color: isToday ? '#2563eb' : '#475569',
                        minWidth: 120,
                      }}
                    >
                      <div>{DAY_NAMES[dayIndex]}</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 'normal' }}>
                        {formatDateDisplay(date)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td
                    style={{
                      padding: 12,
                      borderBottom: '1px solid #e2e8f0',
                      backgroundColor: '#fafafa',
                      verticalAlign: 'top',
                    }}
                  >
                    <div style={{ fontWeight: 500, color: '#1e293b' }}>
                      {room.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                      {room.floor}楼 | {room.capacity}人
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                      {room.availableStartTime} - {room.availableEndTime}
                    </div>
                  </td>
                  {weekDates.map((date, dayIndex) => {
                    const dateStr = formatDate(date);
                    const dayBookings = bookingsByRoomAndDay[room.id]?.[dateStr] || [];
                    const isToday = dateStr === formatDate(new Date());

                    return (
                      <td
                        key={dayIndex}
                        style={{
                          padding: 0,
                          borderBottom: '1px solid #e2e8f0',
                          borderRight: dayIndex < 4 ? '1px solid #e2e8f0' : 'none',
                          backgroundColor: isToday ? '#fefeff' : '#ffffff',
                          verticalAlign: 'top',
                          position: 'relative',
                          height: TOTAL_SLOTS * 40,
                        }}
                      >
                        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
                          {Array.from({ length: TOTAL_SLOTS }, (_, slotIndex) => {
                            const slotTime = formatTime(slotIndex);
                            const isHalfHour = slotIndex % 2 === 1;

                            return (
                              <div
                                key={slotIndex}
                                style={{
                                  position: 'absolute',
                                  top: slotIndex * 40,
                                  left: 0,
                                  right: 0,
                                  height: 40,
                                  borderBottom: isHalfHour ? '1px dashed #f1f5f9' : '1px solid #e2e8f0',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f8fafc';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                onClick={() => handleSlotClick(room.id, dayIndex, slotIndex)}
                                title={`${slotTime} - 点击创建预约`}
                              />
                            );
                          })}

                          {dayBookings.map((booking) => {
                            const position = getBookingPosition(booking);
                            if (!position) return null;

                            const color = userColorMap[booking.userId] || userColors[0];
                            const isOwnBooking = user && booking.userId === user.id;
                            const isAdminUser = isAdmin(user);
                            const canInteract = isOwnBooking || isAdminUser;

                            return (
                              <div
                                key={booking.id}
                                style={{
                                  position: 'absolute',
                                  left: 4,
                                  right: 4,
                                  top: position.top,
                                  height: position.height,
                                  backgroundColor: isOwnBooking ? '#dcfce7' : color.bg,
                                  border: `2px solid ${isOwnBooking ? '#86efac' : color.border}`,
                                  borderRadius: 4,
                                  padding: '4px 8px',
                                  overflow: 'hidden',
                                  cursor: canInteract ? 'pointer' : 'default',
                                  zIndex: 10,
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canInteract) {
                                    handleBookingClick(booking);
                                  }
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    color: isOwnBooking ? '#166534' : color.text,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {booking.title}
                                </div>
                                <div
                                  style={{
                                    fontSize: '0.65rem',
                                    color: isOwnBooking ? '#166534' : color.text,
                                    opacity: 0.8,
                                    marginTop: 2,
                                  }}
                                >
                                  {new Date(booking.startTime).getHours().toString().padStart(2, '0')}:
                                  {new Date(booking.startTime).getMinutes().toString().padStart(2, '0')} -
                                  {new Date(booking.endTime).getHours().toString().padStart(2, '0')}:
                                  {new Date(booking.endTime).getMinutes().toString().padStart(2, '0')}
                                </div>
                                {booking.user && (
                                  <div
                                    style={{
                                      fontSize: '0.6rem',
                                      color: isOwnBooking ? '#166534' : color.text,
                                      opacity: 0.7,
                                    }}
                                  >
                                    {booking.user.username}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          marginTop: 24,
          display: 'flex',
          gap: 24,
          fontSize: '0.875rem',
          color: '#64748b',
          flexWrap: 'wrap',
        }}
      >
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
          <div
            style={{
              width: 20,
              height: 20,
              backgroundColor: '#dbeafe',
              border: '1px solid #93c5fd',
              borderRadius: 4,
            }}
          />
          <span>他人预约（不同用户不同颜色）</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>点击空白格子可快速创建预约</span>
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
