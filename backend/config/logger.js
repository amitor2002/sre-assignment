// Simple structured logging without log4js clustering
const structuredLogger = {
  info: (message, data = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      ...data
    }));
  },
  
  error: (message, data = {}) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      ...data
    }));
  },
  
  warn: (message, data = {}) => {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      ...data
    }));
  },
  
  debug: (message, data = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      message,
      ...data
    }));
  },
  
  logAuth: (action, userId, ip, data = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      category: 'AUTHENTICATION',
      action,
      userId,
      ipAddress: ip,
      ...data
    }));
  },
  
  logDatabase: (operation, table, data = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      category: 'DATABASE',
      operation,
      table,
      ...data
    }));
  }
};

module.exports = structuredLogger;