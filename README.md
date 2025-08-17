# SRE Assignment - Full Stack Application with Monitoring

A complete full-stack application demonstrating DevOps and SRE practices with authentication, real-time monitoring, change data capture, and message processing.

## 🏗️ Architecture Overview

This application implements a modern microservices architecture with comprehensive monitoring and logging:

- **Frontend**: React.js application with JWT authentication
- **Backend**: Node.js/Express API with structured logging
- **Database**: TiDB with Change Data Capture (CDC)
- **Message Queue**: Apache Kafka for real-time processing
- **Monitoring**: log4js with JSON structured logging
- **Containerization**: Docker & Docker Compose

## 🚀 Quick Start

### Prerequisites

- Docker Desktop or Docker Engine
- docker-compose
- 8GB+ RAM recommended
- Ports 3000, 3001, 4000, 9092, 2181, 8300 available

### One-Command Deployment

```bash
# Make the startup script executable
chmod +x start.sh

# Start the entire application
./start.sh
```

**Alternative using docker-compose directly:**

```bash
docker-compose up --build
```

### Access the Application

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **API Health**: http://localhost:3001/health

### Default Credentials

```
Email: admin@sre-assignment.local
Password: admin123
```

**⚠️ SECURITY WARNING: Change the default password immediately!**

## 📊 Application Features

### Part 1: Simple Development ✅

- **Full-stack Application**: React frontend + Node.js backend
- **RESTful API**: Express.js with comprehensive endpoints
- **TiDB Integration**: High-performance distributed database
- **JWT Authentication**: Secure token-based authentication
- **Form Validation**: Client and server-side validation
- **User Management**: Registration, login, profile management

### Part 2: DevOps Implementation ✅

- **Docker Containerization**: All services containerized
- **Multi-service Architecture**: Frontend, backend, database, message queue
- **Apache Kafka**: Message broker for real-time processing
- **TiDB in Docker**: Complete TiDB cluster (PD, TiKV, TiDB)
- **Automatic Initialization**: Database schema and default user creation
- **Health Checks**: Service health monitoring and readiness probes

### Part 3: Monitoring & Logging (SRE Implementation) ✅

- **Structured Logging**: log4js with JSON format across all services
- **User Activity Tracking**: Every login logged with timestamp, user ID, IP
- **Change Data Capture**: TiCDC monitors all database operations
- **Real-time Processing**: Kafka consumer processes database changes
- **Comprehensive Monitoring**: API requests, database operations, user activities

## 🛠️ Technology Stack

| Component        | Technology        | Purpose                     |
| ---------------- | ----------------- | --------------------------- |
| Frontend         | React.js          | User interface              |
| Backend          | Node.js + Express | REST API                    |
| Database         | TiDB              | Distributed SQL database    |
| Message Queue    | Apache Kafka      | Event streaming             |
| Logging          | log4js            | Structured logging          |
| Containerization | Docker + Compose  | Service orchestration       |
| Authentication   | JWT               | Secure token authentication |
| CDC              | TiCDC             | Change data capture         |

## 📁 Project Structure

```
sre-assignment/
├── docker-compose.yml          # Service orchestration
├── start.sh                    # Startup script
├── README.md                   # This file
├── backend/                    # Node.js API
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js              # Main server
│   ├── config/                # Configuration files
│   │   ├── database.js        # Database connection
│   │   ├── kafka.js           # Kafka producer
│   │   └── logger.js          # Logging configuration
│   ├── routes/                # API routes
│   │   └── auth.js            # Authentication routes
│   └── middleware/            # Express middleware
│       └── auth.js            # JWT validation
├── frontend/                  # React application
│   ├── Dockerfile
│   ├── nginx.conf             # Nginx configuration
│   ├── package.json
│   ├── src/
│   │   ├── App.js             # Main app component
│   │   ├── App.css            # Styles
│   │   ├── components/        # React components
│   │   │   ├── LoginForm.js   # Login interface
│   │   │   ├── RegisterForm.js # Registration interface
│   │   │   └── Dashboard.js   # User dashboard
│   │   └── context/           # React context
│   │       └── AuthContext.js # Authentication context
├── consumer/                  # Kafka consumer
│   ├── Dockerfile
│   ├── package.json
│   └── consumer.js            # Message processor
└── db-init/                   # Database initialization
    ├── Dockerfile
    ├── package.json
    └── init.js                # Schema and data setup
```

## 🔧 Service Details

### API Service (Port 3001)

- **Framework**: Express.js with middleware
- **Features**: JWT auth, rate limiting, CORS, helmet security
- **Endpoints**:
  - `POST /api/auth/register` - User registration
  - `POST /api/auth/login` - User login
  - `POST /api/auth/logout` - User logout
  - `GET /api/auth/profile` - Get user profile
  - `GET /api/auth/verify` - Verify JWT token
  - `GET /health` - Health check
  - `GET /api/db-status` - Database status

