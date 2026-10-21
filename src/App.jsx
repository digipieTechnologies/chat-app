import './index.css';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { MainLayout } from './layouts/MainLayout';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ChatProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/chats" replace />} />
            <Route path="/chats" element={<MainLayout />} />
            <Route path="/chats/:chatId" element={<MainLayout />} />
            <Route path="/notifications" element={<MainLayout />} />
            <Route path="/notifications/:chatId" element={<MainLayout />} />
            <Route path="/starred" element={<MainLayout />} />
            <Route path="/starred/:chatId" element={<MainLayout />} />
            <Route path="/files" element={<MainLayout />} />
            <Route path="/files/:chatId" element={<MainLayout />} />
            <Route path="*" element={<Navigate to="/chats" replace />} />
          </Routes>
        </ChatProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
