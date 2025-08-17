const { Kafka } = require('kafkajs');
require('dotenv').config();

// Simple structured logging without log4js clustering
const structuredLogger = {
  info: (message, data = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: 'consumer',
      message,
      ...data
    }));
  },
  
  error: (message, data = {}) => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      service: 'consumer',
      message,
      ...data
    }));
  },
  
  warn: (message, data = {}) => {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      service: 'consumer',
      message,
      ...data
    }));
  },
  
  debug: (message, data = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      service: 'consumer',
      message,
      ...data
    }));
  }
};

// Kafka configuration
const kafka = new Kafka({
  clientId: 'sre-consumer',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const consumer = kafka.consumer({
  groupId: 'sre-consumer-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

// Message processors
const processUserActivity = (message) => {
  try {
    const activity = JSON.parse(message.value.toString());
    
    structuredLogger.info('User activity processed', {
      category: 'USER_ACTIVITY_PROCESSED',
      userId: activity.userId,
      action: activity.action,
      ipAddress: activity.ipAddress,
      timestamp: activity.timestamp,
      additionalData: activity.additionalData || {},
      kafkaPartition: message.partition,
      kafkaOffset: message.offset
    });
    
  } catch (error) {
    structuredLogger.error('Failed to process user activity message', {
      error: error.message,
      rawMessage: message.value.toString(),
      partition: message.partition,
      offset: message.offset
    });
  }
};

const processDatabaseChange = (message) => {
  try {
    const change = JSON.parse(message.value.toString());
    
    structuredLogger.info('Database change processed', {
      category: 'DATABASE_CHANGE_PROCESSED',
      operation: change.operation,
      table: change.table,
      timestamp: change.timestamp,
      changeData: change.changeData || {},
      kafkaPartition: message.partition,
      kafkaOffset: message.offset
    });
    
  } catch (error) {
    structuredLogger.error('Failed to process database change message', {
      error: error.message,
      rawMessage: message.value.toString(),
      partition: message.partition,
      offset: message.offset
    });
  }
};

const processTiCDCChange = (message) => {
  try {
    const cdcData = JSON.parse(message.value.toString());
    
    structuredLogger.info('TiCDC change processed', {
      category: 'TICDC_CHANGE_PROCESSED',
      operation: cdcData.type || 'unknown',
      database: cdcData.database,
      table: cdcData.table,
      timestamp: cdcData.ts || new Date().toISOString(),
      oldValues: cdcData.old || {},
      newValues: cdcData.new || {},
      kafkaPartition: message.partition,
      kafkaOffset: message.offset
    });
    
  } catch (error) {
    structuredLogger.error('Failed to process TiCDC message', {
      error: error.message,
      rawMessage: message.value.toString(),
      partition: message.partition,
      offset: message.offset
    });
  }
};

const startConsumer = async () => {
  try {
    structuredLogger.info('Starting Kafka consumer', {
      brokers: process.env.KAFKA_BROKER || 'localhost:9092',
      groupId: 'sre-consumer-group'
    });

    await consumer.connect();
    structuredLogger.info('Connected to Kafka successfully');

    // Subscribe to topics
    await consumer.subscribe({
      topics: ['user_activities', 'database_changes', 'tidb_changes'],
      fromBeginning: false
    });

    structuredLogger.info('Subscribed to topics', {
      topics: ['user_activities', 'database_changes', 'tidb_changes']
    });

    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const messageInfo = {
          topic,
          partition,
          offset: message.offset,
          timestamp: message.timestamp,
          key: message.key?.toString(),
          messageSize: message.value?.length || 0
        };

        structuredLogger.debug('Received message', messageInfo);

        try {
          switch (topic) {
            case 'user_activities':
              processUserActivity(message);
              break;
            case 'database_changes':
              processDatabaseChange(message);
              break;
            case 'tidb_changes':
              processTiCDCChange(message);
              break;
            default:
              structuredLogger.warn('Unknown topic received', {
                topic,
                partition,
                offset: message.offset
              });
          }
        } catch (error) {
          structuredLogger.error('Error processing message', {
            ...messageInfo,
            error: error.message,
            stack: error.stack
          });
        }
      },
    });

  } catch (error) {
    structuredLogger.error('Failed to start consumer', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Graceful shutdown handling
const gracefulShutdown = async () => {
  structuredLogger.info('Shutting down consumer gracefully');
  
  try {
    await consumer.disconnect();
    structuredLogger.info('Consumer disconnected successfully');
  } catch (error) {
    structuredLogger.error('Error during consumer shutdown', {
      error: error.message
    });
  }
  
  process.exit(0);
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  structuredLogger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  structuredLogger.error('Unhandled rejection', {
    reason: reason?.message || reason,
    promise: promise.toString()
  });
  process.exit(1);
});

// Start the consumer
structuredLogger.info('SRE Consumer Service Starting', {
  nodeVersion: process.version,
  platform: process.platform,
  environment: process.env.NODE_ENV || 'development'
});

startConsumer();