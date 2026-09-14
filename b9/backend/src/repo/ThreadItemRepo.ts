// B9专用 AI Resolver - Western Literature - v9.3 (Phase 2A/2B Updated)
// Features: Complete 6-level English menu system, context-aware #1-#7, exam generation, tts_text population

import { isThreadBodyValid } from "../common/validators/ThreadValidator";
import { QueryArrayResult, QueryOneResult } from "./QueryArrayResult";
import { ThreadItem } from "./ThreadItem";
import { User } from "./User";
import { Thread } from "./Thread";

// FIX: Helper to clean markdown for Text-to-Speech
const cleanTtsText = (text: string): string => {
  return text.replace(/[*#_`>]/g, '').replace(/\n+/g, '. ').trim();
};

// Direct HTTP client for Ollama (with http:// prefix - critical fix)
async function callOllama(prompt: string): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_HOST || "http://aquawisdom-b9-ollama:11434";
  const model = process.env.OLLAMA_MODEL || "Aqua_B9_v1";
  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: model, prompt: prompt, stream: false })
  });
  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }
  const data = await response.json();
  return data.response;
}

// Category keywords for Western Literature
const CATEGORY_KEYWORDS: string[] = [
  "Literature", "Novel", "Poem", "Play", "Author", "Writer", "Poet",
  "Shakespeare", "Dickens", "Austen", "Hemingway", "Joyce", "Woolf",
  "Modernism", "Romanticism", "Victorian", "Gothic", "Tragedy", "Comedy"
];

// Traditional/Simplified Chinese normalization (for Chinese input)
const TRAD_TO_SIMP: Record<string, string> = {
  '關': '关', '國': '国', '學': '学', '體': '体', '實': '实',
  '際': '际', '係': '系', '於': '于', '後': '后', '發': '发',
  '會': '会', '對': '对', '經': '经', '書': '书', '說': '说',
  '話': '话', '點': '点', '時': '时', '間': '间', '問': '问',
  '題': '题', '當': '当', '從': '从', '來': '来', '個': '个',
  '們': '们', '這': '这', '那': '那', '麼': '么', '為': '为'
};

const normalizeChinese = (text: string): string => {
  let result = text;
  for (const [trad, simp] of Object.entries(TRAD_TO_SIMP)) {
    result = result.replace(new RegExp(trad, "g"), simp);
  }
  return result;
};

const GENERAL_PATTERNS: string[] = [
  "介绍", "說明", "解释", "什么是", "如何", "怎么", "哪些",
  "聊聊", "说说", "继续", "还有", "然后", "为什么", "原因"
];

const isVagueQuestion = (question: string): boolean => {
  const trimmed = question.trim();
  if (trimmed.length === 0) return true;
  const withoutChinese = trimmed.replace(/[\u4e00-\u9fff]/g, "");
  const withoutPunctuation = withoutChinese.replace(/[??!!。,、;:""''「」【】\s]/g, "");
  if (withoutPunctuation.length < 3) return true;
  const hasChinese = /[\u4e00-\u9fff]/.test(trimmed);
  if (!hasChinese) return true;
  return false;
};

const getBaseCategoryName = (categoryName: string): string => {
  return categoryName.split("(")[0].trim();
};

// ==========================================
// COMPLETE 6-LEVEL ENGLISH LITERATURE MENU SYSTEM
// ==========================================
const lastMenuMap = new Map<string, string>();
const setLastMenu = (threadId: string, menuNumber: string): void => {
  lastMenuMap.set(threadId, menuNumber);
};
const getLastMenu = (threadId: string): string => {
  return lastMenuMap.get(threadId) || "1";
};

