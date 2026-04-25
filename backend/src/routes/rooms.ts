import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import { Equipment } from "@prisma/client";

const router = Router();

const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

const timeStringSchema = z.string().regex(timePattern, "时间格式必须为 HH:MM");

const createRoomSchema = z.object({
  name: z.string().min(1, "会议室名称不能为空"),
  capacity: z.number().int().min(1, "容纳人数必须至少为1"),
  floor: z.number().int(),
  equipment: z.array(z.nativeEnum(Equipment)),
  availableStartTime: timeStringSchema.optional().default("08:00"),
  availableEndTime: timeStringSchema.optional().default("18:00"),
});

const updateRoomSchema = z
  .object({
    name: z.string().min(1, "会议室名称不能为空").optional(),
    capacity: z.number().int().min(1, "容纳人数必须至少为1").optional(),
    floor: z.number().int().optional(),
    equipment: z.array(z.nativeEnum(Equipment)).optional(),
    availableStartTime: timeStringSchema.optional(),
    availableEndTime: timeStringSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.availableStartTime && data.availableEndTime) {
        return data.availableStartTime < data.availableEndTime;
      }
      return true;
    },
    {
      message: "开始时间必须早于结束时间",
      path: ["availableStartTime"],
    },
  );

router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: { floor: "asc" },
    });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: "获取会议室列表失败" });
  }
});

router.get("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
    });

    if (!room) {
      return res.status(404).json({ error: "会议室不存在" });
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ error: "获取会议室信息失败" });
  }
});

router.post(
  "/",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const data = createRoomSchema.parse(req.body);

      const room = await prisma.room.create({
        data,
      });

      res.status(201).json(room);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "创建会议室失败" });
    }
  },
);

router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const data = updateRoomSchema.parse(req.body);

      const existingRoom = await prisma.room.findUnique({
        where: { id: req.params.id },
      });

      if (!existingRoom) {
        return res.status(404).json({ error: "会议室不存在" });
      }

      const room = await prisma.room.update({
        where: { id: req.params.id },
        data,
      });

      res.json(room);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message });
      }
      res.status(500).json({ error: "更新会议室失败" });
    }
  },
);

router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const existingRoom = await prisma.room.findUnique({
        where: { id: req.params.id },
      });

      if (!existingRoom) {
        return res.status(404).json({ error: "会议室不存在" });
      }

      await prisma.room.delete({
        where: { id: req.params.id },
      });

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "删除会议室失败" });
    }
  },
);

export default router;
