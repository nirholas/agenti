/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 True accessibility is invisible to those who don't need it,
 *    but life-changing for those who do ♿
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Accessibility,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Hand,
  Brain,
  Moon,
  Sun,
  Type,
  Palette,
  MousePointer2,
  Keyboard,
  Zap,
  Settings,
  Download,
  Upload,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  HelpCircle,
  Sparkles,
  X,
  Check,
  Ear,
  Focus,
  Glasses,
  Move,
  Timer,
  MessageSquare
} from 'lucide-react';
import { useAccessibilityStore, AccessibilitySettings } from '@/stores/accessibilityStore';

interface AccessibilityPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccessibilityPanel({ isOpen, onClose }: AccessibilityPanelProps) {
  const { settings, updateSetting, resetSettings, applyProfile, exportSettings, importSettings, speak } = useAccessibilityStore();
  const [activeTab, setActiveTab] = useState<'profiles' | 'vision' | 'audio' | 'motor' | 'cognitive' | 'advanced'>('profiles');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Trap focus in panel
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const focusableElements = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }
  }, [isOpen]);

  // Announce panel open
  useEffect(() => {
    if (isOpen) {
      speak('Accessibility settings panel opened. Use Tab to navigate options.');
    }
  }, [isOpen, speak]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'profiles', label: 'Quick Profiles', icon: Sparkles },
    { id: 'vision', label: 'Vision', icon: Eye },
    { id: 'audio', label: 'Audio & Speech', icon: Volume2 },
    { id: 'motor', label: 'Motor', icon: Hand },
    { id: 'cognitive', label: 'Cognitive', icon: Brain },
    { id: 'advanced', label: 'Advanced', icon: Settings },
  ];

  const handleExport = () => {
    const data = exportSettings();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lyra-accessibility-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    speak('Settings exported successfully');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const success = importSettings(event.target?.result as string);
        speak(success ? 'Settings imported successfully' : 'Failed to import settings');
      };
      reader.readAsText(file);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-panel-title"
    >
      <div 
        ref={panelRef}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{
          fontSize: 'var(--a11y-font-size, 16px)',
          lineHeight: 'var(--a11y-line-height, 1.5)',
          letterSpacing: 'var(--a11y-letter-spacing, 0)',
          fontFamily: 'var(--a11y-font-family, inherit)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
          <div className="flex items-center gap-3">
            <Accessibility className="w-8 h-8" aria-hidden="true" />
            <div>
              <h2 id="a11y-panel-title" className="text-2xl font-bold">
                Accessibility Settings
              </h2>
              <p className="text-sm text-white/80">
                Customize your experience for your needs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Close accessibility settings"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              onClick={() => {
                setActiveTab(tab.id as any);
                speak(tab.label);
              }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Profiles Tab */}
          {activeTab === 'profiles' && (
            <div className="space-y-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Quick profiles optimize multiple settings at once. Choose the profile that best matches your needs:
              </p>
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <ProfileCard
                  icon={Eye}
                  title="Low Vision"
                  description="Larger text, enhanced contrast, bigger cursors, and focus indicators"
                  onClick={() => {
                    applyProfile('vision');
                    speak('Low vision profile applied');
                  }}
                  color="blue"
                />
                <ProfileCard
                  icon={EyeOff}
                  title="Screen Reader / Blind"
                  description="Optimized for JAWS, NVDA, VoiceOver with natural code reading"
                  onClick={() => {
                    applyProfile('blind');
                    speak('Screen reader profile applied');
                  }}
                  color="purple"
                />
                <ProfileCard
                  icon={Ear}
                  title="Deaf / Hard of Hearing"
                  description="Visual sound indicators, no audio cues, enhanced visual feedback"
                  onClick={() => {
                    applyProfile('deaf');
                    speak('Deaf and hard of hearing profile applied');
                  }}
                  color="green"
                />
                <ProfileCard
                  icon={Hand}
                  title="Motor Impairment"
                  description="Large click targets, keyboard navigation, dwell click, sticky keys"
                  onClick={() => {
                    applyProfile('motor');
                    speak('Motor impairment profile applied');
                  }}
                  color="orange"
                />
                <ProfileCard
                  icon={Brain}
                  title="Cognitive / ADHD"
                  description="Simplified UI, reading guide, focus mode, reduced distractions"
                  onClick={() => {
                    applyProfile('cognitive');
                    speak('Cognitive accessibility profile applied');
                  }}
                  color="pink"
                />
                <ProfileCard
                  icon={RotateCcw}
                  title="Reset to Default"
                  description="Clear all customizations and return to default settings"
                  onClick={() => {
                    resetSettings();
                    speak('Settings reset to default');
                  }}
                  color="gray"
                />
              </div>
            </div>
          )}

          {/* Vision Tab */}
          {activeTab === 'vision' && (
            <div className="space-y-6">
              <SettingGroup title="Text & Typography" icon={Type}>
                <SelectSetting
                  label="Font Size"
                  value={settings.fontSize}
                  options={[
                    { value: 'normal', label: 'Normal (16px)' },
                    { value: 'large', label: 'Large (18px)' },
                    { value: 'x-large', label: 'Extra Large (20px)' },
                    { value: 'xx-large', label: 'Huge (24px)' },
                  ]}
                  onChange={(v) => updateSetting('fontSize', v as any)}
                />
                <SelectSetting
                  label="Font Family"
                  value={settings.fontFamily}
                  options={[
                    { value: 'default', label: 'Default' },
                    { value: 'dyslexia', label: 'Dyslexia-Friendly (OpenDyslexic)' },
                    { value: 'monospace', label: 'Monospace' },
                    { value: 'sans-serif', label: 'Simple Sans-Serif' },
                  ]}
                  onChange={(v) => updateSetting('fontFamily', v as any)}
                />
                <SelectSetting
                  label="Line Height"
                  value={settings.lineHeight}
                  options={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'relaxed', label: 'Relaxed (1.75x)' },
                    { value: 'loose', label: 'Loose (2x)' },
                  ]}
                  onChange={(v) => updateSetting('lineHeight', v as any)}
                />
                <SelectSetting
                  label="Letter Spacing"
                  value={settings.letterSpacing}
                  options={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'wide', label: 'Wide' },
                    { value: 'wider', label: 'Extra Wide' },
                  ]}
                  onChange={(v) => updateSetting('letterSpacing', v as any)}
                />
              </SettingGroup>

              <SettingGroup title="Contrast & Colors" icon={Palette}>
                <ToggleSetting
                  label="High Contrast Mode"
                  description="Increase color contrast for better visibility"
                  checked={settings.highContrast}
                  onChange={(v) => updateSetting('highContrast', v)}
                />
                <SelectSetting
                  label="Contrast Level"
                  value={settings.contrastLevel}
                  options={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'more', label: 'Enhanced' },
                    { value: 'maximum', label: 'Maximum' },
                  ]}
                  onChange={(v) => updateSetting('contrastLevel', v as any)}
                  disabled={!settings.highContrast}
                />
                <SelectSetting
                  label="Color Blindness Filter"
                  value={settings.colorBlindMode}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'protanopia', label: 'Protanopia (Red-Blind)' },
                    { value: 'deuteranopia', label: 'Deuteranopia (Green-Blind)' },
                    { value: 'tritanopia', label: 'Tritanopia (Blue-Blind)' },
                    { value: 'achromatopsia', label: 'Achromatopsia (Grayscale)' },
                  ]}
                  onChange={(v) => updateSetting('colorBlindMode', v as any)}
                />
                <ToggleSetting
                  label="Reduce Transparency"
                  description="Make transparent elements more opaque"
                  checked={settings.reducedTransparency}
                  onChange={(v) => updateSetting('reducedTransparency', v)}
                />
              </SettingGroup>

              <SettingGroup title="Cursor & Focus" icon={MousePointer2}>
                <SelectSetting
                  label="Cursor Size"
                  value={settings.cursorSize}
                  options={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'large', label: 'Large' },
                    { value: 'x-large', label: 'Extra Large' },
                  ]}
                  onChange={(v) => updateSetting('cursorSize', v as any)}
                />
                <SelectSetting
                  label="Focus Indicator"
                  value={settings.focusIndicator}
                  options={[
                    { value: 'default', label: 'Default' },
                    { value: 'enhanced', label: 'Enhanced (Thicker outline)' },
                    { value: 'maximum', label: 'Maximum (High contrast box)' },
                  ]}
                  onChange={(v) => updateSetting('focusIndicator', v as any)}
                />
              </SettingGroup>

              <SettingGroup title="Motion & Animation" icon={Move}>
                <ToggleSetting
                  label="Reduce Motion"
                  description="Minimize animations and transitions"
                  checked={settings.reducedMotion}
                  onChange={(v) => updateSetting('reducedMotion', v)}
                />
                <ToggleSetting
                  label="Pause All Animations"
                  description="Completely stop all moving elements"
                  checked={settings.pauseAnimations}
                  onChange={(v) => updateSetting('pauseAnimations', v)}
                />
              </SettingGroup>
            </div>
          )}

          {/* Audio Tab */}
          {activeTab === 'audio' && (
            <div className="space-y-6">
              <SettingGroup title="Text to Speech" icon={Volume2}>
                <ToggleSetting
                  label="Enable Text to Speech"
                  description="Read content aloud when interacting"
                  checked={settings.textToSpeech}
                  onChange={(v) => updateSetting('textToSpeech', v)}
                />
                <RangeSetting
                  label="Speech Rate"
                  value={settings.speechRate}
                  min={0.5}
                  max={2}
                  step={0.1}
                  onChange={(v) => updateSetting('speechRate', v)}
                  disabled={!settings.textToSpeech}
                />
                <RangeSetting
                  label="Speech Pitch"
                  value={settings.speechPitch}
                  min={0.5}
                  max={2}
                  step={0.1}
                  onChange={(v) => updateSetting('speechPitch', v)}
                  disabled={!settings.textToSpeech}
                />
                <ToggleSetting
                  label="Read Code Naturally"
                  description="Convert symbols to words (e.g., '===' becomes 'strictly equals')"
                  checked={settings.speakCodeNaturally}
                  onChange={(v) => updateSetting('speakCodeNaturally', v)}
                  disabled={!settings.textToSpeech}
                />
                <button
                  onClick={() => speak('This is a test of the text to speech feature. Hello world function open parenthesis close parenthesis.')}
                  className="btn-secondary text-sm"
                  disabled={!settings.textToSpeech}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Test Speech
                </button>
              </SettingGroup>

              <SettingGroup title="Screen Reader Optimization" icon={MessageSquare}>
                <ToggleSetting
                  label="Screen Reader Mode"
                  description="Optimize for JAWS, NVDA, VoiceOver"
                  checked={settings.screenReaderOptimized}
                  onChange={(v) => updateSetting('screenReaderOptimized', v)}
                />
                <ToggleSetting
                  label="Announce Page Changes"
                  description="Speak when navigating to new pages"
                  checked={settings.announcePageChanges}
                  onChange={(v) => updateSetting('announcePageChanges', v)}
                />
                <ToggleSetting
                  label="Describe Code as Natural Language"
                  description="Make code blocks easier to understand"
                  checked={settings.codeAsNaturalLanguage}
                  onChange={(v) => updateSetting('codeAsNaturalLanguage', v)}
                />
              </SettingGroup>

              <SettingGroup title="For Deaf / Hard of Hearing" icon={Ear}>
                <ToggleSetting
                  label="Visual Sound Indicators"
                  description="Show visual pulses when sounds play"
                  checked={settings.visualSoundIndicators}
                  onChange={(v) => updateSetting('visualSoundIndicators', v)}
                />
                <ToggleSetting
                  label="Sound Effects"
                  description="Play sounds for actions (disable for silent mode)"
                  checked={settings.soundEffects}
                  onChange={(v) => updateSetting('soundEffects', v)}
                />
              </SettingGroup>
            </div>
          )}

          {/* Motor Tab */}
          {activeTab === 'motor' && (
            <div className="space-y-6">
              <SettingGroup title="Click & Touch Targets" icon={MousePointer2}>
                <ToggleSetting
                  label="Large Click Targets"
                  description="Increase button and link sizes for easier clicking"
                  checked={settings.largeClickTargets}
                  onChange={(v) => updateSetting('largeClickTargets', v)}
                />
                <ToggleSetting
                  label="Dwell Click"
                  description="Click by hovering over elements"
                  checked={settings.dwellClick}
                  onChange={(v) => updateSetting('dwellClick', v)}
                />
                <RangeSetting
                  label="Dwell Time (ms)"
                  value={settings.dwellTime}
                  min={500}
                  max={3000}
                  step={100}
                  onChange={(v) => updateSetting('dwellTime', v)}
                  disabled={!settings.dwellClick}
                />
              </SettingGroup>

              <SettingGroup title="Keyboard" icon={Keyboard}>
                <ToggleSetting
                  label="Keyboard Only Mode"
                  description="Hide mouse-only interactions, enhance keyboard navigation"
                  checked={settings.keyboardOnly}
                  onChange={(v) => updateSetting('keyboardOnly', v)}
                />
                <ToggleSetting
                  label="Sticky Keys"
                  description="Press modifier keys (Ctrl, Shift) one at a time"
                  checked={settings.stickyKeys}
                  onChange={(v) => updateSetting('stickyKeys', v)}
                />
              </SettingGroup>

              <SettingGroup title="Timing" icon={Timer}>
                <ToggleSetting
                  label="Extended Timeouts"
                  description="Allow more time for time-limited actions"
                  checked={settings.extendedTimeouts}
                  onChange={(v) => updateSetting('extendedTimeouts', v)}
                />
                <ToggleSetting
                  label="Confirm Destructive Actions"
                  description="Ask for confirmation before delete, reset, etc."
                  checked={settings.confirmActions}
                  onChange={(v) => updateSetting('confirmActions', v)}
                />
              </SettingGroup>
            </div>
          )}

          {/* Cognitive Tab */}
          {activeTab === 'cognitive' && (
            <div className="space-y-6">
              <SettingGroup title="Simplified Experience" icon={Sparkles}>
                <ToggleSetting
                  label="Simplified UI"
                  description="Hide advanced features, show only essentials"
                  checked={settings.simplifiedUI}
                  onChange={(v) => updateSetting('simplifiedUI', v)}
                />
                <ToggleSetting
                  label="Focus Mode"
                  description="Dim non-essential parts of the page"
                  checked={settings.focusMode}
                  onChange={(v) => updateSetting('focusMode', v)}
                />
              </SettingGroup>

              <SettingGroup title="Reading Assistance" icon={Glasses}>
                <ToggleSetting
                  label="Reading Guide"
                  description="Highlight the line you're reading"
                  checked={settings.readingGuide}
                  onChange={(v) => updateSetting('readingGuide', v)}
                />
                <div className="flex items-center gap-4">
                  <label className="text-sm text-gray-700 dark:text-gray-300">Guide Color:</label>
                  <input
                    type="color"
                    value={settings.readingGuideColor}
                    onChange={(e) => updateSetting('readingGuideColor', e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer"
                    disabled={!settings.readingGuide}
                  />
                </div>
                <ToggleSetting
                  label="Auto Read Aloud"
                  description="Automatically read selected text"
                  checked={settings.autoReadAloud}
                  onChange={(v) => updateSetting('autoReadAloud', v)}
                />
              </SettingGroup>

              <SettingGroup title="Help & Guidance" icon={HelpCircle}>
                <ToggleSetting
                  label="Show Tooltips Longer"
                  description="Keep helpful hints visible longer"
                  checked={settings.showTooltipsLonger}
                  onChange={(v) => updateSetting('showTooltipsLonger', v)}
                />
              </SettingGroup>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <SettingGroup title="Import / Export Settings" icon={Settings}>
                <div className="flex gap-4">
                  <button onClick={handleExport} className="btn-secondary">
                    <Download className="w-4 h-4 mr-2" />
                    Export Settings
                  </button>
                  <button 
                    onClick={() => importInputRef.current?.click()} 
                    className="btn-secondary"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import Settings
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </div>
              </SettingGroup>

              <SettingGroup title="Custom CSS" icon={Palette}>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Add your own CSS to further customize the experience:
                </p>
                <textarea
                  value={settings.customCSS}
                  onChange={(e) => updateSetting('customCSS', e.target.value)}
                  placeholder="/* Your custom CSS here */
body { }
.btn { }"
                  className="w-full h-32 p-3 font-mono text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-none"
                />
              </SettingGroup>

              <SettingGroup title="Content Description" icon={MessageSquare}>
                <ToggleSetting
                  label="Describe Tables"
                  description="Add summary descriptions to data tables"
                  checked={settings.describeTables}
                  onChange={(v) => updateSetting('describeTables', v)}
                />
                <ToggleSetting
                  label="Describe Images"
                  description="Show enhanced alt text for images"
                  checked={settings.describeImages}
                  onChange={(v) => updateSetting('describeImages', v)}
                />
                <ToggleSetting
                  label="Math as Text"
                  description="Convert mathematical formulas to readable text"
                  checked={settings.mathAsText}
                  onChange={(v) => updateSetting('mathAsText', v)}
                />
              </SettingGroup>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <p className="text-sm text-gray-500">
            <Keyboard className="w-4 h-4 inline mr-1" />
            Press <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd> to close
          </p>
          <button
            onClick={onClose}
            className="btn-primary"
          >
            <Check className="w-4 h-4 mr-2" />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-components

function ProfileCard({ icon: Icon, title, description, onClick, color }: {
  icon: typeof Eye;
  title: string;
  description: string;
  onClick: () => void;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    purple: 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
    green: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
    orange: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
    pink: 'from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700',
    gray: 'from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700',
  };

  return (
    <button
      onClick={onClick}
      className={`p-6 rounded-xl bg-gradient-to-br ${colors[color]} text-white text-left transition-all hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-${color}-500`}
    >
      <Icon className="w-8 h-8 mb-3" aria-hidden="true" />
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-white/80">{description}</p>
    </button>
  );
}

function SettingGroup({ title, icon: Icon, children }: {
  title: string;
  icon: typeof Eye;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <Icon className="w-5 h-5 text-primary-600" aria-hidden="true" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="p-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

function ToggleSetting({ label, description, checked, onChange, disabled }: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  
  return (
    <div className={`flex items-center justify-between ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <label htmlFor={id} className="font-medium text-gray-900 dark:text-white cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors ${
          checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

function SelectSetting({ label, value, options, onChange, disabled }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${disabled ? 'opacity-50' : ''}`}>
      <label className="font-medium text-gray-900 dark:text-white">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function RangeSetting({ label, value, min, max, step, onChange, disabled }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <label className="font-medium text-gray-900 dark:text-white">{label}</label>
        <span className="text-sm text-gray-500">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}
