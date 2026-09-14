
// B10专用 AI Resolver - Macbeth - v10.4 (Phase 2B TTS Update)
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

// Direct HTTP client for Ollama
async function callOllama(prompt: string): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_HOST || "http://aquawisdom-b10-ollama:11434";
  const model = process.env.OLLAMA_MODEL || "Aqua_B10_v1";
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

// Category keywords for Macbeth
const CATEGORY_KEYWORDS: string[] = [
  "Macbeth", "Lady Macbeth", "Banquo", "Macduff", "Duncan", "Malcolm",
  "Witches", "Dagger", "Blood", "Sleep", "Ambition", "Guilt",
  "Fate", "Murder", "King", "Scotland", "Prophecy", "Ghost", "Tragedy"
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
// COMPLETE 6-LEVEL ENGLISH MACBETH MENU SYSTEM
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
    "1": `📖 【Scene Guide】"${baseName}"\n#1 What is the plot summary of this scene/topic?\n#2 Who are the main characters and what are their actions?\n#3 What are the key events or turning points?\n#4 What is the dramatic significance of this scene?\n#5 How does this scene advance the tragedy?\n💡 Enter m2 Character Analysis | mm All Menus`,
    "2": `🎭 【Character Analysis】"${baseName}"\n#1 Who is this character and what is their role in the play?\n#2 How does this character develop and change throughout the play?\n#3 What are their key speeches and actions?\n#4 What is their motivation and moral journey?\n#5 How do they compare to other characters?\n💡 Enter m3 Theme & Symbolism | mm All Menus`,
    "3": `🎭 【Theme & Symbolism】"${baseName}"\n#1 What are the major themes in this scene/topic?\n#2 What symbols or imagery appear (blood, sleep, darkness, etc.)?\n#3 How does Shakespeare use language and literary devices?\n#4 What do the Witches' prophecies represent?\n#5 How does the theme of ambition or guilt manifest here?\n💡 Enter m4 Critical Interpretation | mm All Menus`,
    "4": `🎓 【Critical Interpretation】"${baseName}"\n#1 How have scholars interpreted this scene/character?\n#2 What are different critical approaches (psychoanalytic, feminist, etc.)?\n#3 How does this relate to the play's historical context?\n#4 What are the major debates in Macbeth scholarship?\n#5 How does this scene contribute to the play's tragic structure?\n💡 Enter m5 Exam Prep | mm All Menus`,
    "5": `📝 【Exam Prep】"${baseName}"\n#1 Key facts and plot points summary\n#2 Frequently tested characters and quotes\n#3 Important themes and literary devices\n#4 Essay strategies and sample answers\n#5 Common exam questions and model responses\n#6 Generate 10 multiple choice questions\n#7 Generate 5 short answer questions\n💡 Enter m6 Performance Analysis | mm All Menus`,
    "6": `🎭 【Performance Analysis】"${baseName}"\n#1 How has this scene been interpreted on stage?\n#2 Comparison of different film adaptations\n#3 Directorial choices and their effects\n#4 Iconic performances of characters\n#5 How does staging affect the meaning?\n💡 Enter mm All Menus`,
    "master": `❓ 【All Menus】\nm1 Scene Guide (Plot summary and analysis)\nm2 Character Analysis (Character development)\nm3 Theme & Symbolism (Thematic interpretation)\nm4 Critical Interpretation (Scholarly perspectives)\nm5 Exam Prep (Test preparation)\nm6 Performance Analysis (Stage and film)\nmm This guide\nm9 System Status\n💡 Enter m1 to start exploring Macbeth`,
    "9": ` 【System Status】\n📖 Current Topic: ${baseName}\n🤖 AI Model: Aqua_B10_v1\n✅ Service Status: Running\n💾 Conversation Memory: Last 3 exchanges\n📚 Data Source: Shakespeare's Macbeth\n💡 Enter m1 to start exploring`
  };
  return menus[menuNumber] || menus["1"];
};

