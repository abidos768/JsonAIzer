# One-Shot Prompt for AI Site Generator with Tech-ish UI & Supabase Backend

## 1. Project Overview
- Build a **React front-end website** hosted on Vercel.
- Convert **plain text prompt into JSON** using an AI API.
- **One-shot interaction**: user presses generate, output appears immediately.
- Limit each user to **3 attempts per session**.
- Use **Supabase backend** for API key security, attempt tracking, and validation.
- **Tech-ish UI/UX**: dark mode, neon accents, modern/futuristic vibe.

## 2. Agents & Responsibilities

### Agent A - Front-end (React)
- **Components**:
  1. `PromptInput` - textarea + "Generate" button, disabled if attempts >= 3
  2. `JSONOutput` - formatted JSON code block, collapsible sections
  3. `AttemptsCounter` - shows remaining attempts (max 3)
  4. `CopyButton` - copies JSON to clipboard
- **State Management**:
  - `prompt` - stores user input
  - `output` - stores generated JSON
  - `loading` - spinner while waiting for API
  - `attempts` - synced with Supabase
- **UI/UX Features**:
  - Tech-ish look: dark mode, neon highlights, glassmorphism cards
  - Animated hover for buttons, fade-in JSON output
  - Loading indicator: animated dots or spinner
  - Responsive layout for mobile + desktop
  - Optional presets for common JSON schemas
- **Interaction**:
  - Sends prompt to Agent B (backend) for processing
  - Displays JSON output, error messages, remaining attempts

### Agent B - Back-end (Supabase / Edge Function)
- **API Responsibilities**:
  1. Validate incoming prompt (length, allowed characters, injection prevention)
  2. Prepend fixed AI instruction: `"Output MUST be valid JSON with predefined schema only."`
  3. Check user's **remaining attempts** in Supabase
  4. Call AI API (OpenAI or similar)
  5. Validate returned JSON against schema
  6. Increment attempt counter in Supabase
  7. Return JSON to frontend
- **Security & Privacy**:
  - Keep API key **secret**, never exposed to frontend
  - Rate limiting (max 3 attempts per user/session)
  - Minimal data storage: session ID, attempt counts, optional error logs
- **Error Handling**:
  - Invalid prompt -> return user-friendly error
  - Max attempts reached -> return informative message
  - AI output invalid -> retry or error message

## 3. Attempt Limitation
- **Backend** enforces max 3 attempts per session.
- Frontend shows **remaining attempts counter**.
- Frontend buttons are disabled if limit is reached.

## 4. AI Integration
- Use OpenAI API or similar.
- Use **strict instructions** in the prompt to ensure JSON-only output.
- Backend validates AI output before sending it to frontend.

## 5. UI/UX Considerations (Tech-ish)
- **Colors & Theme**: dark mode, neon accent colors, futuristic feel
- **Typography**: monospace for JSON, clean sans-serif for UI text
- **Buttons & Inputs**: glassmorphism, neon glow on hover, animated micro-interactions
- **Output Display**: collapsible JSON, fade-in, syntax highlighting
- **Layout**: floating cards, whitespace for clarity, responsive grid
- **Feedback**: loading animations, success/failure messages, remaining attempts
- **Optional Extras**: keyboard shortcuts, clear input button, dark/light mode toggle

## 6. Security & Privacy
- **Prompt sanitization**: prevent injection attempts or malicious content.
- **Rate limiting**: enforce 3 attempts per session, optional IP tracking.
- **Backend validation**: ensure AI output matches expected JSON schema.
- **Supabase** stores minimal data: user session ID, attempts count, optional logs for errors.
- **No API keys exposed** in frontend.

## 7. Terms and Conditions / Privacy Notice
Users understand:
1. **Input data** (prompts) will be sent to an AI API for processing.
2. Minimal data storage in Supabase: session ID, attempts count, error logs.
3. **No personally identifiable information** should be included unless user consents.
4. Data is used to monitor usage and improve reliability.
5. Users must not bypass attempt limits or manipulate API access.
6. Service is provided as-is, with no liability for AI-generated content.