const isMenuChoice = (body: string): { isChoice: boolean; number: string | null } => {
  const match = body.trim().match(/^#([1-7])$/);
  if (match) {
    return { isChoice: true, number: match[1] };
  }
  return { isChoice: false, number: null };
};

const isMenuRequest = (body: string): { isRequest: boolean; menuNumber: string | null } => {
  const trimmed = body.trim().toLowerCase();
  if (trimmed === "mm") {
    return { isRequest: true, menuNumber: "master" };
  }
  const match = trimmed.match(/^m([1-6])$/);
  if (match) {
    return { isRequest: true, menuNumber: match[1] };
  }
  return { isRequest: false, menuNumber: null };
};

const getMenuByNumber = (menuNumber: string, categoryName: string): string => {
  const baseName = getBaseCategoryName(categoryName);
  const menus: Record<string, string> = {
    "1": `📖 【Literary Guide】"${baseName}"\n\n#1 What is the plot summary or overview of this work?\n#2 Who are the main characters or key figures?\n#3 What are the major themes and literary devices?\n#4 What is the literary significance and historical importance?\n#5 What is the critical reception and legacy?\n\n💡 Enter m2 Casual Reading | mm All Menus`,
    "2": `📖 【Casual Reading】"${baseName}"\n\n#1 Summarize this work/author in one sentence!\n#2 What is most memorable or distinctive about this work?\n#3 What are the interesting passages or notable quotes?\n#4 Why is this worth reading or knowing?\n#5 What are the key takeaways for general readers?\n\n💡 Enter m3 Literary Analysis | mm All Menus`,
    "3": `📚 【Literary Analysis】"${baseName}"\n\n#1 Detailed plot structure and narrative technique\n#2 Character analysis and development\n#3 Theme analysis and symbolic interpretation\n#4 Literary devices and stylistic analysis\n#5 Biographical and historical context\n\n💡 Enter m4 Critical Theory | mm All Menus`,
    "4": `🎓 【Critical Theory】"${baseName}"\n\n#1 Major scholarly interpretations and debates\n#2 Different critical approaches (feminist, Marxist, psychoanalytic, etc.)\n#3 Textual history and publication context\n#4 Influence on other works and authors\n#5 Contemporary relevance and adaptations\n\n💡 Enter m5 Exam Prep | mm All Menus`,
    "5": `📝 【Exam Prep】"${baseName}"\n\n#1 Key facts and summary for exams\n#2 Frequently tested characters, quotes, and themes\n#3 Important literary terms and concepts\n#4 Essay strategies and model analysis\n#5 Common question types and sample answers\n#6 Generate 10 multiple choice questions\n#7 Generate 5 short answer questions\n\n💡 Enter m6 Comparative Literature | mm All Menus`,
    "6": `⚖ 【Comparative Literature】"${baseName}"\n\n#1 Comparison with other works by the same author\n#2 Comparison with works from the same period or movement\n#3 Cross-cultural or cross-national comparison\n#4 Comparison of different critical interpretations\n#5 Comparison of literary adaptations (film, stage, etc.)\n\n💡 Enter mm All Menus`,
    "master": `❓ 【All Menus】\n\nm1 Literary Guide (Core facts and plot)\nm2 Casual Reading (Essential knowledge)\nm3 Literary Analysis (In-depth interpretation)\nm4 Critical Theory (Scholarly perspectives)\nm5 Exam Prep (Test preparation)\nm6 Comparative Literature (Compare and contrast)\nmm This guide\nm9 System Status\n\n💡 Enter m1 to start exploring Western Literature`,
    "9": `🖥 【System Status】\n\n📖 Current Topic: ${baseName}\n🤖 AI Model: Aqua_B9_v1\n✅ Service Status: Running\n💾 Conversation Memory: Last 3 exchanges\n📚 Data Source: Western Literary Canon\n\n💡 Enter m1 to start exploring`
  };
  return menus[menuNumber] || menus["1"];
};

// Welcome message
const getDefaultIntroForCategory = (categoryName: string): string => {
  const baseName = getBaseCategoryName(categoryName);
  return `📖 Welcome to "${baseName}" category!\n\n#1 What is the plot summary or basic information about this work/author?\n#2 What are the key elements or notable figures/works?\n#3 What are the major themes, symbols, and literary devices?\n#4 What is the literary significance and critical reception?\n#5 How does this work fit into literary movements and historical context?\n\n💡 Enter m2 Casual Reading | mm All Menus\nTry: Enter #1 to start exploring!`;
};

// Helpful rejection message
const getHelpfulRejectionMessage = (): string => {
  return `Sorry, I am an AI assistant specialized in answering Western Literature related questions.\n\nPlease ask questions related to Western Literature, for example:\n• What are the characteristics of Romanticism?\n• Who are the major figures of the Lost Generation?\n• What is stream of consciousness technique?\n• Why is Ulysses considered a modernist masterpiece?\n• How did postmodernism differ from modernism?\n\n💡 Enter m2 Casual Reading | mm All Menus`;
};

const getNormalizedBaseCategoryName = (categoryName: string): string => {
  return normalizeChinese(getBaseCategoryName(categoryName));
};

const getConversationHistory = async (threadId: string): Promise<{ hasHistory: boolean; terms: string[] }> => {
  const items = await ThreadItem.find({
    where: { thread: { id: parseInt(threadId) } },
    order: { createdOn: "DESC" },
    take: 2
  });
  const terms: string[] = [];
  for (const item of items) {
    const userTerms = item.body.match(/[\u4e00-\u9fff]{2,4}/g) || [];
    terms.push(...userTerms);
    if (item.aiResponse) {
      const aiTerms = item.aiResponse.match(/[\u4e00-\u9fff]{2,4}/g) || [];
      terms.push(...aiTerms);
    }
  }
  return { hasHistory: items.length > 0, terms: [...new Set(terms)].slice(0, 10) };
};

// Relevance check
const isQuestionRelatedToCategory = async (
  question: string,
  categoryName: string,
  threadId: string
): Promise<boolean> => {
  const normalizedQuestion = normalizeChinese(question);
  const baseName = getBaseCategoryName(categoryName);
  const normalizedBaseName = getNormalizedBaseCategoryName(categoryName);
  
  if (normalizedBaseName && normalizedQuestion.includes(normalizedBaseName.toLowerCase())) {
    console.log(`✅ Filter: Matched normalized category name "${normalizedBaseName}"`);
    return true;
  }
  
  const parts = baseName.split(/[\s\(\(]/);
  for (const part of parts) {
    const normalizedPart = normalizeChinese(part);
    if (normalizedPart.length >= 2 && normalizedQuestion.includes(normalizedPart.toLowerCase())) {
      console.log(`✅ Filter: Matched partial category name "${normalizedPart}"`);
      return true;
    }
  }
  
  for (const keyword of CATEGORY_KEYWORDS) {
    if (normalizedQuestion.includes(normalizeChinese(keyword).toLowerCase())) {
      console.log(`✅ Filter: Matched keyword "${keyword}"`);
      return true;
    }
  }
  
  for (const pattern of GENERAL_PATTERNS) {
    if (normalizedQuestion.includes(normalizeChinese(pattern))) {
      console.log(`✅ Filter: Matched pattern "${pattern}"`);
      return true;
    }
  }

  const { hasHistory, terms } = await getConversationHistory(threadId);
  if (hasHistory) {
    console.log(`✅ Filter: Thread has history - auto-accepting follow-up`);
    return true;
  }
  
  for (const term of terms) {
    if (term && normalizedQuestion.includes(normalizeChinese(term))) {
      console.log(`✅ Filter: Matched context term "${term}"`);
      return true;
    }
  }
  
  console.log(`❌ Filter: No match for "${baseName}"`);
  return false;
};

// Chat history & AI response
const getThreadChatHistory = async (threadId: string, currentBody: string): Promise<string> => {
  const items = await ThreadItem.find({
    where: { thread: { id: parseInt(threadId) } },
    order: { createdOn: "DESC" },
    take: 3
  });
  if (items.length === 0) return currentBody;
  
  let context = "Previous conversation history:\n\n";
  for (const item of items.reverse()) {
    context += `User: ${item.body}\n`;
    if (item.aiResponse) {
      try {
        const parsed = JSON.parse(item.aiResponse);
        const text = parsed.map((n: any) => n.children?.map((c: any) => c.text).join("") || "").join("");
        context += `Assistant: ${text}\n\n`;
      } catch {
        context += `Assistant: ${item.aiResponse}\n\n`;
      }
    }
  }
  context += `User's new question: ${currentBody}\n\nPlease answer based on the conversation history.`;
  return context;
};

// AI Response generation
async function generateAIResponse(question: string, threadId: string, categoryName: string): Promise<string> {
  try {
    const context = await getThreadChatHistory(threadId, question);
    const lengthLimit = "Please keep your response under 500 words. / 請將回答控制在500字以內。";
    const prompt = `You are a teacher in Western Literature. Answer directly. Use English. If user requests for Chinese translation, use Traditional Chinese (繁體中文) to translate last answer. Do NOT use Simplified Chinese (简体中文). ${lengthLimit}\n\n${context}`;
    return await callOllama(prompt);
  } catch (error: any) {
    console.error("AI error:", error);
    if (error.message?.includes("timeout") || error.cause?.code === "UND_ERR_HEADERS_TIMEOUT") {
      return `⏱ Processing time is long. Suggestions: break into smaller questions, simplify your question, or enter mm to view menus.`;
    }
    return "AI service temporarily unavailable. Please try again later.";
  }
}

// ==========================================
// MAIN FUNCTION
// ==========================================
export const createThreadItem = async (
  userId: string | undefined | null,
  threadId: string,
  body: string
): Promise<QueryOneResult<ThreadItem>> => {
  let plainBody = body;
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed) && parsed[0]?.type === "paragraph" && parsed[0]?.children?.[0]?.text) {
      plainBody = parsed[0].children[0].text;
    }
  } catch (e) {}

  const trimmedMenu = plainBody.trim().toLowerCase();
  if (trimmedMenu === "mm" || trimmedMenu.match(/^m[1-6]$/)) {
    const user = await User.findOne({ where: { id: Number(userId) } });
    if (!user) return { messages: ["User not found."] };
    const thread = await Thread.findOne({ where: { id: parseInt(threadId) }, relations: ["category"] });
    if (!thread) return { messages: ["Thread not found."] };
    const category = thread.category;
    const categoryName = category?.name || "Western Literature";

    let menuMessage = "";
    if (trimmedMenu === "mm") {
      menuMessage = getMenuByNumber("master", categoryName);
      setLastMenu(threadId, "master");
    } else {
      const num = trimmedMenu.charAt(1);
      menuMessage = getMenuByNumber(num, categoryName);
      setLastMenu(threadId, num);
    }
    const slateNode = { type: "paragraph", children: [{ text: menuMessage }] };
    // FIX: Added tts_text
    const threadItem = await ThreadItem.create({
      body, user, thread,
      aiResponse: JSON.stringify([slateNode]),
      tts_text: cleanTtsText(menuMessage)
    }).save();
    return { messages: [`${threadItem.id}`] };
  }

  const bodyMsg = isThreadBodyValid(body);
  if (bodyMsg) return { messages: [bodyMsg] };
  if (!userId) return { messages: ["User not logged in."] };
  
  const user = await User.findOne({ where: { id: Number(userId) } });
  if (!user) return { messages: ["User not found."] };

  const thread = await Thread.findOne({
    where: { id: parseInt(threadId) },
    relations: ["category"]
  });
  if (!thread) return { messages: ["Thread not found."] };

  const category = thread.category;
  const categoryName = category?.name || "Western Literature";
  const baseName = getBaseCategoryName(categoryName);

  const menuRequest = isMenuRequest(body);
  if (menuRequest.isRequest) {
    const menuMessage = getMenuByNumber(menuRequest.menuNumber!, categoryName);
    const slateNode = { type: "paragraph", children: [{ text: menuMessage }] };
    // FIX: Added tts_text
    const threadItem = await ThreadItem.create({
      body, user, thread,
      aiResponse: JSON.stringify([slateNode]),
      tts_text: cleanTtsText(menuMessage)
    }).save();
    return { messages: [`${threadItem.id}`] };
  }

  const menuChoice = isMenuChoice(body);
  if (menuChoice.isChoice) {
    const lastMenu = getLastMenu(threadId);
    let actualQuestion = "";

    if (lastMenu === "1") {
      const qMap: Record<string, string> = {
        "1": `What is the plot summary or overview of this work?`,
        "2": `Who are the main characters or key figures?`,
        "3": `What are the major themes and literary devices?`,
        "4": `What is the literary significance and historical importance?`,
        "5": `What is the critical reception and legacy?`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "2") {
      const qMap: Record<string, string> = {
        "1": `Summarize this work/author in one sentence!`,
        "2": `What is most memorable or distinctive about this work?`,
        "3": `What are the interesting passages or notable quotes?`,
        "4": `Why is this worth reading or knowing?`,
        "5": `What are the key takeaways for general readers?`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "3") {
      const qMap: Record<string, string> = {
        "1": `Detailed plot structure and narrative technique`,
        "2": `Character analysis and development`,
        "3": `Theme analysis and symbolic interpretation`,
        "4": `Literary devices and stylistic analysis`,
        "5": `Biographical and historical context`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "4") {
      const qMap: Record<string, string> = {
        "1": `Major scholarly interpretations and debates`,
        "2": `Different critical approaches`,
        "3": `Textual history and publication context`,
        "4": `Influence on other works and authors`,
        "5": `Contemporary relevance and adaptations`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "5") {
      const qMap: Record<string, string> = {
        "1": `Key facts and summary for exams`,
        "2": `Frequently tested characters, quotes, and themes`,
        "3": `Important literary terms and concepts`,
        "4": `Essay strategies and model analysis`,
        "5": `Common question types and sample answers`,
        "6": `Generate 10 multiple choice questions about ${baseName}`,
        "7": `Generate 5 short answer questions about ${baseName}`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "6") {
      const qMap: Record<string, string> = {
        "1": `Comparison with other works by the same author`,
        "2": `Comparison with works from the same period or movement`,
        "3": `Cross-cultural or cross-national comparison`,
        "4": `Comparison of different critical interpretations`,
        "5": `Comparison of literary adaptations`
      };
      actualQuestion = qMap[menuChoice.number];
    } else {
      actualQuestion = `Please provide information about ${baseName}`;
    }

    const isRelevant = await isQuestionRelatedToCategory(actualQuestion, categoryName, threadId);
    if (!isRelevant) {
      const rejectMsg = getHelpfulRejectionMessage();
      const slateNode = { type: "paragraph", children: [{ text: rejectMsg }] };
      // FIX: Added tts_text
      const threadItem = await ThreadItem.create({
        body: actualQuestion, user, thread,
        aiResponse: JSON.stringify([slateNode]),
        tts_text: cleanTtsText(rejectMsg)
      }).save();
      return { messages: [`${threadItem.id}`] };
    }

    const aiResponseText = await generateAIResponse(actualQuestion, threadId, categoryName);
    const slateNode = { type: "paragraph", children: [{ text: aiResponseText }] };
    // FIX: Added tts_text
    const threadItem = await ThreadItem.create({
      body: actualQuestion, user, thread,
      aiResponse: JSON.stringify([slateNode]),
      tts_text: cleanTtsText(aiResponseText)
    }).save();
    return { messages: [`${threadItem.id}`] };
  }

  const existingItemsCount = await ThreadItem.count({ where: { thread: { id: parseInt(threadId) } } });
  const isFirstQuestion = existingItemsCount === 0;
  
  if (isFirstQuestion && isVagueQuestion(plainBody)) {
    const introMessage = getDefaultIntroForCategory(categoryName);
    const slateNode = { type: "paragraph", children: [{ text: introMessage }] };
    // FIX: Added tts_text
    const threadItem = await ThreadItem.create({
      body, user, thread,
      aiResponse: JSON.stringify([slateNode]),
      tts_text: cleanTtsText(introMessage)
    }).save();
    return { messages: [`${threadItem.id}`] };
  }

  const isRelevant = await isQuestionRelatedToCategory(plainBody, categoryName, threadId);
  if (!isRelevant) {
    const rejectMessage = getHelpfulRejectionMessage();
    const slateNode = { type: "paragraph", children: [{ text: rejectMessage }] };
    // FIX: Added tts_text
    const threadItem = await ThreadItem.create({
      body, user, thread,
      aiResponse: JSON.stringify([slateNode]),
      tts_text: cleanTtsText(rejectMessage)
    }).save();
    return { messages: [`${threadItem.id}`] };
  }

  const aiResponseText = await generateAIResponse(plainBody, threadId, categoryName);
  const slateNode = { type: "paragraph", children: [{ text: aiResponseText }] };
  // FIX: Added tts_text
  const threadItem = await ThreadItem.create({
    body, user, thread,
    aiResponse: JSON.stringify([slateNode]),
    tts_text: cleanTtsText(aiResponseText)
  }).save();
  return { messages: [`${threadItem.id}`] };
};

export const getThreadItemsByThreadId = async (threadId: string): Promise<QueryArrayResult<ThreadItem>> => {
  const threadItems = await ThreadItem.createQueryBuilder("ti")
    .where(`ti."threadId" = :threadId`, { threadId })
    .leftJoinAndSelect("ti.thread", "thread")
    .orderBy("ti.createdOn", "ASC")
    .getMany();
  if (!threadItems || threadItems.length === 0) {
    return { messages: ["No responses found for this thread."] };
  }
  return { entities: threadItems };
};
