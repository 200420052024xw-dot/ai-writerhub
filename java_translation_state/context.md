# Java Translation Context Document

## Project Overview
This is a text editor application being translated from Python/TypeScript to Java. The project consists of a backend (Python FastAPI) and frontend (React/TypeScript). The goal is to convert both to Java (backend) and maintain the frontend as-is while updating API contracts.

## Module Structure

### Backend Modules
1. **Authentication Module** (`auth.py`)
   - User registration, login, token management
   - JWT-based authentication

2. **Chat History Module** (`chat_history.py`)
   - Store and retrieve conversation history
   - Message threading

3. **Documents Module** (`documents.py`)
   - Document CRUD operations
   - File upload/download handling

4. **Translation Module** (`translation.py`)
   - Text translation with streaming support
   - Multiple language pairs

5. **RAG Module** (`rag.py`)
   - Retrieval Augmented Generation
   - Knowledge base integration

6. **Format Module** (`format.py`)
   - Text formatting and styling
   - Markdown processing

7. **Assistant Module** (`assistant.py`)
   - AI assistant interactions
   - Prompt management

8. **Health Check** (`health.py`)
   - Service status monitoring

### Frontend Pages
1. **AuthPage** - Login/Register interface
2. **HomePage** - Main dashboard
3. **EditorPage** - Text editing interface
4. **DocumentsPage** - Document management
5. **TranslatePage** - Translation interface
6. **FormatPage** - Formatting tools
7. **SettingsPage** - Application settings

## API Interfaces (to be preserved)

### Authentication Endpoints
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh
- `GET /auth/me` - Get current user info

### Document Endpoints
- `GET /documents` - List user documents
- `POST /documents` - Create new document
- `GET /documents/{id}` - Get document by ID
- `PUT /documents/{id}` - Update document
- `DELETE /documents/{id}` - Delete document
- `POST /documents/upload` - Upload document file
- `GET /documents/{id}/download` - Download document

### Translation Endpoints
- `POST /translation/translate` - Translate text (streaming response)
- `GET /translation/languages` - Get supported languages

### Chat Endpoints
- `GET /chat/history` - Get conversation history
- `POST /chat/message` - Send message to AI assistant

### Format Endpoints
- `POST /format/apply` - Apply formatting to text

### RAG Endpoints
- `POST /rag/query` - Query knowledge base
- `GET /rag/sources` - Get available knowledge sources

### Health Endpoint
- `GET /health` - Service health check

## Design Constraints
1. **API Compatibility**: All existing API endpoints must maintain the same request/response contracts
2. **Authentication**: JWT-based with refresh tokens
3. **Database**: Currently using SQLite, plan to migrate to PostgreSQL for Java version
4. **File Storage**: Local file system storage for documents
5. **AI Integration**: External AI service calls for translation and chat

## AI Code Style Guidelines
- Use Spring Boot framework for Java backend
- Follow standard Java naming conventions (camelCase for variables/methods, PascalCase for classes)
- Implement proper exception handling with custom exceptions
- Use DTOs for API request/response objects
- Implement service layer pattern with repositories
- Use Lombok to reduce boilerplate code
- Implement proper logging using SLF4J

## Known Issues and Future Requirements
- Streaming responses for translation need special handling in Java
- File upload/download requires multipart form handling
- WebSocket support may be needed for real-time chat features
- Database migration scripts will be needed when moving from SQLite to PostgreSQL

## Current Phase Status
- [ ] Phase 1: Core authentication and user management
- [ ] Phase 2: Document management system
- [ ] Phase 3: Translation and chat features
- [ ] Phase 4: RAG and formatting capabilities
- [ ] Phase 5: Integration testing and optimization

## Notes for Next Phase
- Pay special attention to streaming response implementation for translation
- Ensure file upload handling maintains backward compatibility
- Consider implementing caching for frequently accessed documents
- Plan for database schema migration from SQLite to PostgreSQL