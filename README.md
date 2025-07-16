# Agora - Outlook Add-in

A comprehensive event coordination platform for Investor Relations teams and investors.

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- Docker (for PostgreSQL)
- Git

### 1. Start the Database
```bash
# In the root directory
docker-compose up -d
```

### 2. Start the Backend
```bash
# In a new terminal window
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

The backend will be running on `http://localhost:5000`

### 3. Start the Frontend
```bash
# In another terminal window
cd frontend
npm install
npm start
```

The frontend will be running on `http://localhost:3000`

## Testing the Application

### Test User Accounts
- **IR Admin**: `sarah.johnson` / `password123`
- **Analyst Manager**: `michael.chen` / `password123`
- **Investment Analyst**: `david.kim` / `password123`

### Features Implemented

#### ✅ Phase 1: Project Setup
- React frontend with TailwindCSS
- Express backend with PostgreSQL
- Docker containerization for database

#### ✅ Phase 2: Database Setup
- Complete Prisma schema with all tables
- Seed data with sample users, events, and RSVPs
- Database migrations

#### ✅ Phase 3: Backend Features
- JWT authentication system
- Role-based access control
- Full CRUD operations for events
- RSVP management
- Calendar API endpoints
- Subscription system

#### ✅ Phase 4: Frontend Integration
- Login/signup forms with validation
- Authentication context
- Event listing with search and filters
- RSVP functionality
- Responsive design with TailwindCSS

#### ✅ Phase 5: Additional Features
- Calendar grid view with monthly layout
- CSV import/export functionality
- Subscription management system
- Dynamic dashboard with real-time stats
- Enhanced filtering and search capabilities
- Role-based feature access

### API Endpoints

#### Authentication
- `POST /api/auth/login`
- `POST /api/auth/signup`

#### Events
- `GET /api/events`
- `POST /api/events` (IR Admin only)
- `PUT /api/events/:id` (IR Admin only)
- `DELETE /api/events/:id` (IR Admin only)

#### RSVPs
- `POST /api/rsvp`
- `GET /api/rsvp/user/:userID`
- `GET /api/rsvp/event/:eventID`

#### Calendar
- `GET /api/calendar`
- `GET /api/calendar/week`

#### Subscriptions
- `GET /api/subscriptions`
- `POST /api/subscriptions`
- `PUT /api/subscriptions/:id`
- `DELETE /api/subscriptions/:id`

### Project Structure
```
agora-outlook-addin/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── index.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── contexts/
│   │   └── utils/
│   └── package.json
└── docker-compose.yml
```

## Next Steps

The application is now fully functional with:
- User authentication and authorization
- Event management system
- RSVP tracking
- Search and filtering capabilities
- Role-based access control

Ready for additional features like:
- Calendar grid view
- CSV import/export
- Email notifications
- Advanced reporting
- Mobile responsiveness improvements
