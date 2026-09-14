// B7专用 AI Resolver - 三國演義 - v7.7 (Phase 2B TTS Update)
// Features: Complete 6-level menu system, context-aware #1-#7, exam generation, tts_text population

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
  const ollamaUrl = process.env.OLLAMA_HOST || "http://aquawisdom-b7-ollama:11434";
  const model = process.env.OLLAMA_MODEL || "Aqua_B7_v1";
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

// Category keywords for 三國演義
const CATEGORY_KEYWORDS: string[] = [
  "三國", "演義", "三國演義", "Romance of Three Kingdoms",
  "諸葛亮", "孔明", "Zhuge Liang", "關羽", "關公", "關雲長", "Guan Yu",
  "張飛", "Zhang Fei", "趙雲", "Zhao Yun", "劉備", "Liu Bei",
  "曹操", "Cao Cao", "孫權", "Sun Quan", "周瑜", "Zhou Yu",
  "司馬懿", "Sima Yi", "赤壁", "空城計", "草船借箭", "七擒孟獲", "失街亭",
  "桃園結義", "過五關斬六將", "華容道", "白帝城託孤", "出師表"
];

// Traditional/Simplified Chinese normalization
const TRAD_TO_SIMP: Record<string, string> = {
  '關': '关', '諸': '诸', '諸葛': '诸葛', '雲': '云', '長': '长',
  '飛': '飞', '趙': '赵', '劉': '刘', '備': '备', '孫': '孙',
  '權': '权', '馬': '马', '黃': '黄', '週': '周', '瑜': '瑜',
  '懿': '懿', '國': '国', '演': '演', '義': '义', '戰': '战',
  '鬥': '斗', '點': '点', '時': '时', '間': '间', '問': '问',
  '題': '题', '當': '当', '從': '从', '來': '来', '個': '个',
  '們': '们', '這': '这', '那': '那', '麼': '么', '為': '为',
  '萬': '万', '與': '与', '無': '无', '論': '论', '語': '语'
};

const normalizeChinese = (text: string): string => {
  let result = text;
  for (const [trad, simp] of Object.entries(TRAD_TO_SIMP)) {
    result = result.replace(new RegExp(trad, "g"), simp);
  }
  return result;
};

// General patterns for auto-accept
const GENERAL_PATTERNS: string[] = [
  "介绍一下", "介紹一下", "讲一下", "講一下", "说说", "說說",
  "继续", "繼續", "还有吗", "還有嗎", "然后呢", "然後呢",
  "是什么", "什麼是", "什么是", "有哪些", "有什么", "有什麼",
  "故事", "生平", "事迹", "事蹟", "典故", "情节", "情節"
];

// Vague question detection
const isVagueQuestion = (question: string): boolean => {
  const trimmed = question.trim();
  if (trimmed.length === 0) return true;
  const withoutChinese = trimmed.replace(/[\u4e00-\u9fff]/g, "");
  const withoutPunctuation = withoutChinese.replace(/[??!!。,、;:""''「」【】《》\s]/g, "");
  if (withoutPunctuation.length < 3) return true;
  const hasChinese = /[\u4e00-\u9fff]/.test(trimmed);
  if (!hasChinese) return true;
  return false;
};

// Helper function
const getBaseCategoryName = (categoryName: string): string => {
  return categoryName.split("(")[0].trim();
};

// ==========================================
// COMPLETE MENU SYSTEM
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

