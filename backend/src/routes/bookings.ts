import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { RecurrenceRule } from '@prisma/client';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { authenticateToken } from '../middleware/auth';
import { withLock } from '../utils/lock';

const router = Router();

const CACHE_TTL = 600;

const getRoomBookingsCacheKey = (roomId: string, date: string): string => {
  return `room:bookings:${roomId}:${date}`;
};

const formatDateForCache = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const parseTimeString = (timeStr: string): { hour: number; minute: number } => {
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour, minute };
};

const isTimeWithinRange = (
  time: Date,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number
): boolean => {
  const hour = time.getHours();
  const minute = time.getMinutes();
  
  const timeMinutes = hour * 60 + minute;
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  
  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
};

const invalidateRoomCache = async (roomId: string, dates: Date[]): Promise<void> => {
  const uniqueDates = new Set(dates.map((d) => formatDateForCache(d)));
  const keys = Array.from(uniqueDates).map((date) => getRoomBookingsCacheKey(roomId, date));
  
  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

interface ConflictInfo {
  bookingId: string;
  title: string;
  username: string;
  startTime: Date;
  endTime: Date;
}

const checkConflict = async (
  roomId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
): Promise<ConflictInfo[]> => {
  const conflictingBookings = await prisma.booking.findMany({
    where: {
      roomId,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      AND: [
        {
          startTime: {
            lt: endTime,
          },
        },
        {
          endTime: {
            gt: startTime,
          },
        },
      ],
    },
    include: {
      user: {
        select: {
          username: true,
        },
      },
    },
  });

  return conflictingBookings.map((booking) => ({
    bookingId: booking.id,
    title: booking.title,
    username: booking.user.username,
    startTime: booking.startTime,
    endTime: booking.endTime,
  }));
};

const generateRecurrenceDates = (
  startTime: Date,
  endTime: Date,
  rule: RecurrenceRule
): Array<{ startTime: Date; endTime: Date }> => {
  if (rule === RecurrenceRule.NONE) {
    return [{ startTime, endTime }];
  }

  const dates: Array<{ startTime: Date; endTime: Date }> = [];
  
  let currentStart = new Date(startTime);
  let currentEnd = new Date(endTime);
  
  const weeksToGenerate = 4;
  
  for (let i = 0; i < weeksToGenerate; i++) {
    if (i > 0) {
      currentStart = new Date(currentStart);
      currentEnd = new Date(currentEnd);
      
      switch (rule) {
        case RecurrenceRule.DAILY:
          currentStart.setDate(currentStart.getDate() + 1);
          currentEnd.setDate(currentEnd.getDate() + 1);
          break;
        case RecurrenceRule.WEEKLY:
          currentStart.setDate(currentStart.getDate() + 7);
          currentEnd.setDate(currentEnd.getDate() + 7);
          break;
        case RecurrenceRule.MONTHLY:
          currentStart.setMonth(currentStart.getMonth() + 1);
          currentEnd.setMonth(currentEnd.getMonth() + 1);
          break;
      }
    }
    
    if (currentStart > new Date()) {
      dates.push({
        startTime: new Date(currentStart),
        endTime: new Date(currentEnd),
      });
    }
  }
  
  return dates;
};

const recurrenceRuleSchema = z.nativeEnum(RecurrenceRule);

const createBookingSchema = z.object({
  roomId: z.string().min(1, '会议室不能为空'),
  title: z.string().min(1, '会议主题不能为空'),
  startTime: z.coerce.date().refine((date) => !isNaN(date.getTime()), {
    message: '开始时间格式无效',
  }),
  endTime: z.coerce.date().refine((date) => !isNaN(date.getTime()), {
    message: '结束时间格式无效',
  }),
  attendees: z.number().int().min(1, '参会人数必须至少为1'),
  recurrenceRule: recurrenceRuleSchema.optional().default(RecurrenceRule.NONE),
});

router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const data = createBookingSchema.parse(req.body);
    const { startTime, endTime, recurrenceRule } = data;

    if (startTime >= endTime) {
      return res.status(400).json({ error: '开始时间必须早于结束时间' });
    }

    const durationMs = endTime.getTime() - startTime.getTime();
    if (durationMs < 30 * 60 * 1000) {
      return res.status(400).json({ error: '预约时长至少为30分钟' });
    }

    if (endTime <= new Date()) {
      return res.status(400).json({ error: '预约时间必须在未来' });
    }

    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
    });

    if (!room) {
      return res.status(404).json({ error: '会议室不存在' });
    }

    const { hour: startHour, minute: startMinute } = parseTimeString(room.availableStartTime);
    const { hour: endHour, minute: endMinute } = parseTimeString(room.availableEndTime);

    const recurrenceDates = generateRecurrenceDates(startTime, endTime, recurrenceRule);
    
    if (recurrenceDates.length === 0) {
      return res.status(400).json({ error: '没有有效的预约时间' });
    }

    for (const date of recurrenceDates) {
      if (!isTimeWithinRange(date.startTime, startHour, startMinute, endHour, endMinute) ||
          !isTimeWithinRange(date.endTime, startHour, startMinute, endHour, endMinute)) {
        return res.status(400).json({ 
          error: `预约时间超出会议室可用时间段（${room.availableStartTime} - ${room.availableEndTime}）` 
        });
      }
    }

    if (data.attendees > room.capacity) {
      return res.status(400).json({ error: `参会人数超过会议室容量（最大${room.capacity}人）` });
    }

    const lockResource = `room:${data.roomId}`;

    try {
      const createdBookings = await withLock(redis, lockResource, async () => {
        const allConflicts: Array<{ date: string; conflicts: ConflictInfo[] }> = [];
        
        for (const date of recurrenceDates) {
          const conflicts = await checkConflict(data.roomId, date.startTime, date.endTime);
          if (conflicts.length > 0) {
            allConflicts.push({
              date: date.startTime.toISOString(),
              conflicts,
            });
          }
        }

        if (allConflicts.length > 0) {
          const firstConflict = allConflicts[0];
          const conflictInfo = firstConflict.conflicts[0];
          const conflictDate = new Date(firstConflict.date);
          const conflictDateStr = `${conflictDate.getMonth() + 1}月${conflictDate.getDate()}日`;
          
          return res.status(409).json({
            error: '预约时间冲突',
            conflict: {
              date: conflictDateStr,
              title: conflictInfo.title,
              username: conflictInfo.username,
              startTime: conflictInfo.startTime.toISOString(),
              endTime: conflictInfo.endTime.toISOString(),
            },
            allConflicts: allConflicts.map((c) => ({
              date: c.date,
              conflicts: c.conflicts.map((cf) => ({
                title: cf.title,
                username: cf.username,
                startTime: cf.startTime.toISOString(),
                endTime: cf.endTime.toISOString(),
              })),
            })),
          });
        }

        const recurrenceGroupId = recurrenceRule !== RecurrenceRule.NONE 
          ? `recurrence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` 
          : null;

        const bookingsToCreate = recurrenceDates.map((date) => ({
          roomId: data.roomId,
          userId: req.user!.id,
          title: data.title,
          startTime: date.startTime,
          endTime: date.endTime,
          attendees: data.attendees,
          recurrenceRule,
          recurrenceGroupId,
        }));

        const createdBookings: any[] = [];
        
        for (const bookingData of bookingsToCreate) {
          const booking = await prisma.booking.create({
            data: bookingData,
            include: {
              room: true,
              user: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          });
          createdBookings.push(booking);
        }

        const affectedDates = recurrenceDates.map((d) => d.startTime);
        await invalidateRoomCache(data.roomId, affectedDates);

        return createdBookings;
      });

      if (res.headersSent) return;

      res.status(201).json({
        bookings: createdBookings,
        count: createdBookings.length,
        recurrenceRule,
      });
    } catch (error: any) {
      if (res.headersSent) return;

      if (error.message === 'Failed to acquire lock') {
        return res.status(503).json({ error: '系统繁忙，请稍后重试' });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create booking error:', error);
    res.status(500).json({ error: '创建预约失败' });
  }
});

