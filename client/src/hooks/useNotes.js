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
      setError(requestError.response?.data?.message || 'Unable to load documents');
    } finally {
      setLoading(false);
    }
  }, [archived]);

  useEffect(() => {
    let active = true;
    api.get('/notes', { params: { archived } })
      .then(({ data }) => { if (active) { setNotes(data); setError(''); } })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load documents'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [archived]);

  useEffect(() => {
    if (!user) return undefined;
    connectSocket();
    const syncNote = ({ note }) => {
      setNotes((current) => {
        const withoutNote = current.filter((item) => item._id !== note._id);
        if (Boolean(note.isArchived) !== archived) return withoutNote;
        return [note, ...withoutNote].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });
    };
    const removeNote = ({ noteId }) => setNotes((current) => current.filter((note) => note._id !== noteId));
    socket.on('note-sync', syncNote);
    socket.on('note-remove', removeNote);
    return () => {
      socket.off('note-sync', syncNote);
      socket.off('note-remove', removeNote);
    };
  }, [archived, user]);
  return { notes, setNotes, loading, error, refresh };
}
