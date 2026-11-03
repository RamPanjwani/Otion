import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { connectSocket, socket } from '../services/socket';
import useAuth from './useAuth';

export default function useNotes({ archived = false } = {}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notes', { params: { archived } });
      setNotes(data);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load notes');
    } finally {
      setLoading(false);
    }
  }, [archived]);

  useEffect(() => {
    let active = true;
    api.get('/notes', { params: { archived } })
      .then(({ data }) => { if (active) { setNotes(data); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load notes'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [archived]);

  useEffect(() => {
    if (!user) return undefined;
    connectSocket();
    const syncNote = ({ note }) => {
      setNotes((current) => {
        const existing = current.find((item) => item._id === note._id);
        const merged = existing ? {
          ...existing,
          ...note,
          isFavorite: note.isFavorite ?? existing.isFavorite,
          lastOpenedAt: note.lastOpenedAt ?? existing.lastOpenedAt,
          sortOrder: note.sortOrder ?? existing.sortOrder,
        } : note;
        const withoutNote = current.filter((item) => item._id !== note._id);
        if (Boolean(note.isArchived) !== archived) return withoutNote;
        return [merged, ...withoutNote].sort(compareNotes);
      });
    };
    const reorderNotes = ({ noteIds }) => setNotes((current) => {
      const position = new Map(noteIds.map((noteId, index) => [String(noteId), index]));
      return [...current].sort((a, b) => (position.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER) - (position.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER));
    });
    const removeNote = ({ noteId }) => setNotes((current) => current.filter((note) => note._id !== noteId));
    socket.on('note-sync', syncNote);
    socket.on('note-order', reorderNotes);
    socket.on('note-remove', removeNote);
    return () => {
      socket.off('note-sync', syncNote);
      socket.off('note-order', reorderNotes);
      socket.off('note-remove', removeNote);
    };
  }, [archived, user]);
  return { notes, setNotes, loading, error, refresh };
}

function compareNotes(a, b) {
  const aOrder = Number.isFinite(a.sortOrder) ? a.sortOrder : -1;
  const bOrder = Number.isFinite(b.sortOrder) ? b.sortOrder : -1;
  return aOrder - bOrder || new Date(b.updatedAt) - new Date(a.updatedAt);
}