// Menu content definitions
const getMenuByNumber = (menuNumber: string, categoryName: string): string => {
  const baseName = getBaseCategoryName(categoryName);
  const menus: Record<string, string> = {
    "1": `📖 【故事導覽】「${baseName}」\n#1 這一回的主要情節是什麼?\n#2 有哪些關鍵人物?他們的表現如何?\n#3 有什麼經典場面或對白?\n#4 這一回在《三國演義》中的重要性?\n#5 這一回為後續埋下了什麼伏筆?\n💡 輸入 m2 輕鬆閱讀 | mm 所有選單`,
    "2": `📖 【輕鬆讀三國】「${baseName}」\n#1 用一句話總結這一回!\n#2 這一回誰最出風頭?\n#3 有什麼有趣或感人的情節?\n#4 這一回教會了我們什麼?\n#5 如果只看這一回,重點是什麼?\n💡 輸入 m3 深度解析 | mm 所有選單`,
    "3": `📚 【深度解析】「${baseName}」\n#1 這一回的完整情節脈絡\n#2 人物性格與動機分析\n#3 經典對話與兵法策略解讀\n#4 這一回在小說結構中的位置\n#5 歷史真實與小說虛構的對比\n💡 輸入 m4 學術探討 | mm 所有選單`,
    "4": `🎓 【學術探討】「${baseName}」\n#1 學術界對這一回的主要觀點\n#2 不同版本的文本差異\n#3 人物形象的文化意涵\n#4 這一回與《三國志》的對比\n#5 這一回對後世文學的影響\n💡 輸入 m5 考試重點 | mm 所有選單`,
    "5": `📝 【考試重點】「${baseName}」\n#1 這一回的必考重點\n#2 常考人物與事蹟\n#3 經典成語與典故出處\n#4 這一回在文學史上的地位\n#5 常見問答題型整理\n#6 給我出10題選擇題\n#7 給我出5題簡答題\n💡 輸入 m6 比較分析 | mm 所有選單`,
    "6": `⚖ 【比較分析】「${baseName}」\n#1 與前後回目的關聯\n#2 不同人物在同一事件中的表現對比\n#3 與《三國志》史實的比較\n#4 不同影視改編的呈現差異\n#5 魏蜀吳三方視角的解讀\n💡 輸入 mm 所有選單`,
    "master": `❓ 【所有選單】\nm1 故事導覽(快速了解)\nm2 輕鬆讀三國(趣味閱讀)\nm3 深度解析(詳細分析)\nm4 學術探討(進階研究)\nm5 考試重點(應試準備)\nm6 比較分析(對照研究)\nmm 本說明\nm9 系統狀態\n💡 輸入 m1 開始探索`,
    "9": ` 【系統狀態】\n📖 當前章節:${baseName}\n🤖 AI模型:Aqua_B7_v1\n✅ 服務:運行中\n💾 記憶:最近3輪對話\n📚 資料來源:《三國演義》\n💡 輸入 m1 開始探索`
  };
  return menus[menuNumber] || menus["1"];
};

// Welcome message
const getDefaultIntroForCategory = (categoryName: string): string => {
  const baseName = getBaseCategoryName(categoryName);
  return `📖 歡迎來到「${baseName}」分類!\n#1 這一回發生了什麼故事?\n#2 有哪些重要人物登場?\n#3 有什麼經典情節或名言?\n#4 這一回在整部小說中有什麼地位?\n#5 這一回對後續發展有什麼影響?\n💡 輸入 m2 輕鬆閱讀 | mm 所有選單\n試試看:輸入 #1 開始探索!`;
};

// Helpful rejection message
const getHelpfulRejectionMessage = (): string => {
  return `抱歉,我是專門回答《三國演義》相關問題的AI助手。\n請提出與三國演義相關的問題,例如:\n• 桃園三結義的經過是什麼?\n• 諸葛亮的空城計是怎麼回事?\n• 赤壁之戰的勝負關鍵是什麼?\n• 關羽有哪些著名事蹟?\n• 這一回的主要情節是什麼?\n💡 輸入 m2 輕鬆閱讀 | mm 所有選單`;
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
  
  let context = "以下是之前的對話記錄:\n\n";
  for (const item of items.reverse()) {
    context += `用戶: ${item.body}\n`;
    if (item.aiResponse) {
      try {
        const parsed = JSON.parse(item.aiResponse);
        const text = parsed.map((n: any) => n.children?.map((c: any) => c.text).join("") || "").join("");
        context += `助手: ${text}\n\n`;
      } catch {
        context += `助手: ${item.aiResponse}\n\n`;
      }
    }
  }
  context += `現在用戶的新問題: ${currentBody}\n\n請基於以上對話歷史回答。`;
  return context;
};

