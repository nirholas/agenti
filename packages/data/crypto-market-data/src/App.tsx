/**
 * Crypto Market Data App
 * https://github.com/nirholas/crypto-market-data
 */

import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useThemeStore } from './stores/themeStore';
import MarketsPage from './pages/MarketsPage';
import Footer from './components/Footer';

const basename = import.meta.env.BASE_URL;

function App() {
  const { mode } = useThemeStore();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  return (
    <Router basename={basename}>
      <div className={`min-h-screen ${mode === 'dark' ? 'dark' : ''}`}>
        <div className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen">
          <main className="pb-20 md:pb-0">
            <Routes>
              <Route path="/" element={<MarketsPage />} />
              <Route path="/markets" element={<MarketsPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </div>
    </Router>
  );
}

export default App;
