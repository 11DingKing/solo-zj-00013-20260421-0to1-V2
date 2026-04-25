'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Booking } from '@/types';

const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date
    .getHours()
    .toString()
    .padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await api.getMyBookings();
      setBookings(data);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCancel = async (booking: Booking) => {
    if (new Date(booking.startTime) <= new Date()) {
      setError('不能取消已开始的预约');
      return;
    }

    if (!confirm('确定要取消这个预约吗？')) {
      return;
    }

    try {
      setCancelingId(booking.id);
      setError('');
      await api.cancelBooking(booking.id);
      fetchBookings();
    } catch (err: any) {
      setError(err.message || '取消失败');
    } finally {
      setCancelingId(null);
    }
  };

  const now = new Date();
  const upcomingBookings = bookings.filter((b) => new Date(b.startTime) > now);
  const pastBookings = bookings.filter((b) => new Date(b.startTime) <= now);

  if (!user) {
    return null;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">我的预约</h1>
      </div>

      {error && (
        <div className="error-message" style={{ marginBottom: 24 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : (
        <>
          {upcomingBookings.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  marginBottom: 16,
                }}
              >
                即将开始 ({upcomingBookings.length})
              </h2>
              <div className="booking-list">
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="booking-item">
                    <div className="booking-info">
                      <h3>{booking.title}</h3>
                      <div className="booking-meta">
                        <span>📍 {booking.room?.name || '-'}</span>
                        <span>🕐 {formatDateTime(booking.startTime)}</span>
                        <span>➡️ {formatDateTime(booking.endTime)}</span>
                        <span>👥 {booking.attendees}人</span>
                      </div>
                    </div>
                    <div className="booking-actions">
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleCancel(booking)}
                        disabled={cancelingId === booking.id}
                      >
                        {cancelingId === booking.id ? '取消中...' : '取消预约'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pastBookings.length > 0 && (
            <div>
              <h2
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#64748b',
                  marginBottom: 16,
                }}
              >
                历史预约 ({pastBookings.length})
              </h2>
              <div className="booking-list">
                {pastBookings.map((booking) => (
                  <div key={booking.id} className="booking-item past">
                    <div className="booking-info">
                      <h3>{booking.title}</h3>
                      <div className="booking-meta">
                        <span>📍 {booking.room?.name || '-'}</span>
                        <span>🕐 {formatDateTime(booking.startTime)}</span>
                        <span>➡️ {formatDateTime(booking.endTime)}</span>
                        <span>👥 {booking.attendees}人</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingBookings.length === 0 && pastBookings.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <div className="empty-state-text">暂无预约记录</div>
              <div className="empty-state-hint">前往会议室页面预约一个会议室吧</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
