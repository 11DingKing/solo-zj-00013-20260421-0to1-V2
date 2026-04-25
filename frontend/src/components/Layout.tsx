'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { isAdmin } from '@/types';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="loading" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const isActive = (path: string) => pathname === path;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav className="navbar">
        <div className="navbar-content">
          <Link href="/" className="navbar-brand">
            会议室预约系统
          </Link>

          {user && (
            <div className="navbar-nav">
              <Link href="/rooms" className={`navbar-link ${isActive('/rooms') ? 'active' : ''}`}>
                会议室
              </Link>
              <Link href="/bookings" className={`navbar-link ${isActive('/bookings') ? 'active' : ''}`}>
                我的预约
              </Link>
              {isAdmin(user) && (
                <Link href="/admin/rooms" className={`navbar-link ${isActive('/admin/rooms') ? 'active' : ''}`}>
                  会议室管理
                </Link>
              )}
            </div>
          )}

          <div className="navbar-user">
            {user ? (
              <>
                <span className="user-role">
                  {isAdmin(user) ? '管理员' : '普通用户'}
                </span>
                <span>{user.username}</span>
                <button className="logout-btn" onClick={logout}>
                  退出
                </button>
              </>
            ) : (
              <Link href="/login" className="navbar-link">
                登录
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
};