### Frontend Service (Port 3000)

- **Framework**: React.js with hooks
- **Features**: Responsive design, form validation, routing
- **Pages**: Login, Register, Dashboard
- **Authentication**: JWT token management with auto-refresh

### Database Service (TiDB - Port 4000)

- **Architecture**: Distributed SQL database
- **Components**: PD (Placement Driver), TiKV (Storage), TiDB (SQL Layer)
- **Features**: ACID transactions, horizontal scaling
- **Tables**: users, user_tokens, activity_logs, system_settings

### Message Queue (Kafka - Port 9092)

- **Topics**:
  - `user_activities` - User login/logout events
  - `database_changes` - Database change notifications
  - `tidb_changes` - TiCDC change data capture
- **Consumer**: Processes and logs all messages

### Change Data Capture (TiCDC - Port 8300)

- **Purpose**: Monitors all database changes
- **Output**: Streams changes to Kafka topics
- **Format**: Structured JSON with old/new values

## 📝 Logging Implementation

### Structured JSON Logging

All services use consistent JSON logging format:

```json
{
  "timestamp": "2025-08-16T10:30:45.123Z",
  "level": "INFO",
  "category": "AUTHENTICATION",
  "action": "LOGIN",
  "userId": 123,
  "ipAddress": "192.168.1.100",
  "email": "user@example.com"
}
```

### Log Categories

- **USER_ACTIVITY**: Login, logout, registration events
- **DATABASE_CHANGE**: INSERT, UPDATE, DELETE operations
- **API_REQUEST**: HTTP request/response logging
- **SYSTEM_EVENT**: Service startup, errors, health checks

### Viewing Logs

```bash
# View real-time logs for specific services
docker-compose logs -f api      # API service logs
docker-compose logs -f consumer # Consumer service logs
docker-compose logs -f ticdc    # TiCDC logs

# View all logs
docker-compose logs -f

# Search logs for specific events
docker-compose logs api | grep "LOGIN"
docker-compose logs consumer | grep "DATABASE_CHANGE"
```

## 🔍 Monitoring Features

### 1. User Activity Logging ✅

- **Trigger**: Every user login/logout
- **Format**: JSON with timestamp, user ID, action, IP address
- **Storage**: Console logs + file logs
- **Tool**: log4js

### 2. Database Change Monitoring ✅

- **Method**: TiCDC (Change Data Capture)
- **Coverage**: All INSERT/UPDATE/DELETE operations
- **Processing**: Real-time Kafka message processing
- **Format**: Structured JSON with old/new values

### 3. Real-time Data Processing ✅

- **Consumer**: Node.js Kafka consumer
- **Topics**: user_activities, database_changes, tidb_changes
- **Processing**: Structured logging and potential analytics
- **Format**: Consistent JSON structure

## 🐳 Docker Configuration

### Services

- **tidb**: TiDB SQL layer
- **pd**: Placement Driver (metadata management)
- **tikv**: TiKV storage engine
- **ticdc**: Change Data Capture component
- **zookeeper**: Kafka coordination service
- **kafka**: Message broker
- **api**: Backend Node.js service
- **frontend**: React application with Nginx
- **consumer**: Kafka message consumer
- **db-init**: Database initialization

### Volumes

- Persistent storage for TiDB, Kafka, and logs
- Automatic data persistence across container restarts

### Networking

- Internal Docker network for service communication
- Exposed ports for external access

## 🔧 Development

### Local Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd sre-assignment

# Start development environment
docker-compose up --build

# Or use the startup script
chmod +x start.sh
./start.sh
```

### Making Changes

```bash
# Rebuild specific service after changes
docker-compose build api
docker-compose up -d api

# View logs during development
docker-compose logs -f api

# Access container for debugging
docker exec -it sre-api /bin/sh
```

### Environment Variables

Create `.env` files in each service directory for local configuration:

**backend/.env**

```env
NODE_ENV=development
DB_HOST=tidb
DB_PORT=4000
DB_USER=root
DB_PASSWORD=
DB_NAME=sre_app
JWT_SECRET=your-super-secret-jwt-key-change-in-production
KAFKA_BROKER=kafka:9092
```

**frontend/.env**

```env
REACT_APP_API_URL=http://localhost:3001
```

## 🧪 Testing

### Manual Testing

1. **Registration Flow**:

   - Go to http://localhost:3000
   - Click "Create one here"
   - Fill out registration form
   - Check logs for user activity

2. **Login Flow**:

   - Use default credentials or newly created account
   - Verify JWT token storage
   - Check dashboard access

3. **Database Changes**:
   - Perform any database operation
   - Check consumer logs for CDC events
   - Verify structured logging

### Health Checks

```bash
# Check API health
curl http://localhost:3001/health

# Check database status
curl http://localhost:3001/api/db-status

