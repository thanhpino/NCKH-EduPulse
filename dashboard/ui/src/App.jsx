import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Register from './pages/Register';

// Login.jsx sẽ do Dev A làm — placeholder tạm thời redirect thẳng sang Register
function LoginPlaceholder() {
  return <Navigate to="/register?mssv=B2012345" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPlaceholder />} />
        <Route path="/login" element={<LoginPlaceholder />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}
