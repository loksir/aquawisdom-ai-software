
// C1专用 AI Resolver - Family AI Companion - v1.7 (Phase 2B TTS Update)
// FAMILY SAFE VERSION
// Features: 500-word limit, mm reminders on all menus, family-safe language, tts_text population

import { isThreadBodyValid } from "../common/validators/ThreadValidator";
import { QueryArrayResult, QueryOneResult } from "./QueryArrayResult";
import { ThreadItem } from "./ThreadItem";
import { User } from "./User";
import { Thread } from "./Thread";

// FIX: Helper to clean markdown for Text-to-Speech
const cleanTtsText = (text: string): string => {
  return text.replace(/[*#_`>]/g, '').replace(/\n+/g, '. ').trim();
};

// ============================================
// OLLAMA CLIENT
// ============================================
async function callOllama(prompt: string): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_HOST || "http://aquawisdom-c1-ollama:11434";
  const model = process.env.OLLAMA_MODEL || "Aqua_C1_v1";
  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false })
  });
  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }
  const data = await response.json();
  return data.response || "抱歉,AI 沒有返回有效回應。請再試一次。";
}

// ============================================
// CATEGORY TYPE MAPPING
// ============================================
type CategoryType = 'casual' | 'learning' | 'practical' | 'serious';

const CATEGORY_TYPES: Record<string, CategoryType> = {
  "隨便問": "casual",
  "今日煮什麼?": "casual",
  "想看什麼劇?": "casual",
  "想去哪裡玩?": "casual",
  "想聽什麼歌?": "casual",
  "想看什麼書?": "learning",
  "健康指南": "learning",
  "天文地理": "learning",
  "世界博覽": "learning",
  "想種一些花?": "practical",
  "寵物怎麼養?": "practical",
  "小小工室": "practical",
  "理財怎麼做?": "serious"
};

const getCategoryType = (categoryName: string): CategoryType => {
  if (CATEGORY_TYPES[categoryName]) {
    return CATEGORY_TYPES[categoryName];
  }
  for (const [key, type] of Object.entries(CATEGORY_TYPES)) {
    if (categoryName.includes(key) || key.includes(categoryName)) {
      return type;
    }
  }
  return 'casual';
};

// ============================================
// CATEGORY KEYWORDS
// ============================================
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "隨便問": ["隨便", "任何", "問題", "聊聊", "聊天"],
  "今日煮什麼?": ["煮", "食譜", "菜", "料理", "廚房", "美食", "吃"],
  "想看什麼書?": ["書", "閱讀", "小說", "作者", "推薦書籍", "目錄", "第.章"],
  "想看什麼劇?": ["劇", "電影", "影集", "動漫", "推薦", "追劇"],
  "想去哪裡玩?": ["旅遊", "景點", "旅行", "住宿", "行程"],
  "想聽什麼歌?": ["歌", "音樂", "歌手", "樂團", "歌曲", "歌單"],
  "健康指南": ["健康", "運動", "健身", "養生", "飲食", "醫療"],
  "天文地理": ["天文", "地理", "宇宙", "星球", "地球", "科學"],
  "世界博覽": ["世界", "文化", "新聞", "時事", "歷史", "各國"],
  "想種一些花?": ["種花", "植物", "盆栽", "園藝", "多肉"],
  "寵物怎麼養?": ["寵物", "狗", "貓", "飼養", "照顧", "訓練"],
  "理財怎麼做?": ["理財", "投資", "儲蓄", "股票", "基金", "保險"],
  "小小工室": ["DIY", "手作", "修理", "工具", "木工", "創作"]
};

const GENERAL_PATTERNS: string[] = [
  "介紹", "說明", "解釋", "什麼是", "如何", "怎麼", "哪個", "推薦",
  "聊聊", "說說", "繼續", "還有", "然後呢", "為什麼"
];

// ============================================
// CHINESE NORMALIZATION
// ============================================
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

