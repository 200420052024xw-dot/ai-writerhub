# Instructions for Student B - Phase 2: Document Management System

## Your Mission
You are responsible for implementing the document management system in Java. This includes CRUD operations, file upload/download, and document metadata handling.

## Before You Start
1. Read the `context.md` file to understand the project structure
2. Review the `progress.md` file to see your specific tasks and what Student A completed
3. Examine the existing Python document code in `backend/app/routers/documents.py` and `backend/app/schemas/documents.py`
4. Look at the frontend documents page in `frontend/src/pages/DocumentsPage.tsx`

## Step-by-Step Process

### Step 1: Review Student A's Work
- Examine the Java project structure Student A created
- Understand the authentication system implementation
- Check the database schema and user entity

### Step 2: Create Document Entity
- Create `Document.java` entity class with fields:
  - id, title, content, filePath, fileType, fileSize
  - createdAt, updatedAt, userId (foreign key to User)
- Use JPA annotations for database mapping

### Step 3: Implement Document Repository
- Create `DocumentRepository.java` extending JpaRepository
- Add custom queries if needed (findByUserId, etc.)

### Step 4: Create Document Service
- Implement business logic for document operations
- Handle file storage using the local file system
- Implement methods:
  - `createDocument(Document document, MultipartFile file)`
  - `getDocumentById(Long id)`
  - `getUserDocuments(Long userId)`
  - `updateDocument(Long id, Document document)`
  - `deleteDocument(Long id)`
  - `downloadDocument(Long id)`

### Step 5: Implement Document Controller
- Create endpoints EXACTLY as they exist in Python:
  - `GET /documents` - List user documents
  - `POST /documents` - Create new document
  - `GET /documents/{id}` - Get document by ID
  - `PUT /documents/{id}` - Update document
  - `DELETE /documents/{id}` - Delete document
  - `POST /documents/upload` - Upload document file
  - `GET /documents/{id}/download` - Download document

### Step 6: Handle File Operations
- Implement file upload using Spring's MultipartFile
- Store files in a designated directory (check Python implementation for path)
- Handle file download with proper content types
- Implement file size limits and validation

### Step 7: Write Tests
- Create unit tests for document service
- Write integration tests for all endpoints
- Test file upload/download functionality
- Test error cases: invalid files, missing documents, permission issues

## Important Notes
1. **File Storage**: Use the same directory structure as the Python version to maintain compatibility
2. **API Responses**: Match the exact response format from Python (check frontend expectations)
3. **Authentication**: All document endpoints require authentication (use Student A's security setup)
4. **Error Handling**: Return appropriate HTTP status codes (404 for not found, 403 for unauthorized, etc.)

## Files You Should Examine
- `backend/app/routers/documents.py` - Python document endpoints
- `backend/app/schemas/documents.py` - Request/response schemas
- `frontend/src/pages/DocumentsPage.tsx` - Frontend document management
- `frontend/src/services/api.ts` - API client calls
- `backend/app/core/` - Check for any document-related configurations

## Deliverables
1. Working document management system
2. All unit and integration tests passing
3. Updated `progress.md` with your completed tasks
4. Documentation of file storage location and configuration

## When You're Done
1. Update the `progress.md` file to mark Phase 2 as complete
2. Add detailed notes about file storage configuration
3. Commit your code: "Phase 2: Document management system complete"
4. Hand over to Student C with a summary

## Special Considerations
- **Large Files**: Ensure the system handles large file uploads properly
- **Security**: Validate file types and scan for malicious content if possible
- **Performance**: Consider implementing pagination for document lists
- **Backup**: Document the file storage location for backup purposes

## Questions?
If you encounter issues:
1. Check Student A's implementation for authentication patterns
2. Review the Python code for business logic reference
3. Document any issues in `progress.md`
4. Coordinate with team members for complex decisions