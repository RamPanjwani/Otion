import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { socket } from '../services/socket';

export default function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const load = useCallback(() => api.get('/notifications').then(({ data }) => setNotifications(data)), []);

  useEffect(() => {
    let active = true;
    api.get('/notifications').then(({ data }) => { if (active) setNotifications(data); }).catch(() => undefined);
    const refresh = () => load().catch(() => undefined);
    socket.on('notification', refresh);
    return () => { active = false; socket.off('notification', refresh); };
  }, [load]);

  const unread = notifications.filter((item) => !item.readAt).length;
  const openNotification = async (notification) => {
    if (!notification.readAt) await api.patch(`/notifications/${notification._id}/read`);
    setOpen(false);
    if (notification.note?._id) navigate(`/notes/${notification.note._id}`);
    load().catch(() => undefined);
  };
  const readAll = async () => {
    await api.patch('/notifications/all/read');
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
  };

  return <div className="relative"><button type="button" onClick={() => setOpen((current) => !current)} className="icon-action relative h-9 w-9" aria-label="Notifications"><Bell size={18} />{unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-violet-500 ring-2 ring-canvas" />}</button>{open && <div className="elevated-panel absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-2rem))] rounded-2xl p-2"><div className="flex items-center justify-between px-2 py-2"><p className="text-sm font-semibold">Notifications</p>{unread > 0 && <button type="button" onClick={readAll} className="flex items-center gap-1 text-xs text-muted hover:text-ink"><CheckCheck size={14} /> Mark all read</button>}</div><div className="max-h-80 overflow-y-auto">{notifications.length ? notifications.map((notification) => <button key={notification._id} type="button" onClick={() => openNotification(notification)} className={`w-full rounded-xl px-3 py-3 text-left transition hover:bg-panel ${notification.readAt ? '' : 'bg-accent-soft/70'}`}><p className="text-sm"><span className="font-semibold">{notification.actor?.name || 'Someone'}</span> {notification.type === 'share' ? 'shared a note with you' : notification.type === 'mention' ? 'mentioned you in a comment' : 'commented on your note'}</p><p className="mt-1 truncate text-xs text-muted">{notification.note?.icon || '📝'} {notification.note?.title || 'Note'} · {new Date(notification.createdAt).toLocaleString()}</p></button>) : <p className="px-3 py-8 text-center text-sm text-muted">No notifications</p>}</div></div>}</div>;
}
