# Instructions for Student C - Phase 3: Translation and Chat Features

## Your Mission
You are responsible for implementing the translation and chat features in Java. This includes streaming translation responses and AI assistant integration.

## Before You Start
1. Read the `context.md` file to understand the project structure
2. Review the `progress.md` file to see your tasks and what Students A & B completed
3. Examine the existing Python code:
   - `backend/app/routers/translation.py` - Translation endpoints
   - `backend/app/routers/chat_history.py` - Chat history management
   - `backend/app/routers/assistant.py` - AI assistant integration
4. Look at frontend pages:
   - `frontend/src/pages/TranslatePage.tsx` - Translation interface
   - `frontend/src/pages/EditorPage.tsx` - Chat functionality

## Step-by-Step Process

### Step 1: Review Previous Work
- Examine Student A's authentication system
- Review Student B's document management implementation
- Understand the existing database schema and project structure

### Step 2: Implement Translation Service
- Create `TranslationService.java` with methods:
  - `translateText(String text, String sourceLang, String targetLang)`
  - `getSupportedLanguages()`
- Integrate with external translation API (check Python implementation for service)
- Implement proper error handling for API failures

### Step 3: Handle Streaming Responses
- Implement Server-Sent Events (SSE) for streaming translation
- Create `TranslationController.java` with streaming endpoint
- Use Spring's `SseEmitter` for real-time response streaming
- Ensure proper connection handling and cleanup

### Step 4: Implement Chat History
- Create `ChatMessage.java` entity for storing messages
- Implement `ChatRepository.java` for database operations
- Create `ChatService.java` with methods:
  - `saveMessage(ChatMessage message)`
  - `getChatHistory(Long userId)`
  - `clearChatHistory(Long userId)`

### Step 5: Create Chat Controller
- Implement chat endpoints:
  - `GET /chat/history` - Get conversation history
  - `POST /chat/message` - Send message to AI assistant
- Handle both synchronous and streaming responses if needed

### Step 6: Integrate AI Assistant
- Create `AssistantService.java` to interact with AI APIs
- Implement prompt management and response processing
- Handle different AI models and configurations

### Step 7: Write Tests
- Test translation accuracy and streaming functionality
- Test chat history persistence and retrieval
- Test AI assistant integration
- Test error handling for API failures

## Important Notes
1. **Streaming Implementation**: This is critical - the frontend expects real-time streaming for translations
2. **API Compatibility**: Maintain exact response formats from Python version
3. **External Services**: You'll need API keys for translation and AI services
4. **Error Handling**: Implement robust error handling for external API failures

## Files You Should Examine
- `backend/app/routers/translation.py` - Translation implementation
- `backend/app/routers/chat_history.py` - Chat history logic
- `backend/app/routers/assistant.py` - AI assistant integration
- `frontend/src/pages/TranslatePage.tsx` - Frontend translation UI
- `frontend/src/services/api.ts` - API client for translation/chat
- `backend/app/prompts/` - AI prompt templates

## Deliverables
1. Working translation system with streaming responses
2. Functional chat history management
3. AI assistant integration
4. All tests passing
5. Updated `progress.md` with your completed tasks

## Technical Challenges
1. **Streaming Responses**: Implementing SSE properly in Spring Boot
2. **External API Integration**: Handling timeouts, rate limits, and failures
3. **Real-time Communication**: Ensuring low-latency responses
4. **Error Recovery**: Graceful degradation when AI services are unavailable

## When You're Done
1. Update the `progress.md` file to mark Phase 3 as complete
2. Document any external service configurations needed
3. Commit your code: "Phase 3: Translation and chat features complete"
4. Prepare handover notes for Phase 4

## Special Considerations
- **API Keys**: Store external service API keys securely (use environment variables)
- **Rate Limiting**: Implement rate limiting for external API calls
- **Caching**: Consider caching translation results for repeated requests
- **Monitoring**: Add logging for external service calls and performance tracking

## Questions?
If you encounter issues:
1. Review Python implementation for business logic
2. Check frontend expectations for response formats
3. Document challenges in `progress.md`
4. Coordinate with team for architectural decisions