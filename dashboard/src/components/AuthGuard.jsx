import { Navigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const AuthGuard = ({ children, requireAdmin = false }) => {
  const location = useLocation();
  const token = localStorage.getItem('auth_token');

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  try {
    const decoded = jwtDecode(token);
    const currentTime = Date.now() / 1000;

    if (decoded.exp < currentTime) {
      localStorage.removeItem('auth_token');
      return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (requireAdmin && decoded.role !== 'admin') {
      return <Navigate to="/unauthorized" replace />;
    }

    return children;
  } catch (error) {
    localStorage.removeItem('auth_token');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
};

export default AuthGuard;
