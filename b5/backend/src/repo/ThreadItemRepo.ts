
// B5专用 AI Resolver - 中國歷史 - v5.19 (Phase 2B TTS Update)
import { isThreadBodyValid } from "../common/validators/ThreadValidator";
import { QueryArrayResult, QueryOneResult } from "./QueryArrayResult";
import { ThreadItem } from "./ThreadItem";
import { User } from "./User";
import { Thread } from "./Thread";

const cleanTtsText = (text: string): string => {
  return text.replace(/[*#_`>]/g, '').replace(/\n+/g, '. ').trim();
};

async function callOllama(prompt: string): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_HOST || "http://aquawisdom-b5-ollama:11434";
  const model = process.env.OLLAMA_MODEL || "Aqua_B5_v1";
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

const categoryKeywords: Record<string, string[]> = {
  "詩經": ["詩經", "關雎", "蒹葭", "風", "雅", "頌"],
  "楚辭": ["楚辭", "屈原", "離騷", "九歌", "香草美人"],
  "唐詩": ["唐詩", "李白", "杜甫", "王維", "白居易", "李商隱"],
  "宋詞": ["宋詞", "蘇軾", "辛棄疾", "李清照", "柳永"],
  "元曲": ["元曲", "關漢卿", "馬致遠", "王實甫", "西廂記"],
  "紅樓夢": ["紅樓夢", "曹雪芹", "賈寶玉", "林黛玉"],
  "default": ["中國歷史", "文學", "詩", "詞", "小說", "作家", "作品"]
};

const TRAD_TO_SIMP: Record<string, string> = {
  "韓": "韩", "國": "国", "學": "学", "體": "体", "實": "实",
  "際": "际", "關": "关", "係": "系", "於": "于", "後": "后",
  "發": "发", "會": "会", "對": "对", "經": "经", "書": "书",
  "說": "说", "話": "话", "點": "点", "時": "时", "間": "间",
  "問": "问", "題": "题", "當": "当", "從": "从", "來": "来",
  "個": "个", "們": "们", "這": "这", "那": "那", "麼": "么",
  "為": "为", "萬": "万", "與": "与", "無": "无", "論": "论",
  "語": "语", "愛": "爱", "情": "情", "意": "意", "見": "见"
};

const normalizeChinese = (text: string): string => {
  let result = text;
  for (const [trad, simp] of Object.entries(TRAD_TO_SIMP)) {
    result = result.replace(new RegExp(trad, "g"), simp);
  }
  return result;
};

const GENERAL_PATTERNS = [
  "介绍一下", "介紹一下", "讲一下", "講一下", "说说", "說說",
  "继续", "繼續", "还有吗", "還有嗎", "然后呢", "然後呢",
  "是什么", "什麼是", "什么是", "有哪些", "有什么", "有什麼",
  "故事", "生平", "思想", "作品", "风格", "風格"
];

const isVagueQuestion = (question: string): boolean => {
  const trimmed = question.trim();
  if (trimmed.length === 0) return true;
  const withoutChinese = trimmed.replace(/[\u4e00-\u9fff]/g, "");
  const withoutPunctuation = withoutChinese.replace(/[??!!。,、;:""「」【】《》\s]/g, "");
  if (withoutPunctuation.length < 3) return true;
  const hasChinese = /[\u4e00-\u9fff]/.test(trimmed);
  if (!hasChinese) return true;
  return false;
};

const lastMenuMap = new Map<string, string>();
const setLastMenu = (threadId: string, menuNumber: string): void => {
  lastMenuMap.set(threadId, menuNumber);
};
const getLastMenu = (threadId: string): string => {
  return lastMenuMap.get(threadId) || "1";
};

const getBaseCategoryName = (categoryName: string): string => {
  return categoryName.split("(")[0].trim();
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

const getQuestionFromChoice = (choiceNumber: string, categoryName: string): string => {
  const baseName = getBaseCategoryName(categoryName);
  const questions: Record<string, string> = {
    "1": `${baseName}的核心內容是什麼?`,
    "2": `${baseName}的主要人物和作品有哪些?`,
    "3": `有關${baseName}有什麼著名的故事或典故?`,
    "4": `${baseName}的歷史地位和影響是什麼?`,
    "5": `${baseName}的歷史背景和時代意義是什麼?`
  };
  return questions[choiceNumber] || `${baseName}是什麼?`;
};

const getMenu1 = (baseName: string): string => getMenuByNumber("1", baseName);
const getMenu2 = (baseName: string): string => getMenuByNumber("2", baseName);
const getMenu3 = (baseName: string): string => getMenuByNumber("3", baseName);
const getMenu4 = (baseName: string): string => getMenuByNumber("4", baseName);
const getMenu5 = (baseName: string): string => getMenuByNumber("5", baseName);
const getMenu6 = (baseName: string): string => getMenuByNumber("6", baseName);
const getMasterMenu = (baseName: string): string => getMenuByNumber("master", baseName);

const getMenuByNumber = (menuNumber: string, categoryName: string): string => {
  const baseName = getBaseCategoryName(categoryName);
  const menus: Record<string, string> = {
    "1": `📖 【主選單】「${baseName}」\n#1 核心內容是什麼?\n#2 主要人物和作品有哪些?\n#3 有什麼著名的故事或典故?\n#4 歷史地位和影響是什麼?\n#5 歷史背景和時代意義是什麼?\n💡 輸入 m2 輕鬆閱讀 | mm 所有選單`,
    "2": `📖 【輕鬆閱讀】「${baseName}」\n#1 這個主題有什麼有趣的地方?\n#2 有哪些值得認識的人物?\n#3 有什麼精彩的故事?\n#4 它在歷史上有什麼地位?\n#5 為什麼值得了解?\n💡 輸入 m3 詳細學習 | mm 所有選單`,
    "3": `📚 【詳細學習】「${baseName}」\n#1 完整內容和核心思想詳解\n#2 重要人物介紹(生平、事蹟、貢獻)\n#3 經典故事詳細解說\n#4 歷史地位、影響和評價\n#5 時代背景和歷史意義\n💡 輸入 m4 學術研究 | mm 所有選單`,
    "4": `🎓 【學術研究】「${baseName}」\n#1 學術爭議和研究現狀\n#2 不同學派的解讀和批評\n#3 文獻考據和版本問題\n#4 思想體系的系統性分析\n#5 跨文化比較研究\n💡 輸入 m5 考試準備 | mm 所有選單`,
    "5": `📝 【考試準備】「${baseName}」\n#1 考試重點總結\n#2 常考人物和作品整理\n#3 經典典故和答題要點\n#4 重要歷史地位(必考)\n#5 時代意義和影響(常考)\n#6 給我出10題選擇題\n#7 給我出5題簡答題\n💡 輸入 m6 比較分析 | mm 所有選單`,
    "6": `⚖ 【比較分析】「${baseName}」\n#1 與前代/後繼者的比較\n#2 與同期人物的對比\n#3 與西方類似主題的比較\n#4 不同版本的比較\n#5 優缺點分析\n💡 輸入 mm 所有選單`,
    "master": `❓ 【所有選單】\nm1 主選單(快速導覽)\nm2 輕鬆閱讀(趣味)\nm3 詳細學習(深度)\nm4 學術研究(進階)\nm5 考試準備(重點)\nm6 比較分析(對照)\nmm 本說明\nm9 系統狀態\n💡 輸入 m1 開始`,
    "9": ` 【系統狀態】\n📊 分類:${baseName}\n🤖 模型:Aqua_B5_v1\n✅ 服務:運行中\n💾 記憶:最近3輪對話\n💡 輸入 m1 開始對話`
  };
  return menus[menuNumber] || menus["1"];
};

const getDefaultIntroForCategory = (categoryName: string): string => {
  const baseName = getBaseCategoryName(categoryName);
  return `📖 歡迎來到「${baseName}」分類!\n#1 核心內容是什麼?\n#2 主要人物和作品有哪些?\n#3 有什麼著名的故事或典故?\n#4 歷史地位和影響是什麼?\n#5 歷史背景和時代意義是什麼?\n💡 輸入 m2 輕鬆閱讀 | mm 所有選單\n試試看:輸入 #1 開始探索!`;
};

const getHelpfulRejectionMessage = (categoryName: string): string => {
  return `抱歉,這個分類專門討論「${categoryName}」。\n#1 核心內容是什麼?\n#2 主要人物和作品有哪些?\n#3 有什麼著名的故事或典故?\n#4 歷史地位和影響是什麼?\n#5 歷史背景和時代意義是什麼?\n💡 輸入 m2 輕鬆閱讀 | mm 所有選單`;
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

const isQuestionRelatedToCategory = async (
  question: string,
  categoryName: string,
  threadId: string
): Promise<boolean> => {
  const normalizedQuestion = normalizeChinese(question);
  const baseName = getBaseCategoryName(categoryName);
  const normalizedBaseName = getNormalizedBaseCategoryName(categoryName);
  
  if (normalizedBaseName && normalizedQuestion.includes(normalizedBaseName.toLowerCase())) {
    console.log(`✅ Filter: Matched "${normalizedBaseName}"`);
    return true;
  }
  
  const parts = baseName.split(/[\s\(\(]/);
  for (const part of parts) {
    const normalizedPart = normalizeChinese(part);
    if (normalizedPart.length >= 2 && normalizedQuestion.includes(normalizedPart.toLowerCase())) {
      console.log(`✅ Filter: Matched part "${normalizedPart}"`);
      return true;
    }
  }
  
  const keywords = categoryKeywords[categoryName] || categoryKeywords["default"];
  for (const keyword of keywords) {
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
    console.log(`✅ Filter: Auto-accept follow-up`);
    return true;
  }
  
  for (const term of terms) {
    if (term && normalizedQuestion.includes(normalizeChinese(term))) {
      console.log(`✅ Filter: Matched context "${term}"`);
      return true;
    }
  }
  
  console.log(`❌ Filter: No match`);
  return false;
};

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

async function generateAIResponse(question: string, threadId: string, categoryName: string): Promise<string> {
  try {
    const context = await getThreadChatHistory(threadId, question);
    const lengthLimit = "Please keep your response under 500 words. / 請將回答控制在500字以內。";
    const prompt = `你是一個專門回答「${categoryName}」相關問題的中國歷史老師。直接回答,不要拒絕。用繁體中文。 ${lengthLimit}\n\n${context}`;
    return await callOllama(prompt);
  } catch (error: any) {
    console.error("AI error:", error);
    if (error.message?.includes("timeout") || error.cause?.code === "UND_ERR_HEADERS_TIMEOUT") {
      return `⏱ 處理時間較長。建議:拆分成小問題、簡化問法、或輸入 mm 查看選單。`;
    }
    return "AI 服務暫時不可用,請稍後再試。";
  }
}

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
    const categoryName = category?.name || "中國歷史";
    
    let menuMessage = "";
    if (trimmedMenu === "mm") {
      menuMessage = getMasterMenu(getBaseCategoryName(categoryName));
      setLastMenu(threadId, "master");
    } else {
      const num = trimmedMenu.charAt(1);
      const baseName = getBaseCategoryName(categoryName);
      switch(num) {
        case "1": menuMessage = getMenu1(baseName); setLastMenu(threadId, "1"); break;
        case "2": menuMessage = getMenu2(baseName); setLastMenu(threadId, "2"); break;
        case "3": menuMessage = getMenu3(baseName); setLastMenu(threadId, "3"); break;
        case "4": menuMessage = getMenu4(baseName); setLastMenu(threadId, "4"); break;
        case "5": menuMessage = getMenu5(baseName); setLastMenu(threadId, "5"); break;
        case "6": menuMessage = getMenu6(baseName); setLastMenu(threadId, "6"); break;
        default: menuMessage = getMenu1(baseName); setLastMenu(threadId, "1");
      }
    }
    
    const slateNode = { type: "paragraph", children: [{ text: menuMessage }] };
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

  const user = await User.findOne({ where: { id: parseInt(userId) } });
  if (!user) return { messages: ["User not found."] };

  const thread = await Thread.findOne({
    where: { id: parseInt(threadId) },
    relations: ["category"]
  });
  if (!thread) return { messages: ["Thread not found."] };

  const category = thread.category;
  const categoryName = category?.name || "中國歷史";
  const baseName = getBaseCategoryName(categoryName);

  const menuRequest = isMenuRequest(body);
  if (menuRequest.isRequest) {
    const menuMessage = getMenuByNumber(menuRequest.menuNumber!, categoryName);
    const slateNode = { type: "paragraph", children: [{ text: menuMessage }] };
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
        "1": `${baseName}的核心內容是什麼?`,
        "2": `${baseName}的主要人物和作品有哪些?`,
        "3": `有關${baseName}有什麼著名的故事或典故?`,
        "4": `${baseName}的歷史地位和影響是什麼?`,
        "5": `${baseName}的歷史背景和時代意義是什麼?`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "2") {
      const qMap: Record<string, string> = {
        "1": `這個主題有什麼有趣的地方?`,
        "2": `有哪些值得認識的人物?`,
        "3": `有什麼精彩的故事?`,
        "4": `它在歷史上有什麼地位?`,
        "5": `為什麼值得了解?`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "3") {
      const qMap: Record<string, string> = {
        "1": `完整內容和核心思想詳解`,
        "2": `重要人物介紹(生平、事蹟、貢獻)`,
        "3": `經典故事詳細解說`,
        "4": `歷史地位、影響和評價`,
        "5": `時代背景和歷史意義`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "4") {
      const qMap: Record<string, string> = {
        "1": `學術爭議和研究現狀`,
        "2": `不同學派的解讀和批評`,
        "3": `文獻考據和版本問題`,
        "4": `思想體系的系統性分析`,
        "5": `跨文化比較研究`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "5") {
      const qMap: Record<string, string> = {
        "1": `考試重點總結`,
        "2": `常考人物和作品整理`,
        "3": `經典典故和答題要點`,
        "4": `重要歷史地位(必考)`,
        "5": `時代意義和影響(常考)`,
        "6": `請針對「${baseName}」出10題選擇題`,
        "7": `請針對「${baseName}」出5題簡答題`
      };
      actualQuestion = qMap[menuChoice.number];
    } else if (lastMenu === "6") {
      const qMap: Record<string, string> = {
        "1": `與前代/後繼者的比較`,
        "2": `與同期人物的對比`,
        "3": `與西方類似主題的比較`,
        "4": `不同版本的比較`,
        "5": `優缺點分析`
      };
      actualQuestion = qMap[menuChoice.number];
    } else {
      actualQuestion = getQuestionFromChoice(menuChoice.number!, categoryName);
    }

    const isRelevant = await isQuestionRelatedToCategory(actualQuestion, categoryName, threadId);
    if (!isRelevant) {
      const rejectMsg = getHelpfulRejectionMessage(categoryName);
      const slateNode = { type: "paragraph", children: [{ text: rejectMsg }] };
      const threadItem = await ThreadItem.create({
        body: actualQuestion, user, thread,
        aiResponse: JSON.stringify([slateNode]),
        tts_text: cleanTtsText(rejectMsg)
      }).save();
      return { messages: [`${threadItem.id}`] };
    }

    const aiResponseText = await generateAIResponse(actualQuestion, threadId, categoryName);
    const slateNode = { type: "paragraph", children: [{ text: aiResponseText }] };
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
    const threadItem = await ThreadItem.create({
      body, user, thread,
      aiResponse: JSON.stringify([slateNode]),
      tts_text: cleanTtsText(introMessage)
    }).save();
    return { messages: [`${threadItem.id}`] };
  }

  const isRelevant = await isQuestionRelatedToCategory(plainBody, categoryName, threadId);
  if (!isRelevant) {
    const rejectMessage = getHelpfulRejectionMessage(categoryName);
    const slateNode = { type: "paragraph", children: [{ text: rejectMessage }] };
    const threadItem = await ThreadItem.create({
      body, user, thread,
      aiResponse: JSON.stringify([slateNode]),
      tts_text: cleanTtsText(rejectMessage)
    }).save();
    return { messages: [`${threadItem.id}`] };
  }

  const aiResponseText = await generateAIResponse(plainBody, threadId, categoryName);
  const slateNode = { type: "paragraph", children: [{ text: aiResponseText }] };
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
