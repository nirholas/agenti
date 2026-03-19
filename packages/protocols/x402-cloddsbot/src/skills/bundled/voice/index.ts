/**
 * Voice CLI Skill
 *
 * Commands:
 * /voice start - Start voice recognition
 * /voice stop - Stop voice recognition
 * /voice status - Show voice state and config
 * /voice config - Show/update detailed voice config
 * /voice wake <word> - Set wake word
 * /voice test [text] - Test TTS output
 * /voice voices - List system voices
 * /voice language <lang> - Set voice language
 * /voice sensitivity <high|medium|low> - Set wake word sensitivity
 * /voice timeout <seconds> - Set listen timeout
 * /voice continuous <on|off> - Toggle continuous listening
 */

let activeAssistant: any = null;

// Persistent config overrides (stored in-memory for the session)
const voiceConfigOverrides: Record<string, any> = {};

async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || 'help';

  try {
    const {
      VoiceRecognition,
      TextToSpeech,
      VoiceAssistant,
      createVoiceAssistant,
    } = await import('../../../voice/index');

    switch (cmd) {
      case 'start': {
        const config: Record<string, any> = { ...voiceConfigOverrides };
        // Parse optional flags
        const engineIdx = parts.indexOf('--engine');
        if (engineIdx >= 0) config.sttEngine = parts[engineIdx + 1];
        const langIdx = parts.indexOf('--lang');
        if (langIdx >= 0) config.language = parts[langIdx + 1];

        const assistant = createVoiceAssistant(config);
        activeAssistant = assistant;

        try {
          await assistant.start();
          return `**Voice Recognition Started**\n\n` +
            `STT Engine: ${config.sttEngine || 'whisper'}\n` +
            `Language: ${config.language || 'en-US'}\n` +
            `Wake word: "hey clodds"\n` +
            `Sensitivity: ${voiceConfigOverrides.sensitivity || 0.5}\n` +
            `Continuous: ${voiceConfigOverrides.continuous ? 'on' : 'off'}\n\n` +
            `Listening for voice input... Stop with /voice stop`;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return `**Voice Start Failed**\n\n${msg}\n\nMake sure whisper or vosk is installed and a microphone is available.`;
        }
      }

      case 'stop': {
        if (activeAssistant) {
          activeAssistant.stop();
          activeAssistant = null;
          return 'Voice recognition stopped.';
        }
        const recognition = new VoiceRecognition();
        recognition.stopListening();
        return 'Voice recognition stopped (no active assistant found, attempted fallback).';
      }

      case 'status': {
        const recognition = new VoiceRecognition();
        const tts = new TextToSpeech();
        const sttAvailable = await recognition.isAvailable();
        const ttsAvailable = await tts.isAvailable();

        return `**Voice Status**\n\n` +
          `STT available: ${sttAvailable ? 'Yes' : 'No (install whisper or vosk)'}\n` +
          `TTS available: ${ttsAvailable ? 'Yes' : 'No (install say or espeak)'}\n` +
          `Default STT engine: ${voiceConfigOverrides.sttEngine || 'whisper'}\n` +
          `Default TTS engine: ${voiceConfigOverrides.ttsEngine || 'say'}\n` +
          `Language: ${voiceConfigOverrides.language || 'en-US'}\n` +
          `Sensitivity: ${voiceConfigOverrides.sensitivity || 0.5}\n` +
          `Continuous: ${voiceConfigOverrides.continuous ? 'on' : 'off'}\n` +
          `Timeout: ${voiceConfigOverrides.timeout || 'default'}s\n` +
          `Active assistant: ${activeAssistant ? 'Yes' : 'No'}`;
      }

      case 'config': {
        const sttEngineIdx = parts.indexOf('--stt');
        const ttsEngineIdx = parts.indexOf('--tts');
        const langIdx = parts.indexOf('--lang');
        const sensitivityIdx = parts.indexOf('--sensitivity');
        const wakeIdx = parts.indexOf('--wake');

        // If no flags, show current config
        if (sttEngineIdx < 0 && ttsEngineIdx < 0 && langIdx < 0 && sensitivityIdx < 0 && wakeIdx < 0) {
          const recognition = new VoiceRecognition();
          const sttAvailable = await recognition.isAvailable();

          return `**Voice Config**\n\n` +
            `STT Engine: ${voiceConfigOverrides.sttEngine || 'whisper'} ${sttAvailable ? '(available)' : '(not found)'}\n` +
            `TTS Engine: ${voiceConfigOverrides.ttsEngine || 'say'}\n` +
            `Wake Word: "${voiceConfigOverrides.wakeWord || 'hey clodds'}"\n` +
            `Language: ${voiceConfigOverrides.language || 'en-US'}\n` +
            `Sample Rate: 16000 Hz\n` +
            `Sensitivity: ${voiceConfigOverrides.sensitivity || 0.5}\n` +
            `Timeout: ${voiceConfigOverrides.timeout || 'default'}s\n` +
            `Continuous: ${voiceConfigOverrides.continuous ? 'on' : 'off'}\n` +
            `Silence Threshold: 500ms\n` +
            `Silence Duration: 1500ms\n` +
            `Audio Device: default\n\n` +
            `Supported STT: whisper, vosk\n` +
            `Supported TTS: say (macOS), espeak (Linux)`;
        }

        // Build config from flags
        const configParts: string[] = [];
        if (sttEngineIdx >= 0) {
          voiceConfigOverrides.sttEngine = parts[sttEngineIdx + 1];
          configParts.push(`STT Engine: ${parts[sttEngineIdx + 1]}`);
        }
        if (ttsEngineIdx >= 0) {
          voiceConfigOverrides.ttsEngine = parts[ttsEngineIdx + 1];
          configParts.push(`TTS Engine: ${parts[ttsEngineIdx + 1]}`);
        }
        if (langIdx >= 0) {
          voiceConfigOverrides.language = parts[langIdx + 1];
          configParts.push(`Language: ${parts[langIdx + 1]}`);
        }
        if (sensitivityIdx >= 0) {
          voiceConfigOverrides.sensitivity = parseFloat(parts[sensitivityIdx + 1]) || 0.5;
          configParts.push(`Sensitivity: ${parts[sensitivityIdx + 1]}`);
        }
        if (wakeIdx >= 0) {
          const wakeWord = parts.slice(wakeIdx + 1).join(' ');
          voiceConfigOverrides.wakeWord = wakeWord;
          configParts.push(`Wake Word: "${wakeWord}"`);
        }

        return `**Voice Config Updated**\n\n${configParts.join('\n')}`;
      }

      case 'wake': {
        const wakeWord = parts.slice(1).join(' ');
        if (!wakeWord) return 'Usage: /voice wake <word or phrase>\n\nExample: /voice wake hey clodds';

        voiceConfigOverrides.wakeWord = wakeWord;

        // Create a new recognition instance with the wake word
        const recognition = new VoiceRecognition({ wakeWord });
        const sttAvailable = await recognition.isAvailable();

        return `**Wake Word Updated**\n\n` +
          `Wake word: "${wakeWord}"\n` +
          `STT available: ${sttAvailable ? 'Yes' : 'No'}\n\n` +
          `Start listening with /voice start`;
      }

      case 'language':
      case 'lang': {
        const lang = parts[1];
        if (!lang) {
          return `**Current Language:** ${voiceConfigOverrides.language || 'en-US'}\n\n` +
            `Usage: /voice language <lang-code>\n\n` +
            `Examples:\n` +
            `  /voice lang en-US    (English - US)\n` +
            `  /voice lang en-GB    (English - UK)\n` +
            `  /voice lang es-ES    (Spanish)\n` +
            `  /voice lang fr-FR    (French)\n` +
            `  /voice lang de-DE    (German)\n` +
            `  /voice lang ja-JP    (Japanese)\n` +
            `  /voice lang zh-CN    (Chinese)`;
        }

        voiceConfigOverrides.language = lang;
        return `**Language Updated**\n\nLanguage set to: ${lang}\n\nRestart voice with /voice start to apply.`;
      }

      case 'sensitivity': {
        const level = parts[1]?.toLowerCase();
        const sensitivityMap: Record<string, number> = {
          low: 0.3,
          medium: 0.5,
          high: 0.8,
        };

        if (!level || !(level in sensitivityMap)) {
          const current = voiceConfigOverrides.sensitivity || 0.5;
          const currentLabel = current >= 0.7 ? 'high' : current >= 0.4 ? 'medium' : 'low';
          return `**Current Sensitivity:** ${currentLabel} (${current})\n\n` +
            `Usage: /voice sensitivity <high|medium|low>\n\n` +
            `  high   (0.8) - Triggers easily, more false positives\n` +
            `  medium (0.5) - Balanced (default)\n` +
            `  low    (0.3) - Harder to trigger, fewer false positives`;
        }

        voiceConfigOverrides.sensitivity = sensitivityMap[level];
        return `**Sensitivity Updated**\n\nWake word sensitivity set to: ${level} (${sensitivityMap[level]})\n\nRestart voice with /voice start to apply.`;
      }

      case 'timeout': {
        const seconds = parseInt(parts[1] || '', 10);

        if (isNaN(seconds) || seconds < 1) {
          return `**Current Timeout:** ${voiceConfigOverrides.timeout || 'default'}s\n\n` +
            `Usage: /voice timeout <seconds>\n\n` +
            `Sets how long to listen before timing out.\n` +
            `Example: /voice timeout 30`;
        }

        voiceConfigOverrides.timeout = seconds;
        return `**Timeout Updated**\n\nListen timeout set to: ${seconds}s\n\nRestart voice with /voice start to apply.`;
      }

      case 'continuous': {
        const value = parts[1]?.toLowerCase();

        if (!value || !['on', 'off', 'true', 'false', '1', '0'].includes(value)) {
          const current = voiceConfigOverrides.continuous ? 'on' : 'off';
          return `**Continuous Listening:** ${current}\n\n` +
            `Usage: /voice continuous <on|off>\n\n` +
            `When on, keeps listening after processing each command.\n` +
            `When off, stops after each wake word activation.`;
        }

        const enabled = ['on', 'true', '1'].includes(value);
        voiceConfigOverrides.continuous = enabled;
        return `**Continuous Listening ${enabled ? 'Enabled' : 'Disabled'}**\n\n` +
          `Voice will ${enabled ? 'keep listening' : 'stop'} after processing each command.\n\n` +
          `Restart voice with /voice start to apply.`;
      }

      case 'test': {
        const tts = new TextToSpeech();
        const available = await tts.isAvailable();
        if (!available) {
          return '**Voice Test Failed**\n\nTTS engine not available. Install `say` (macOS) or `espeak` (Linux).';
        }

        const testPhrase = parts.slice(1).join(' ') || 'Hello, voice test successful.';
        await tts.speak(testPhrase);
        return `**Voice Test**\n\nSpoke: "${testPhrase}"`;
      }

      case 'voices': {
        const tts = new TextToSpeech();
        const available = await tts.isAvailable();
        if (!available) {
          return '**System Voices**\n\nTTS engine not available.';
        }

        const voices = await tts.getVoices();
        if (voices.length === 0) {
          return '**System Voices**\n\nNo voices found.';
        }

        const listed = voices.slice(0, 20).map(v => `- ${v}`).join('\n');
        const more = voices.length > 20 ? `\n\n...and ${voices.length - 20} more` : '';
        return `**System Voices (${voices.length})**\n\n${listed}${more}`;
      }

      default:
        return helpText();
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function helpText(): string {
  return `**Voice Commands**

  /voice start [--engine whisper]    - Start listening
  /voice stop                        - Stop listening
  /voice status                      - Check availability
  /voice config                      - Show voice config
  /voice wake <word>                 - Set wake word
  /voice language <lang>             - Set voice language
  /voice sensitivity <high|med|low>  - Set wake sensitivity
  /voice timeout <seconds>           - Set listen timeout
  /voice continuous <on|off>         - Toggle continuous mode
  /voice test [text]                 - Test TTS output
  /voice voices                      - List system voices`;
}

export default {
  name: 'voice',
  description: 'Voice recognition, wake words, and voice-controlled trading',
  commands: ['/voice'],
  handle: execute,
};
