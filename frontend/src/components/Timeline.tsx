'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Room, Booking, isAdmin, equipmentLabels } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface TimelineProps {
  rooms: Room[];
  bookings: Booking[];
  date: string;
  onSlotClick?: (roomId: string, startTime: string, endTime: string) => void;
  onBookingClick?: (booking: Booking) => void;
}

const START_HOUR = 8;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const HOUR_WIDTH = 80;

const formatTime = (hour: number, minute: number = 0): string => {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

const parseTime = (timeStr: string): { hour: number; minute: number } => {
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour, minute };
};

const getPositionAndWidth = (
  startTime: string,
  endTime: string
): { left: number; width: number } => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const startBaseMinutes = START_HOUR * 60;

  const left = ((startMinutes - startBaseMinutes) / 60) * HOUR_WIDTH;
  const width = ((endMinutes - startMinutes) / 60) * HOUR_WIDTH;

  return { left: Math.max(0, left), width: Math.max(0, width) };
};

const formatDateTimeInput = (date: string, hour: number, minute: number = 0): string => {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString().slice(0, 16);
};

export const Timeline: React.FC<TimelineProps> = ({
  rooms,
  bookings,
  date,
  onSlotClick,
  onBookingClick,
}) => {
  const { user } = useAuth();
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

  const hours = useMemo(() => {
    return Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);
  }, []);

  const bookingsByRoom = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const booking of bookings) {
      if (!map[booking.roomId]) {
        map[booking.roomId] = [];
      }
      map[booking.roomId].push(booking);
    }
    return map;
  }, [bookings]);

  const handleGridClick = useCallback(
    (roomId: string, event: React.MouseEvent<HTMLDivElement>) => {
      if (!onSlotClick) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const totalWidth = TOTAL_HOURS * HOUR_WIDTH;
      const clampedX = Math.max(0, Math.min(x, totalWidth));

      const hoursFromStart = (clampedX / HOUR_WIDTH) * 2;
      const nearestHalfHour = Math.floor(hoursFromStart) / 2;
      const startHour = START_HOUR + nearestHalfHour;

      const hour = Math.floor(startHour);
      const minute = (startHour - hour) * 60;

      const startTime = formatDateTimeInput(date, hour, minute);
      const endTime = formatDateTimeInput(date, hour + 1, minute);

      onSlotClick(roomId, startTime, endTime);
    },
    [date, onSlotClick]
  );

  return (
    <div className="timeline-container">
      <div className="timeline-grid">
        <div className="timeline-header">
          <div className="timeline-room-header">会议室</div>
          <div className="timeline-time-header">
            {hours.map((hour) => (
              <div key={hour} className="timeline-time-slot">
                {formatTime(hour)}
              </div>
            ))}
          </div>
        </div>

        {rooms.map((room) => {
          const roomBookings = bookingsByRoom[room.id] || [];

          return (
            <div
              key={room.id}
              className={`timeline-row ${hoveredRoom === room.id ? 'hovered' : ''}`}
              onMouseEnter={() => setHoveredRoom(room.id)}
              onMouseLeave={() => setHoveredRoom(null)}
            >
              <div className="timeline-room-cell">
                <div className="room-name">{room.name}</div>
                <div className="room-details">
                  <span className="room-floor">{room.floor}楼</span>
                  <span className="room-capacity">{room.capacity}人</span>
                </div>
                <div className="room-equipment">
                  {room.equipment.map((eq) => (
                    <span key={eq} className="equipment-tag">
                      {equipmentLabels[eq]}
                    </span>
                  ))}
                </div>
              </div>

              <div
                className="timeline-slot-grid"
                onClick={(e) => handleGridClick(room.id, e)}
              >
                {hours.map((hour) => (
                  <div key={hour} className="timeline-slot">
                    <div className="timeline-slot-divider" />
                  </div>
                ))}

                {roomBookings.map((booking) => {
                  const { left, width } = getPositionAndWidth(
                    booking.startTime,
                    booking.endTime
                  );
                  const isOwnBooking = user && booking.userId === user.id;
                  const isAdminUser = isAdmin(user);
                  const canInteract = isOwnBooking || isAdminUser;

                  const startDate = new Date(booking.startTime);
                  const endDate = new Date(booking.endTime);

                  return (
                    <div
                      key={booking.id}
                      className={`timeline-booking ${isOwnBooking ? 'own' : ''} ${
                        canInteract ? 'interactive' : ''
                      }`}
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canInteract && onBookingClick) {
                          onBookingClick(booking);
                        }
                      }}
                      title={`${booking.title}\n${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')} - ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`}
                    >
                      <div className="booking-title">{booking.title}</div>
                      <div className="booking-time">
                        {startDate.getHours().toString().padStart(2, '0')}:
                        {startDate.getMinutes().toString().padStart(2, '0')} -
                        {endDate.getHours().toString().padStart(2, '0')}:
                        {endDate.getMinutes().toString().padStart(2, '0')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
