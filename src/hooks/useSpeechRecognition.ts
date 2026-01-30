'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface UseSpeechRecognitionReturn {
  transcript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
  error: string | null;
}

// Check if running as installed PWA
function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// Check if iOS
function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function useSpeechRecognition(lang: string = 'en-US'): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // iOS PWA limitation: Speech Recognition doesn't work in standalone mode
      if (isIOS() && isStandalonePWA()) {
        setError('Voice input is not supported in iOS PWA mode. Please use Safari browser instead.');
        setIsSupported(false);
        return;
      }

      // Check for secure context (HTTPS required)
      if (!window.isSecureContext) {
        setError('Voice input requires HTTPS. Please use a secure connection.');
        setIsSupported(false);
        return;
      }

      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = lang;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const current = event.resultIndex;
          const result = event.results[current][0].transcript;
          setTranscript(result);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          // Provide user-friendly error messages
          let errorMessage = event.error;
          switch (event.error) {
            case 'not-allowed':
              errorMessage = 'Microphone access denied. Please enable microphone permission in your browser/device settings.';
              break;
            case 'network':
              errorMessage = 'Network error. Voice recognition requires an internet connection.';
              break;
            case 'no-speech':
              errorMessage = 'No speech detected. Please try again.';
              break;
            case 'audio-capture':
              errorMessage = 'No microphone found. Please check your device settings.';
              break;
          }
          setError(errorMessage);
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        setIsSupported(true);
      } else {
        setError('Speech recognition not supported in this browser');
      }
    }
  }, [lang]);

  const startListening = useCallback(async () => {
    if (recognitionRef.current) {
      setTranscript('');
      setError(null);
      
      // Request microphone permission explicitly (helps with PWA)
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        console.error('Microphone permission denied:', e);
        setError('Microphone access denied. Please enable microphone permission.');
        return;
      }
      
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error('Failed to start recognition:', e);
        setError('Failed to start voice recognition. Please try again.');
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return { 
    transcript, 
    isListening, 
    startListening, 
    stopListening, 
    isSupported,
    error 
  };
}
