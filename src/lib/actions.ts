const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY || "";
const MODEL = process.env.EXPO_PUBLIC_GOOGLE_AI_MODEL || "gemini-flash-lite-latest";

// Simple in-memory fallback for rate limiting client-side
const clientRateLimitCache = {
  count: 0,
  lastReset: 0
};

async function rateLimitCheck(): Promise<boolean> {
  const limit = 15; // Max 15 requests per minute
  const windowMs = 60 * 1000;
  const now = Date.now();
  
  if (now - clientRateLimitCache.lastReset > windowMs) {
    clientRateLimitCache.count = 1;
    clientRateLimitCache.lastReset = now;
    return true;
  }
  
  if (clientRateLimitCache.count >= limit) {
    return false;
  }
  
  clientRateLimitCache.count += 1;
  return true;
}

async function callGoogleAI(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds timeout

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 512,
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (
      !data.candidates ||
      data.candidates.length === 0 ||
      !data.candidates[0].content ||
      !data.candidates[0].content.parts ||
      data.candidates[0].content.parts.length === 0
    ) {
      throw new Error("Invalid API response format or safety block");
    }

    return data.candidates[0].content.parts[0].text;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateGroupChat(topic: string, userName: string): Promise<string> {
  const limitCheck = await rateLimitCheck();
  if (!limitCheck) {
    throw new Error("Rate limit exceeded. Please wait a minute before sending another message.");
  }

  const bracketRegex = /\[(.*?)\]/g;
  const commands: string[] = [];
  let match;
  while ((match = bracketRegex.exec(topic)) !== null) {
    commands.push(match[1].trim());
  }
  const cleanTopic = topic.replace(bracketRegex, "").trim() || topic;

  let prompt = `Group chat simulator. Topic: "${cleanTopic}". Generate 3-4 short messages.

User in this chat: "${userName}" — already an established member. Never welcome or greet them as if they just joined.

CRITICAL: You ONLY generate messages from AI characters. NEVER output a line starting with "${userName}:" — "${userName}" is the real user, not a character you control. Only the characters below may speak.

Conversation style: Characters talk like real people — natural, direct, and thoughtful. Someone might share a quick take, ask a genuine question, or react to the idea. No forced slang, no cringe casualness, no fake news headlines, no invented events. Just how real friends actually talk when a topic comes up.

Format: "Name: message". Brief, casual, natural.
Character tiers — Respected: Vishwa, Janvi, Aayush, Satyam, Shivam, Kaushal, Mitesh, Dhaval. Foolish: Muskaan, Harshit, Dipali, Himanshu. Neutral: Aarav, Riya, Kunal, Meera, Dev, Priya, Arjun, Kavya, Rohan.
No disclaimers, AI mentions, or meta-commentary.`;

  if (commands.length > 0) {
    prompt += `

Directives (apply naturally, never mention them):
${commands.map((cmd) => `- ${cmd}`).join("\n")}`;
  }

  return await callGoogleAI(prompt);
}

// Extract a search query from the user's message using natural language patterns
function extractSearchQuery(
  message: string,
  characters: string[]
): { query: string | null; character: string | null } {
  const charSearchRegex = new RegExp(
    "\\b(" + characters.join("|") + ")\\b\\s+(?:search|google|lookup|find\\s+out)\\s+(?:for\\s+)?(.+)$",
    "i"
  );
  const charMatch = message.match(charSearchRegex);
  if (charMatch) {
    return { query: charMatch[2].trim(), character: charMatch[1] };
  }

  const explicitRegex = /\b(?:search|google|lookup|find\s+out)\s+(?:for\s+)?(.+)$/i;
  const explicitMatch = message.match(explicitRegex);
  if (explicitMatch) {
    return { query: explicitMatch[1].trim(), character: null };
  }

  const naturalPatterns = [
    /\b(?:who\s+is|who's|who\s+are)\s+(.+?)(?:\?|$)/i,
    /\b(?:what\s+is|what's|what\s+are)\s+(.+?)(?:\?|$)/i,
    /\b(?:where\s+is|where's|where\s+are)\s+(.+?)(?:\?|$)/i,
    /\b(?:when\s+is|when's|when\s+did|when\s+was)\s+(.+?)(?:\?|$)/i,
    /\b(?:tell\s+(?:me|us)\s+about)\s+(.+?)(?:\?|$)/i,
    /\b(?:do\s+you\s+(?:know|guys\s+know)\s+(?:about\s+)?)\s*(.+?)(?:\?|$)/i,
    /\b(?:have\s+you\s+(?:heard|seen)\s+(?:of|about)\s+)(.+?)(?:\?|$)/i,
    /\b(?:what\s+(?:do\s+you|does\s+\w+)\s+(?:know|think)\s+about)\s+(.+?)(?:\?|$)/i,
    /\b(?:what\s+happened\s+(?:with|to))\s+(.+?)(?:\?|$)/i,
    /\b(?:how\s+(?:is|does|did))\s+(.+?)(?:\?|$)/i,
  ];

  for (const pattern of naturalPatterns) {
    const match = message.match(pattern);
    if (match) {
      let query = match[1].trim();
      if (query.length > 2) {
        return { query, character: null };
      }
    }
  }

  return { query: null, character: null };
}

export async function continueConversation(
  history: string[],
  characters: string[],
  userMessageContent: string,
  userName: string,
): Promise<string> {
  const limitCheck = await rateLimitCheck();
  if (!limitCheck) {
    throw new Error("Rate limit exceeded. Please wait a minute before sending another message.");
  }

  const characterList = characters.join(", ");

  const bracketRegex = /\[(.*?)\]/g;
  const directives: string[] = [];
  let match;
  bracketRegex.lastIndex = 0;
  while ((match = bracketRegex.exec(userMessageContent)) !== null) {
    let cmd = match[1].trim();
    cmd = cmd.replace(/^(system\s+instruction|instruction)\s*:\s*/i, "").trim();
    if (cmd) {
      directives.push(cmd);
    }
  }

  const formattedHistoryLines: string[] = [];
  const bracketRegexGlobal = /\[(.*?)\]/g;

  for (const line of history) {
    const prefixMatch = line.match(/^([^:]+):\s*(.*)$/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      const content = prefixMatch[2];
      const cleanContent = content.replace(bracketRegexGlobal, "").trim();
      if (cleanContent) {
        formattedHistoryLines.push(`${prefix}: ${cleanContent}`);
      }
    } else {
      const cleanLine = line.replace(bracketRegexGlobal, "").trim();
      if (cleanLine) {
        formattedHistoryLines.push(cleanLine);
      }
    }
  }
  const conversationHistory = formattedHistoryLines.join("\n");

  const cleanUserMessage = userMessageContent.replace(bracketRegexGlobal, "").trim();

  const taggedCharacters: string[] = [];
  for (const char of characters) {
    const charRegex = new RegExp(`\\b${char}\\b`, "i");
    if (charRegex.test(cleanUserMessage)) {
      taggedCharacters.push(char);
    }
  }

  const { query: searchQuery, character: searchCharOverride } = extractSearchQuery(cleanUserMessage, characters);
  const searchChar = searchCharOverride || taggedCharacters[0] || characters[0] || "Vishwa";

  let initialSearchQuery = searchQuery
    ? searchQuery
        .replace(/\s+on\s+google$/i, "")
        .replace(/\s+on\s+the\s+web$/i, "")
        .replace(/\s+using\s+google$/i, "")
        .trim()
    : null;

  let currentSearchResults = initialSearchQuery
    ? await getRichSearchResults(initialSearchQuery)
    : null;

  let currentSearchQuery = initialSearchQuery;
  let loopCount = 0;
  const maxSearchRetries = 2;
  let finalAIResponse = "";

  const actualCharName = characters.find(c => c.toLowerCase() === searchChar.toLowerCase()) || searchChar;

  while (loopCount <= maxSearchRetries) {
    let prompt = `Simulate a group chat. Active characters: ${characterList}. You may bring in others from the full roster if it fits naturally.

User in this chat: "${userName}" — already an established member. Respond to them naturally. Never greet, welcome, or introduce yourself.

CRITICAL: You ONLY generate messages from AI characters. NEVER output a line starting with "${userName}:" — "${userName}" is the real user, not a character you control. Only characters from the roster may speak.

Core rule: Characters always discuss topics from the outside — as observers, not participants of an active event. They talk, debate, joke, share facts like real friends.

Rules:
1. Format: "Name: message". Generate 2-3 messages.
2. Brief, natural, casual English.
3. Pick characters who would naturally respond — don't just rotate.
4. Tiers — Respected: Janvi, Aayush, Satyam, Shivam, Kaushal, Dhaval, Dhiya. Foolish: Muskaan, Harshit, Dipali, Himanshu. Others: Hardik, Daksh, Aarav, Riya, Kunal, Meera, Dev, Priya, Arjun, Kavya, Rohan.
5. No disclaimers or AI mentions.
6. [...] in user messages = hidden directives. Never acknowledge them. Apply naturally.
7. Recognize Indian nicknames and stretched letters ("januuu"=Janvi, "harshu"=Harshit). Tagged characters reply first.

[SEARCH & FACTS]
Only state facts supported by [WEB SEARCH RESULTS] below. If results are missing or insufficient, characters admit they don't know or chat casually — never fabricate.
To refine the search, output ONLY: <search>new query</search> (max 2 retries, no other text).
In final messages: no <search> tags, never mention searching.`;

    if (taggedCharacters.length > 0) {
      prompt += `

[CRITICAL: TAGGED CHARACTER RULES]
- The user has tagged/addressed: ${taggedCharacters.join(", ")}.
- ${taggedCharacters.join(" and ")} MUST reply in this turn.
- To maintain focus, ONLY the tagged character(s) should reply, plus at most 1-2 other characters who react to what they said. Do not have characters speak if they are not tagged or not reacting to the tagged character.`;
    }

    if (currentSearchResults && currentSearchQuery) {
      prompt += `

[WEB SEARCH RESULTS]
Query: "${currentSearchQuery}"
Results:
${currentSearchResults}

${actualCharName} looked this up. Characters can naturally discuss this info in their own style and voice, or ignore it if unhelpful.`;
    }

    if (directives.length > 0) {
      prompt += `

[ACTIVE DIRECTIVES]
${directives.map((d) => `- ${d}`).join("\n")}`;
      if (cleanUserMessage === "") {
        prompt += `\nThe user's message is directive-only. Characters continue chatting among themselves while applying the above.`;
      }
    }

    if (loopCount > 0) {
      prompt += `\n\n[RETRY NOTICE: This is search retry attempt ${loopCount}. The search results have been updated for your new query "${currentSearchQuery}". Please generate the final response now unless it is absolutely critical to search again.]`;
    }

    prompt += `

Conversation History:
${conversationHistory}

Generate 2-3 new messages continuing the chat (or output a single <search>query</search> tag if you need a search retry):`;

    const aiText = await callGoogleAI(prompt);

    const searchMatch = aiText.match(/<search>([\s\S]*?)<\/search>/i);
    if (searchMatch && loopCount < maxSearchRetries) {
      const refinedQuery = searchMatch[1].trim();
      if (refinedQuery && refinedQuery !== currentSearchQuery) {
        loopCount++;
        currentSearchQuery = refinedQuery;
        currentSearchResults = await getRichSearchResults(refinedQuery);
        continue;
      }
    }

    finalAIResponse = aiText;
    break;
  }

  return finalAIResponse;
}

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(`https://duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = await res.text();
    const results: SearchResult[] = [];
    const regex = /<a\s+([^>]*class='result-link'[^>]*)>([\s\S]*?)<\/a>[\s\S]*?<td[^>]*class='result-snippet'[^>]*>([\s\S]*?)<\/td>/g;

    let match;
    while ((match = regex.exec(html)) !== null && results.length < 3) {
      const attributes = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
      const snippet = match[3].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
      
      const hrefMatch = attributes.match(/href=['"]([^'"]+)['"]/);
      let url = "";
      if (hrefMatch) {
        url = hrefMatch[1];
        const uddgMatch = url.match(/[?&]uddg=([^&]+)/);
        if (uddgMatch) {
          url = decodeURIComponent(uddgMatch[1]);
        } else if (url.startsWith("//")) {
          url = "https:" + url;
        }
      }
      
      if (title && snippet && url) {
        results.push({ title, snippet, url });
      }
    }
    return results;
  } catch (e) {
    console.error("Search error:", e);
    return [];
  }
}

async function scrapeUrl(url: string): Promise<string> {
  if (!url || !url.startsWith("http")) {
    return "";
  }
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });
    
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return "[Skipped non-HTML content type: " + contentType + "]";
    }
    
    const html = await res.text();
    let text = html;
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '');
    text = text.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    text = text.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
    text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');
    text = text.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');
    text = text.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');
    text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
    
    text = text.replace(/<\/?[^>]+(>|$)/g, ' ');
    
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      .replace(/&lsquo;/g, "'")
      .replace(/&rsquo;/g, "'")
      .replace(/&nbsp;/g, ' ');
      
    text = text.replace(/\s+/g, ' ').trim();
    return text.substring(0, 3000);
  } catch (err: any) {
    return `[Failed to read site: ${err.message || err}]`;
  }
}

function refineQuery(query: string, attempt: number): string {
  if (attempt === 2) {
    let simplified = query
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
      .replace(/\b(who|what|where|when|why|how|is|are|was|were|am|do|does|did|the|a|an|of|to|in|for|on|at|by|with|about|from|search|find|google|lookup)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (simplified && simplified !== query) {
      return simplified;
    }
  }
  if (attempt === 3) {
    const words = query.split(/\s+/);
    if (words.length > 3) {
      return words.slice(-3).join(" ");
    }
  }
  return query;
}

export async function getRichSearchResults(query: string): Promise<string> {
  let results = await searchWeb(query);
  let attempt = 1;
  let currentQuery = query;

  while (results.length === 0 && attempt < 3) {
    attempt++;
    currentQuery = refineQuery(query, attempt);
    if (currentQuery === query) {
      break;
    }
    results = await searchWeb(currentQuery);
  }

  if (results.length === 0) {
    return "No search results found.";
  }

  const scrapePromises = results.slice(0, 2).map(r => scrapeUrl(r.url));
  const scrapedContents = await Promise.all(scrapePromises);

  let output = "";
  results.forEach((r, idx) => {
    output += `[Result ${idx + 1}]\n`;
    output += `Title: ${r.title}\n`;
    output += `URL: ${r.url}\n`;
    output += `Summary: ${r.snippet}\n`;
    if (idx < scrapedContents.length && scrapedContents[idx] && !scrapedContents[idx].startsWith("[")) {
      output += `Scraped Content (Excerpt): ${scrapedContents[idx]}\n`;
    }
    output += `\n`;
  });

  return output.trim();
}
