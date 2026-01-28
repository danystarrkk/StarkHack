import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/Home';
import DirectoryPage from './pages/Directory';
import MachineListingsPage from './pages/Machines';
import WriteupViewPage from './pages/Writeup';
import AboutPage from './pages/About';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/directory" element={<DirectoryPage />} />
          {/* Dynamic Route for Machines List by Platform */}
          <Route path="/machines/:platformId" element={<MachineListingsPage />} />
          {/* Dynamic Route for Specific Writeup */}
          <Route path="/writeup/:platformId/:slug" element={<WriteupViewPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;