"use client";

import React, { useState, useEffect } from "react";
import { Navbar, NavTab } from "@/components/Navbar";
import { DashboardView } from "@/components/DashboardView";
import { BooksView } from "@/components/BooksView";
import { SemanticSearchView } from "@/components/SemanticSearchView";
import { ClusteringView } from "@/components/ClusteringView";
import { ProcessView } from "@/components/ProcessView";
import { ErrorsView } from "@/components/ErrorsView";
import { BookDetailModal } from "@/components/BookDetailModal";
import { ManualBookModal } from "@/components/ManualBookModal";
import { BookDetail } from "@/lib/db";

export default function Home() {
  const [currentTab, setCurrentTab] = useState<NavTab>("dashboard");
  const [stats, setStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [selectedBook, setSelectedBook] = useState<BookDetail | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("");
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
    setCurrentTab("books");
  };

  const availableCategories = stats?.topCategories?.map((c: any) => c.name) || [];

  return (
    <div className="app-wrapper">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setFilterCategory("");
          setCurrentTab(tab);
        }}
        totalBooks={stats?.totalBooks}
        errorBooks={stats?.errorBooks}
      />

      {/* Main View Area with generous edge margins */}
      <main className="app-main">
        {currentTab === "dashboard" && (
          <DashboardView
            stats={stats}
            loading={loadingStats}
            onNavigate={(tab) => {
              setFilterCategory("");
              setCurrentTab(tab);
            }}
            onSelectBook={setSelectedBook}
          />
        )}

        {currentTab === "books" && (
          <BooksView
            onSelectBook={setSelectedBook}
            onBookUpdated={() => refreshStats()}
            initialCategory={filterCategory}
          />
        )}

        {currentTab === "errors" && (
          <ErrorsView
            onSelectBook={setSelectedBook}
            onNavigate={(tab) => {
              setFilterCategory("");
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
          EPUB Archive Web App • Modelos Locales LM Studio • ChromaDB + SQLite
        </p>
      </footer>
    </div>
  );
}