// AI Response generation
async function generateAIResponse(question: string, threadId: string, categoryName: string): Promise<string> {
  try {
    const context = await getThreadChatHistory(threadId, question);
    const lengthLimit = "Please keep your response under 500 words. / 請將回答控制在500字以內。";
    const prompt = `你是一個專門回答「三國演義」相關問題的老師。直接回答,不要拒絕。用繁體中文。 ${lengthLimit}\n\n${context}`;
    return await callOllama(prompt);
  } catch (error: any) {
    console.error("AI error:", error);
    if (error.message?.includes("timeout") || error.cause?.code === "UND_ERR_HEADERS_TIMEOUT") {
      return `⏱ 處理時間較長。建議:拆分成小問題、簡化問法、或輸入 mm 查看選單。`;
    }
    return "AI 服務暫時不可用,請稍後再試。";
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
  // Extract plain text from rich text JSON
  let plainBody = body;
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed) && parsed[0]?.type === "paragraph" && parsed[0]?.children?.[0]?.text) {
      plainBody = parsed[0].children[0].text;
    }
  } catch (e) {}

  // FIRST: Check for menu commands (bypass validation)
  const trimmedMenu = plainBody.trim().toLowerCase();
  if (trimmedMenu === "mm" || trimmedMenu.match(/^m[1-6]$/)) {
    const user = await User.findOne({ where: { id: parseInt(userId) } });
    if (!user) return { messages: ["User not found."] };
    const thread = await Thread.findOne({ where: { id: parseInt(threadId) }, relations: ["category"] });
    if (!thread) return { messages: ["Thread not found."] };
    const category = thread.category;
    const categoryName = category?.name || "三國演義";
    
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

  // THEN: Body validation for normal messages
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
  const categoryName = category?.name || "三國演義";
  const baseName = getBaseCategoryName(categoryName);

  // MENU REQUEST (m1, m2, mm)
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

  // MENU CHOICE (#1, #2, #3, #4, #5, #6, #7)
  const menuChoice = isMenuChoice(body);
  if (menuChoice.isChoice) {
    const lastMenu = getLastMenu(threadId);
    let actualQuestion = "";

    if (lastMenu === "1") {
      const qMap: Record<string, string> = {
        "1": `這一回的主要情節是什麼?`,
        "2": `有哪些關鍵人物?他們的表現如何?`,
        "3": `有什麼經典場面或對白?`,
        "4": `這一回在《三國演義》中的重要性?`,
        "5": `這一回為後續埋下了什麼伏筆?`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "2") {
      const qMap: Record<string, string> = {
        "1": `用一句話總結這一回!`,
        "2": `這一回誰最出風頭?`,
        "3": `有什麼有趣或感人的情節?`,
        "4": `這一回教會了我們什麼?`,
        "5": `如果只看這一回,重點是什麼?`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "3") {
      const qMap: Record<string, string> = {
        "1": `這一回的完整情節脈絡`,
        "2": `人物性格與動機分析`,
        "3": `經典對話與兵法策略解讀`,
        "4": `這一回在小說結構中的位置`,
        "5": `歷史真實與小說虛構的對比`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "4") {
      const qMap: Record<string, string> = {
        "1": `學術界對這一回的主要觀點`,
        "2": `不同版本的文本差異`,
        "3": `人物形象的文化意涵`,
        "4": `這一回與《三國志》的對比`,
        "5": `這一回對後世文學的影響`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "5") {
      const qMap: Record<string, string> = {
        "1": `這一回的必考重點`,
        "2": `常考人物與事蹟`,
        "3": `經典成語與典故出處`,
        "4": `這一回在文學史上的地位`,
        "5": `常見問答題型整理`,
        "6": `請針對「${baseName}」出10題選擇題`,
        "7": `請針對「${baseName}」出5題簡答題`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "6") {
      const qMap: Record<string, string> = {
        "1": `與前後回目的關聯`,
        "2": `不同人物在同一事件中的表現對比`,
        "3": `與《三國志》史實的比較`,
        "4": `不同影視改編的呈現差異`,
        "5": `魏蜀吳三方視角的解讀`
      };
      actualQuestion = qMap[menuChoice.number];
    } else {
      actualQuestion = `請介紹關於「${baseName}」的內容`;
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

  // NORMAL QUESTION HANDLING
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

// // B7专用 AI Resolver - 三國演義 - v1.1 (Phase 2B TTS Update)
// // Features: Complete 6-level menu system, context-aware #1-#7, exam generation, tts_text population

// import { isThreadBodyValid } from "../common/validators/ThreadValidator";
// import { QueryArrayResult, QueryOneResult } from "./QueryArrayResult";
// import { ThreadItem } from "./ThreadItem";
// import { User } from "./User";
// import { Thread } from "./Thread";

// // FIX: Helper to clean markdown for Text-to-Speech
// const cleanTtsText = (text: string): string => {
//   return text.replace(/[*#_`>]/g, '').replace(/\n+/g, '. ').trim();
// };

// // Direct HTTP client for Ollama
// async function callOllama(prompt: string): Promise<string> {
//   const ollamaUrl = process.env.OLLAMA_HOST || "http://ollama:11437";
//   const model = process.env.OLLAMA_MODEL || "Aqua_B7_v1";

//   const response = await fetch(`${ollamaUrl}/api/generate`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ model: model, prompt: prompt, stream: false })
//   });

//   if (!response.ok) {
//     throw new Error(`Ollama API error: ${response.status}`);
//   }

//   const data = await response.json();
//   return data.response;
// }

// // Category keywords for 三國演義
// const CATEGORY_KEYWORDS: string[] = [
//   "Western", "History", "Europe", "America", "Ancient", "Greece", "Rome",
//   "Medieval", "Renaissance", "Enlightenment", "Revolution", "Industrial",
//   "World War", "Cold War", "Civilization", "Empire", "Battle", "Treaty",
//   "Democracy", "Republic", "Monarchy", "Colony", "Independence"
// ];

// // Traditional/Simplified Chinese normalization (for Chinese input)
// const TRAD_TO_SIMP: Record<string, string> = {
//   '關': '关', '國': '国', '學': '学', '體': '体', '實': '实',
//   '際': '际', '係': '系', '於': '于', '後': '后', '發': '发',
//   '會': '会', '對': '对', '經': '经', '書': '书', '說': '说',
//   '話': '话', '點': '点', '時': '时', '間': '间', '問': '问',
//   '題': '题', '當': '当', '從': '从', '來': '来', '個': '个',
//   '們': '们', '這': '这', '那': '那', '麼': '么', '為': '为'
// };

// const normalizeChinese = (text: string): string => {
//   let result = text;
//   for (const [trad, simp] of Object.entries(TRAD_TO_SIMP)) {
//     result = result.replace(new RegExp(trad, "g"), simp);
//   }
//   return result;
// };

// // General patterns for auto-accept
// const GENERAL_PATTERNS: string[] = [
//   "介绍", "說明", "解释", "什么是", "如何", "怎么", "哪些",
//   "聊聊", "说说", "继续", "还有", "然后", "为什么", "原因"
// ];

// // Vague question detection
// const isVagueQuestion = (question: string): boolean => {
//   const trimmed = question.trim();
//   if (trimmed.length === 0) return true;

//   const withoutChinese = trimmed.replace(/[\u4e00-\u9fff]/g, "");
//   const withoutPunctuation = withoutChinese.replace(/[？?！!。，、；：""''「」【】\s]/g, "");

//   if (withoutPunctuation.length < 3) return true;

//   const hasChinese = /[\u4e00-\u9fff]/.test(trimmed);
//   if (!hasChinese) return true;

//   return false;
// };

// const getBaseCategoryName = (categoryName: string): string => {
//   return categoryName.split("(")[0].trim();
// };

// // ==========================================
// // COMPLETE 6-LEVEL ENGLISH MENU SYSTEM
// // ==========================================

// const lastMenuMap = new Map<string, string>();
// const setLastMenu = (threadId: string, menuNumber: string): void => {
//   lastMenuMap.set(threadId, menuNumber);
// };
// const getLastMenu = (threadId: string): string => {
//   return lastMenuMap.get(threadId) || "1";
// };

// const isMenuChoice = (body: string): { isChoice: boolean; number: string | null } => {
//   const match = body.trim().match(/^#([1-7])$/);
//   if (match) {
//     return { isChoice: true, number: match[1] };
//   }
//   return { isChoice: false, number: null };
// };

// const isMenuRequest = (body: string): { isRequest: boolean; menuNumber: string | null } => {
//   const trimmed = body.trim().toLowerCase();
//   if (trimmed === "mm") {
//     return { isRequest: true, menuNumber: "master" };
//   }
//   const match = trimmed.match(/^m([1-6])$/);
//   if (match) {
//     return { isRequest: true, menuNumber: match[1] };
//   }
//   return { isRequest: false, menuNumber: null };
// };

// const getMenuByNumber = (menuNumber: string, categoryName: string): string => {
//   const baseName = getBaseCategoryName(categoryName);

//   const menus: Record<string, string> = {
//     "1": `📖 【Historical Guide】"${baseName}"

// #1 What is the historical background and context?
// #2 Who were the key figures and their contributions?
// #3 What were the decisive events or turning points?
// #4 What is the historical significance and impact?
// #5 How did this influence future generations?

// 💡 Enter m2 Casual Reading | mm All Menus`,

//     "2": `📖 【Casual Reading】"${baseName}"

// #1 Summarize this history in one sentence!
// #2 Who is most notable during this period?
// #3 What are the interesting or thought-provoking stories?
// #4 What does this history teach us?
// #5 If only looking at the highlights, what is the core?

// 💡 Enter m3 Detailed Study | mm All Menus`,

//     "3": `📚 【Detailed Study】"${baseName}"

// #1 Complete historical context and development process
// #2 Analysis of character motivations and historical roles
// #3 Interpretation of key events, battles, and decisions
// #4 Position of this history within Western civilization
// #5 Comparison of historical records vs scholarly interpretations

// 💡 Enter m4 Academic Research | mm All Menus`,

//     "4": `🎓 【Academic Research】"${baseName}"

// #1 Major scholarly perspectives and controversies
// #2 Different historiographical interpretations
// #3 Historical sources, archaeological findings, and evidence
// #4 Comparative study with other civilizations of the same period
// #5 Profound impact on modern Western society

// 💡 Enter m5 Exam Prep | mm All Menus`,

//     "5": `📝 【Exam Prep】"${baseName}"

// #1 Key exam points summary
// #2 Frequently tested figures and events
// #3 Classic terms and key concepts
// #4 Position of this history in Western civilization (must-know)
// #5 Common question types and answer strategies
// #6 Generate 10 multiple choice questions
// #7 Generate 5 short answer questions

// 💡 Enter m6 Comparative Analysis | mm All Menus`,

//     "6": `⚖ 【Comparative Analysis】"${baseName}"

// #1 Connections and evolution with previous/subsequent periods
// #2 Comparison of different figures in the same historical context
// #3 Comparison with contemporary Eastern civilizations
// #4 Differences in narrative between different historical works
// #5 Multi-dimensional analysis (political, economic, social, cultural)

// 💡 Enter mm All Menus`,

//     "master": `❓ 【All Menus】

// m1 Historical Guide (Quick grasp)
// m2 Casual Reading (Fun learning)
// m3 Detailed Study (In-depth analysis)
// m4 Academic Research (Advanced study)
// m5 Exam Prep (Test preparation)
// m6 Comparative Analysis (Comparative study)
// mm This guide
// m9 System Status

// 💡 Enter m1 to start exploring 三國演義`,

//     "9": `🖥 【System Status】

// 📖 Current Topic: ${baseName}
// 🤖 AI Model: Aqua_B7_v1
// ✅ Service Status: Running
// 💾 Conversation Memory: Last 3 exchanges
// 📚 Data Source: Western Civilization History

// 💡 Enter m1 to start exploring`
//   };

//   return menus[menuNumber] || menus["1"];
// };

// // Welcome message
// const getDefaultIntroForCategory = (categoryName: string): string => {
//   const baseName = getBaseCategoryName(categoryName);
//   return `📖 Welcome to "${baseName}" category!

// #1 What is the main content of this historical period/event?
// #2 What important figures are featured?
// #3 What key events or turning points occurred?
// #4 What is the significance in Western civilization?
// #5 What impact did it have on future generations?

// 💡 Enter m2 Casual Reading | mm All Menus
// Try: Enter #1 to start exploring!`;
// };

// // Helpful rejection message
// const getHelpfulRejectionMessage = (): string => {
//   return `Sorry, I am an AI assistant specialized in answering 三國演義 related questions.

// Please ask questions related to 三國演義, for example:
// • What factors led to the rise of the Roman Empire?
// • What were the causes and consequences of World War II?
// • How did the Scientific Revolution change European thought?
// • What were the key events of the French Revolution?
// • How did the Cold War shape international relations?

// 💡 Enter m2 Casual Reading | mm All Menus`;
// };

// const getNormalizedBaseCategoryName = (categoryName: string): string => {
//   return normalizeChinese(getBaseCategoryName(categoryName));
// };

// const getConversationHistory = async (threadId: string): Promise<{ hasHistory: boolean; terms: string[] }> => {
//   const items = await ThreadItem.find({
//     where: { thread: { id: parseInt(threadId) } },
//     order: { createdOn: "DESC" },
//     take: 2
//   });
//   const terms: string[] = [];
//   for (const item of items) {
//     const userTerms = item.body.match(/[\u4e00-\u9fff]{2,4}/g) || [];
//     terms.push(...userTerms);
//     if (item.aiResponse) {
//       const aiTerms = item.aiResponse.match(/[\u4e00-\u9fff]{2,4}/g) || [];
//       terms.push(...aiTerms);
//     }
//   }
//   return { hasHistory: items.length > 0, terms: [...new Set(terms)].slice(0, 10) };
// };

// // Relevance check
// const isQuestionRelatedToCategory = async (
//   question: string,
//   categoryName: string,
//   threadId: string
// ): Promise<boolean> => {
//   const normalizedQuestion = normalizeChinese(question);
//   const baseName = getBaseCategoryName(categoryName);
//   const normalizedBaseName = getNormalizedBaseCategoryName(categoryName);

//   if (normalizedBaseName &&
//       normalizedQuestion.includes(normalizedBaseName.toLowerCase())) {
//     console.log(`✅ Filter: Matched normalized category name "${normalizedBaseName}"`);
//     return true;
//   }

//   const parts = baseName.split(/[\s\(\（]/);
//   for (const part of parts) {
//     const normalizedPart = normalizeChinese(part);
//     if (normalizedPart.length >= 2 &&
//         normalizedQuestion.includes(normalizedPart.toLowerCase())) {
//       console.log(`✅ Filter: Matched partial category name "${normalizedPart}"`);
//       return true;
//     }
//   }

//   for (const keyword of CATEGORY_KEYWORDS) {
//     if (normalizedQuestion.includes(normalizeChinese(keyword).toLowerCase())) {
//       console.log(`✅ Filter: Matched keyword "${keyword}"`);
//       return true;
//     }
//   }

//   for (const pattern of GENERAL_PATTERNS) {
//     if (normalizedQuestion.includes(normalizeChinese(pattern))) {
//       console.log(`✅ Filter: Matched pattern "${pattern}"`);
//       return true;
//     }
//   }

//   const { hasHistory, terms } = await getConversationHistory(threadId);
//   if (hasHistory) {
//     console.log(`✅ Filter: Thread has history - auto-accepting follow-up`);
//     return true;
//   }

//   for (const term of terms) {
//     if (term && normalizedQuestion.includes(normalizeChinese(term))) {
//       console.log(`✅ Filter: Matched context term "${term}"`);
//       return true;
//     }
//   }

//   console.log(`❌ Filter: No match for "${baseName}"`);
//   return false;
// };

// // Chat history & AI response
// const getThreadChatHistory = async (threadId: string, currentBody: string): Promise<string> => {
//   const items = await ThreadItem.find({
//     where: { thread: { id: parseInt(threadId) } },
//     order: { createdOn: "DESC" },
//     take: 3
//   });
//   if (items.length === 0) return currentBody;

//   let context = "Previous conversation history:\n\n";
//   for (const item of items.reverse()) {
//     context += `User: ${item.body}\n`;
//     if (item.aiResponse) {
//       try {
//         const parsed = JSON.parse(item.aiResponse);
//         const text = parsed.map((n: any) => n.children?.map((c: any) => c.text).join("") || "").join("");
//         context += `Assistant: ${text}\n\n`;
//       } catch {
//         context += `Assistant: ${item.aiResponse}\n\n`;
//       }
//     }
//   }
//   context += `User's new question: ${currentBody}\n\nPlease answer based on the conversation history.`;
//   return context;
// };

// async function generateAIResponse(question: string, threadId: string, categoryName: string): Promise<string> {
//   try {
//     const context = await getThreadChatHistory(threadId, question);
//     const lengthLimit = "Please keep your response under 500 words. / 請將回答控制在500字以內。";
//     const prompt = `You are an expert in 三國演義. Answer directly. Use English. If user requests for Chinese translation, use Traditional Chinese (繁體中文) to translate last answer. Do NOT use Simplified Chinese (简体中文). ${lengthLimit}\n\n${context}`;
//     return await callOllama(prompt);
//   } catch (error: any) {
//     console.error("AI error:", error);
//     if (error.message?.includes("timeout") || error.cause?.code === "UND_ERR_HEADERS_TIMEOUT") {
//       return `⏱ Processing time is long. Suggestions: break into smaller questions, simplify your question, or enter mm to view menus.`;
//     }
//     return "AI service temporarily unavailable. Please try again later.";
//   }
// }

// // ==========================================
// // MAIN FUNCTION
// // ==========================================

// export const createThreadItem = async (
//   userId: string | undefined | null,
//   threadId: string,
//   body: string
// ): Promise<QueryOneResult<ThreadItem>> => {
//   let plainBody = body;
//   try {
//     const parsed = JSON.parse(body);
//     if (Array.isArray(parsed) && parsed[0]?.type === "paragraph" && parsed[0]?.children?.[0]?.text) {
//       plainBody = parsed[0].children[0].text;
//     }
//   } catch (e) {}

//   const trimmedMenu = plainBody.trim().toLowerCase();
//   if (trimmedMenu === "mm" || trimmedMenu.match(/^m[1-6]$/)) {
//     const user = await User.findOne({ where: { id: parseInt(userId) } });
//     if (!user) return { messages: ["User not found."] };
//     const thread = await Thread.findOne({ where: { id: parseInt(threadId) }, relations: ["category"] });
//     if (!thread) return { messages: ["Thread not found."] };
//     const category = thread.category;
//     const categoryName = category?.name || "三國演義";
//     const baseName = getBaseCategoryName(categoryName);

//     let menuMessage = "";
//     if (trimmedMenu === "mm") {
//       menuMessage = getMenuByNumber("master", categoryName);
//       setLastMenu(threadId, "master");
//     } else {
//       const num = trimmedMenu.charAt(1);
//       menuMessage = getMenuByNumber(num, categoryName);
//       setLastMenu(threadId, num);
//     }
//     const slateNode = { type: "paragraph", children: [{ text: menuMessage }] };
//     const threadItem = await ThreadItem.create({ 
//       body, user, thread, 
//       aiResponse: JSON.stringify([slateNode]), 
//       tts_text: cleanTtsText(menuMessage) // Added for Phase 2B TTS
//     }).save();
//     return { messages: [`${threadItem.id}`] };
//   }

//   const bodyMsg = isThreadBodyValid(body);
//   if (bodyMsg) return { messages: [bodyMsg] };
//   if (!userId) return { messages: ["User not logged in."] };

//   const user = await User.findOne({ where: { id: parseInt(userId) } });
//   if (!user) return { messages: ["User not found."] };

//   const thread = await Thread.findOne({
//     where: { id: parseInt(threadId) },
//     relations: ["category"]
//   });
//   if (!thread) return { messages: ["Thread not found."] };

//   const category = thread.category;
//   const categoryName = category?.name || "三國演義";
//   const baseName = getBaseCategoryName(categoryName);

//   const menuRequest = isMenuRequest(body);
//   if (menuRequest.isRequest) {
//     const menuMessage = getMenuByNumber(menuRequest.menuNumber!, categoryName);
//     const slateNode = { type: "paragraph", children: [{ text: menuMessage }] };
//     const threadItem = await ThreadItem.create({ 
//       body, user, thread, 
//       aiResponse: JSON.stringify([slateNode]), 
//       tts_text: cleanTtsText(menuMessage) // Added for Phase 2B TTS
//     }).save();
//     return { messages: [`${threadItem.id}`] };
//   }

//   const menuChoice = isMenuChoice(body);
//   if (menuChoice.isChoice) {
//     const lastMenu = getLastMenu(threadId);
//     let actualQuestion = "";

//     if (lastMenu === "1") {
//       const qMap: Record<string, string> = {
//         "1": `What is the historical background and context of this period?`,
//         "2": `Who were the key figures and their contributions?`,
//         "3": `What were the decisive events or turning points?`,
//         "4": `What is the historical significance and impact?`,
//         "5": `How did this influence future generations?`
//       };
//       actualQuestion = qMap[menuChoice.number];
//     } else if (lastMenu === "2") {
//       const qMap: Record<string, string> = {
//         "1": `Summarize this history in one sentence!`,
//         "2": `Who is most notable during this period?`,
//         "3": `What are the interesting or thought-provoking stories?`,
//         "4": `What does this history teach us?`,
//         "5": `If only looking at the highlights, what is the core?`
//       };
//       actualQuestion = qMap[menuChoice.number];
//     } else if (lastMenu === "3") {
//       const qMap: Record<string, string> = {
//         "1": `Complete historical context and development process`,
//         "2": `Analysis of character motivations and historical roles`,
//         "3": `Interpretation of key events, battles, and decisions`,
//         "4": `Position of this history within Western civilization`,
//         "5": `Comparison of historical records vs scholarly interpretations`
//       };
//       actualQuestion = qMap[menuChoice.number];
//     } else if (lastMenu === "4") {
//       const qMap: Record<string, string> = {
//         "1": `Major scholarly perspectives and controversies`,
//         "2": `Different historiographical interpretations`,
//         "3": `Historical sources, archaeological findings, and evidence`,
//         "4": `Comparative study with other civilizations of the same period`,
//         "5": `Profound impact on modern Western society`
//       };
//       actualQuestion = qMap[menuChoice.number];
//     } else if (lastMenu === "5") {
//       const qMap: Record<string, string> = {
//         "1": `Key exam points summary`,
//         "2": `Frequently tested figures and events`,
//         "3": `Classic terms and key concepts`,
//         "4": `Position of this history in Western civilization`,
//         "5": `Common question types and answer strategies`,
//         "6": `Generate 10 multiple choice questions about ${baseName}`,
//         "7": `Generate 5 short answer questions about ${baseName}`
//       };
//       actualQuestion = qMap[menuChoice.number];
//     } else if (lastMenu === "6") {
//       const qMap: Record<string, string> = {
//         "1": `Connections and evolution with previous/subsequent periods`,
//         "2": `Comparison of different figures in the same historical context`,
//         "3": `Comparison with contemporary Eastern civilizations`,
//         "4": `Differences in narrative between different historical works`,
//         "5": `Multi-dimensional analysis (political, economic, social, cultural)`
//       };
//       actualQuestion = qMap[menuChoice.number];
//     } else {
//       actualQuestion = `Please provide information about ${baseName}`;
//     }

//     const isRelevant = await isQuestionRelatedToCategory(actualQuestion, categoryName, threadId);

//     if (!isRelevant) {
//       const rejectMsg = getHelpfulRejectionMessage();
//       const slateNode = { type: "paragraph", children: [{ text: rejectMsg }] };
//       const threadItem = await ThreadItem.create({ 
//         body: actualQuestion, user, thread, 
//         aiResponse: JSON.stringify([slateNode]), 
//         tts_text: cleanTtsText(rejectMsg) // Added for Phase 2B TTS
//       }).save();
//       return { messages: [`${threadItem.id}`] };
//     }

//     const aiResponseText = await generateAIResponse(actualQuestion, threadId, categoryName);
//     const slateNode = { type: "paragraph", children: [{ text: aiResponseText }] };
//     const threadItem = await ThreadItem.create({ 
//       body: actualQuestion, user, thread, 
//       aiResponse: JSON.stringify([slateNode]), 
//       tts_text: cleanTtsText(aiResponseText) // Added for Phase 2B TTS
//     }).save();
//     return { messages: [`${threadItem.id}`] };
//   }

//   const existingItemsCount = await ThreadItem.count({ where: { thread: { id: parseInt(threadId) } } });
//   const isFirstQuestion = existingItemsCount === 0;

//   if (isFirstQuestion && isVagueQuestion(plainBody)) {
//     const introMessage = getDefaultIntroForCategory(categoryName);
//     const slateNode = { type: "paragraph", children: [{ text: introMessage }] };
//     const threadItem = await ThreadItem.create({ 
//       body, user, thread, 
//       aiResponse: JSON.stringify([slateNode]), 
//       tts_text: cleanTtsText(introMessage) // Added for Phase 2B TTS
//     }).save();
//     return { messages: [`${threadItem.id}`] };
//   }

//   const isRelevant = await isQuestionRelatedToCategory(plainBody, categoryName, threadId);

//   if (!isRelevant) {
//     const rejectMessage = getHelpfulRejectionMessage();
//     const slateNode = { type: "paragraph", children: [{ text: rejectMessage }] };
//     const threadItem = await ThreadItem.create({ 
//       body, user, thread, 
//       aiResponse: JSON.stringify([slateNode]), 
//       tts_text: cleanTtsText(rejectMessage) // Added for Phase 2B TTS
//     }).save();
//     return { messages: [`${threadItem.id}`] };
//   }

//   const aiResponseText = await generateAIResponse(plainBody, threadId, categoryName);
//   const slateNode = { type: "paragraph", children: [{ text: aiResponseText }] };
//   const threadItem = await ThreadItem.create({ 
//     body, user, thread, 
//     aiResponse: JSON.stringify([slateNode]), 
//     tts_text: cleanTtsText(aiResponseText) // Added for Phase 2B TTS
//   }).save();
//   return { messages: [`${threadItem.id}`] };
// };

// export const getThreadItemsByThreadId = async (
//   threadId: string
// ): Promise<QueryArrayResult<ThreadItem>> => {
//   const threadItems = await ThreadItem.createQueryBuilder("ti")
//     .where(`ti."threadId" = :threadId`, { threadId })
//     .leftJoinAndSelect("ti.thread", "thread")
//     .orderBy("ti.createdOn", "ASC")
//     .getMany();
//   if (!threadItems || threadItems.length === 0) {
//     return { messages: ["No responses found for this thread."] };
//   }
//   return { entities: threadItems };
// };