"use client";

import React, { useState, useEffect } from "react";
import { Navbar, NavTab } from "@/components/Navbar";
import { DashboardView } from "@/components/DashboardView";
import { BooksView } from "@/components/BooksView";
import { SemanticSearchView } from "@/components/SemanticSearchView";
import { ClusteringView } from "@/components/ClusteringView";
import { ProcessView } from "@/components/ProcessView";
import { ErrorsView } from "@/components/ErrorsView";
import { DuplicatesView } from "@/components/DuplicatesView";
import { BookDetailModal } from "@/components/BookDetailModal";
import { ManualBookModal } from "@/components/ManualBookModal";
import { ProcessProvider } from "@/components/ProcessContext";
import { GlobalLogDrawer } from "@/components/GlobalLogDrawer";
import { ProcessFloatingWidget } from "@/components/ProcessFloatingWidget";
import { BookDetail } from "@/lib/db";

function HomeContent() {
  const [currentTab, setCurrentTab] = useState<NavTab>("dashboard");
  const [stats, setStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [selectedBook, setSelectedBook] = useState<BookDetail | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterRead, setFilterRead] = useState<string>("");
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualBook, setManualBook] = useState<BookDetail | null>(null);

  const refreshStats = async () => {
    try {
      setLoadingStats(true);
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const handleSelectCategory = (cat: string) => {
    setFilterCategory(cat);
    setFilterRead("");
    setCurrentTab("books");
  };

  const availableCategories = stats?.topCategories?.map((c: any) => c.name) || [];

  return (
    <ProcessProvider onProcessFinished={refreshStats}>
      <div className="app-wrapper">
        {/* Top Navbar with live process indicator */}
        <Navbar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setFilterCategory("");
            setFilterRead("");
            setCurrentTab(tab);
          }}
          totalBooks={stats?.totalBooks}
          errorBooks={stats?.errorBooks}
          duplicateGroups={stats?.duplicateGroups}
        />

        {/* Main View Area with generous edge margins */}
        <main className="app-main">
          {currentTab === "dashboard" && (
            <DashboardView
              stats={stats}
              loading={loadingStats}
              onNavigate={(tab, options) => {
                setFilterCategory(options?.category || "");
                setFilterRead(options?.readFilter || "");
                setCurrentTab(tab);
              }}
              onSelectBook={setSelectedBook}
            />
          )}

          {currentTab === "books" && (
            <BooksView
              onSelectBook={setSelectedBook}
              onBookUpdated={() => refreshStats()}
              onNavigateDuplicates={() => {
                setFilterCategory("");
                setFilterRead("");
                setCurrentTab("duplicates");
              }}
              initialCategory={filterCategory}
              initialReadFilter={filterRead}
            />
          )}

          {currentTab === "duplicates" && (
            <DuplicatesView
              onSelectBook={setSelectedBook}
              onRefreshStats={refreshStats}
            />
          )}

          {currentTab === "errors" && (
            <ErrorsView
              onSelectBook={setSelectedBook}
              onNavigate={(tab) => {
                setFilterCategory("");
                setFilterRead("");
                setCurrentTab(tab);
              }}
              onRefreshStats={refreshStats}
              availableCategories={availableCategories}
            />
          )}

          {currentTab === "search" && (
            <SemanticSearchView
              onSelectBook={setSelectedBook}
            />
          )}

          {currentTab === "cluster" && (
            <ClusteringView
              onSelectBook={setSelectedBook}
              onRefreshStats={refreshStats}
            />
          )}

          {currentTab === "process" && (
            <ProcessView
              onProcessComplete={refreshStats}
            />
          )}
        </main>

        {/* Persistent Floating Widget (visible across all tabs when process is running) */}
        <ProcessFloatingWidget />

        {/* Global Live Log Drawer (accessible from any page via indicator or floating widget) */}
        <GlobalLogDrawer onNavigateToProcess={() => setCurrentTab("process")} />

        {/* Book Detail Modal */}
        <BookDetailModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onToggleRead={(updated) => {
            setSelectedBook(updated);
            refreshStats();
          }}
          onEditManual={(book) => {
            setSelectedBook(null);
            setManualBook(book);
            setManualModalOpen(true);
          }}
          onDeleteBook={() => {
            setSelectedBook(null);
            refreshStats();
          }}
          onNavigateDuplicates={() => {
            setSelectedBook(null);
            setFilterCategory("");
            setCurrentTab("duplicates");
          }}
        />

        {/* Global Manual Book Modal (when opened via BookDetailModal) */}
        <ManualBookModal
          isOpen={manualModalOpen}
          initialBook={manualBook}
          onClose={() => {
            setManualModalOpen(false);
            setManualBook(null);
          }}
          onSaved={(updated) => {
            refreshStats();
            setSelectedBook(updated);
          }}
          availableCategories={availableCategories}
        />

        {/* Footer */}
        <footer className="app-footer">
          <p>
            EPUB Archive Web App • Backends de IA Configurables (LM Studio, Ollama, OpenAI, Gemini) • ChromaDB + SQLite
          </p>
        </footer>
      </div>
    </ProcessProvider>
  );
}

export default function Home() {
  return <HomeContent />;
}
