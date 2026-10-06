import { Link, Outlet, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import './ProfileLayout.css';

export function ProfileLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="profile-layout-wrapper">
      <div className="profile-header-top">
        <h1>Settings</h1>
        <p>Configure your personal and security preferences</p>
      </div>
      <div className="profile-layout">
        <div className="profile-sidebar">
          <nav className="profile-nav">
            <Link
              to="/app/profile"
              className={`profile-nav-item ${currentPath === '/app/profile' ? 'active' : ''}`}
            >
              <span>Personal Info</span>
              {currentPath === '/app/profile' && <ChevronRight size={16} className="nav-chevron" />}
            </Link>
            <Link
              to="/app/profile/theme"
              className={`profile-nav-item ${currentPath === '/app/profile/theme' ? 'active' : ''}`}
            >
              <span>Theme & Appearance</span>
              {currentPath === '/app/profile/theme' && <ChevronRight size={16} className="nav-chevron" />}
            </Link>
            {user?.username !== 'admin' && (
              <Link
                to="/app/profile/ai"
                className={`profile-nav-item ${currentPath === '/app/profile/ai' ? 'active' : ''}`}
              >
                <span>AI Preferences</span>
                {currentPath === '/app/profile/ai' && <ChevronRight size={16} className="nav-chevron" />}
              </Link>
            )}
            <Link
              to="/app/profile/security"
              className={`profile-nav-item ${currentPath === '/app/profile/security' ? 'active' : ''}`}
            >
              <span>Security</span>
              {currentPath === '/app/profile/security' && <ChevronRight size={16} className="nav-chevron" />}
            </Link>
            {user?.username !== 'admin' && (
              <Link
                to="/app/profile/storage"
                className={`profile-nav-item ${currentPath === '/app/profile/storage' ? 'active' : ''}`}
              >
                <span>Storage</span>
                {currentPath === '/app/profile/storage' && <ChevronRight size={16} className="nav-chevron" />}
              </Link>
            )}
          </nav>
        </div>
        <div className="profile-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
