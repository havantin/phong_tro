/**
 * App Entry Point with Routing & State Providers
 */
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CompareProvider } from './context/CompareContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { FloatingAiChat } from './components/FloatingAiChat';
import { HomePage } from './pages/HomePage';
import { RoomsPage } from './pages/RoomsPage';
import { RoomDetailPage } from './pages/RoomDetailPage';
import { AiSearchPage } from './pages/AiSearchPage';
import { ComparePage } from './pages/ComparePage';
import { FavoritesPage } from './pages/FavoritesPage';
import { OwnerDashboard } from './pages/OwnerDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CompareProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white font-sans">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/rooms" element={<RoomsPage />} />
                  <Route path="/rooms/:id" element={<RoomDetailPage />} />
                  <Route path="/ai-search" element={<AiSearchPage />} />
                  <Route path="/compare" element={<ComparePage />} />
                  <Route path="/favorites" element={<FavoritesPage />} />
                  <Route path="/owner" element={<OwnerDashboard />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                </Routes>
              </main>
              <Footer />
              {/* Global Floating AI Chatbot accessible on every page */}
              <FloatingAiChat />
            </div>
          </BrowserRouter>
        </CompareProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
