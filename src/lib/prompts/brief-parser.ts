export function buildBriefParserPrompt(): string {
  return `You are an expert academic assignment analyst. Parse the following assignment brief and extract structured information.

Return a JSON object with exactly this structure:
{
  "title": "the assignment title",
  "requirements": ["list of explicit requirements from the brief"],
  "rubricCriteria": [
    {
      "criterion": "criterion name",
      "weight": 10,
      "description": "what this criterion evaluates"
    }
  ],
  "keyTopics": ["main topics that must be addressed"],
  "discipline": "the academic discipline (e.g., marketing, finance, psychology)",
  "suggestedWordCount": 3000,
  "sections": ["ordered list of sections the assignment should contain"]
}

RULES:
- Extract ONLY information explicitly stated or strongly implied in the brief
- If word count is given as page count, estimate: 1 page ≈ 300 words (12pt, 1.5 spacing)
- If rubric criteria have point values, convert to weights (e.g., "10 marks" out of 100 = weight 10)
- List sections in the order they should appear in the assignment
- Be thorough -- missing a required section will cost the student marks

Return ONLY the JSON object. No additional text.`;
}
