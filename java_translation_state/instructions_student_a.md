# Instructions for Student A - Phase 1: Core Authentication

## Your Mission
You are responsible for implementing the core authentication and user management system in Java. This is the foundation that all other phases will build upon.

## Before You Start
1. Read the `context.md` file thoroughly to understand the project structure and requirements
2. Review the `progress.md` file to see your specific tasks
3. Examine the existing Python authentication code in `backend/app/routers/auth.py` and `backend/app/schemas/auth.py`
4. Look at the frontend authentication page in `frontend/src/pages/AuthPage.tsx` to understand the API contract

## Step-by-Step Process

### Step 1: Set Up Java Project
- Create a new Spring Boot project with the following dependencies:
  - Spring Web
  - Spring Security
  - Spring Data JPA
  - H2 Database (for development)
  - JWT library (like jjwt)
  - Lombok
- Configure `application.properties` with database and JWT settings

### Step 2: Create User Entity
- Create `User.java` entity class with fields matching the Python user model
- Include: id, username, email, passwordHash, createdAt, updatedAt
- Use JPA annotations for database mapping

### Step 3: Implement JWT Service
- Create `JwtService.java` to handle token generation and validation
- Implement methods:
  - `generateAccessToken(User user)`
  - `generateRefreshToken(User user)`
  - `validateToken(String token)`
  - `extractUsername(String token)`

### Step 4: Create Authentication Controller
- Implement these endpoints EXACTLY as they exist in Python:
  - `POST /auth/register` - User registration
  - `POST /auth/login` - User login  
  - `POST /auth/refresh` - Token refresh
  - `GET /auth/me` - Get current user info
- Use DTOs for request/response objects to match the Python API contract

### Step 5: Implement Security Configuration
- Configure Spring Security to handle JWT authentication
- Create filters for token validation
- Set up CORS configuration to match frontend requirements

### Step 6: Write Tests
- Create unit tests for JWT service
- Write integration tests for authentication endpoints
- Test edge cases: invalid tokens, expired tokens, wrong credentials

## Important Notes
1. **API Compatibility**: The frontend expects EXACTLY the same API responses as the Python version. Check the frontend code to see what fields it expects.
2. **Password Hashing**: Use BCrypt with the same strength as the Python version
3. **Error Handling**: Return the same HTTP status codes and error message formats
4. **JWT Structure**: The token payload must contain the same claims (user ID, username, expiration)

## Files You Should Examine
- `backend/app/routers/auth.py` - Python authentication endpoints
- `backend/app/schemas/auth.py` - Request/response schemas
- `frontend/src/pages/AuthPage.tsx` - Frontend authentication logic
- `frontend/src/services/api.ts` - API client code

## Deliverables
1. Working Spring Boot authentication system
2. All unit and integration tests passing
3. Updated `progress.md` with your completed tasks
4. Documentation of any deviations from the Python implementation

## When You're Done
1. Update the `progress.md` file to mark Phase 1 as complete
2. Add detailed notes about any issues or decisions you made
3. Commit your code with a clear message: "Phase 1: Core authentication implementation complete"
4. Hand over to Student B with a summary of what you implemented

## Questions?
If you encounter issues or need clarification:
1. Document the issue in the `progress.md` file under "Notes"
2. Communicate with your team members
3. Check the existing Python code for reference implementations