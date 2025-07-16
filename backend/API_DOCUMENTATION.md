# Agora Backend API Documentation

## Overview
The Agora backend provides a comprehensive REST API for managing investor relations events, RSVPs, and user subscriptions.

## Base URL
```
http://localhost:5000/api
```

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Authentication
- `POST /auth/signup` - Register a new user
- `POST /auth/login` - Login and get JWT token

### Events
- `GET /events` - Get all events (with filtering and pagination)
- `GET /events/:id` - Get single event
- `POST /events` - Create new event (IR Admin only)
- `PUT /events/:id` - Update event (IR Admin only)
- `DELETE /events/:id` - Delete event (IR Admin only)

### Calendar
- `GET /calendar` - Get calendar grid data
- `GET /calendar/week` - Get week view data

### RSVP
- `POST /rsvp` - Create or update RSVP
- `GET /rsvp/user/:userID` - Get user's RSVPs
- `GET /rsvp/event/:eventID` - Get event RSVPs
- `DELETE /rsvp/:eventID` - Delete RSVP

### Subscriptions
- `GET /subscriptions` - Get user's subscriptions
- `POST /subscriptions` - Create new subscription
- `PUT /subscriptions/:id` - Update subscription
- `DELETE /subscriptions/:id` - Delete subscription
- `GET /subscriptions/sectors` - Get available GICS sectors

### Testing
- `GET /health` - Health check
- `GET /test-db` - Database connection test

## Sample Test Data

### Login Credentials
```json
{
  "username": "sarah.johnson",
  "password": "password123"
}
```

### Other Test Users
- `michael.chen` / `password123` (Analyst Manager)
- `emily.rodriguez` / `password123` (Analyst Manager)
- `david.kim` / `password123` (Investment Analyst)
- `lisa.wang` / `password123` (Investment Analyst)
- `james.thompson` / `password123` (Investment Analyst)

## Testing with cURL

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "sarah.johnson", "password": "password123"}'
```

### Get Events (replace TOKEN with actual token)
```bash
curl -X GET http://localhost:5000/api/events \
  -H "Authorization: Bearer TOKEN"
```

### Create RSVP
```bash
curl -X POST http://localhost:5000/api/rsvp \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventID": "EVENT_ID", "status": "ACCEPTED"}'
```

## Role-Based Access Control

### IR Admin
- Full access to all endpoints
- Can create, update, and delete events
- Can view all user data

### Analyst Manager
- Can view and manage own RSVPs
- Can view subordinate analyst RSVPs
- Can manage own subscriptions

### Investment Analyst
- Can view and manage own RSVPs
- Can manage own subscriptions
- Limited access to events based on permissions

## Error Handling
All endpoints return appropriate HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 500: Internal Server Error

## Database Schema
The API uses the following main models:
- User (with roles: IR_ADMIN, ANALYST_MANAGER, INVESTMENT_ANALYST)
- Event (with types: EARNINGS_CALL, INVESTOR_MEETING, CONFERENCE, etc.)
- RSVP (with statuses: ACCEPTED, DECLINED, TENTATIVE, PENDING)
- Subscription (with statuses: ACTIVE, INACTIVE, EXPIRED)
- GICSCompany (public company information)
- UserCompany (user organization information)
