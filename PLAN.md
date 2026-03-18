# Human Writer - Implementation Plan

## Architecture

**Two-pass humanization pipeline using real AI models:**

### Pass 1: Anthropic Claude API (Rewriting)
- Send AI-generated text to Claude with a carefully crafted system prompt
- The prompt instructs Claude to rewrite the text with human-like qualities:
  - Variable sentence lengths (mix short punchy + longer complex)
  - Contractions, informal phrasing, sentence fragments
  - Remove AI-typical transitions ("Furthermore", "Moreover", "Additionally")
  - Add rhetorical questions, personal voice, opinions
  - Introduce natural imperfections (starting with "And" or "But", casual asides)
  - Vary paragraph lengths dramatically
  - Use domain-specific language and colloquialisms

### Pass 2: HuggingFace AI Detection Score (Verification)
- Use a HuggingFace AI detection model to score the rewritten text
- Models like `roberta-base-openai-detector` or `Hello-SimpleAI/chatgpt-detector-roberta`
- Show the user the AI probability score so they can iterate
- If score is too high, allow re-humanizing

## File Structure

```
src/
├── app/
│   ├── page.tsx              # Main UI - input/output textareas + controls
│   ├── layout.tsx            # Updated metadata
│   ├── globals.css           # Updated styles
│   └── api/
│       ├── humanize/
│       │   └── route.ts      # POST - calls Anthropic API to rewrite text
│       └── detect/
│           └── route.ts      # POST - calls HuggingFace API to score text
```

## Implementation Steps

1. Install `@anthropic-ai/sdk` dependency
2. Create `/api/humanize` route - Claude rewriting endpoint
3. Create `/api/detect` route - HuggingFace AI detection endpoint
4. Build the main UI page with:
   - Input textarea (paste AI text)
   - "Humanize" button
   - Output textarea (shows rewritten text)
   - AI detection score display
   - "Check Score" button
   - Copy to clipboard button
5. Update layout metadata
6. Environment variables: `ANTHROPIC_API_KEY`, `HUGGINGFACE_API_KEY`
