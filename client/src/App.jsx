import { Navigate, Route, Routes } from 'react-router-dom';
import useAuth from './hooks/useAuth';
import Loading from './components/Loading';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NoteEditor from './pages/NoteEditor';
import Trash from './pages/Trash';
import PublicNote from './pages/PublicNote';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading fullPage />;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/documents/:id" element={<ProtectedRoute><NoteEditor /></ProtectedRoute>} />
      <Route path="/trash" element={<ProtectedRoute><Trash /></ProtectedRoute>} />
      <Route path="/public/:id" element={<PublicNote />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
