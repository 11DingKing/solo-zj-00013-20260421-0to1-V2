import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: UserRole;
      };
    }
  }
}

export interface JwtPayload {
  id: string;
  username: string;
  role: UserRole;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: '未授权访问' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = {
      id: payload.id,
      username: payload.username,
      role: payload.role,
    };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token 无效或已过期' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: '未授权访问' });
  }

  if (req.user.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: '需要管理员权限' });
  }

  next();
};
