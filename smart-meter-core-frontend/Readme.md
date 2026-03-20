# SmartMeter Core - Enterprise Energy Monitoring & AI Analytics Platform

A comprehensive full-stack energy management platform featuring real-time monitoring, AI-driven insights, load forecasting, and multi-role administration capabilities for consumers, utilities, and system administrators.

---

## 📋 Table of Contents

- [Platform Overview](#platform-overview)
- [Features](#features)
- [Architecture](#architecture)
- [API Specifications](#api-specifications)
- [Data Models](#data-models)
- [Authentication & Authorization](#authentication--authorization)
- [Integration Guide](#integration-guide)
- [Frontend Routes](#frontend-routes)
- [State Management](#state-management)

---

## 🎯 Platform Overview

**SmartMeter Core** is a role-based energy management system designed for:
- **Consumers**: Monitor personal energy usage, optimize bills, and access AI insights
- **Utilities**: Manage grid operations, analyze regional demand, and coordinate with consumers
- **Admins**: Monitor system health, manage users, and ensure compliance

### Technology Stack
- **Frontend**: Next.js 14, React 19, TypeScript, Tailwind CSS
- **State Management**: Zustand (for auth and energy data)
- **Charts & Visualization**: Recharts
- **UI Components**: shadcn/ui
- **Authentication**: Mock (to be replaced with real auth backend)

---

## ✨ Features

### Consumer Features

#### 1. **Real-Time Monitoring** (`/dashboard/monitoring`)
- Live power consumption (kW) and voltage readings (V)
- Current flow monitoring (A) and grid frequency (Hz)
- 24-hour rolling visualization with 5-minute intervals
- Real-time alerts for consumption spikes
- **Required APIs**:
  - `GET /api/consumer/realtime` - Stream live meter data
  - `WebSocket /ws/consumer/realtime/:meterId` - Real-time data feed

#### 2. **Dashboard** (`/dashboard/dashboard`)
- Key metrics: Current power usage, daily consumption, estimated monthly bill
- Today's consumption timeline (hourly breakdown)
- Weekly comparison chart
- Cost breakdown by time-of-use (peak/off-peak)
- **Required APIs**:
  - `GET /api/consumer/dashboard` - Dashboard summary data
  - `GET /api/consumer/usage/today` - Daily consumption data
  - `GET /api/consumer/usage/week` - Weekly comparison

#### 3. **Historical Data Analysis** (`/dashboard/historical`)
- Time-range filtering (24-hour, 7-day, 30-day, yearly)
- Consumption timeline with detailed metrics
- Temperature correlation tracking
- Bill history and trend analysis
- Peak hours identification
- **Required APIs**:
  - `GET /api/consumer/history?range=day|week|month|year` - Historical consumption
  - `GET /api/consumer/weather?date=YYYY-MM-DD` - Weather data correlation
  - `GET /api/consumer/billing/history?range=month` - Bill history

#### 4. **Load Forecast** (`/dashboard/forecast`)
- 24-hour hourly consumption forecast with confidence intervals
- Weekly consumption pattern prediction
- Grid pricing forecast (peak/off-peak hours)
- Radar chart: Current vs Optimal load profile comparison
- AI-driven optimization recommendations
- Estimated savings by shifting consumption
- **Required APIs**:
  - `GET /api/consumer/forecast/hourly` - 24-hour forecast with confidence intervals
  - `GET /api/consumer/forecast/weekly` - Weekly pattern prediction
  - `GET /api/consumer/pricing/forecast` - Grid pricing forecast
  - `GET /api/consumer/recommendations` - AI optimization recommendations

#### 5. **AI Energy Assistant** (`/dashboard/ai-chat`)
- Conversational AI for energy insights
- Dynamic chart generation based on queries
- Analysis capabilities:
  - Peak hours identification
  - Bill breakdown and forecasting
  - Savings opportunity detection
  - Anomaly detection (unusual consumption patterns)
- Suggested questions for quick access
- **Required APIs**:
  - `POST /api/ai/chat` - Chat completion endpoint
    - Request: `{ message: string, meterId: string }`
    - Response: `{ response: string, charts?: ChartData[], recommendations?: string[] }`
  - `GET /api/ai/analysis?type=peaks|bills|savings|anomalies` - Quick analysis endpoint

#### 6. **AI Insights** (`/dashboard/insights`)
- Efficiency score (0-100) with month-over-month comparison
- Appliance-level consumption breakdown
- Weather impact analysis (temperature correlation)
- Peer comparison (consumption vs neighborhood average)
- Prioritized recommendations with:
  - Action description
  - Estimated monthly savings ($)
  - Implementation difficulty
  - ROI timeline
- **Required APIs**:
  - `GET /api/consumer/insights/efficiency` - Efficiency score and trends
  - `GET /api/consumer/insights/appliances` - Appliance-level breakdown
  - `GET /api/consumer/insights/weather` - Weather correlation data
  - `GET /api/consumer/insights/peer-comparison` - Comparison with peers
  - `GET /api/consumer/insights/recommendations` - Prioritized recommendations

#### 7. **Load Control & Automation** (`/dashboard/automation`)
- Connected appliances management
  - List connected devices (HVAC, EV Charger, Water Heater, etc.)
  - Individual on/off control
  - Scheduled operation times
- Automation rules creation:
  - Peak-shaving rules (auto-turn off during peak hours)
  - Renewable energy maximization rules
  - Temperature-based triggers
  - Time-based schedules
- **Required APIs**:
  - `GET /api/consumer/devices` - List connected appliances
  - `POST /api/consumer/devices/:deviceId/control` - Control device
    - Request: `{ action: 'on'|'off', schedule?: { startTime, endTime } }`
  - `GET /api/consumer/automation/rules` - Get automation rules
  - `POST /api/consumer/automation/rules` - Create rule
    - Request: `{ name, type, condition, action, priority }`
  - `PUT /api/consumer/automation/rules/:ruleId` - Update rule
  - `DELETE /api/consumer/automation/rules/:ruleId` - Delete rule

---

### Utility Features

#### 1. **Utility Command Center** (`/dashboard/utility/dashboard`)
- Grid overview metrics:
  - Total grid load (MW)
  - Peak demand (MW)
  - Renewable generation (%)
  - System frequency (Hz)
  - Active consumer count
- Regional load distribution (heatmap)
- Consumer segmentation:
  - Residential clusters
  - Commercial clusters
  - Industrial clusters
- Demand response status
- **Required APIs**:
  - `GET /api/utility/grid/metrics` - Grid overview metrics
  - `GET /api/utility/grid/regional-load` - Regional load distribution
  - `GET /api/utility/consumers/segments` - Consumer segmentation
  - `GET /api/utility/demand-response/status` - DR program status

#### 2. **Consumer Management** (To be implemented)
- Consumer list with consumption metrics
- Disconnect/reconnect management
- Billing and payment tracking
- Complaint management
- **Required APIs**:
  - `GET /api/utility/consumers?page=1&limit=50` - List consumers
  - `GET /api/utility/consumers/:consumerId` - Consumer details
  - `POST /api/utility/consumers/:consumerId/actions` - Manage consumer

#### 3. **Demand Response Program** (To be implemented)
- Active DR events management
- Consumer enrollment tracking
- Response metrics and analytics
- **Required APIs**:
  - `GET /api/utility/dr-programs` - List DR programs
  - `POST /api/utility/dr-programs/:programId/activate` - Activate event
  - `GET /api/utility/dr-programs/:programId/participants` - Program participants

---

### Admin Features

#### 1. **System Health Dashboard** (`/dashboard/admin/health`)
- Infrastructure status:
  - API server health (uptime, response time)
  - Database health (connections, query performance)
  - Message queue status (pending jobs)
  - Cache system status
- SLA compliance tracking:
  - Uptime percentage
  - API response time
  - Error rate
  - Data sync latency
- System metrics:
  - Memory usage
  - CPU usage
  - Disk usage
  - Network bandwidth
- Detailed audit logs:
  - User actions
  - System events
  - Error logs
  - API request logs
- **Required APIs**:
  - `GET /api/admin/health/infrastructure` - Infrastructure status
  - `GET /api/admin/health/sla` - SLA metrics
  - `GET /api/admin/health/system` - System resource usage
  - `GET /api/admin/logs/audit?type=users|system|errors|api&limit=100&offset=0` - Audit logs
  - `GET /api/admin/logs/errors?severity=critical|warning|info` - Error logs

#### 2. **User Management** (To be implemented)
- User creation and role assignment
- Permission management
- User deactivation
- **Required APIs**:
  - `GET /api/admin/users` - List all users
  - `POST /api/admin/users` - Create user
  - `PUT /api/admin/users/:userId` - Update user
  - `DELETE /api/admin/users/:userId` - Deactivate user
  - `POST /api/admin/users/:userId/roles` - Assign role

#### 3. **System Configuration** (To be implemented)
- Rate limiting configuration
- API key management
- Feature flags
- **Required APIs**:
  - `GET /api/admin/config` - Get configuration
  - `PUT /api/admin/config` - Update configuration
  - `POST /api/admin/api-keys` - Generate API key

---

## 🏗️ Architecture

### Frontend Structure
```
app/
├── (dashboard)/
│   ├── dashboard/              # Consumer main dashboard
│   ├── monitoring/             # Real-time monitoring
│   ├── historical/             # Historical data analysis
│   ├── forecast/               # Load forecasting
│   ├── ai-chat/                # AI Energy Assistant
│   ├── insights/               # AI Insights
│   ├── automation/             # Load control & automation
│   ├── utility/
│   │   └── dashboard/          # Utility command center
│   └── admin/
│       └── health/             # System health dashboard
├── login/                      # Authentication page
├── page.tsx                    # Home/redirect page
├── layout.tsx                  # Root layout
└── globals.css                 # Global styles

components/
├── layout/
│   ├── sidebar.tsx             # Role-based navigation
│   ├── navbar.tsx              # Top navigation bar
│   └── dashboard-layout.tsx    # Protected layout wrapper
├── mode-toggle.tsx             # Light/dark theme toggle
└── ui/                         # shadcn/ui components

lib/
├── store/
│   ├── use-auth-store.ts       # Authentication state
│   └── use-energy-store.ts     # Energy data state
└── utils.ts                    # Utility functions

hooks/
└── use-realtime-energy.ts      # Real-time data simulation
```

---

## 🔌 API Specifications

### Base URL
```
https://api.smartmeter.local/v1
```

### Authentication
All endpoints (except `/auth/login`) require:
```
Authorization: Bearer {JWT_TOKEN}
```

---

### Authentication Endpoints

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "role": "CONSUMER|UTILITY|ADMIN"
}

Response (200):
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "usr_123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "CONSUMER",
    "meterId": "MTR-8829-X1"
  },
  "expiresIn": 86400
}
```

#### Logout
```
POST /auth/logout
Authorization: Bearer {JWT_TOKEN}

Response (200):
{ "message": "Logged out successfully" }
```

#### Refresh Token
```
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response (200):
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 86400
}
```

---

### Consumer Energy Endpoints

#### Get Real-Time Data
```
GET /consumer/realtime?meterId={METER_ID}

Response (200):
{
  "meterId": "MTR-8829-X1",
  "timestamp": "2024-03-20T14:30:45Z",
  "usage": 3.2,           // kW
  "voltage": 230.5,       // V
  "current": 14.2,        // A
  "frequency": 49.98,     // Hz
  "cost": 0.45            // USD
}
```

#### Get Dashboard Summary
```
GET /consumer/dashboard?meterId={METER_ID}

Response (200):
{
  "currentUsage": 3.2,
  "dailyUsage": 12.4,
  "estimatedBill": 145.50,
  "costSavings": 32.15,
  "timeline": [
    { "time": "00:00", "usage": 0.8 },
    { "time": "01:00", "usage": 0.6 },
    ...
  ],
  "weeklyComparison": {
    "thisWeek": 87.3,
    "lastWeek": 92.5,
    "change": -5.6
  },
  "costBreakdown": {
    "peak": 89.30,
    "offPeak": 56.20
  }
}
```

#### Get Historical Data
```
GET /consumer/history?meterId={METER_ID}&range=day|week|month|year

Response (200):
{
  "range": "month",
  "data": [
    {
      "timestamp": "2024-03-01T00:00:00Z",
      "usage": 24.5,
      "cost": 35.40,
      "avgTemperature": 15.2,
      "peakHour": "18:30"
    },
    ...
  ],
  "summary": {
    "totalUsage": 730.5,
    "totalCost": 1061.25,
    "avgDaily": 24.35,
    "avgCost": 35.38,
    "peakDay": "2024-03-15",
    "peakDayUsage": 32.1
  }
}
```

#### Get Hourly Forecast
```
GET /consumer/forecast/hourly?meterId={METER_ID}

Response (200):
{
  "generatedAt": "2024-03-20T14:30:45Z",
  "forecast": [
    {
      "hour": "15:00",
      "predicted": 3.5,
      "lower_bound": 2.8,     // 80% confidence interval
      "upper_bound": 4.2,
      "reliability": 0.92
    },
    ...
  ],
  "modelMetrics": {
    "accuracy": 0.94,
    "lastUpdated": "2024-03-20T14:30:45Z"
  }
}
```

#### Get Weekly Forecast
```
GET /consumer/forecast/weekly?meterId={METER_ID}

Response (200):
{
  "weeklyPattern": [
    {
      "day": "Monday",
      "predicted": 85.3,
      "historical_avg": 83.2,
      "confidence": 0.89
    },
    ...
  ],
  "insights": [
    "Monday-Friday pattern shows 12% higher consumption",
    "Weekend usage is 18% lower"
  ]
}
```

#### Get Grid Pricing Forecast
```
GET /consumer/pricing/forecast?meterId={METER_ID}

Response (200):
{
  "forecast": [
    {
      "time": "15:00",
      "rate": 0.18,          // USD per kWh
      "period": "peak",
      "expectedLoad": 4500   // MW
    },
    ...
  ],
  "recommendation": "Shift consumption to 22:00-06:00 for 40% savings"
}
```

#### Get AI Recommendations
```
GET /consumer/recommendations?meterId={METER_ID}

Response (200):
{
  "recommendations": [
    {
      "id": "rec_001",
      "title": "Upgrade to Smart Thermostat",
      "description": "Automated temperature control based on occupancy",
      "estimatedSavings": 45.50,
      "difficulty": "medium",
      "roiMonths": 18,
      "priority": "high"
    },
    ...
  ],
  "generatedAt": "2024-03-20T14:30:45Z"
}
```

#### Get Connected Devices
```
GET /consumer/devices?meterId={METER_ID}

Response (200):
{
  "devices": [
    {
      "id": "dev_001",
      "name": "HVAC System",
      "type": "hvac",
      "status": "online",
      "currentUsage": 2.5,
      "estimatedMonthlyConsumption": 450,
      "controllable": true
    },
    ...
  ]
}
```

#### Control Device
```
POST /consumer/devices/{DEVICE_ID}/control?meterId={METER_ID}
Content-Type: application/json

{
  "action": "on|off",
  "schedule": {
    "startTime": "14:00",
    "endTime": "16:00"
  }
}

Response (200):
{
  "deviceId": "dev_001",
  "action": "executed",
  "newStatus": "on",
  "timestamp": "2024-03-20T14:30:45Z"
}
```

#### Get Automation Rules
```
GET /consumer/automation/rules?meterId={METER_ID}

Response (200):
{
  "rules": [
    {
      "id": "rule_001",
      "name": "Peak Hour Auto-Off",
      "type": "peak-shaving",
      "condition": "time >= 16:00 AND time <= 21:00",
      "action": "turn_off_device",
      "targetDevices": ["dev_001", "dev_003"],
      "enabled": true,
      "priority": "high"
    },
    ...
  ]
}
```

#### Create Automation Rule
```
POST /consumer/automation/rules?meterId={METER_ID}
Content-Type: application/json

{
  "name": "Weekend AC Off",
  "type": "scheduled",
  "condition": "dayOfWeek IN [Saturday, Sunday]",
  "action": "turn_off_device",
  "targetDevices": ["dev_001"],
  "priority": "medium",
  "enabled": true
}

Response (201):
{
  "id": "rule_002",
  ...
}
```

#### Update Automation Rule
```
PUT /consumer/automation/rules/{RULE_ID}?meterId={METER_ID}
Content-Type: application/json

{
  "enabled": false,
  "priority": "low"
}

Response (200):
{
  "id": "rule_002",
  ...
}
```

#### Delete Automation Rule
```
DELETE /consumer/automation/rules/{RULE_ID}?meterId={METER_ID}

Response (204): No Content
```

---

### AI Endpoints

#### Chat Completion
```
POST /ai/chat
Content-Type: application/json

{
  "message": "What are my peak usage hours?",
  "meterId": "MTR-8829-X1",
  "context": "last_7_days"
}

Response (200):
{
  "response": "Your peak usage hours are between 18:00 and 21:00...",
  "charts": [
    {
      "type": "bar",
      "title": "Usage by Hour",
      "data": [...]
    }
  ],
  "suggestions": [
    "Shift laundry to off-peak hours",
    "Use time-of-use rates to your advantage"
  ],
  "confidence": 0.94
}
```

#### Get Quick Analysis
```
GET /ai/analysis?meterId={METER_ID}&type=peaks|bills|savings|anomalies&range=7days

Response (200):
{
  "analysisType": "peaks",
  "insights": [...],
  "charts": [...],
  "generatedAt": "2024-03-20T14:30:45Z"
}
```

---

### Insights Endpoints

#### Get Efficiency Score
```
GET /consumer/insights/efficiency?meterId={METER_ID}

Response (200):
{
  "score": 78,
  "grade": "B",
  "trend": "improving",
  "monthChange": 5,
  "benchmarkComparison": {
    "yourUsage": 730.5,
    "similarHomes": 820.3,
    "percentBetter": 12
  }
}
```

#### Get Appliance Breakdown
```
GET /consumer/insights/appliances?meterId={METER_ID}

Response (200):
{
  "appliances": [
    {
      "name": "HVAC System",
      "percentage": 42,
      "usage": 306.8,
      "cost": 445.87,
      "efficiency": "average",
      "recommendation": "Consider upgrading to ENERGY STAR certified model"
    },
    ...
  ]
}
```

#### Get Weather Correlation
```
GET /consumer/insights/weather?meterId={METER_ID}&range=month

Response (200):
{
  "correlation": {
    "heating": 0.78,        // Correlation with cold temperature
    "cooling": 0.85,        // Correlation with hot temperature
    "seasonal": "spring"
  },
  "data": [
    {
      "date": "2024-03-01",
      "usage": 24.5,
      "avgTemp": 12.5,
      "weatherType": "cloudy"
    },
    ...
  ]
}
```

#### Get Peer Comparison
```
GET /consumer/insights/peer-comparison?meterId={METER_ID}

Response (200):
{
  "yourUsage": 730.5,
  "peerAverage": 820.3,
  "percentBetter": 12,
  "demographics": {
    "houseSize": "2000 sqft",
    "occupants": 4,
    "buildingAge": 15
  },
  "topSavers": [
    {
      "savings": 180,
      "method": "Smart thermostat installation"
    }
  ]
}
```

#### Get Recommendations
```
GET /consumer/insights/recommendations?meterId={METER_ID}

Response (200):
{
  "recommendations": [
    {
      "id": "rec_001",
      "title": "Upgrade to Smart Thermostat",
      "category": "HVAC",
      "estimatedSavings": 45.50,
      "difficulty": "medium",
      "roiMonths": 18,
      "priority": "high",
      "description": "Automated temperature control based on occupancy",
      "steps": [...]
    },
    ...
  ]
}
```

---

### Utility Endpoints

#### Get Grid Metrics
```
GET /utility/grid/metrics

Response (200):
{
  "timestamp": "2024-03-20T14:30:45Z",
  "totalLoad": 4250.5,           // MW
  "peakDemand": 4800.0,          // MW
  "renewableGeneration": 32,     // %
  "frequency": 49.98,            // Hz
  "activeConsumers": 12450,
  "gridHealth": "optimal"
}
```

#### Get Regional Load Distribution
```
GET /utility/grid/regional-load

Response (200):
{
  "regions": [
    {
      "id": "reg_01",
      "name": "North District",
      "load": 1200.5,
      "capacity": 1500.0,
      "utilizationPercent": 80,
      "trend": "increasing"
    },
    ...
  ]
}
```

#### Get Consumer Segments
```
GET /utility/consumers/segments

Response (200):
{
  "segments": {
    "residential": {
      "count": 10500,
      "avgUsage": 720.5,
      "trend": "stable"
    },
    "commercial": {
      "count": 1200,
      "avgUsage": 4500.3,
      "trend": "increasing"
    },
    "industrial": {
      "count": 150,
      "avgUsage": 25000.0,
      "trend": "stable"
    }
  }
}
```

---

### Admin Endpoints

#### Get Infrastructure Health
```
GET /admin/health/infrastructure

Response (200):
{
  "components": [
    {
      "name": "API Server",
      "status": "healthy",
      "uptime": 99.99,
      "avgResponseTime": 45,     // ms
      "requestsPerSecond": 2500
    },
    {
      "name": "Database",
      "status": "healthy",
      "connections": 450,
      "maxConnections": 500,
      "queryTime": 12            // ms average
    },
    {
      "name": "Message Queue",
      "status": "healthy",
      "pendingJobs": 1200,
      "processingRate": 450      // jobs/min
    },
    {
      "name": "Cache System",
      "status": "healthy",
      "hitRate": 0.87,
      "memoryUsage": 8.5         // GB
    }
  ]
}
```

#### Get SLA Metrics
```
GET /admin/health/sla

Response (200):
{
  "metrics": {
    "uptime": 99.98,
    "avgResponseTime": 45,
    "errorRate": 0.02,
    "dataSyncLatency": 2.5,     // seconds
    "targetUptime": 99.99,
    "targetResponseTime": 100,
    "targetErrorRate": 0.05
  },
  "complianceStatus": "compliant",
  "lastIncident": "2024-03-15T08:30:00Z"
}
```

#### Get System Metrics
```
GET /admin/health/system

Response (200):
{
  "cpu": 45.3,                  // %
  "memory": 67.8,               // %
  "disk": 52.1,                 // %
  "network": {
    "inbound": 250.5,           // Mbps
    "outbound": 180.3            // Mbps
  },
  "timestamp": "2024-03-20T14:30:45Z"
}
```

#### Get Audit Logs
```
GET /admin/logs/audit?type=users|system|errors|api&limit=100&offset=0

Response (200):
{
  "logs": [
    {
      "id": "log_001",
      "timestamp": "2024-03-20T14:30:45Z",
      "type": "user_login",
      "userId": "usr_123",
      "email": "user@example.com",
      "action": "login",
      "status": "success",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0..."
    },
    ...
  ],
  "total": 5420,
  "page": 0
}
```

---

## 📊 Data Models

### User
```typescript
interface User {
  id: string                           // Unique identifier
  email: string
  name: string
  passwordHash: string
  role: "CONSUMER" | "UTILITY" | "ADMIN"
  meterId?: string                     // For CONSUMER role
  companyId?: string                   // For UTILITY/ADMIN roles
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  lastLogin?: Date
}
```

### Meter
```typescript
interface Meter {
  id: string
  meterId: string                      // Physical meter number
  consumerId: string
  location: {
    address: string
    latitude: number
    longitude: number
  }
  meterType: "smart" | "analog"
  installDate: Date
  status: "active" | "inactive" | "faulty"
  lastReading: Date
  createdAt: Date
}
```

### Energy Reading
```typescript
interface EnergyReading {
  id: string
  meterId: string
  timestamp: Date
  usage: number                        // kWh
  voltage: number                      // V
  current: number                      // A
  frequency: number                    // Hz
  powerFactor: number                  // 0-1
  cost: number                         // USD
  temperatureOutside?: number          // °C
  source: "meter" | "forecast"
}
```

### Device
```typescript
interface Device {
  id: string
  meterId: string
  name: string
  type: "hvac" | "water_heater" | "ev_charger" | "washer" | "refrigerator" | "other"
  status: "online" | "offline"
  currentUsage: number                 // kW
  controllable: boolean
  lastCommunication: Date
  createdAt: Date
}
```

### Automation Rule
```typescript
interface AutomationRule {
  id: string
  meterId: string
  name: string
  type: "scheduled" | "peak-shaving" | "weather-based" | "price-based"
  condition: string                    // Expression to evaluate
  action: string                       // Action to execute
  targetDevices: string[]              // Device IDs
  priority: "low" | "medium" | "high"
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}
```

### Forecast
```typescript
interface Forecast {
  id: string
  meterId: string
  generatedAt: Date
  forecastPeriod: "hourly" | "daily" | "weekly"
  data: ForecastPoint[]
  modelVersion: string
  accuracy: number                     // 0-1
}

interface ForecastPoint {
  timestamp: Date
  predicted: number
  lowerBound: number                   // Confidence interval
  upperBound: number
  confidence: number                   // 0-1
}
```

### Recommendation
```typescript
interface Recommendation {
  id: string
  meterId: string
  title: string
  description: string
  category: string
  estimatedSavings: number             // USD per month
  difficulty: "easy" | "medium" | "hard"
  roiMonths: number
  priority: "low" | "medium" | "high"
  steps: string[]
  createdAt: Date
}
```

### Audit Log
```typescript
interface AuditLog {
  id: string
  timestamp: Date
  userId: string
  action: string
  resourceType: string
  resourceId: string
  oldValue?: any
  newValue?: any
  status: "success" | "failure"
  ipAddress: string
  userAgent: string
}
```

---

## 🔐 Authentication & Authorization

### JWT Token Structure
```json
{
  "sub": "usr_123",
  "email": "user@example.com",
  "role": "CONSUMER",
  "meterId": "MTR-8829-X1",
  "iat": 1710939045,
  "exp": 1711025445
}
```

### Role-Based Access Control (RBAC)

**Consumer Role**:
- Access own meter data only
- Read: Dashboard, monitoring, historical, forecast, insights
- Write: Automation rules, device control preferences
- Delete: Own automation rules

**Utility Role**:
- Read: Grid metrics, consumer segments, DR program data
- Write: DR events, consumer notifications
- Update: Consumer management actions

**Admin Role**:
- Full access to all system features
- User management
- System configuration
- Audit log access

---

## 🔗 Integration Guide

### Backend Implementation Checklist

#### Phase 1: Authentication & User Management
- [ ] Implement user registration endpoint
- [ ] Add password hashing (bcrypt)
- [ ] Implement JWT token generation
- [ ] Add token refresh mechanism
- [ ] Create role-based middleware
- [ ] Setup database schema for users

#### Phase 2: Energy Data Collection
- [ ] Create energy reading storage schema
- [ ] Implement real-time data ingestion API
- [ ] Add WebSocket support for live data streaming
- [ ] Create database indexes for time-series queries
- [ ] Implement data retention policies

#### Phase 3: Historical Analysis
- [ ] Build aggregation queries (hourly, daily, weekly, monthly)
- [ ] Implement date range filtering
- [ ] Add weather data integration
- [ ] Create bill calculation service

#### Phase 4: Forecasting Engine
- [ ] Integrate with ML service or library
- [ ] Train models on historical data
- [ ] Implement confidence interval calculation
- [ ] Add periodic model retraining

#### Phase 5: AI & Insights
- [ ] Integrate with AI/LLM API (OpenAI, Claude, etc.)
- [ ] Build analysis service for efficiency metrics
- [ ] Create recommendation engine
- [ ] Implement peer comparison queries

#### Phase 6: Device Management & Automation
- [ ] Create device registry schema
- [ ] Implement device control APIs (may require IoT integration)
- [ ] Build automation rule engine
- [ ] Add scheduling service

#### Phase 7: Utility Features
- [ ] Aggregate consumer data for utility views
- [ ] Implement regional load distribution queries
- [ ] Build demand response program management
- [ ] Create utility reporting service

#### Phase 8: Admin Features
- [ ] Build system health monitoring service
- [ ] Implement audit logging
- [ ] Create SLA tracking
- [ ] Build error tracking and alerting

### Frontend-Backend Integration Points

1. **State Management to API**:
   - Replace mock data in `use-energy-store.ts` with API calls
   - Replace mock login in `use-auth-store.ts` with real authentication
   - Add error handling and loading states

2. **Real-Time Updates**:
   - Replace `use-realtime-energy.ts` mock with WebSocket connection
   - Implement connection recovery logic
   - Add data validation on received messages

3. **API Error Handling**:
   - Add 401 unauthorized handling (redirect to login)
   - Implement exponential backoff for retries
   - Show user-friendly error messages

4. **Authentication Persistence**:
   - Store JWT token securely (HTTP-only cookie recommended)
   - Implement automatic token refresh
   - Clear token on logout

---

## 🛣️ Frontend Routes

### Public Routes
- `/` - Home/redirect (redirects to login if not authenticated)
- `/login` - User login page

### Protected Routes (Consumer)
- `/dashboard/dashboard` - Main consumer dashboard
- `/dashboard/monitoring` - Real-time monitoring
- `/dashboard/historical` - Historical data analysis
- `/dashboard/forecast` - Load forecasting
- `/dashboard/ai-chat` - AI Energy Assistant
- `/dashboard/insights` - AI insights and recommendations
- `/dashboard/automation` - Load control & automation

### Protected Routes (Utility)
- `/dashboard/utility/dashboard` - Utility command center

### Protected Routes (Admin)
- `/dashboard/admin/health` - System health dashboard

---

## 🎯 State Management

### Zustand Stores

#### `useAuthStore`
- **State**: `user`, `isAuthenticated`
- **Actions**: `login(email, role, meterId)`, `logout()`
- **Persistence**: LocalStorage via persist middleware

#### `useEnergyStore`
- **State**: `liveData`, `historicalData`, `totalUsageToday`, `estimatedBill`, `isLive`
- **Actions**: `addLiveData(data)`, `setLive(bool)`, `fetchHistorical(range)`
- **Usage**: Stores energy metrics and historical consumption data

### Custom Hooks

#### `useRealtimeEnergy`
- Simulates real-time energy data updates
- Can be replaced with WebSocket connection to backend
- Updates every 5 seconds by default

---

## 📝 Development Notes

### Current State (Frontend Only)
- All data is mocked using example data
- Authentication uses in-memory storage (will reset on page reload without persistence integration)
- Real-time data is simulated with random increments
- No backend API integration yet

### Next Steps for Backend Integration
1. Set up REST API server with Express/FastAPI/Django
2. Create PostgreSQL/MongoDB database
3. Implement user authentication with JWT
4. Build energy data collection system
5. Create forecasting ML service
6. Integrate AI/LLM for chat and insights
7. Implement WebSocket for real-time updates
8. Add monitoring and observability

### Environment Variables (to be added)
```
NEXT_PUBLIC_API_BASE_URL=https://api.smartmeter.local/v1
NEXT_PUBLIC_WS_URL=wss://api.smartmeter.local/ws
JWT_SECRET=your_secret_key_here
```

---

## 📚 Additional Resources

- **Next.js Documentation**: https://nextjs.org/docs
- **Recharts Documentation**: https://recharts.org/
- **Zustand Documentation**: https://github.com/pmndrs/zustand
- **shadcn/ui**: https://ui.shadcn.com/
- **Tailwind CSS**: https://tailwindcss.com/

---

## 🔌 MVP Backend Integration (Connected Simulator)
### What changed vs “frontend only”
- Authentication is now backed by the FastAPI backend (`POST /auth/login`) and returns a JWT token.
- Real-time live charts are now driven by WebSocket updates from the backend (`/ws/consumer/realtime/:meterId`).
- Dashboard, Historical, Forecast, Insights, and Automation screens call the backend REST endpoints instead of generating placeholder data.

### Run (local)
1. Backend: `smart-meter-core-backend/main.py` (FastAPI on `http://localhost:8000`)
2. Simulator: `smart-meter-core-backend/simulator_run.py` (sends meter readings to backend)
3. Frontend: `smart-meter-core-frontend` via `npm run dev`

### Backend endpoints used by Consumer UI (MVP)
- `GET /api/consumer/dashboard?meterId=...`
- `GET /api/consumer/history?meterId=...&range=day|week|month|year`
- `GET /api/consumer/forecast/hourly?meterId=...`
- `GET /api/consumer/forecast/weekly?meterId=...`
- `GET /api/consumer/insights/efficiency?meterId=...`
- `GET /api/consumer/insights/appliances?meterId=...`
- `GET /api/consumer/insights/weather?meterId=...`
- `GET /api/consumer/devices?meterId=...`
- WebSocket: `/ws/consumer/realtime/:meterId`

### Hardware migration guidance
When you replace the simulator with real hardware, keep the same ingestion contract:
- Hardware gateway must POST meter readings to the backend ingestion endpoint.
- Live stream continues to work because the backend broadcasts whatever it ingests.

See: `smart-meter-core-backend/README.md`

## 📄 License

SmartMeter Core © 2024. All rights reserved.
