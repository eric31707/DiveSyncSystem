import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/common/AppLayout';
import DashboardPage from './pages/DashboardPage';
import DiveListPage from './pages/DiveListPage';
import UploadPage from './pages/UploadPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="dives" element={<DiveListPage />} />
          <Route path="upload" element={<UploadPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