router.get('/my', authenticateToken, async (req: Request, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        userId: req.user!.id,
      },
      include: {
        room: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: '获取预约列表失败' });
  }
});

router.get('/by-week', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { weekStart, roomId } = req.query;

    if (!weekStart) {
      return res.status(400).json({ error: '请提供周起始日期参数' });
    }

    const startDate = new Date(weekStart as string);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const bookings = await prisma.booking.findMany({
      where: {
        roomId: roomId ? (roomId as string) : undefined,
        AND: [
          {
            startTime: {
              lt: endDate,
            },
          },
          {
            endTime: {
              gt: startDate,
            },
          },
        ],
      },
      include: {
        room: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: '获取预约信息失败' });
  }
});

router.get('/by-date', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { date, roomId } = req.query;

    if (!date) {
      return res.status(400).json({ error: '请提供日期参数' });
    }

    const targetDate = new Date(date as string);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const dateStr = formatDateForCache(targetDate);
    
    if (roomId) {
      const cacheKey = getRoomBookingsCacheKey(roomId as string, dateStr);
      const cachedData = await redis.get(cacheKey);
      
      if (cachedData) {
        return res.json(JSON.parse(cachedData));
      }
    }

    const bookings = await prisma.booking.findMany({
      where: {
        roomId: roomId ? (roomId as string) : undefined,
        AND: [
          {
            startTime: {
              lt: endOfDay,
            },
          },
          {
            endTime: {
              gt: startOfDay,
            },
          },
        ],
      },
      include: {
        room: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    if (roomId) {
      const cacheKey = getRoomBookingsCacheKey(roomId as string, dateStr);
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(bookings));
    }

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: '获取预约信息失败' });
  }
});

router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        room: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: '预约不存在' });
    }

    if (booking.userId !== req.user!.id) {
      return res.status(403).json({ error: '只能取消自己的预约' });
    }

    const now = new Date();
    const thirtyMinutesBefore = new Date(booking.startTime.getTime() - 30 * 60 * 1000);

    if (now >= thirtyMinutesBefore) {
      return res.status(400).json({ 
        error: '预约开始前30分钟内不允许取消，请联系管理员' 
      });
    }

    const roomId = booking.roomId;
    const bookingDate = booking.startTime;

    await prisma.booking.delete({
      where: { id: req.params.id },
    });

    await invalidateRoomCache(roomId, [bookingDate]);

    res.status(204).send();
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: '取消预约失败' });
  }
});

router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        room: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: '预约不存在' });
    }

    if (booking.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权限查看此预约' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: '获取预约信息失败' });
  }
});

export default router;
