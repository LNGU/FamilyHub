'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface UseSpeechSynthesisReturn {
  speak: (text: string, lang?: string) => void;
  cancel: () => void;
  isSpeaking: boolean;
  voices: SpeechSynthesisVoice[];
  isSupported: boolean;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const englishVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const koreanVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      setIsSupported(true);
      
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length === 0) return;
        
        setVoices(availableVoices);
        
        // Find good English voice (prefer natural/premium voices)
        englishVoiceRef.current = availableVoices.find(v => 
          v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Premium'))
        ) || availableVoices.find(v => v.lang.startsWith('en-US')) 
          || availableVoices.find(v => v.lang.startsWith('en')) 
          || null;
        
        // Find Korean voice
        koreanVoiceRef.current = availableVoices.find(v => 
          v.lang.startsWith('ko')
        ) || null;
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
      
      // iOS fix: voices may load async
      setTimeout(loadVoices, 100);
      setTimeout(loadVoices, 500);
    }
  }, []);

  // iOS fix: Keep speech synthesis alive
  useEffect(() => {
    if (!isSupported) return;
    
    const keepAlive = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 5000);
    
    return () => clearInterval(keepAlive);
  }, [isSupported]);

  const speak = useCallback((text: string, lang: string = 'en-US') => {
    if (!text || !isSupported) return;
    
    window.speechSynthesis.cancel();
    
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      
      if (lang.startsWith('ko') && koreanVoiceRef.current) {
        utterance.voice = koreanVoiceRef.current;
        utterance.lang = 'ko-KR';
      } else if (englishVoiceRef.current) {
        utterance.voice = englishVoiceRef.current;
        utterance.lang = 'en-US';
      } else {
        utterance.lang = lang;
      }
      
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
        // Ignore 'interrupted' and 'canceled' errors - they're normal when canceling speech
        if (e.error === 'interrupted' || e.error === 'canceled' || !e.error) {
          setIsSpeaking(false);
          return;
        }
        console.error('Speech synthesis error:', e.error);
        setIsSpeaking(false);
      };
      
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
      
      setTimeout(() => {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }, 100);
    }, 50);
  }, [isSupported]);

  const cancel = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  return { speak, cancel, isSpeaking, voices, isSupported };
}
