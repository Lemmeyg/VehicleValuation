import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import DirectoryPreview from './components/DirectoryPreview';
import Pricing from './components/Pricing';
import KnowledgeBasePreview from './components/KnowledgeBasePreview';
import Footer from './components/Footer';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Navbar />
      <main className="flex-grow">
        <Hero />
        <Features />
        <KnowledgeBasePreview />
        <DirectoryPreview />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
};

export default App;