const isVagueQuestion = (question: string): boolean => {
  const trimmed = question.trim();
  if (trimmed.length === 0) return true;
  const casualPatterns = /^(hi|hello|hey|嗨|哈|你好|您好|嗨嗨)$/i;
  if (casualPatterns.test(trimmed)) return true;
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

// ============================================
// MENU SYSTEM STATE
// ============================================
const lastMenuMap = new Map<string, string>();
const setLastMenu = (threadId: string, menuNumber: string): void => {
  lastMenuMap.set(threadId, menuNumber);
};
const getLastMenu = (threadId: string): string => {
  return lastMenuMap.get(threadId) || "1";
};

const isMenuChoice = (body: string): { isChoice: boolean; number: string | null } => {
  const match = body.trim().match(/^#([1-5])$/);
  if (match) return { isChoice: true, number: match[1] };
  return { isChoice: false, number: null };
};

const isMenuRequest = (body: string): { isRequest: boolean; menuNumber: string | null } => {
  const trimmed = body.trim().toLowerCase();
  if (trimmed === "mm") return { isRequest: true, menuNumber: "master" };
  const match = trimmed.match(/^m([1-4])$/);
  if (match) return { isRequest: true, menuNumber: match[1] };
  return { isRequest: false, menuNumber: null };
};

// ============================================
// HYBRID MENU DEFINITIONS - FAMILY SAFE
// ============================================
const MENUS: Record<CategoryType, {
  m1: { name: string; items: Record<string, string> };
  m2: { name: string; items: Record<string, string> };
  m3: { name: string; items: Record<string, string> };
  m4: { name: string; items: Record<string, string> };
}> = {
  casual: {
    m1: { name: "輕鬆聊", items: { "1": "簡單說 - 一句話搞定", "2": "跟我聊 - 像朋友聊天", "3": "給我點子 - 靈感建議", "4": "小撇步 - 馬上能用", "5": "猜猜看 - 趣味互動" } },
    m2: { name: "詳細說", items: { "1": "說清楚 - 完整解釋", "2": "一步步教 - 詳細步驟", "3": "常見問題 - FAQ整理", "4": "實際案例 - 生活中的例子", "5": "還有什麼? - 相關補充" } },
    m3: { name: "幫我想", items: { "1": "給建議 - 直接告訴我", "2": "想選項 - 提供幾個選擇", "3": "優缺點 - 幫我分析", "4": "創意發想 - 跳脫框架", "5": "換個角度 - 不同觀點" } },
    m4: { name: "玩一下", items: { "1": "趣味問答 - 來個小測驗", "2": "故事接龍 - 一起編故事", "3": "腦筋急轉彎 - 動動腦", "4": "猜謎遊戲 - 我出題你猜", "5": "笑一個 - 輕鬆一下" } }
  },
  learning: {
    m1: { name: "認識它", items: { "1": "快速認識 - 30秒搞懂", "2": "簡單介紹 - 重點了解", "3": "重點整理 - 關鍵幾點", "4": "實用技巧 - 馬上能用", "5": "考考自己 - 來個小測驗" } },
    m2: { name: "多了解", items: { "1": "簡單解析 - 快速掌握", "2": "相關知識 - 連結學習", "3": "延伸閱讀 - 更多資訊", "4": "參考觀點 - 不同看法", "5": "進階問答 - 多了解一點" } },
    m3: { name: "探索它", items: { "1": "重點摘要 - 快速掌握", "2": "相關主題 - 延伸學習", "3": "延伸學習 - 更進一步", "4": "簡單探討 - 重點分析", "5": "問答時間 - 互動學習" } },
    m4: { name: "深入讀", items: { "1": "參考觀點 - 不同看法", "2": "參考資料 - 更多資訊", "3": "歷史脈絡 - 發展故事", "4": "未來方向 - 發展趨勢", "5": "常見問答 - 簡單了解" } }
  },
  practical: {
    m1: { name: "動手做", items: { "1": "基本概念 - 先了解", "2": "步驟教學 - 跟著做", "3": "實用技巧 - 馬上用", "4": "常見問題 - 避免踩雷", "5": "小測驗 - 驗收成果" } },
    m2: { name: "詳細教", items: { "1": "完整步驟 - 一步一步", "2": "注意細節 - 重點提醒", "3": "常見錯誤 - 避開陷阱", "4": "實際案例 - 參考學習", "5": "進階技巧 - 更上一層" } },
    m3: { name: "解決它", items: { "1": "問題診斷 - 找出問題", "2": "解決方案 - 怎麼做", "3": "替代選項 - 其他選擇", "4": "預防措施 - 避免再犯", "5": "小測驗 - 確認理解" } },
    m4: { name: "進階教", items: { "1": "進階技巧 - 更上一層", "2": "簡單知識 - 重點理解", "3": "常見迷思 - 釐清觀念", "4": "最佳案例 - 參考學習", "5": "簡單驗收 - 確認學會" } }
  },
  serious: {
    m1: { name: "入門指南", items: { "1": "基礎知識 - 從零開始", "2": "簡單了解 - 重點說明", "3": "實用建議 - 參考看看", "4": "注意事項 - 多想想", "5": "常見問答 - 簡單了解" } },
    m2: { name: "多了解", items: { "1": "簡單解析 - 重點視角", "2": "簡單數據 - 重點數字", "3": "參考觀點 - 不同看法", "4": "案例參考 - 實際了解", "5": "常見問答 - 簡單了解" } },
    m3: { name: "想一想", items: { "1": "優缺點 - 想想看", "2": "注意事項 - 多想想", "3": "參考案例 - 學習一下", "4": "參考建議 - 多方了解", "5": "簡單問答 - 重點探討" } },
    m4: { name: "深入想", items: { "1": "簡單分析 - 重點解析", "2": "簡單數據 - 重點參考", "3": "基本原則 - 參考了解", "4": "參考觀點 - 不同看法", "5": "常見問題 - 簡單了解" } }
  }
};

// ============================================
// HYBRID QMAP (Question Mapping)
// ============================================
const getHybridQMap = (categoryType: CategoryType, threadTitle: string): Record<string, Record<string, string>> => {
  const qMaps: Record<CategoryType, Record<string, Record<string, string>>> = {
    casual: {
      "1": { "1": `請用簡單一句話建議關於「${threadTitle}」`, "2": `請用朋友聊天的方式介紹「${threadTitle}」`, "3": `請給一些關於「${threadTitle}」的創意點子`, "4": `請提供關於「${threadTitle}」的實用小技巧`, "5": `請出3個有趣的問題考考我關於「${threadTitle}」` },
      "2": { "1": `請詳細解釋「${threadTitle}」的完整內容`, "2": `請一步一步教我關於「${threadTitle}」的步驟`, "3": `請整理「${threadTitle}」的常見問題和解答`, "4": `請分享「${threadTitle}」的實際生活案例`, "5": `請提供更多關於「${threadTitle}」的補充資訊` },
      "3": { "1": `請給一些關於「${threadTitle}」的具體建議`, "2": `請提供關於「${threadTitle}」的幾個選擇方案`, "3": `請分析「${threadTitle}」的優點和缺點`, "4": `請提供關於「${threadTitle}」的創意想法`, "5": `請從不同角度分析「${threadTitle}」` },
      "4": { "1": `請出5個關於「${threadTitle}」的趣味問答`, "2": `請和我一起編一個關於「${threadTitle}」的故事`, "3": `請出3個關於「${threadTitle}」的腦筋急轉彎`, "4": `請出5個關於「${threadTitle}」的猜謎題`, "5": `請分享一個關於「${threadTitle}」的輕鬆笑話` }
    },
    learning: {
      "1": { "1": `請用簡單的方式介紹「${threadTitle}」的基本概念`, "2": `請簡單介紹「${threadTitle}」的重點內容`, "3": `請整理「${threadTitle}」的關鍵重點`, "4": `請提供關於「${threadTitle}」的實用技巧`, "5": `請出5個關於「${threadTitle}」的問題考考我` },
      "2": { "1": `請簡單解析「${threadTitle}」的重點`, "2": `請推薦關於「${threadTitle}」的延伸閱讀`, "3": `請介紹與「${threadTitle}」相關的知識`, "4": `請提供關於「${threadTitle}」的不同看法`, "5": `請出5個關於「${threadTitle}」的進階問題` },
      "3": { "1": `請總結「${threadTitle}」的重點摘要`, "2": `請介紹與「${threadTitle}」相關的主題`, "3": `請提供「${threadTitle}」的延伸學習方向`, "4": `請簡單探討「${threadTitle}」的重點`, "5": `請出5個關於「${threadTitle}」的互動問答` },
      "4": { "1": `請提供一些關於「${threadTitle}」的觀點`, "2": `請提供關於「${threadTitle}」的參考資料`, "3": `請介紹「${threadTitle}」的歷史和發展`, "4": `請分析「${threadTitle}」的未來趨勢`, "5": `請出5個關於「${threadTitle}」的常見問答` }
    },
    practical: {
      "1": { "1": `請介紹「${threadTitle}」的基本概念`, "2": `請提供「${threadTitle}」的步驟教學`, "3": `請分享「${threadTitle}」的實用技巧`, "4": `請整理「${threadTitle}」的常見問題`, "5": `請出5個關於「${threadTitle}」的小測驗` },
      "2": { "1": `請提供「${threadTitle}」的完整步驟指導`, "2": `請提醒「${threadTitle}」需要注意的細節`, "3": `請整理「${threadTitle}」的常見錯誤`, "4": `請分享「${threadTitle}」的實際案例`, "5": `請提供「${threadTitle}」的進階技巧` },
      "3": { "1": `請幫我診斷「${threadTitle}」可能遇到的問題`, "2": `請提供「${threadTitle}」的解決方案`, "3": `請提供「${threadTitle}」的替代方案`, "4": `請分享「${threadTitle}」的預防措施`, "5": `請出5個關於「${threadTitle}」的驗收測驗` },
      "4": { "1": `請分享「${threadTitle}」的進階技巧`, "2": `請提供「${threadTitle}」的簡單知識`, "3": `請釐清「${threadTitle}」的常見迷思`, "4": `請分享「${threadTitle}」的最佳案例`, "5": `請出5個關於「${threadTitle}」的簡單驗收問題` }
    },
    serious: {
      "1": { "1": `請提供「${threadTitle}」的基礎知識`, "2": `請簡單說明「${threadTitle}」的重點`, "3": `請提供「${threadTitle}」的實用建議`, "4": `請提醒「${threadTitle}」需要注意的事項`, "5": `請出5個關於「${threadTitle}」的常見問答` },
      "2": { "1": `請簡單解析「${threadTitle}」的重點`, "2": `請提供「${threadTitle}」的簡單數據`, "3": `請提供關於「${threadTitle}」的不同看法`, "4": `請分享「${threadTitle}」的實際案例`, "5": `請出5個關於「${threadTitle}」的常見問答` },
      "3": { "1": `請分析「${threadTitle}」的優點和缺點`, "2": `請提醒「${threadTitle}」需要注意的事項`, "3": `請分享「${threadTitle}」的參考案例`, "4": `請提供關於「${threadTitle}」的參考建議`, "5": `請出5個關於「${threadTitle}」的簡單問答` },
      "4": { "1": `請簡單分析「${threadTitle}」的重點`, "2": `請提供「${threadTitle}」的簡單數據參考`, "3": `請提供「${threadTitle}」的基本原則參考`, "4": `請分享關於「${threadTitle}」的不同看法`, "5": `請出5個關於「${threadTitle}」的常見問題` }
    }
  };
  return qMaps[categoryType] || qMaps['casual'];
};

// ============================================
// MENU DISPLAY FUNCTIONS
// ============================================
const getHybridMenuByNumber = (menuNumber: string, threadTitle: string, categoryType: CategoryType): string => {
  const menuConfig = MENUS[categoryType];
  if (!menuConfig) return getFallbackMenu(menuNumber, threadTitle);
  
  let menu; let menuName; let items;
  switch (menuNumber) {
    case "1": menu = menuConfig.m1; menuName = menu.name; items = menu.items; break;
    case "2": menu = menuConfig.m2; menuName = menu.name; items = menu.items; break;
    case "3": menu = menuConfig.m3; menuName = menu.name; items = menu.items; break;
    case "4": menu = menuConfig.m4; menuName = menu.name; items = menu.items; break;
    case "master": return getMasterMenu(categoryType);
    case "9": return getSystemStatus(threadTitle);
    default: return getFallbackMenu(menuNumber, threadTitle);
  }
  const itemLines = Object.entries(items).map(([key, value]) => `#${key} ${value}`).join('\n');
  return `📖 【${menuName}】「${threadTitle}」\n\n${itemLines}\n\n💡 輸入 mm 查看所有選單\n\n#${Object.keys(items).length} 個選項,選一個開始!`;
};

const getMasterMenu = (categoryType: CategoryType): string => {
  const menuConfig = MENUS[categoryType];
  return `📋 【幫助選單】\n\n💬 聊天模式\n m1 ${menuConfig.m1.name}\n m2 ${menuConfig.m2.name}\n\n🧠 思考模式\n m3 ${menuConfig.m3.name}\n m4 ${menuConfig.m4.name}\n\ni 其他\n mm 本選單\n m9 系統狀態\n\n💡 輸入 m1 開始聊天,或直接問問題!`;
};

const getSystemStatus = (threadTitle: string): string => {
  return `🔆 【系統狀態】\n\n 正在聊:${threadTitle}\n🤖 AI:Aqua_C1_v1\n📊 狀態:✅ 運作中\n📝 回覆長度:最多 500 字\n💡 提示:僅供參考,非專業建議\n\n💡 輸入 mm 查看所有選單\n📋 輸入 m1 開始聊天!`;
};

const getFallbackMenu = (menuNumber: string, threadTitle: string): string => {
  const menus: Record<string, string> = {
    "1": `📖 【基本回應】「${threadTitle}」\n\n#1 簡單建議\n#2 基本介紹\n#3 要點整理\n#4 實用技巧\n#5 想考考自己\n\n💡 直接輸入您的問題也可以~\n💡 輸入 mm 查看所有選單`,
    "2": `📖 【詳細說明】「${threadTitle}」\n\n#1 步驟建議\n#2 完整介紹\n#3 常見問題\n#4 案例分享\n#5 想考考自己\n\n💡 輸入 mm 查看所有選單`,
    "3": `📚 【深入探討】「${threadTitle}」\n\n#1 優缺點分析\n#2 進階知識\n#3 相關主題\n#4 趨勢展望\n#5 想考考自己\n\n💡 輸入 mm 查看所有選單`,
    "4": `📚 【參考分析】「${threadTitle}」\n\n#1 參考觀點\n#2 數據參考\n#3 相關資訊\n#4 實用建議\n#5 想考考自己\n\n💡 輸入 mm 查看所有選單`,
    "master": `【幫助選單】\n\nm1 基本回應\nm2 詳細說明\nm3 深入探討\nm4 參考分析\nmm 本說明\n\n💡 輸入 m1 開始!`,
    "9": `【系統狀態】\n\n當前主題:${threadTitle}\nAI模型:Aqua_C1_v1\n服務狀態:運行中\n\n💡 輸入 mm 查看所有選單\n📋 輸入 m1 開始探索`
  };
  return menus[menuNumber] || menus["1"];
};

// ============================================
// CONTEXT-AWARE SYSTEM HANDLING MESSAGES
// ============================================
const getDefaultIntroForCategory = (categoryName: string, categoryType: CategoryType): string => {
  if (categoryName === "想看什麼書?" || categoryName.includes("想看什麼書")) {
    return "📚 歡迎來到「想看什麼書?」\n\n直接告訴我您想了解的書名,例如:\n· 「小王子」\n· 「原子習慣」\n· 「哈利波特」\n\n我會為您介紹這本書,主動詢問是否需要目錄~\n\n也可以輸入 #1 提供建議、#2 基本資料、#3 詳細一點、#4 深入研究\n💡 輸入 mm 查看所有選單";
  }
  const messages: Record<CategoryType, string> = {
    casual: `☕ 歡迎來到「${categoryName}」\n\n#1 簡單說 - 一句話搞定\n#2 跟我聊 - 像朋友聊天\n#3 給我點子 - 靈感建議\n#4 小撇步 - 馬上能用\n#5 猜猜看 - 趣味互動\n\n💬 直接輸入您的問題也可以~\n💡 輸入 mm 查看所有選單`,
    learning: `📖 歡迎來到「${categoryName}」\n\n#1 快速認識 - 30秒搞懂\n#2 簡單介紹 - 重點了解\n#3 重點整理 - 關鍵幾點\n#4 實用技巧 - 馬上能用\n#5 考考自己 - 來個小測驗\n\n💬 直接輸入您的問題也可以~\n💡 輸入 mm 查看所有選單`,
    practical: ` 歡迎來到「${categoryName}」\n\n#1 基本概念 - 先了解\n#2 步驟教學 - 跟著做\n#3 實用技巧 - 馬上用\n#4 常見問題 - 避免踩雷\n#5 小測驗 - 驗收成果\n\n💬 直接輸入您的問題也可以~\n💡 輸入 mm 查看所有選單`,
    serious: `📊 歡迎來到「${categoryName}」\n\n#1 基礎知識 - 從零開始\n#2 簡單了解 - 重點說明\n#3 實用建議 - 參考看看\n#4 注意事項 - 多想想\n#5 常見問答 - 簡單了解\n\n💬 直接輸入您的問題也可以~\n💡 輸入 mm 查看所有選單`
  };
  return messages[categoryType] || messages['casual'];
};


const getGentleRejectionMessage = (categoryName: string, categoryType: CategoryType): string => {
  const messages: Record<CategoryType, string> = {
    casual: `😅 這個問題跟「${categoryName}」比較沒有關係呢~\n建議切換到「隨便問」分類,或試試其他更適合的分類。\n或者我還是可以試試看回答你~\n💡 輸入 mm 查看所有選單`,
    learning: `📖 這個問題跟「${categoryName}」的主題比較不同呢~\n建議切換到「隨便問」分類,或選擇其他更適合的分類。\n或者我還是可以試試看回答你~\n💡 輸入 mm 查看所有選單`,
    practical: ` 這個問題跟「${categoryName}」的主題比較不同呢~\n建議切換到「隨便問」分類,或選擇其他更適合的分類。\n或者我還是可以試試看回答你~\n💡 輸入 mm 查看所有選單`,
    serious: `📊 這個問題跟「${categoryName}」的主題比較不同呢~\n建議切換到「隨便問」分類,或選擇其他更適合的分類。\n或者我還是可以試試看回答你~\n💡 輸入 mm 查看所有選單`
  };
  return messages[categoryType] || messages['casual'];
};

const getTimeoutMessage = (): string => {
  return `⏱ 處理時間有點長~\n可能是問題比較複雜,建議:\n· 拆成幾個小問題\n· 換個方式問問看\n· 或輸入 mm 查看選單\n再試一次看看?`;
};

// ============================================
// CONVERSATION HISTORY
// ============================================
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
  const normalizedBaseName = normalizeChinese(baseName);
  
  if (normalizedBaseName && normalizedQuestion.includes(normalizedBaseName.toLowerCase())) {
    console.log(`✅ Filter: Matched category name "${normalizedBaseName}"`);
    return true;
  }
  
  const keywords = CATEGORY_KEYWORDS[categoryName] || CATEGORY_KEYWORDS["隨便問"];
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

// ============================================
// CHAT HISTORY & AI RESPONSE GENERATION
// ============================================
const getThreadChatHistory = async (threadId: string, currentBody: string): Promise<string> => {
  const items = await ThreadItem.find({
    where: { thread: { id: parseInt(threadId) } },
    order: { createdOn: "DESC" },
    take: 3
  });
  if (items.length === 0) return currentBody;
  
  let context = "以下是之前的對話記錄:\n\n";
  for (const item of items.reverse()) {
    context += `用戶:${item.body}\n`;
    if (item.aiResponse) {
      try {
        const parsed = JSON.parse(item.aiResponse);
        const text = parsed.map((n: any) => n.children?.map((c: any) => c.text).join("") || "").join("");
        context += `助手:${text}\n\n`;
      } catch {
        context += `助手:${item.aiResponse}\n\n`;
      }
    }
  }
  context += `現在用戶的問題:${currentBody}\n\n請基於以上對話歷史回答。`;
  return context;
};

async function generateAIResponse(question: string, threadId: string, categoryName: string, threadTitle: string): Promise<string> {
  try {
    const context = await getThreadChatHistory(threadId, question);
    const categoryType = getCategoryType(categoryName);
    let categoryInstruction = "";
    const disclaimer = "請注意:以上內容僅供參考,不構成專業建議。";
    const lengthLimit = "請將回答控制在500字以內。";
    
    if (categoryType === 'casual') {
      categoryInstruction = `請用輕鬆、溫暖的口吻回答,像家人朋友聊天一樣自然。${lengthLimit}`;
    } else if (categoryType === 'learning') {
      categoryInstruction = `請用清晰、簡單的方式回答,幫助用戶快速理解。${lengthLimit}${disclaimer}`;
    } else if (categoryType === 'practical') {
      categoryInstruction = `請提供具體、實用的建議,簡單明瞭。${lengthLimit}${disclaimer}`;
    } else if (categoryType === 'serious') {
      categoryInstruction = `請用簡單、清晰的方式回答,重點突出。${lengthLimit}${disclaimer}`;
    }
    
    let bookHandlingInstruction = "";
    if (categoryName === "想看什麼書?" || categoryName.includes("想看什麼書")) {
      bookHandlingInstruction = `\n回答後,請主動詢問:「需要我為您列出這本書的目錄嗎?」\n如果用戶同意,請提供該書的主要章節列表。`;
    }
    
    const prompt = `你是一個友善的家庭AI助手。\n📍 分類:${categoryName}\n📍 對話主題:${threadTitle}\n對話歷史:${context}\n用戶問題:${question}\n${categoryInstruction}\n${bookHandlingInstruction}\n請用繁體中文回答,語氣溫暖友善,像家人一樣自然。`;
    const response = await callOllama(prompt);
    
    if (!response || response.trim() === '') {
      return "好的,我已經收到您的問題。不過我需要多一點時間思考,請再問一次或換個方式問問看~";
    }
    return response;
  } catch (error: any) {
    console.error("AI error:", error);
    if (error.message?.includes("timeout") || error.cause?.code === "UND_ERR_HEADERS_TIMEOUT") {
      return getTimeoutMessage();
    }
    return "不好意思,現在有點忙~請稍後再問我喔! 🙏";
  }
}

// ============================================
// MAIN FUNCTION
// ============================================
export const createThreadItem = async (
  userId: string | undefined | null,
  threadId: string,
  body: string
): Promise<QueryOneResult<ThreadItem>> => {
  console.log("🔍 [C1] createThreadItem - START");
  let plainBody = body;
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed) && parsed[0]?.type === "paragraph" && parsed[0]?.children?.[0]?.text) {
      plainBody = parsed[0].children[0].text;
    }
  } catch (e) {}

  try {
    const thread = await Thread.findOne({ where: { id: parseInt(threadId) }, relations: ["category"] });
    if (!thread) return { messages: ["Thread not found."] };
    
    const threadTitle = thread.title || "聊天";
    const category = thread.category;
    const categoryName = category?.name || "隨便問";
    const categoryType = getCategoryType(categoryName);
    
    const trimmedMenu = plainBody.trim().toLowerCase();
    
    // === MENU REQUEST (mm or m1-m4) ===
    if (trimmedMenu === "mm" || trimmedMenu.match(/^m[1-4]$/)) {
      const user = await User.findOne({ where: { id: parseInt(userId) } });
      if (!user) return { messages: ["User not found."] };
      let menuMessage = "";
      if (trimmedMenu === "mm") {
        menuMessage = getHybridMenuByNumber("master", threadTitle, categoryType);
        setLastMenu(threadId, "master");
      } else {
        const num = trimmedMenu.charAt(1);
        menuMessage = getHybridMenuByNumber(num, threadTitle, categoryType);
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

    // === BODY VALIDATION ===
    const bodyMsg = isThreadBodyValid(body);
    if (bodyMsg) return { messages: [bodyMsg] };
    if (!userId) return { messages: ["User not logged in."] };
    
    const user = await User.findOne({ where: { id: parseInt(userId) } });
    if (!user) return { messages: ["User not found."] };

    // === MENU REQUEST (plain text) ===
    const menuRequest = isMenuRequest(plainBody);
    if (menuRequest.isRequest) {
      const menuMessage = getHybridMenuByNumber(menuRequest.menuNumber!, threadTitle, categoryType);
      const slateNode = { type: "paragraph", children: [{ text: menuMessage }] };
      const threadItem = await ThreadItem.create({
        body, user, thread,
        aiResponse: JSON.stringify([slateNode]),
        tts_text: cleanTtsText(menuMessage) // Added for Phase 2B TTS
      }).save();
      return { messages: [`${threadItem.id}`] };
    }

    // === MENU CHOICE (#1, #2, #3, #4, #5) ===
    const menuChoice = isMenuChoice(plainBody);
    if (menuChoice.isChoice) {
      const lastMenu = getLastMenu(threadId);
      const qMap = getHybridQMap(categoryType, threadTitle);
      const actualQuestion = qMap[lastMenu]?.[menuChoice.number] || `請提供關於「${threadTitle}」的資訊`;
      
      const isRelevant = await isQuestionRelatedToCategory(actualQuestion, categoryName, threadId);
      if (!isRelevant) {
        const rejectMsg = getGentleRejectionMessage(categoryName, categoryType);
        const slateNode = { type: "paragraph", children: [{ text: rejectMsg }] };
        const threadItem = await ThreadItem.create({
          body, user, thread,
          aiResponse: JSON.stringify([slateNode]),
          tts_text: cleanTtsText(rejectMsg) // Added for Phase 2B TTS
        }).save();
        return { messages: [`${threadItem.id}`] };
      }
      
      const aiResponseText = await generateAIResponse(actualQuestion, threadId, categoryName, threadTitle);
      const slateNode = { type: "paragraph", children: [{ text: aiResponseText }] };
      const threadItem = await ThreadItem.create({
        body, user, thread,
        aiResponse: JSON.stringify([slateNode]),
        tts_text: cleanTtsText(aiResponseText) // Added for Phase 2B TTS
      }).save();
      return { messages: [`${threadItem.id}`] };
    }

    // === REGULAR QUESTION (not menu choice) ===
    const existingItemsCount = await ThreadItem.count({ where: { thread: { id: parseInt(threadId) } } });
    const isFirstQuestion = existingItemsCount === 0;
    
    if (isFirstQuestion && isVagueQuestion(plainBody)) {
      const introMessage = getDefaultIntroForCategory(categoryName, categoryType);
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
      const rejectMessage = getGentleRejectionMessage(categoryName, categoryType);
      const slateNode = { type: "paragraph", children: [{ text: rejectMessage }] };
      const threadItem = await ThreadItem.create({
        body, user, thread,
        aiResponse: JSON.stringify([slateNode]),
        tts_text: cleanTtsText(rejectMessage) // Added for Phase 2B TTS
      }).save();
      return { messages: [`${threadItem.id}`] };
    }

    const aiResponseText = await generateAIResponse(plainBody, threadId, categoryName, threadTitle);
    const slateNode = { type: "paragraph", children: [{ text: aiResponseText }] };
    const threadItem = await ThreadItem.create({
      body, user, thread,
      aiResponse: JSON.stringify([slateNode]),
      tts_text: cleanTtsText(aiResponseText) // Added for Phase 2B TTS
    }).save();
    return { messages: [`${threadItem.id}`] };
    
  } catch (error: any) {
    console.error("❌ [C1] createThreadItem - ERROR:", error.message);
    return { messages: ["系統錯誤,請稍後再試。"] };
  }
};

// ============================================
// GET THREAD ITEMS
// ============================================
export const getThreadItemsByThreadId = async (threadId: string): Promise<QueryArrayResult<ThreadItem>> => {
  try {
    const threadItems = await ThreadItem.createQueryBuilder("ti")
      .where(`ti."threadId" = :threadId`, { threadId })
      .leftJoinAndSelect("ti.thread", "thread")
      .orderBy("ti.createdOn", "ASC")
      .getMany();
      
    if (!threadItems || threadItems.length === 0) {
      return { messages: ["No responses found for this thread."] };
    }
    return { entities: threadItems };
  } catch (error: any) {
    console.error("❌ [C1] getThreadItemsByThreadId - ERROR:", error.message);
    return { messages: ["Error retrieving thread items."] };
  }
};