# Check frontend
curl http://localhost:3000/health
```

### Log Verification

```bash
# Verify user activity logging
docker-compose logs api | grep "AUTHENTICATION"

# Verify database change capture
docker-compose logs consumer | grep "DATABASE_CHANGE"

# Verify TiCDC is running
docker-compose logs ticdc
```

## 🚨 Troubleshooting

### Common Issues

**1. Port Conflicts**

```bash
# Check if ports are in use
netstat -an | grep :3000
netstat -an | grep :3001
netstat -an | grep :4000
netstat -an | grep :9092

# Stop conflicting services
docker-compose down
```

**2. Database Connection Issues**

```bash
# Check TiDB logs
docker-compose logs tidb

# Verify database is running
docker exec tidb-server mysql -h 127.0.0.1 -P 4000 -u root -e "SELECT 1"
```

**3. Kafka Issues**

```bash
# Check Kafka logs
docker-compose logs kafka

# List Kafka topics
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list
```

**4. Memory Issues**

```bash
# Check Docker resource usage
docker stats

# Increase Docker memory allocation (recommended: 8GB+)
```

### Service Dependencies

Services start in this order:

1. **pd** (Placement Driver)
2. **tikv** (Storage)
3. **tidb** (Database)
4. **zookeeper** → **kafka**
5. **ticdc** (Change Data Capture)
6. **db-init** (Database initialization)
7. **api** (Backend service)
8. **frontend** (React app)
9. **consumer** (Message processor)

### Log Locations

- **API logs**: `backend/logs/`
- **Consumer logs**: `consumer/logs/`
- **TiCDC logs**: `ticdc_logs/` volume
- **Container logs**: `docker-compose logs <service>`

## 🔒 Security Considerations

### Production Deployment

1. **Change Default Credentials**:

   ```sql
   UPDATE users SET password = ? WHERE email = 'admin@sre-assignment.local';
   ```

2. **Environment Variables**:

   - Use strong JWT secrets
   - Configure proper database passwords
   - Set up SSL/TLS certificates

3. **Network Security**:

   - Use internal Docker networks
   - Configure firewall rules
   - Enable HTTPS

4. **Database Security**:
   - Create dedicated database users
   - Implement proper access controls
   - Enable audit logging

## 📊 Performance Optimization

### Monitoring

- **API Response Times**: Built-in request logging
- **Database Performance**: TiDB monitoring dashboard
- **Kafka Lag**: Consumer group monitoring
- **Memory Usage**: Docker stats monitoring

### Scaling

- **Horizontal**: Add more API/Consumer instances
- **Database**: TiDB auto-scaling with more TiKV nodes
- **Kafka**: Add more brokers and partitions
- **Load Balancing**: Nginx for frontend, load balancer for API

## 🤝 Contributing

### Code Style

- **JavaScript**: ESLint configuration
- **React**: Functional components with hooks
- **Logging**: Consistent JSON structure
- **Error Handling**: Proper try-catch blocks

### Commit Guidelines

- Use conventional commits
- Include tests for new features
- Update documentation for changes
- Verify all services work after changes

## 📋 Assignment Checklist

### Part 1: Simple Development ✅

- [x] Node.js backend with Express
- [x] React frontend
- [x] RESTful API
- [x] TiDB database integration
- [x] Login screen with validation
- [x] JWT token management
- [x] Database token storage

### Part 2: DevOps Implementation ✅

- [x] Docker containers for all services
- [x] Dockerfiles for each service
- [x] TiDB in Docker environment
- [x] Apache Kafka integration
- [x] Automatic database initialization
- [x] Default user creation

### Part 3: Monitoring & Logging ✅

- [x] log4js implementation
- [x] JSON formatted user activity logs
- [x] TiCDC for database change monitoring
- [x] TiCDC component in docker-compose
- [x] Automatic CDC task startup
- [x] Kafka consumer for change processing
- [x] Structured logging format
- [x] Real-time data processing

### Submission Requirements ✅

- [x] Complete source code
- [x] Docker configuration files
- [x] Database schema and seed files
- [x] README.md with setup instructions
- [x] Single command deployment

## 🎯 Key Features Demonstrated

1. **Full-Stack Development**: Complete React + Node.js application
2. **Database Integration**: TiDB with proper schema design
3. **Authentication**: Secure JWT-based auth system
4. **Containerization**: Multi-service Docker environment
5. **Message Queue**: Kafka for real-time processing
6. **Change Data Capture**: TiCDC monitoring all database changes
7. **Structured Logging**: Comprehensive log4js implementation
8. **Real-time Processing**: Kafka consumer processing CDC events
9. **DevOps Practices**: Infrastructure as code, health checks
10. **SRE Implementation**: Monitoring, logging, observability

---

**🎉 Congratulations! You've successfully deployed a complete SRE monitoring application with real-time change data capture, structured logging, and message processing capabilities.**
