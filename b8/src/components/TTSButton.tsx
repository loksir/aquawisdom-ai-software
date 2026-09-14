import React, { useState, useEffect, useCallback, useRef } from 'react';
import { database } from '../db/Database';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

const B8_MINI_PC_URL = 'https://192.168.0.151:8448';
const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
const LANG_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: 'Mandarin (繁體)', value: 'zh-TW' },
  { label: 'Cantonese (粵語)', value: 'yue-HK' },
  { label: 'English', value: 'en-US' }
];


// Helper: Sanitize Slate JSON and Markdown into clean, chunked text
const sanitizeAndChunk = (rawText: string): string[] => {
  let text = rawText;
  
  // 1. Parse Slate JSON if present
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed[0]?.type === 'paragraph') {
      // Join nodes with a newline character so we can process it below
      text = parsed.map((node: any) => node.children?.map((c: any) => c.text).join("") || "").join("\n");
    }
  } catch (e) {}

  // 2. Fix common abbreviations
  text = text.replace(/\be\.g\./gi, 'for example');
  text = text.replace(/\bi\.e\./gi, 'that is');
  text = text.replace(/\betc\./gi, 'etcetera');
  
  // 3. Remove Emojis and special symbols
  text = text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '');
  
  // 4. FIX: Replace ALL types of dashes (hyphen, en-dash, em-dash) with a period 
  // to force a hard pause. We only replace them if they have spaces around them 
  // so we don't break hyphenated words like "well-known".
  text = text.replace(/\s+[-–—]+\s*/g, '. '); // Space, dash, space -> Period
  text = text.replace(/\s*[-–—]+\s+/g, '. '); // Dash, space -> Period
  text = text.replace(/\s*--\s*/g, '. ');      // Double hyphen -> Period
  
  // 5. Normalize literal "\n" strings into actual newline characters
  text = text.replace(/\\n/g, '\n');
  
  // 6. FIX: If a newline is NOT preceded by punctuation, replace it with a comma!
  text = text.replace(/([^.!?,;:。！？，；：])\s*\n+/g, '$1, ');
  
  // 7. Replace any remaining newlines with a space (Stops the "done" glitch)
  text = text.replace(/\s*\n\s*/g, ' ');
  
  // 8. WHITELIST: Keep letters, numbers, spaces, AND English/Chinese punctuation
  text = text.replace(/[^\p{L}\p{N}\s.,!?:;'"\-。！？，：；、]/gu, ' ');
  
  // 9. Collapse multiple spaces into one
  text = text.replace(/\s+/g, ' ').trim();
  
  // 10. Split into sentence chunks (Recognizes English & Chinese punctuation)
  const chunks = text.match(/[^.!?。！？]+[.!?。！？]+|\S[^.!?。！？]*$/g);
  return chunks ? chunks.map(c => c.trim()).filter(c => c.length > 0) : [text];
};

// Helper: Sanitize Slate JSON and Markdown into clean, chunked text
// const sanitizeAndChunk = (rawText: string): string[] => {
//   let text = rawText;
  
//   // 1. Parse Slate JSON if present
//   try {
//     const parsed = JSON.parse(text);
//     if (Array.isArray(parsed) && parsed[0]?.type === 'paragraph') {
//       // Join nodes with a newline character so we can process it below
//       text = parsed.map((node: any) => node.children?.map((c: any) => c.text).join("") || "").join("\n");
//     }
//   } catch (e) {}

//   // 2. Fix common abbreviations
//   text = text.replace(/\be\.g\./gi, 'for example');
//   text = text.replace(/\bi\.e\./gi, 'that is');
//   text = text.replace(/\betc\./gi, 'etcetera');
  
//   // 3. Remove Emojis and special symbols
//   text = text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '');
  
//   // 4. FIX: Replace dashes with commas for a natural pause
//   text = text.replace(/\s*--\s*/g, ', ');
//   text = text.replace(/\s+-\s+/g, ', ');
  
//   // 5. Normalize literal "\n" strings into actual newline characters
//   text = text.replace(/\\n/g, '\n');
  
//   // 6. FIX: If a newline is NOT preceded by punctuation, replace it with a comma!
//   // This forces the TTS engine to pause between headings and paragraphs.
//   text = text.replace(/([^.!?,;:。！？，；：])\s*\n+/g, '$1, ');
  
//   // 7. Replace any remaining newlines with a space (Stops the "done" glitch)
//   text = text.replace(/\s*\n\s*/g, ' ');
  
//   // 8. WHITELIST: Keep letters, numbers, spaces, AND English/Chinese punctuation
//   text = text.replace(/[^\p{L}\p{N}\s.,!?:;'"\-。！？，：；、]/gu, ' ');
  
//   // 9. Collapse multiple spaces into one
//   text = text.replace(/\s+/g, ' ').trim();
  
//   // 10. Split into sentence chunks (Recognizes English & Chinese punctuation)
//   const chunks = text.match(/[^.!?。！？]+[.!?。！？]+|\S[^.!?。！？]*$/g);
//   return chunks ? chunks.map(c => c.trim()).filter(c => c.length > 0) : [text];
// };

// Helper: Sanitize Slate JSON and Markdown into clean, chunked text
// const sanitizeAndChunk = (rawText: string): string[] => {
//   let text = rawText;
  
//   // 1. Parse Slate JSON if present
//   try {
//     const parsed = JSON.parse(text);
//     if (Array.isArray(parsed) && parsed[0]?.type === 'paragraph') {
//       text = parsed.map((node: any) => node.children?.map((c: any) => c.text).join("") || "").join(" ");
//     }
//   } catch (e) {}

//   // 2. Fix common abbreviations
//   text = text.replace(/\be\.g\./gi, 'for example');
//   text = text.replace(/\bi\.e\./gi, 'that is');
//   text = text.replace(/\betc\./gi, 'etcetera');
  
//   // 3. Remove Emojis and special symbols
//   text = text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '');
  
//   // 4. Remove literal "\n" strings
//   text = text.replace(/\\n/g, ' ');
  
//   // 5. Remove space + newline combinations (Stops the "done" glitch)
//   text = text.replace(/\s+\n/g, ' ');
//   text = text.replace(/\n\s+/g, ' ');
//   text = text.replace(/[\n\r\t]+/g, ' ');
  
//   // 6. WHITELIST: Keep letters, numbers, spaces, AND English/Chinese punctuation
//   // Added: 。 ！ ？ ， ： ； 、 (Chinese full-width punctuation)
//   text = text.replace(/[^\p{L}\p{N}\s.,!?:;'"\-。！？，：；、]/gu, ' ');
  
//   // 7. Collapse multiple spaces into one
//   text = text.replace(/\s+/g, ' ').trim();
  
//   // 8. Split into sentence chunks (Now recognizes Chinese periods ! ?)
//   const chunks = text.match(/[^.!?。！？]+[.!?。！？]+|\S[^.!?。！？]*$/g);
//   return chunks ? chunks.map(c => c.trim()).filter(c => c.length > 0) : [text];
// };

// // Helper: Sanitize Slate JSON and Markdown into clean, chunked text
// const sanitizeAndChunk = (rawText: string): string[] => {
//   let text = rawText;
  
//   // 1. Parse Slate JSON if present
//   try {
//     const parsed = JSON.parse(text);
//     if (Array.isArray(parsed) && parsed[0]?.type === 'paragraph') {
//       // Join paragraphs with a space
//       text = parsed.map((node: any) => node.children?.map((c: any) => c.text).join("") || "").join(" ");
//     }
//   } catch (e) {
//     // Not JSON, proceed as plain text
//   }

  // 2. Fix common abbreviations so TTS doesn't read them as initials
//   text = text.replace(/\be\.g\./gi, 'for example');
//   text = text.replace(/\bi\.e\./gi, 'that is');
//   text = text.replace(/\betc\./gi, 'etcetera');
  
//   // 3. Remove Emojis and special symbols
//   text = text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '');
  
//   // 4. FIX: Aggressively remove literal "\n" strings (backslash n)
//   text = text.replace(/\\n/g, ' ');
  
//   // 5. FIX: Aggressively remove space + newline character combinations
//   // This stops the TTS engine from saying "done"
//   text = text.replace(/\s+\n/g, ' '); // Space followed by newline
//   text = text.replace(/\n\s+/g, ' '); // Newline followed by space
//   text = text.replace(/[\n\r\t]+/g, ' '); // Any remaining newlines or tabs
  
//   // 6. WHITELIST: Keep ONLY letters (all languages), numbers, spaces, and basic punctuation.
//   // This completely removes all brackets [], {}, <>, and any other weird symbols.
//   text = text.replace(/[^\p{L}\p{N}\s.,!?:;'"\-]/gu, ' ');
  
//   // 7. Collapse multiple spaces into one
//   text = text.replace(/\s+/g, ' ').trim();
  
//   // 8. Split into sentence chunks
//   const chunks = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g);
//   return chunks ? chunks.map(c => c.trim()).filter(c => c.length > 0) : [text];
// };
// FIX: Upgraded sanitizer to remove emojis, brackets, and literal "done" artifacts
// const sanitizeAndChunk = (rawText: string): string[] => {
//   let text = rawText;
//   try {
//     const parsed = JSON.parse(text);
//     if (Array.isArray(parsed) && parsed[0]?.type === 'paragraph') {
//       text = parsed.map((node: any) => node.children?.map((c: any) => c.text).join("") || "").join("\n");
//     }
//   } catch (e) {}
  
//   // 1. Remove Emojis and special symbols (💡, ❓, etc.)
//   text = text.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '');
  
//   // 2. Remove brackets and markdown symbols
//   text = text.replace(/[*#_`>\[\]{}()]/g, '');
  
//   // 3. Fix escaped newlines (\\n) and literal newlines (\n) to be clean periods
//   text = text.replace(/\\n/g, '. ');
//   text = text.replace(/\n+/g, '. ');
  
//   // 4. Collapse multiple spaces into one
//   text = text.replace(/\s+/g, ' ').trim();
  
//   // 5. Split into sentence chunks
//   const chunks = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g);
//   return chunks ? chunks.map(c => c.trim()).filter(c => c.length > 0) : [text];
// };

export function TTSButton({ threadItemId, initialText }: { threadItemId: string, initialText?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [language, setLanguage] = useState('auto');
  const [ttsText, setTtsText] = useState(initialText || '');
  const [loading, setLoading] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const chunksRef = useRef<string[]>([]);
  const currentChunkRef = useRef(0);
  const isPlayingRef = useRef(false);

  const loadTtsText = useCallback(async () => {
    setLoading(true);
    try {
      const localItem = await database.getThreadItemById(threadItemId);
      if (localItem?.tts_text) { setTtsText(localItem.tts_text); setLoading(false); return; }
      const response = await fetch(`${B8_MINI_PC_URL}/api/thread-item/${threadItemId}`);
      if (!response.ok) throw new Error(`Failed to fetch TTS: ${response.status}`);
      const data = await response.json();
      if (data.item?.tts_text) {
        setTtsText(data.item.tts_text);
        await database.updateTtsText(threadItemId, data.item.tts_text);
      } else if (data.item?.aiResponse) {
        setTtsText(data.item.aiResponse);
        await database.updateTtsText(threadItemId, data.item.aiResponse);
      }
    } catch (e) { console.error('TTS load error:', e); } 
    finally { setLoading(false); }
  }, [threadItemId]);

  useEffect(() => { if (!initialText) loadTtsText(); }, [initialText, loadTtsText]);

  // FIX: Stop audio immediately if the user navigates away from the page
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      TextToSpeech.stop();
    };
  }, []);

  // FIX: Global Event Listener. If another TTS button starts, stop this one.
  useEffect(() => {
    const handleGlobalPlay = (event: Event) => {
      const playingId = (event as CustomEvent).detail;
      if (playingId !== threadItemId && (isPlaying || isPaused)) {
        handleStop();
      }
    };
    window.addEventListener('b8-tts-play', handleGlobalPlay as EventListener);
    return () => window.removeEventListener('b8-tts-play', handleGlobalPlay as EventListener);
  }, [isPlaying, isPaused, threadItemId]);

  const getLangCode = (text: string): string => {
    if (language !== 'auto') return language;
    const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const totalLength = text.replace(/\s/g, '').length;
    return (totalLength > 0 && chineseCount / totalLength > 0.15) ? 'zh-TW' : 'en-US';
  };

  const playChunk = async (index: number, rate: number, lang: string) => {
    if (index >= chunksRef.current.length) {
      isPlayingRef.current = false; setIsPlaying(false); setIsPaused(false);
      currentChunkRef.current = 0; chunksRef.current = []; return;
    }
    currentChunkRef.current = index;
    const textToSpeak = chunksRef.current[index];
    const finalLang = getLangCode(textToSpeak);
    try {
      await TextToSpeech.speak({ text: textToSpeak, lang: finalLang, rate, pitch: 1.0, volume: 1.0, category: 'playback' });
      if (isPlayingRef.current) playChunk(index + 1, rate, lang);
    } catch (e) { console.error(e); isPlayingRef.current = false; setIsPlaying(false); setIsPaused(false); }
  };

  const handlePlayPause = async () => {
    if (!ttsText) return;
    if (isPlaying) { isPlayingRef.current = false; await TextToSpeech.stop(); setIsPlaying(false); setIsPaused(true); return; }
    
    window.dispatchEvent(new CustomEvent('b8-tts-play', { detail: threadItemId }));

    if (isPaused) { isPlayingRef.current = true; setIsPlaying(true); setIsPaused(false); playChunk(currentChunkRef.current, speed, language); return; }
    
    chunksRef.current = sanitizeAndChunk(ttsText); currentChunkRef.current = 0; isPlayingRef.current = true; setIsPlaying(true); setIsPaused(false); playChunk(0, speed, language);
  };

  const handleStop = async () => {
    isPlayingRef.current = false; await TextToSpeech.stop(); setIsPlaying(false); setIsPaused(false); currentChunkRef.current = 0; chunksRef.current = [];
  };

  const handleSkip = async () => {
    if (!isPlaying) return;
    await TextToSpeech.stop();
    const nextIndex = currentChunkRef.current + 1;
    if (nextIndex < chunksRef.current.length) { isPlayingRef.current = true; playChunk(nextIndex, speed, language); } else { handleStop(); }
  };

  const handleRewind = async () => {
    if (!isPlaying && !isPaused) return;
    await TextToSpeech.stop();
    let prevIndex = currentChunkRef.current - 1;
    if (prevIndex < 0) prevIndex = 0;
    isPlayingRef.current = true; setIsPlaying(true); setIsPaused(false); playChunk(prevIndex, speed, language);
  };

  const changeSpeed = async (newSpeed: number) => {
    setSpeed(newSpeed); setShowSpeedMenu(false);
    if (isPlaying) { await TextToSpeech.stop(); isPlayingRef.current = true; playChunk(currentChunkRef.current, newSpeed, language); }
  };

  const changeLanguage = async (newLang: string) => {
    setLanguage(newLang); setShowLangMenu(false);
    if (isPlaying) { await TextToSpeech.stop(); isPlayingRef.current = true; playChunk(currentChunkRef.current, speed, newLang); }
  };

  if (loading) return <div style={{ marginTop: '10px', marginBottom: '40px' }}><span style={{ fontSize: '12px', color: '#999' }}>Loading TTS...</span></div>;

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', marginBottom: '40px', position: 'relative', flexWrap: 'wrap', gap: '8px' }}>
      <button onClick={handlePlayPause} style={{ background: isPlaying ? '#E74C3C' : '#4A90D9', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '15px', fontWeight: 600, minWidth: '110px' }} disabled={!ttsText || loading}>
        {isPlaying ? '⏸ Pause' : (isPaused ? '▶️ Resume' : '▶️ Listen')}
      </button>
      {(isPlaying || isPaused) && (
        <button onClick={handleStop} style={{ background: '#34495E', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '15px', fontWeight: 600 }}>⏹ Stop</button>
      )}
      {(isPlaying || isPaused) && (
        <button onClick={handleRewind} style={{ background: '#6c757d', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '15px', fontWeight: 600 }}>⏮ Rewind</button>
      )}
      {isPlaying && (
        <button onClick={handleSkip} style={{ background: '#6c757d', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '15px', fontWeight: 600 }}>⏭ Skip</button>
      )}
      <div style={{ position: 'relative' }}>
        <button onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowLangMenu(false); }} style={{ padding: '8px 12px', backgroundColor: '#F0F0F0', border: 'none', borderRadius: '16px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>{speed}x ▾</button>
        {showSpeedMenu && (
          <div style={{ position: 'absolute', top: '45px', left: '0', backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', zIndex: 100, display: 'flex', flexWrap: 'wrap', width: '160px' }}>
            {SPEED_OPTIONS.map((s) => (
              <div key={s} onClick={() => changeSpeed(s)} style={{ padding: '6px 12px', borderRadius: '8px', margin: '2px', cursor: 'pointer', width: '40px', textAlign: 'center', fontSize: '13px', backgroundColor: s === speed ? '#4A90D9' : '#fff', color: s === speed ? '#fff' : '#333' }}>{s}x</div>
            ))}
          </div>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <button onClick={() => { setShowLangMenu(!showLangMenu); setShowSpeedMenu(false); }} style={{ padding: '8px 12px', backgroundColor: '#F0F0F0', border: 'none', borderRadius: '16px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>{LANG_OPTIONS.find(l => l.value === language)?.label} ▾</button>
        {showLangMenu && (
          <div style={{ position: 'absolute', top: '45px', right: '0', backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', zIndex: 100, display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
            {LANG_OPTIONS.map((l) => (
              <div key={l.value} onClick={() => changeLanguage(l.value)} style={{ padding: '8px 12px', borderRadius: '8px', margin: '2px', cursor: 'pointer', fontSize: '13px', backgroundColor: l.value === language ? '#4A90D9' : '#fff', color: l.value === language ? '#fff' : '#333' }}>{l.label}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
// import React, { useState, useEffect, useCallback, useRef } from 'react';
// import { database } from '../db/Database';
// import { TextToSpeech } from '@capacitor-community/text-to-speech';

// const B8_MINI_PC_URL = 'https://192.168.0.151:8448';
// const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
// const LANG_OPTIONS = [
//   { label: 'Auto', value: 'auto' },
//   { label: 'Mandarin (繁體)', value: 'zh-TW' },
//   { label: 'Cantonese (粵語)', value: 'yue-HK' },
//   { label: 'English', value: 'en-US' }
// ];

// // Helper: Sanitize Slate JSON and Markdown into clean, chunked text
// const sanitizeAndChunk = (rawText: string): string[] => {
//   let text = rawText;
//   try {
//     const parsed = JSON.parse(text);
//     if (Array.isArray(parsed) && parsed[0]?.type === 'paragraph') {
//       text = parsed.map((node: any) => node.children?.map((c: any) => c.text).join("") || "").join("\n");
//     }
//   } catch (e) {}
//   text = text.replace(/[*#_`>]/g, '');
//   text = text.replace(/\n+/g, '. ');
//   const chunks = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g);
//   return chunks ? chunks.map(c => c.trim()).filter(c => c.length > 0) : [text];
// };

// export function TTSButton({ threadItemId, initialText }: { threadItemId: string, initialText?: string }) {
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [isPaused, setIsPaused] = useState(false);
//   const [speed, setSpeed] = useState(1.0);
//   const [language, setLanguage] = useState('auto');
//   const [ttsText, setTtsText] = useState(initialText || '');
//   const [loading, setLoading] = useState(false);
//   const [showSpeedMenu, setShowSpeedMenu] = useState(false);
//   const [showLangMenu, setShowLangMenu] = useState(false);

//   const chunksRef = useRef<string[]>([]);
//   const currentChunkRef = useRef(0);
//   const isPlayingRef = useRef(false);

//   const loadTtsText = useCallback(async () => {
//     setLoading(true);
//     try {
//       const localItem = await database.getThreadItemById(threadItemId);
//       if (localItem?.tts_text) { setTtsText(localItem.tts_text); setLoading(false); return; }
//       const response = await fetch(`${B8_MINI_PC_URL}/api/thread-item/${threadItemId}`);
//       if (!response.ok) throw new Error(`Failed to fetch TTS: ${response.status}`);
//       const data = await response.json();
//       if (data.item?.tts_text) {
//         setTtsText(data.item.tts_text);
//         await database.updateTtsText(threadItemId, data.item.tts_text);
//       } else if (data.item?.aiResponse) {
//         setTtsText(data.item.aiResponse);
//         await database.updateTtsText(threadItemId, data.item.aiResponse);
//       }
//     } catch (e) { console.error('TTS load error:', e); } 
//     finally { setLoading(false); }
//   }, [threadItemId]);

//   useEffect(() => { if (!initialText) loadTtsText(); }, [initialText, loadTtsText]);

//   // FIX: Global Event Listener. If another TTS button starts, stop this one.
//   useEffect(() => {
//     const handleGlobalPlay = (event: Event) => {
//       const playingId = (event as CustomEvent).detail;
//       if (playingId !== threadItemId && (isPlaying || isPaused)) {
//         handleStop();
//       }
//     };
//     window.addEventListener('b8-tts-play', handleGlobalPlay as EventListener);
//     return () => window.removeEventListener('b8-tts-play', handleGlobalPlay as EventListener);
//   }, [isPlaying, isPaused, threadItemId]);

//   const getLangCode = (text: string): string => {
//     if (language !== 'auto') return language;
//     const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
//     const totalLength = text.replace(/\s/g, '').length;
//     // FIX: Lowered threshold to 0.15 (15% Chinese chars) for smarter Auto detection
//     return (totalLength > 0 && chineseCount / totalLength > 0.15) ? 'zh-TW' : 'en-US';
//   };

//   const playChunk = async (index: number, rate: number, lang: string) => {
//     if (index >= chunksRef.current.length) {
//       isPlayingRef.current = false; setIsPlaying(false); setIsPaused(false);
//       currentChunkRef.current = 0; chunksRef.current = []; return;
//     }
//     currentChunkRef.current = index;
//     const textToSpeak = chunksRef.current[index];
//     const finalLang = getLangCode(textToSpeak);
//     try {
//       await TextToSpeech.speak({ text: textToSpeak, lang: finalLang, rate, pitch: 1.0, volume: 1.0, category: 'playback' });
//       if (isPlayingRef.current) playChunk(index + 1, rate, lang);
//     } catch (e) { console.error(e); isPlayingRef.current = false; setIsPlaying(false); setIsPaused(false); }
//   };

//   const handlePlayPause = async () => {
//     if (!ttsText) return;
//     if (isPlaying) { isPlayingRef.current = false; await TextToSpeech.stop(); setIsPlaying(false); setIsPaused(true); return; }
    
//     // FIX: Tell all other TTS buttons to stop before starting
//     window.dispatchEvent(new CustomEvent('b8-tts-play', { detail: threadItemId }));

//     if (isPaused) { isPlayingRef.current = true; setIsPlaying(true); setIsPaused(false); playChunk(currentChunkRef.current, speed, language); return; }
    
//     chunksRef.current = sanitizeAndChunk(ttsText); currentChunkRef.current = 0; isPlayingRef.current = true; setIsPlaying(true); setIsPaused(false); playChunk(0, speed, language);
//   };

//   const handleStop = async () => {
//     isPlayingRef.current = false; await TextToSpeech.stop(); setIsPlaying(false); setIsPaused(false); currentChunkRef.current = 0; chunksRef.current = [];
//   };

//   const handleSkip = async () => {
//     if (!isPlaying) return;
//     await TextToSpeech.stop();
//     const nextIndex = currentChunkRef.current + 1;
//     if (nextIndex < chunksRef.current.length) { isPlayingRef.current = true; playChunk(nextIndex, speed, language); } else { handleStop(); }
//   };

//   const handleRewind = async () => {
//     if (!isPlaying && !isPaused) return;
//     await TextToSpeech.stop();
//     let prevIndex = currentChunkRef.current - 1;
//     if (prevIndex < 0) prevIndex = 0;
//     isPlayingRef.current = true; setIsPlaying(true); setIsPaused(false); playChunk(prevIndex, speed, language);
//   };

//   const changeSpeed = async (newSpeed: number) => {
//     setSpeed(newSpeed); setShowSpeedMenu(false);
//     if (isPlaying) { await TextToSpeech.stop(); isPlayingRef.current = true; playChunk(currentChunkRef.current, newSpeed, language); }
//   };

//   const changeLanguage = async (newLang: string) => {
//     setLanguage(newLang); setShowLangMenu(false);
//     if (isPlaying) { await TextToSpeech.stop(); isPlayingRef.current = true; playChunk(currentChunkRef.current, speed, newLang); }
//   };

//   if (loading) return <div style={{ marginTop: '10px', marginBottom: '40px' }}><span style={{ fontSize: '12px', color: '#999' }}>Loading TTS...</span></div>;

//   return (
//     <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', marginBottom: '40px', position: 'relative', flexWrap: 'wrap', gap: '8px' }}>
//       <button onClick={handlePlayPause} style={{ background: isPlaying ? '#E74C3C' : '#4A90D9', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '15px', fontWeight: 600, minWidth: '110px' }} disabled={!ttsText || loading}>
//         {isPlaying ? '⏸ Pause' : (isPaused ? '▶️ Resume' : '▶️ Listen')}
//       </button>
//       {(isPlaying || isPaused) && (
//         <button onClick={handleStop} style={{ background: '#34495E', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '15px', fontWeight: 600 }}>⏹ Stop</button>
//       )}
//       {(isPlaying || isPaused) && (
//         <button onClick={handleRewind} style={{ background: '#6c757d', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '15px', fontWeight: 600 }}>⏮ Rewind</button>
//       )}
//       {isPlaying && (
//         <button onClick={handleSkip} style={{ background: '#6c757d', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '15px', fontWeight: 600 }}>⏭ Skip</button>
//       )}
//       <div style={{ position: 'relative' }}>
//         <button onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowLangMenu(false); }} style={{ padding: '8px 12px', backgroundColor: '#F0F0F0', border: 'none', borderRadius: '16px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>{speed}x ▾</button>
//         {showSpeedMenu && (
//           <div style={{ position: 'absolute', top: '45px', left: '0', backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', zIndex: 100, display: 'flex', flexWrap: 'wrap', width: '160px' }}>
//             {SPEED_OPTIONS.map((s) => (
//               <div key={s} onClick={() => changeSpeed(s)} style={{ padding: '6px 12px', borderRadius: '8px', margin: '2px', cursor: 'pointer', width: '40px', textAlign: 'center', fontSize: '13px', backgroundColor: s === speed ? '#4A90D9' : '#fff', color: s === speed ? '#fff' : '#333' }}>{s}x</div>
//             ))}
//           </div>
//         )}
//       </div>
//       <div style={{ position: 'relative' }}>
//         <button onClick={() => { setShowLangMenu(!showLangMenu); setShowSpeedMenu(false); }} style={{ padding: '8px 12px', backgroundColor: '#F0F0F0', border: 'none', borderRadius: '16px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>{LANG_OPTIONS.find(l => l.value === language)?.label} ▾</button>
//         {showLangMenu && (
//           <div style={{ position: 'absolute', top: '45px', right: '0', backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', zIndex: 100, display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
//             {LANG_OPTIONS.map((l) => (
//               <div key={l.value} onClick={() => changeLanguage(l.value)} style={{ padding: '8px 12px', borderRadius: '8px', margin: '2px', cursor: 'pointer', fontSize: '13px', backgroundColor: l.value === language ? '#4A90D9' : '#fff', color: l.value === language ? '#fff' : '#333' }}>{l.label}</div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// import React, { useState, useEffect, useCallback, useRef } from 'react';
// import { database } from '../db/Database';
// import { TextToSpeech } from '@capacitor-community/text-to-speech';

// const B8_MINI_PC_URL = 'https://192.168.0.151:8448';
// const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
// const LANG_OPTIONS = [
//   { label: 'Auto', value: 'auto' },
//   { label: 'Mandarin (繁體)', value: 'zh-TW' },
//   { label: 'Cantonese (粵語)', value: 'yue-HK' },
//   { label: 'English', value: 'en-US' }
// ];

// // Helper: Sanitize Slate JSON and Markdown into clean, chunked text
// const sanitizeAndChunk = (rawText: string): string[] => {
//   let text = rawText;
  
//   // 1. Parse Slate JSON if present
//   try {
//     const parsed = JSON.parse(text);
//     if (Array.isArray(parsed) && parsed[0]?.type === 'paragraph') {
//       text = parsed.map((node: any) => 
//         node.children?.map((c: any) => c.text).join("") || ""
//       ).join("\n");
//     }
//   } catch (e) {
//     // Not JSON, proceed as plain text
//   }

//   // 2. Strip Markdown symbols
//   text = text.replace(/[*#_`>]/g, '');
  
//   // 3. Replace newlines with periods for natural TTS pauses
//   text = text.replace(/\n+/g, '. ');
  
//   // 4. Split into sentence chunks (so we can pause/skip)
//   const chunks = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g);
//   return chunks ? chunks.map(c => c.trim()).filter(c => c.length > 0) : [text];
// };

// export function TTSButton({ threadItemId, initialText }: { threadItemId: string, initialText?: string }) {
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [isPaused, setIsPaused] = useState(false);
//   const [speed, setSpeed] = useState(1.0);
//   const [language, setLanguage] = useState('auto');
//   const [ttsText, setTtsText] = useState(initialText || '');
//   const [loading, setLoading] = useState(false);
//   const [showSpeedMenu, setShowSpeedMenu] = useState(false);
//   const [showLangMenu, setShowLangMenu] = useState(false);

//   // Refs for managing the audio queue without blocking the UI
//   const chunksRef = useRef<string[]>([]);
//   const currentChunkRef = useRef(0);
//   const isPlayingRef = useRef(false);

//   const loadTtsText = useCallback(async () => {
//     setLoading(true);
//     try {
//       const localItem = await database.getThreadItemById(threadItemId);
//       if (localItem?.tts_text) { 
//         setTtsText(localItem.tts_text); 
//         setLoading(false); 
//         return; 
//       }

//       const response = await fetch(`${B8_MINI_PC_URL}/api/thread-item/${threadItemId}`);
//       if (!response.ok) throw new Error(`Failed to fetch TTS: ${response.status}`);
//       const data = await response.json();
      
//       if (data.item?.tts_text) {
//         setTtsText(data.item.tts_text);
//         await database.updateTtsText(threadItemId, data.item.tts_text);
//       } else if (data.item?.aiResponse) {
//         // Fallback: Use aiResponse if tts_text is empty
//         const fallbackText = data.item.aiResponse;
//         setTtsText(fallbackText);
//         await database.updateTtsText(threadItemId, fallbackText);
//       }
//     } catch (e) { 
//       console.error('TTS load error:', e); 
//     } finally { 
//       setLoading(false); 
//     }
//   }, [threadItemId]);

//   useEffect(() => { 
//     if (!initialText) loadTtsText(); 
//   }, [initialText, loadTtsText]);

//   const getLangCode = (text: string): string => {
//     if (language !== 'auto') return language;
//     const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
//     const totalLength = text.replace(/\s/g, '').length;
//     return (totalLength > 0 && chineseCount / totalLength > 0.3) ? 'zh-TW' : 'en-US';
//   };

//   const playChunk = async (index: number, rate: number, lang: string) => {
//     if (index >= chunksRef.current.length) {
//       // Finished all chunks naturally
//       isPlayingRef.current = false;
//       setIsPlaying(false);
//       setIsPaused(false);
//       currentChunkRef.current = 0;
//       chunksRef.current = []; // Clear chunks so it starts fresh next time
//       return;
//     }

//     currentChunkRef.current = index;
//     const textToSpeak = chunksRef.current[index];
//     const finalLang = getLangCode(textToSpeak);

//     try {
//       await TextToSpeech.speak({
//         text: textToSpeak,
//         lang: finalLang,
//         rate: rate,
//         pitch: 1.0,
//         volume: 1.0,
//         category: 'playback',
//       });
      
//       // If still playing, automatically move to the next chunk
//       if (isPlayingRef.current) {
//         playChunk(index + 1, rate, lang);
//       }
//     } catch (e) { 
//       console.error('TTS Speak Error:', e); 
//       isPlayingRef.current = false;
//       setIsPlaying(false);
//       setIsPaused(false);
//     }
//   };

//   const handlePlayPause = async () => {
//     if (!ttsText) return;

//     // If currently playing, PAUSE
//     if (isPlaying) {
//       isPlayingRef.current = false;
//       await TextToSpeech.stop();
//       setIsPlaying(false);
//       setIsPaused(true);
//       return;
//     }

//     // If resuming from pause, don't re-chunk
//     if (isPaused) {
//       isPlayingRef.current = true;
//       setIsPlaying(true);
//       setIsPaused(false);
//       playChunk(currentChunkRef.current, speed, language);
//       return;
//     }

//     // STARTING FRESH: Sanitize and chunk the text
//     chunksRef.current = sanitizeAndChunk(ttsText);
//     currentChunkRef.current = 0;
//     isPlayingRef.current = true;
//     setIsPlaying(true);
//     setIsPaused(false);
//     playChunk(0, speed, language);
//   };

//   // Complete Stop and reset to beginning
//   const handleStop = async () => {
//     isPlayingRef.current = false;
//     await TextToSpeech.stop();
//     setIsPlaying(false);
//     setIsPaused(false);
//     currentChunkRef.current = 0;
//     chunksRef.current = []; // Clear chunks so next Play starts from beginning
//   };

//   // Skip to next chunk
//   const handleSkip = async () => {
//     if (!isPlaying) return;
    
//     await TextToSpeech.stop();
//     const nextIndex = currentChunkRef.current + 1;
    
//     if (nextIndex < chunksRef.current.length) {
//       isPlayingRef.current = true;
//       playChunk(nextIndex, speed, language);
//     } else {
//       // Reached the end
//       handleStop();
//     }
//   };

//   // NEW: Rewind to previous chunk
//   const handleRewind = async () => {
//     // Only allow rewind if we have an active session (playing or paused)
//     if (!isPlaying && !isPaused) return;
    
//     await TextToSpeech.stop();
    
//     let prevIndex = currentChunkRef.current - 1;
//     if (prevIndex < 0) {
//       prevIndex = 0; // Can't rewind before the beginning, just restart current chunk
//     }
    
//     // If it was paused, resume playback from the previous chunk
//     isPlayingRef.current = true;
//     setIsPlaying(true);
//     setIsPaused(false);
//     playChunk(prevIndex, speed, language);
//   };

//   const changeSpeed = async (newSpeed: number) => {
//     setSpeed(newSpeed);
//     setShowSpeedMenu(false);
    
//     if (isPlaying) {
//       // Stop and replay current chunk at new speed
//       await TextToSpeech.stop();
//       isPlayingRef.current = true;
//       playChunk(currentChunkRef.current, newSpeed, language);
//     }
//   };

//   const changeLanguage = async (newLang: string) => {
//     setLanguage(newLang);
//     setShowLangMenu(false);
    
//     if (isPlaying) {
//       // Stop and replay current chunk in new language
//       await TextToSpeech.stop();
//       isPlayingRef.current = true;
//       playChunk(currentChunkRef.current, speed, newLang);
//     }
//   };

//   if (loading) {
//     return (
//       <div style={{ marginTop: '10px', marginBottom: '40px' }}>
//         <span style={{ fontSize: '12px', color: '#999', padding: '10px' }}>Loading TTS...</span>
//       </div>
//     );
//   }

//   return (
//     <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', marginBottom: '40px', position: 'relative', flexWrap: 'wrap', gap: '8px' }}>
      
//       {/* Play / Pause Button */}
//       <button 
//         onClick={handlePlayPause} 
//         style={{
//           background: isPlaying ? '#E74C3C' : '#4A90D9',
//           color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '20px',
//           cursor: !ttsText ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 600, minWidth: '110px'
//         }}
//         disabled={!ttsText || loading}
//       >
//         {isPlaying ? '⏸ Pause' : (isPaused ? '▶️ Resume' : '▶️ Listen')}
//       </button>

//       {/* Stop Button (Only show if playing or paused) */}
//       {(isPlaying || isPaused) && (
//         <button 
//           onClick={handleStop} 
//           style={{
//             background: '#34495E', color: '#FFF', border: 'none', padding: '8px 16px', 
//             borderRadius: '20px', cursor: 'pointer', fontSize: '15px', fontWeight: 600
//           }}
//         >
//           ⏹ Stop
//         </button>
//       )}

//       {/* Rewind Button (Only show if playing or paused) */}
//       {(isPlaying || isPaused) && (
//         <button 
//           onClick={handleRewind} 
//           style={{
//             background: '#6c757d', color: '#FFF', border: 'none', padding: '8px 16px', 
//             borderRadius: '20px', cursor: 'pointer', fontSize: '15px', fontWeight: 600
//           }}
//         >
//           ⏮ Rewind
//         </button>
//       )}

//       {/* Skip Button (Only show if actively playing) */}
//       {isPlaying && (
//         <button 
//           onClick={handleSkip} 
//           style={{
//             background: '#6c757d', color: '#FFF', border: 'none', padding: '8px 16px', 
//             borderRadius: '20px', cursor: 'pointer', fontSize: '15px', fontWeight: 600
//           }}
//         >
//           ⏭ Skip
//         </button>
//       )}

//       {/* Speed Control */}
//       <div style={{ position: 'relative' }}>
//         <button 
//           onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowLangMenu(false); }} 
//           style={{
//             padding: '8px 12px', backgroundColor: '#F0F0F0', border: 'none', borderRadius: '16px',
//             cursor: 'pointer', fontSize: '14px', fontWeight: 500
//           }}
//         >
//           {speed}x ▾
//         </button>
//         {showSpeedMenu && (
//           <div style={{
//             position: 'absolute', top: '45px', left: '0', backgroundColor: '#FFFFFF', borderRadius: '12px',
//             padding: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', zIndex: 100, display: 'flex', flexWrap: 'wrap', width: '160px'
//           }}>
//             {SPEED_OPTIONS.map((s) => (
//               <div key={s} onClick={() => changeSpeed(s)} style={{
//                 padding: '6px 12px', borderRadius: '8px', margin: '2px', cursor: 'pointer', width: '40px',
//                 textAlign: 'center', fontSize: '13px', backgroundColor: s === speed ? '#4A90D9' : '#fff', color: s === speed ? '#fff' : '#333',
//               }}>{s}x</div>
//             ))}
//           </div>
//         )}
//       </div>

//       {/* Language Control */}
//       <div style={{ position: 'relative' }}>
//         <button 
//           onClick={() => { setShowLangMenu(!showLangMenu); setShowSpeedMenu(false); }} 
//           style={{
//             padding: '8px 12px', backgroundColor: '#F0F0F0', border: 'none', borderRadius: '16px',
//             cursor: 'pointer', fontSize: '14px', fontWeight: 500
//           }}
//         >
//           {LANG_OPTIONS.find(l => l.value === language)?.label} ▾
//         </button>
//         {showLangMenu && (
//           <div style={{
//             position: 'absolute', top: '45px', right: '0', backgroundColor: '#FFFFFF', borderRadius: '12px',
//             padding: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', zIndex: 100, display: 'flex', flexDirection: 'column', minWidth: '150px'
//           }}>
//             {LANG_OPTIONS.map((l) => (
//               <div key={l.value} onClick={() => changeLanguage(l.value)} style={{
//                 padding: '8px 12px', borderRadius: '8px', margin: '2px', cursor: 'pointer', fontSize: '13px',
//                 backgroundColor: l.value === language ? '#4A90D9' : '#fff', color: l.value === language ? '#fff' : '#333',
//               }}>{l.label}</div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// import React, { useState, useEffect, useCallback, useRef } from 'react';
// import { database } from '../db/Database';
// import { TextToSpeech } from '@capacitor-community/text-to-speech';

// const B8_MINI_PC_URL = 'https://192.168.0.151:8448';
// const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
// const LANG_OPTIONS = [
//   { label: 'Auto', value: 'auto' },
//   { label: 'Mandarin (繁體)', value: 'zh-TW' },
//   { label: 'Cantonese (粵語)', value: 'yue-HK' },
//   { label: 'English', value: 'en-US' }
// ];

// // Helper: Sanitize Slate JSON and Markdown into clean, chunked text
// const sanitizeAndChunk = (rawText: string): string[] => {
//   let text = rawText;
  
//   // 1. Parse Slate JSON if present
//   try {
//     const parsed = JSON.parse(text);
//     if (Array.isArray(parsed) && parsed[0]?.type === 'paragraph') {
//       text = parsed.map((node: any) => 
//         node.children?.map((c: any) => c.text).join("") || ""
//       ).join("\n");
//     }
//   } catch (e) {
//     // Not JSON, proceed as plain text
//   }

//   // 2. Strip Markdown symbols
//   text = text.replace(/[*#_`>]/g, '');
  
//   // 3. Replace newlines with periods for natural TTS pauses
//   text = text.replace(/\n+/g, '. ');
  
//   // 4. Split into sentence chunks (so we can pause/skip)
//   const chunks = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g);
//   return chunks ? chunks.map(c => c.trim()).filter(c => c.length > 0) : [text];
// };

// export function TTSButton({ threadItemId, initialText }: { threadItemId: string, initialText?: string }) {
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [speed, setSpeed] = useState(1.0);
//   const [language, setLanguage] = useState('auto');
//   const [ttsText, setTtsText] = useState(initialText || '');
//   const [loading, setLoading] = useState(false);
//   const [showSpeedMenu, setShowSpeedMenu] = useState(false);
//   const [showLangMenu, setShowLangMenu] = useState(false);

//   // Refs for managing the audio queue without blocking the UI
//   const chunksRef = useRef<string[]>([]);
//   const currentChunkRef = useRef(0);
//   const isPlayingRef = useRef(false);

//   const loadTtsText = useCallback(async () => {
//     setLoading(true);
//     try {
//       const localItem = await database.getThreadItemById(threadItemId);
//       if (localItem?.tts_text) { 
//         setTtsText(localItem.tts_text); 
//         setLoading(false); 
//         return; 
//       }

//       const response = await fetch(`${B8_MINI_PC_URL}/api/thread-item/${threadItemId}`);
//       if (!response.ok) throw new Error(`Failed to fetch TTS: ${response.status}`);
//       const data = await response.json();
      
//       if (data.item?.tts_text) {
//         setTtsText(data.item.tts_text);
//         await database.updateTtsText(threadItemId, data.item.tts_text);
//       } else if (data.item?.aiResponse) {
//         // Fallback: Use aiResponse if tts_text is empty
//         const fallbackText = data.item.aiResponse;
//         setTtsText(fallbackText);
//         await database.updateTtsText(threadItemId, fallbackText);
//       }
//     } catch (e) { 
//       console.error('TTS load error:', e); 
//     } finally { 
//       setLoading(false); 
//     }
//   }, [threadItemId]);

//   useEffect(() => { 
//     if (!initialText) loadTtsText(); 
//   }, [initialText, loadTtsText]);

//   const getLangCode = (text: string): string => {
//     if (language !== 'auto') return language;
//     const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
//     const totalLength = text.replace(/\s/g, '').length;
//     return (totalLength > 0 && chineseCount / totalLength > 0.3) ? 'zh-TW' : 'en-US';
//   };

//   const playChunk = async (index: number, rate: number, lang: string) => {
//     if (index >= chunksRef.current.length) {
//       // Finished all chunks
//       isPlayingRef.current = false;
//       setIsPlaying(false);
//       currentChunkRef.current = 0;
//       return;
//     }

//     currentChunkRef.current = index;
//     const textToSpeak = chunksRef.current[index];
//     const finalLang = getLangCode(textToSpeak);

//     try {
//       await TextToSpeech.speak({
//         text: textToSpeak,
//         lang: finalLang,
//         rate: rate,
//         pitch: 1.0,
//         volume: 1.0,
//         category: 'playback',
//       });
      
//       // If still playing, automatically move to the next chunk
//       if (isPlayingRef.current) {
//         playChunk(index + 1, rate, lang);
//       }
//     } catch (e) { 
//       console.error('TTS Speak Error:', e); 
//       isPlayingRef.current = false;
//       setIsPlaying(false);
//     }
//   };

//   const handlePlayPause = async () => {
//     if (!ttsText) return;

//     // If currently playing, PAUSE
//     if (isPlaying) {
//       isPlayingRef.current = false;
//       await TextToSpeech.stop();
//       setIsPlaying(false);
//       return;
//     }

//     // If resuming from pause, don't re-chunk
//     if (chunksRef.current.length > 0 && currentChunkRef.current > 0) {
//       isPlayingRef.current = true;
//       setIsPlaying(true);
//       playChunk(currentChunkRef.current, speed, language);
//       return;
//     }

//     // STARTING FRESH: Sanitize and chunk the text
//     chunksRef.current = sanitizeAndChunk(ttsText);
//     currentChunkRef.current = 0;
//     isPlayingRef.current = true;
//     setIsPlaying(true);
//     playChunk(0, speed, language);
//   };

//   const handleSkip = async () => {
//     if (!isPlaying) return;
    
//     // Stop current chunk, play next
//     await TextToSpeech.stop();
//     const nextIndex = currentChunkRef.current + 1;
    
//     if (nextIndex < chunksRef.current.length) {
//       isPlayingRef.current = true;
//       playChunk(nextIndex, speed, language);
//     } else {
//       // Reached the end
//       isPlayingRef.current = false;
//       setIsPlaying(false);
//       currentChunkRef.current = 0;
//     }
//   };

//   const changeSpeed = async (newSpeed: number) => {
//     setSpeed(newSpeed);
//     setShowSpeedMenu(false);
    
//     if (isPlaying) {
//       // Stop and replay current chunk at new speed
//       await TextToSpeech.stop();
//       isPlayingRef.current = true;
//       playChunk(currentChunkRef.current, newSpeed, language);
//     }
//   };

//   const changeLanguage = async (newLang: string) => {
//     setLanguage(newLang);
//     setShowLangMenu(false);
    
//     if (isPlaying) {
//       // Stop and replay current chunk in new language
//       await TextToSpeech.stop();
//       isPlayingRef.current = true;
//       playChunk(currentChunkRef.current, speed, newLang);
//     }
//   };

//   if (loading) {
//     return (
//       <div style={{ marginTop: '10px', marginBottom: '40px' }}>
//         <span style={{ fontSize: '12px', color: '#999', padding: '10px' }}>Loading TTS...</span>
//       </div>
//     );
//   }

//   return (
//     <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', marginBottom: '40px', position: 'relative', flexWrap: 'wrap', gap: '8px' }}>
//       {/* Play / Pause Button */}
//       <button 
//         onClick={handlePlayPause} 
//         style={{
//           background: isPlaying ? '#E74C3C' : '#4A90D9',
//           color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '20px',
//           cursor: !ttsText ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 600, minWidth: '100px'
//         }}
//         disabled={!ttsText || loading}
//       >
//         {isPlaying ? '⏸ Pause' : '▶️ Listen'}
//       </button>

//       {/* Skip Button */}
//       {isPlaying && (
//         <button 
//           onClick={handleSkip} 
//           style={{
//             background: '#6c757d', color: '#FFF', border: 'none', padding: '8px 16px', 
//             borderRadius: '20px', cursor: 'pointer', fontSize: '15px', fontWeight: 600
//           }}
//         >
//           ⏭ Skip
//         </button>
//       )}

//       {/* Speed Control */}
//       <div style={{ position: 'relative' }}>
//         <button 
//           onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowLangMenu(false); }} 
//           style={{
//             padding: '8px 12px', backgroundColor: '#F0F0F0', border: 'none', borderRadius: '16px',
//             cursor: 'pointer', fontSize: '14px', fontWeight: 500
//           }}
//         >
//           {speed}x ▾
//         </button>
//         {showSpeedMenu && (
//           <div style={{
//             position: 'absolute', top: '45px', left: '0', backgroundColor: '#FFFFFF', borderRadius: '12px',
//             padding: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', zIndex: 100, display: 'flex', flexWrap: 'wrap', width: '160px'
//           }}>
//             {SPEED_OPTIONS.map((s) => (
//               <div key={s} onClick={() => changeSpeed(s)} style={{
//                 padding: '6px 12px', borderRadius: '8px', margin: '2px', cursor: 'pointer', width: '40px',
//                 textAlign: 'center', fontSize: '13px', backgroundColor: s === speed ? '#4A90D9' : '#fff', color: s === speed ? '#fff' : '#333',
//               }}>{s}x</div>
//             ))}
//           </div>
//         )}
//       </div>

//       {/* Language Control */}
//       <div style={{ position: 'relative' }}>
//         <button 
//           onClick={() => { setShowLangMenu(!showLangMenu); setShowSpeedMenu(false); }} 
//           style={{
//             padding: '8px 12px', backgroundColor: '#F0F0F0', border: 'none', borderRadius: '16px',
//             cursor: 'pointer', fontSize: '14px', fontWeight: 500
//           }}
//         >
//           {LANG_OPTIONS.find(l => l.value === language)?.label} ▾
//         </button>
//         {showLangMenu && (
//           <div style={{
//             position: 'absolute', top: '45px', right: '0', backgroundColor: '#FFFFFF', borderRadius: '12px',
//             padding: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', zIndex: 100, display: 'flex', flexDirection: 'column', minWidth: '150px'
//           }}>
//             {LANG_OPTIONS.map((l) => (
//               <div key={l.value} onClick={() => changeLanguage(l.value)} style={{
//                 padding: '8px 12px', borderRadius: '8px', margin: '2px', cursor: 'pointer', fontSize: '13px',
//                 backgroundColor: l.value === language ? '#4A90D9' : '#fff', color: l.value === language ? '#fff' : '#333',
//               }}>{l.label}</div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// import React, { useState, useEffect, useCallback } from 'react';
// import { database } from '../db/Database';
// import { TextToSpeech } from '@capacitor-community/text-to-speech';

// // To this:
// const B8_MINI_PC_URL = 'https://192.168.0.151:8448';
// // const B8_MINI_PC_URL = 'http://192.168.0.151:5018';
// const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// interface TTSButtonProps {
//   threadItemId: string;
//   initialText?: string;
// }

// export function TTSButton({ threadItemId, initialText }: TTSButtonProps) {
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [speed, setSpeed] = useState(1.0);
//   const [ttsText, setTtsText] = useState(initialText || '');
//   const [loading, setLoading] = useState(false);
//   const [showSpeedMenu, setShowSpeedMenu] = useState(false);

//   const loadTtsText = useCallback(async () => {
//     setLoading(true);
//     try {
//       const localItem = await database.getThreadItemById(threadItemId);
//       if (localItem?.tts_text) {
//         setTtsText(localItem.tts_text);
//         setLoading(false);
//         return;
//       }

//       const response = await fetch(`${B8_MINI_PC_URL}/api/thread-item/${threadItemId}`);
//       if (!response.ok) throw new Error(`Failed to fetch TTS: ${response.status}`);

//       const data = await response.json();
//       if (data.item?.tts_text) {
//         const tts = data.item.tts_text;
//         setTtsText(tts);
//         await database.updateTtsText(threadItemId, tts);
//       }
//     } catch (e) {
//       console.error('❌ TTS load error:', e);
//     } finally {
//       setLoading(false);
//     }
//   }, [threadItemId]);

//   useEffect(() => {
//     if (!initialText) {
//       loadTtsText();
//     }
//   }, [initialText, loadTtsText]);

//   const speakText = async (text: string, rate: number) => {
//     setIsPlaying(true);
//     const chineseCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
//     const totalLength = text.replace(/\s/g, '').length;
//     const lang = (totalLength > 0 && chineseCount / totalLength > 0.3) ? 'zh-CN' : 'en-US';

//     try {
//       await TextToSpeech.speak({
//         text: text,
//         lang: lang,
//         rate: rate,
//         pitch: 1.0,
//         volume: 1.0,
//         category: 'playback',
//       });
//     } catch (e) {
//       console.error('TTS Speak Error:', e);
//     } finally {
//       setIsPlaying(false);
//     }
//   };

//   const handleListen = async () => {
//     if (!ttsText) return;
    
//     if (isPlaying) {
//       await TextToSpeech.stop();
//       setIsPlaying(false);
//       return;
//     }

//     await speakText(ttsText, speed);
//   };

//   const changeSpeed = async (newSpeed: number) => {
//     setSpeed(newSpeed);
//     setShowSpeedMenu(false);

//     if (isPlaying) {
//       await TextToSpeech.stop();
//       setIsPlaying(false);
//       setTimeout(() => speakText(ttsText, newSpeed), 200);
//     }
//   };

//   if (loading) {
//     return (
//       <div style={{ marginTop: '10px' }}>
//         <span style={{ fontSize: '12px', color: '#999', padding: '10px' }}>Loading TTS...</span>
//       </div>
//     );
//   }

//   return (
//     <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', position: 'relative' }}>
//       <button 
//         onClick={handleListen} 
//         style={{
//           background: isPlaying ? '#E74C3C' : '#4A90D9',
//           color: '#FFF',
//           border: 'none',
//           padding: '8px 16px',
//           borderRadius: '20px',
//           cursor: !ttsText ? 'not-allowed' : 'pointer',
//           fontSize: '15px',
//           fontWeight: 600,
//           minWidth: '100px'
//         }}
//         disabled={!ttsText || loading}
//       >
//         {isPlaying ? '⏹ Stop' : '🔊 Listen'}
//       </button>

//       <button 
//         onClick={() => setShowSpeedMenu(!showSpeedMenu)} 
//         style={{
//           marginLeft: '12px',
//           padding: '8px 12px',
//           backgroundColor: '#F0F0F0',
//           border: 'none',
//           borderRadius: '16px',
//           cursor: 'pointer',
//           fontSize: '14px',
//           fontWeight: 500
//         }}
//         disabled={loading}
//       >
//         {speed}x ▾
//       </button>

//       {showSpeedMenu && (
//         <div style={{
//           position: 'absolute',
//           top: '45px',
//           left: '120px',
//           backgroundColor: '#FFFFFF',
//           borderRadius: '12px',
//           padding: '8px',
//           boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
//           zIndex: 100,
//           display: 'flex',
//           flexWrap: 'wrap',
//           width: '160px'
//         }}>
//           {SPEED_OPTIONS.map((s) => (
//             <div 
//               key={s} 
//               onClick={() => changeSpeed(s)}
//               style={{
//                 padding: '6px 12px',
//                 borderRadius: '8px',
//                 margin: '2px',
//                 cursor: 'pointer',
//                 width: '40px',
//                 textAlign: 'center',
//                 fontSize: '13px',
//                 backgroundColor: s === speed ? '#4A90D9' : '#fff',
//                 color: s === speed ? '#fff' : '#333',
//               }}
//             >
//               {s}x
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// import React, { useState, useEffect, useCallback } from 'react';
// import { database } from '../db/Database';

// const B8_MINI_PC_URL = 'http://192.168.0.151:5018';
// const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

// interface TTSButtonProps {
//   threadItemId: string;
//   initialText?: string;
// }

// export function TTSButton({ threadItemId, initialText }: TTSButtonProps) {
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [speed, setSpeed] = useState(1.0);
//   const [ttsText, setTtsText] = useState(initialText || '');
//   const [loading, setLoading] = useState(false);
//   const [showSpeedMenu, setShowSpeedMenu] = useState(false);

//   const loadTtsText = useCallback(async () => {
//     setLoading(true);
//     try {
//       // Step 1: Try local DB first (Instant)
//       const localItem = await database.getThreadItemById(threadItemId);
//       if (localItem?.tts_text) {
//         console.log('✅ TTS: Loaded from local DB');
//         setTtsText(localItem.tts_text);
//         setLoading(false);
//         return;
//       }

//       // Step 2: Fallback to Mini PC
//       console.log('📡 TTS: Fetching from Mini PC...');
//       const response = await fetch(`${B8_MINI_PC_URL}/api/thread-item/${threadItemId}`);
//       if (!response.ok) throw new Error(`Failed to fetch TTS: ${response.status}`);

//       const data = await response.json();
//       if (data.item?.tts_text) {
//         const tts = data.item.tts_text;
//         setTtsText(tts);
        
//         // Step 3: Safely Update local DB (Prevents overwriting row)
//         console.log('💾 TTS: Caching to local DB');
//         await database.updateTtsText(threadItemId, tts);
//       }
//     } catch (e) {
//       console.error('❌ TTS load error:', e);
//     } finally {
//       setLoading(false);
//     }
//   }, [threadItemId]);

//   useEffect(() => {
//     if (!initialText) {
//       loadTtsText();
//     }
//   }, [initialText, loadTtsText]);

//   const handleListen = () => {
//     if (!ttsText) return;
    
//     // Use native browser TTS
//     if (isPlaying) {
//       window.speechSynthesis.cancel();
//       setIsPlaying(false);
//       return;
//     }

//     setIsPlaying(true);
//     const utterance = new SpeechSynthesisUtterance(ttsText);
    
//     // Language detection
//     const chineseCount = (ttsText.match(/[\u4e00-\u9fff]/g) || []).length;
//     const totalLength = ttsText.replace(/\s/g, '').length;
//     utterance.lang = (totalLength > 0 && chineseCount / totalLength > 0.3) ? 'zh-CN' : 'en-US';
    
//     // Apply selected speed
//     utterance.rate = speed;

//     utterance.onend = () => setIsPlaying(false);
//     utterance.onerror = () => setIsPlaying(false);
    
//     window.speechSynthesis.speak(utterance);
//   };

//   const changeSpeed = (newSpeed: number) => {
//     setSpeed(newSpeed);
//     setShowSpeedMenu(false);

//     // If currently playing, stop and restart with new speed
//     if (isPlaying) {
//       window.speechSynthesis.cancel();
//       setIsPlaying(false);
      
//       setTimeout(() => {
//         setIsPlaying(true);
//         const utterance = new SpeechSynthesisUtterance(ttsText);
//         const chineseCount = (ttsText.match(/[\u4e00-\u9fff]/g) || []).length;
//         const totalLength = ttsText.replace(/\s/g, '').length;
//         utterance.lang = (totalLength > 0 && chineseCount / totalLength > 0.3) ? 'zh-CN' : 'en-US';
//         utterance.rate = newSpeed;
        
//         utterance.onend = () => setIsPlaying(false);
//         utterance.onerror = () => setIsPlaying(false);
        
//         window.speechSynthesis.speak(utterance);
//       }, 100);
//     }
//   };

//   if (loading) {
//     return (
//       <div style={{ marginTop: '10px' }}>
//         <span style={{ fontSize: '12px', color: '#999', padding: '10px' }}>Loading TTS...</span>
//       </div>
//     );
//   }

//   return (
//     <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', position: 'relative' }}>
//       <button 
//         onClick={handleListen} 
//         style={{
//           background: isPlaying ? '#E74C3C' : '#4A90D9',
//           color: '#FFF',
//           border: 'none',
//           padding: '8px 16px',
//           borderRadius: '20px',
//           cursor: !ttsText ? 'not-allowed' : 'pointer',
//           fontSize: '15px',
//           fontWeight: 600,
//           minWidth: '100px'
//         }}
//         disabled={!ttsText || loading}
//       >
//         {isPlaying ? '⏹ Stop' : '🔊 Listen'}
//       </button>

//       <button 
//         onClick={() => setShowSpeedMenu(!showSpeedMenu)} 
//         style={{
//           marginLeft: '12px',
//           padding: '8px 12px',
//           backgroundColor: '#F0F0F0',
//           border: 'none',
//           borderRadius: '16px',
//           cursor: 'pointer',
//           fontSize: '14px',
//           fontWeight: 500
//         }}
//         disabled={loading}
//       >
//         {speed}x ▾
//       </button>

//       {showSpeedMenu && (
//         <div style={{
//           position: 'absolute',
//           top: '45px',
//           left: '120px',
//           backgroundColor: '#FFFFFF',
//           borderRadius: '12px',
//           padding: '8px',
//           boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
//           zIndex: 100,
//           display: 'flex',
//           flexWrap: 'wrap',
//           width: '160px'
//         }}>
//           {SPEED_OPTIONS.map((s) => (
//             <div 
//               key={s} 
//               onClick={() => changeSpeed(s)}
//               style={{
//                 padding: '6px 12px',
//                 borderRadius: '8px',
//                 margin: '2px',
//                 cursor: 'pointer',
//                 width: '40px',
//                 textAlign: 'center',
//                 fontSize: '13px',
//                 backgroundColor: s === speed ? '#4A90D9' : '#fff',
//                 color: s === speed ? '#fff' : '#333',
//               }}
//             >
//               {s}x
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// import React, { useState, useEffect, useCallback } from 'react';
// import { database } from '../db/Database';

// const B8_MINI_PC_URL = 'http://192.168.0.151:5018';

// export function TTSButton({ threadItemId, initialText }: { threadItemId: string, initialText?: string }) {
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [ttsText, setTtsText] = useState(initialText || '');

//   // FIX: Wrap loadTtsText in useCallback so it has a stable reference
//   const loadTtsText = useCallback(async () => {
//     try {
//       const localItem = await database.getThreadItemById(threadItemId);
//       if (localItem?.tts_text) { 
//         setTtsText(localItem.tts_text); 
//         return; 
//       }
//       const response = await fetch(`${B8_MINI_PC_URL}/api/thread-item/${threadItemId}`);
//       const data = await response.json();
//       if (data.item?.tts_text) {
//         setTtsText(data.item.tts_text);
//         await database.updateTtsText(threadItemId, data.item.tts_text);
//       }
//     } catch (e) {}
//   }, [threadItemId]); // Dependency on threadItemId

//   // FIX: Include initialText and loadTtsText in the dependency array
//   useEffect(() => { 
//     if (!initialText) loadTtsText(); 
//   }, [initialText, loadTtsText]);

//   const handleListen = () => {
//     if (!ttsText) return;
    
//     // Use native browser TTS
//     if (isPlaying) {
//       window.speechSynthesis.cancel();
//       setIsPlaying(false);
//       return;
//     }

//     const utterance = new SpeechSynthesisUtterance(ttsText);
//     utterance.lang = ((ttsText.match(/[\u4e00-\u9fff]/g) || []).length / ttsText.length > 0.3) ? 'zh-CN' : 'en-US';
//     utterance.onend = () => setIsPlaying(false);
//     utterance.onerror = () => setIsPlaying(false);
    
//     window.speechSynthesis.speak(utterance);
//     setIsPlaying(true);
//   };

//   return (
//     <button onClick={handleListen} disabled={!ttsText} style={{ background: isPlaying ? '#E74C3C' : '#4A90D9', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', marginTop: '10px' }}>
//       {isPlaying ? '⏹ Stop' : '🔊 Listen'}
//     </button>
//   );
// }