// Welcome message
const getDefaultIntroForCategory = (categoryName: string): string => {
  const baseName = getBaseCategoryName(categoryName);
  return `📖 Welcome to "${baseName}" category!\n#1 What happens in this scene or what is this character/theme about?\n#2 Who are the key characters involved or what are the key elements?\n#3 What are the significant events, quotes, or literary devices?\n#4 What is the dramatic significance in the play?\n#5 How does this connect to the overall tragedy of Macbeth?\n💡 Enter m2 Character Analysis | mm All Menus\nTry: Enter #1 to start exploring!`;
};

// Helpful rejection message
const getHelpfulRejectionMessage = (): string => {
  return `Sorry, I am an AI assistant specialized in answering questions about Shakespeare's Macbeth.\nPlease ask questions related to Macbeth, for example:\n• What happens in the dagger scene?\n• How does Lady Macbeth change throughout the play?\n• What does blood symbolize in Macbeth?\n• Why is Macbeth considered a tragic hero?\n• How does the play explore the theme of ambition?\n💡 Enter m2 Character Analysis | mm All Menus`;
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
    const prompt = `You are a teacher in Shakespeare's Macbeth. Answer directly. Use English. If user requests for Chinese translation, use Traditional Chinese (繁體中文) to translate last answer. Do NOT use Simplified Chinese (简体中文). ${lengthLimit}\n\n${context}`;
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
    if (Array.isArray(parsed) && parsed[0]?.type === "paragraph" && parsed[0].children?.[0]?.text) {
      plainBody = parsed[0].children[0].text;
    }
  } catch (e) {}

  const trimmedMenu = plainBody.trim().toLowerCase();
  if (trimmedMenu === "mm" || trimmedMenu.match(/^m[1-6]$/)) {
    const user = await User.findOne({ where: { id: parseInt(userId) } });
    if (!user) return { messages: ["User not found."] };
    const thread = await Thread.findOne({ where: { id: parseInt(threadId) }, relations: ["category"] });
    if (!thread) return { messages: ["Thread not found."] };
    const category = thread.category;
    const categoryName = category?.name || "Macbeth";
    
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
    const threadItem = await ThreadItem.create({
      body, user, thread,
      aiResponse: JSON.stringify([slateNode]),
      tts_text: cleanTtsText(menuMessage) // Added for Phase 2B TTS
    }).save();
    return { messages: [`${threadItem.id}`] };
  }

  const bodyMsg = isThreadBodyValid(body);
  if (bodyMsg) return { messages: [bodyMsg] };
  if (!userId) return { messages: ["User not logged in."] };

  const user = await User.findOne({ where: { id: parseInt(userId) } });
  if (!user) return { messages: ["User not found."] };

  const thread = await Thread.findOne({
    where: { id: parseInt(threadId) },
    relations: ["category"]
  });
  if (!thread) return { messages: ["Thread not found."] };

  const category = thread.category;
  const categoryName = category?.name || "Macbeth";
  const baseName = getBaseCategoryName(categoryName);

  const menuRequest = isMenuRequest(body);
  if (menuRequest.isRequest) {
    const menuMessage = getMenuByNumber(menuRequest.menuNumber!, categoryName);
    const slateNode = { type: "paragraph", children: [{ text: menuMessage }] };
    const threadItem = await ThreadItem.create({
      body, user, thread,
      aiResponse: JSON.stringify([slateNode]),
      tts_text: cleanTtsText(menuMessage) // Added for Phase 2B TTS
    }).save();
    return { messages: [`${threadItem.id}`] };
  }

  const menuChoice = isMenuChoice(body);
  if (menuChoice.isChoice) {
    const lastMenu = getLastMenu(threadId);
    let actualQuestion = "";

    if (lastMenu === "1") {
      const qMap: Record<string, string> = {
        "1": `What is the plot summary of this scene/topic?`,
        "2": `Who are the main characters and what are their actions?`,
        "3": `What are the key events or turning points?`,
        "4": `What is the dramatic significance of this scene?`,
        "5": `How does this scene advance the tragedy?`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "2") {
      const qMap: Record<string, string> = {
        "1": `Who is this character and what is their role in the play?`,
        "2": `How does this character develop and change throughout the play?`,
        "3": `What are their key speeches and actions?`,
        "4": `What is their motivation and moral journey?`,
        "5": `How do they compare to other characters?`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "3") {
      const qMap: Record<string, string> = {
        "1": `What are the major themes in this scene/topic?`,
        "2": `What symbols or imagery appear?`,
        "3": `How does Shakespeare use language and literary devices?`,
        "4": `What do the Witches' prophecies represent?`,
        "5": `How does the theme of ambition or guilt manifest here?`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "4") {
      const qMap: Record<string, string> = {
        "1": `How have scholars interpreted this scene/character?`,
        "2": `What are different critical approaches?`,
        "3": `How does this relate to the play's historical context?`,
        "4": `What are the major debates in Macbeth scholarship?`,
        "5": `How does this scene contribute to the play's tragic structure?`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "5") {
      const qMap: Record<string, string> = {
        "1": `Key facts and plot points summary`,
        "2": `Frequently tested characters and quotes`,
        "3": `Important themes and literary devices`,
        "4": `Essay strategies and sample answers`,
        "5": `Common exam questions and model responses`,
        "6": `Generate 10 multiple choice questions about ${baseName}`,
        "7": `Generate 5 short answer questions about ${baseName}`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "6") {
      const qMap: Record<string, string> = {
        "1": `How has this scene been interpreted on stage?`,
        "2": `Comparison of different film adaptations`,
        "3": `Directorial choices and their effects`,
        "4": `Iconic performances of characters`,
        "5": `How does staging affect the meaning?`
      };
      actualQuestion = qMap[menuChoice.number];
    } else {
      actualQuestion = `Please provide information about ${baseName}`;
    }

    const isRelevant = await isQuestionRelatedToCategory(actualQuestion, categoryName, threadId);
    if (!isRelevant) {
      const rejectMsg = getHelpfulRejectionMessage();
      const slateNode = { type: "paragraph", children: [{ text: rejectMsg }] };
      const threadItem = await ThreadItem.create({
        body: actualQuestion, user, thread,
        aiResponse: JSON.stringify([slateNode]),
        tts_text: cleanTtsText(rejectMsg) // Added for Phase 2B TTS
      }).save();
      return { messages: [`${threadItem.id}`] };
    }

    const aiResponseText = await generateAIResponse(actualQuestion, threadId, categoryName);
    const slateNode = { type: "paragraph", children: [{ text: aiResponseText }] };
    const threadItem = await ThreadItem.create({
      body: actualQuestion, user, thread,
      aiResponse: JSON.stringify([slateNode]),
      tts_text: cleanTtsText(aiResponseText) // Added for Phase 2B TTS
    }).save();
    return { messages: [`${threadItem.id}`] };
  }

  const existingItemsCount = await ThreadItem.count({ where: { thread: { id: parseInt(threadId) } } });
  const isFirstQuestion = existingItemsCount === 0;

  if (isFirstQuestion && isVagueQuestion(plainBody)) {
    const introMessage = getDefaultIntroForCategory(categoryName);
    const slateNode = { type: "paragraph", children: [{ text: introMessage }] };
    const threadItem = await ThreadItem.create({
      body, user, thread,
      aiResponse: JSON.stringify([slateNode]),
      tts_text: cleanTtsText(introMessage) // Added for Phase 2B TTS
    }).save();
    return { messages: [`${threadItem.id}`] };
  }

  const isRelevant = await isQuestionRelatedToCategory(plainBody, categoryName, threadId);
  if (!isRelevant) {
    const rejectMessage = getHelpfulRejectionMessage();
    const slateNode = { type: "paragraph", children: [{ text: rejectMessage }] };
    const threadItem = await ThreadItem.create({
      body, user, thread,
      aiResponse: JSON.stringify([slateNode]),
      tts_text: cleanTtsText(rejectMessage) // Added for Phase 2B TTS
    }).save();
    return { messages: [`${threadItem.id}`] };
  }

  const aiResponseText = await generateAIResponse(plainBody, threadId, categoryName);
  const slateNode = { type: "paragraph", children: [{ text: aiResponseText }] };
  const threadItem = await ThreadItem.create({
    body, user, thread,
    aiResponse: JSON.stringify([slateNode]),
    tts_text: cleanTtsText(aiResponseText) // Added for Phase 2B TTS
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
