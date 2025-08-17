const { Kafka } = require('kafkajs');

// Simple console logger
const logger = {
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

const kafka = new Kafka({
  clientId: 'sre-backend-api',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const producer = kafka.producer({
  maxInFlightRequests: 1,
  idempotent: true,
  transactionTimeout: 30000,
});

const kafkaProducer = {
  async connect() {
    try {
      await producer.connect();
      logger.info('Kafka producer connected successfully');
    } catch (error) {
      logger.error('Failed to connect Kafka producer', { error: error.message });
      throw error;
    }
  },

  async sendMessage(topic, message) {
    try {
      const result = await producer.send({
        topic,
        messages: [
          {
            key: message.key || null,
            value: JSON.stringify(message),
            timestamp: Date.now().toString()
          }
        ]
      });
      
      logger.info('Message sent to Kafka', {
        topic,
        messageId: message.key,
        partition: result[0].partition,
        offset: result[0].baseOffset
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to send message to Kafka', {
        topic,
        error: error.message,
        message: message
      });
      throw error;
    }
  },

  async sendUserActivity(action, userId, ipAddress, additionalData = {}) {
    const activity = {
      key: `user_${userId}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      category: 'USER_ACTIVITY',
      action: action.toUpperCase(),
      userId,
      ipAddress,
      ...additionalData
    };

    try {
      await this.sendMessage('user_activities', activity);
      logger.logAuth(action, userId, ipAddress, additionalData);
    } catch (error) {
      logger.error('Failed to send user activity to Kafka', {
        action,
        userId,
        error: error.message
      });
    }
  },

  async sendDatabaseChange(operation, table, data = {}) {
    const change = {
      key: `db_${table}_${Date.now()}`,
      timestamp: new Date().toISOString(),
      category: 'DATABASE_CHANGE',
      operation: operation.toUpperCase(),
      table,
      ...data
    };

    try {
      await this.sendMessage('database_changes', change);
      logger.logDatabase(operation, table, data);
    } catch (error) {
      logger.error('Failed to send database change to Kafka', {
        operation,
        table,
        error: error.message
      });
    }
  },

  async disconnect() {
    try {
      await producer.disconnect();
      logger.info('Kafka producer disconnected');
    } catch (error) {
      logger.error('Error disconnecting Kafka producer', { error: error.message });
    }
  }
};

module.exports = kafkaProducer;