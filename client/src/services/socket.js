import { io } from 'socket.io-client';

export const socket = io(import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000'), {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

socket.on('account-deleted', () => {
  sessionStorage.removeItem('otion_token');
  localStorage.removeItem('otion_token');
  window.dispatchEvent(new Event('otion:unauthorized'));
});

export const connectSocket = () => {
  const token = sessionStorage.getItem('otion_token') || localStorage.getItem('otion_token');
  if (socket.connected && socket.auth?.token !== token) socket.disconnect();
  socket.auth = { token };
  if (!socket.connected) socket.connect();
  return socket;
};
