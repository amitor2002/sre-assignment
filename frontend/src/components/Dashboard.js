import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [systemStatus, setSystemStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSystemStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const [healthResponse, dbResponse] = await Promise.all([
        axios.get('/health'),
        axios.get('/api/db-status')
      ]);

      setSystemStatus({
        api: healthResponse.data,
        database: dbResponse.data,
        lastUpdated: new Date().toISOString()
      });
      setError('');
    } catch (err) {
      setError('Failed to fetch system status');
      console.error('System status error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const StatusCard = ({ title, status, details }) => (
    <div className={`status-card ${status === 'healthy' || status === 'connected' ? 'healthy' : 'error'}`}>
      <div className="status-header">
        <h3>{title}</h3>
        <span className={`status-indicator ${status === 'healthy' || status === 'connected' ? 'healthy' : 'error'}`}>
          {status === 'healthy' || status === 'connected' ? '🟢' : '🔴'}
        </span>
      </div>
      <div className="status-details">
        {details && Object.entries(details).map(([key, value]) => (
          <div key={key} className="detail-item">
            <span className="detail-key">{key}:</span>
            <span className="detail-value">{typeof value === 'object' ? JSON.stringify(value) : value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="user-info">
          <h1>Welcome, {user?.firstName}!</h1>
          <p>SRE Monitoring Dashboard</p>
        </div>
        <div className="dashboard-actions">
          <button onClick={fetchSystemStatus} className="refresh-button">
            🔄 Refresh
          </button>
          <button onClick={handleLogout} className="logout-button">
            🚪 Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      <div className="dashboard-content">
        <div className="user-profile-section">
          <div className="profile-card">
            <h2>User Profile</h2>
            <div className="profile-details">
              <div className="profile-item">
                <span className="profile-label">Name:</span>
                <span className="profile-value">{user?.firstName} {user?.lastName}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Email:</span>
                <span className="profile-value">{user?.email}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">User ID:</span>
                <span className="profile-value">{user?.id}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="system-status-section">
          <h2>System Status</h2>
          <div className="status-grid">
            <StatusCard 
              title="API Service" 
              status={systemStatus.api?.status}
              details={{
                uptime: systemStatus.api?.uptime ? `${Math.floor(systemStatus.api.uptime)}s` : 'N/A',
                environment: systemStatus.api?.environment || 'N/A',
                timestamp: systemStatus.api?.timestamp || 'N/A'
              }}
            />
            
            <StatusCard 
              title="Database" 
              status={systemStatus.database?.database}
              details={{
                connection: systemStatus.database?.database || 'N/A',
                result: systemStatus.database?.result ? 'Query successful' : 'N/A'
              }}
            />
          </div>

          {systemStatus.lastUpdated && (
            <div className="status-footer">
              <p>Last updated: {new Date(systemStatus.lastUpdated).toLocaleString()}</p>
            </div>
          )}
        </div>

        <div className="monitoring-info-section">
          <h2>SRE Features Active</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Activity Logging</h3>
              <p>Every user action is logged in JSON format using log4js. Login activities are tracked with timestamps, user IDs, and IP addresses.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Change Data Capture</h3>
              <p>TiDB CDC monitors all database changes in real-time. Every INSERT, UPDATE, and DELETE operation is captured and logged.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Kafka Integration</h3>
              <p>Apache Kafka processes database changes and user activities. A dedicated consumer application processes these messages in real-time.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🐳</div>
              <h3>Containerized Architecture</h3>
              <p>Entire application runs in Docker containers. TiDB, Kafka, API, frontend, and consumer services are all orchestrated with docker-compose.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔐</div>
              <h3>JWT Authentication</h3>
              <p>Secure token-based authentication with database-stored tokens. All API requests are authenticated using Bearer tokens in headers.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Real-time Monitoring</h3>
              <p>Structured logging with consistent JSON format across all services. Database operations, user activities, and system events are monitored.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;