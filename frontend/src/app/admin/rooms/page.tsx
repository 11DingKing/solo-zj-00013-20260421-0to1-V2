'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Room, Equipment, equipmentLabels, isAdmin } from '@/types';

const equipmentOptions = [
  { value: Equipment.PROJECTOR, label: '投影仪' },
  { value: Equipment.WHITEBOARD, label: '白板' },
  { value: Equipment.VIDEO_CONFERENCE, label: '视频会议' },
];

const RoomModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  onSaved: () => void;
}> = ({ isOpen, onClose, room, onSaved }) => {
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [floor, setFloor] = useState(1);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [availableStartTime, setAvailableStartTime] = useState('08:00');
  const [availableEndTime, setAvailableEndTime] = useState('18:00');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEdit = !!room;

  useEffect(() => {
    if (room) {
      setName(room.name);
      setCapacity(room.capacity);
      setFloor(room.floor);
      setEquipment([...room.equipment]);
      setAvailableStartTime(room.availableStartTime);
      setAvailableEndTime(room.availableEndTime);
    } else {
      setName('');
      setCapacity(10);
      setFloor(1);
      setEquipment([]);
      setAvailableStartTime('08:00');
      setAvailableEndTime('18:00');
    }
    setError('');
  }, [room]);

  const handleEquipmentChange = (eq: Equipment) => {
    setEquipment((prev) =>
      prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isEdit && room) {
        await api.updateRoom(room.id, {
          name,
          capacity,
          floor,
          equipment,
          availableStartTime,
          availableEndTime,
        });
      } else {
        await api.createRoom({
          name,
          capacity,
          floor,
          equipment,
          availableStartTime,
          availableEndTime,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? '编辑会议室' : '添加会议室'}</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label className="form-label">会议室名称</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：第一会议室"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">所在楼层</label>
              <input
                type="number"
                className="form-input"
                value={floor}
                onChange={(e) => setFloor(parseInt(e.target.value) || 0)}
                min={0}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">容纳人数</label>
              <input
                type="number"
                className="form-input"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                min={1}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">设备列表</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                {equipmentOptions.map((option) => (
                  <label
                    key={option.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      padding: '8px 12px',
                      borderRadius: 8,
                      backgroundColor: equipment.includes(option.value) ? '#dbeafe' : '#f1f5f9',
                      border: equipment.includes(option.value) ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={equipment.includes(option.value)}
                      onChange={() => handleEquipmentChange(option.value)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: '0.875rem' }}>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">可用时间段</label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 4, display: 'block' }}>
                    开始时间
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    value={availableStartTime}
                    onChange={(e) => setAvailableStartTime(e.target.value)}
                    required
                  />
                </div>
                <span style={{ color: '#64748b' }}>至</span>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 4, display: 'block' }}>
                    结束时间
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    value={availableEndTime}
                    onChange={(e) => setAvailableEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                预约时间必须在此时间段内
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else if (!isAdmin(user)) {
      router.push('/rooms');
    }
  }, [user, router]);

  const fetchRooms = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await api.getRooms();
      setRooms(data);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleEdit = (room: Room) => {
    setEditingRoom(room);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingRoom(null);
    setModalOpen(true);
  };

  const handleDelete = async (room: Room) => {
    if (!confirm(`确定要删除会议室「${room.name}」吗？`)) {
      return;
    }

    try {
      setDeletingId(room.id);
      await api.deleteRoom(room.id);
      fetchRooms();
    } catch (err: any) {
      alert(err.message || '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  if (!user || !isAdmin(user)) {
    return null;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">会议室管理</h1>
        <button className="btn btn-primary" onClick={handleAdd}>
          + 添加会议室
        </button>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏢</div>
          <div className="empty-state-text">暂无会议室</div>
          <div className="empty-state-hint">点击上方按钮添加第一个会议室</div>
        </div>
      ) : (
        <div className="room-list">
          {rooms.map((room) => (
            <div key={room.id} className="room-card">
              <div className="room-card-header">
                <div className="room-card-name">{room.name}</div>
              </div>
              <div className="room-card-meta">
                <div>楼层：{room.floor}楼</div>
                <div>容量：{room.capacity}人</div>
                <div>可用时间：{room.availableStartTime} - {room.availableEndTime}</div>
              </div>
              {room.equipment.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      marginBottom: 6,
                    }}
                  >
                    设备：
                  </div>
                  <div className="room-equipment">
                    {room.equipment.map((eq) => (
                      <span key={eq} className="equipment-tag">
                        {equipmentLabels[eq]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="room-card-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleEdit(room)}
                >
                  编辑
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(room)}
                  disabled={deletingId === room.id}
                >
                  {deletingId === room.id ? '删除中...' : '删除'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <RoomModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        room={editingRoom}
        onSaved={fetchRooms}
      />
    </div>
  );
}
