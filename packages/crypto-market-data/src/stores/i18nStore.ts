/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Innovation starts with a single keystroke ⌨️
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'en' | 'es' | 'zh' | 'fr' | 'de' | 'ja' | 'ko' | 'pt' | 'ru' | 'ar';

interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
  rtl?: boolean;
}

export const languages: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true }
];

// Translations dictionary
type TranslationKey = string;
type Translations = Record<Language, Record<TranslationKey, string>>;

const translations: Translations = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.examples': 'Examples',
    'nav.playground': 'Playground',
    'nav.sandbox': 'Sandbox',
    'nav.docs': 'Documentation',
    'nav.tutorials': 'Tutorials',
    'nav.about': 'About',
    'nav.faq': 'FAQ',
    'nav.community': 'Community',
    'nav.settings': 'Settings',
    
    // Hero
    'hero.title': 'Learn Web3 Development',
    'hero.subtitle': 'The Interactive Way',
    'hero.description': 'Build, deploy, and understand smart contracts with AI-powered tools and interactive tutorials.',
    'hero.cta.start': 'Start Building',
    'hero.cta.explore': 'Explore Examples',
    
    // Features
    'features.title': 'Revolutionary Features',
    'features.ai.title': 'AI Code Whisperer',
    'features.ai.description': 'Real-time AI analysis with voice control',
    'features.timemachine.title': 'Time Machine',
    'features.timemachine.description': 'Travel through code evolution',
    'features.exploit.title': 'Exploit Lab',
    'features.exploit.description': 'Learn security by hacking safely',
    'features.arena.title': 'Collaborative Arena',
    'features.arena.description': 'Code with AI teammates',
    'features.neural.title': 'Neural Gas Oracle',
    'features.neural.description': 'ML-powered gas optimization',
    'features.crosschain.title': 'Cross-Chain Deploy',
    'features.crosschain.description': 'Deploy to 8+ networks instantly',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.copy': 'Copy',
    'common.copied': 'Copied!',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.all': 'All',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.close': 'Close',
    'common.open': 'Open',
    'common.learn_more': 'Learn More',
    'common.get_started': 'Get Started',
    
    // Sandbox
    'sandbox.compile': 'Compile',
    'sandbox.deploy': 'Deploy',
    'sandbox.compiling': 'Compiling...',
    'sandbox.deploying': 'Deploying...',
    'sandbox.console': 'Console',
    'sandbox.files': 'Files',
    'sandbox.interaction': 'Interact',
    'sandbox.innovation': 'Innovation Mode',
    'sandbox.activate_innovation': 'Activate Innovation',
    
    // About
    'about.title': 'About Us',
    'about.mission': 'Our Mission',
    'about.vision': 'Our Vision',
    'about.team': 'Meet the Team',
    'about.values': 'Our Values',
    'about.join': 'Join Our Mission',
    
    // Docs
    'docs.title': 'Documentation',
    'docs.search_placeholder': 'Search documentation...',
    'docs.getting_started': 'Getting Started',
    'docs.quick_links': 'Quick Links',
    'docs.read_time': 'min read',
    
    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.theme.system': 'System',
    'settings.notifications': 'Notifications',
    'settings.privacy': 'Privacy',
    
    // Footer
    'footer.rights': 'All rights reserved',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms of Service',
  },
  
  es: {
    // Navigation
    'nav.home': 'Inicio',
    'nav.examples': 'Ejemplos',
    'nav.playground': 'Playground',
    'nav.sandbox': 'Sandbox',
    'nav.docs': 'Documentación',
    'nav.tutorials': 'Tutoriales',
    'nav.about': 'Acerca de',
    'nav.faq': 'FAQ',
    'nav.community': 'Comunidad',
    'nav.settings': 'Configuración',
    
    // Hero
    'hero.title': 'Aprende Desarrollo Web3',
    'hero.subtitle': 'De Forma Interactiva',
    'hero.description': 'Construye, despliega y entiende contratos inteligentes con herramientas impulsadas por IA y tutoriales interactivos.',
    'hero.cta.start': 'Comenzar a Construir',
    'hero.cta.explore': 'Explorar Ejemplos',
    
    // Features
    'features.title': 'Características Revolucionarias',
    'features.ai.title': 'AI Code Whisperer',
    'features.ai.description': 'Análisis de IA en tiempo real con control por voz',
    'features.timemachine.title': 'Máquina del Tiempo',
    'features.timemachine.description': 'Viaja a través de la evolución del código',
    'features.exploit.title': 'Laboratorio de Exploits',
    'features.exploit.description': 'Aprende seguridad hackeando de forma segura',
    'features.arena.title': 'Arena Colaborativa',
    'features.arena.description': 'Programa con compañeros de IA',
    'features.neural.title': 'Oráculo Neural de Gas',
    'features.neural.description': 'Optimización de gas con ML',
    'features.crosschain.title': 'Despliegue Multi-Cadena',
    'features.crosschain.description': 'Despliega en 8+ redes al instante',
    
    // Common
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.copy': 'Copiar',
    'common.copied': '¡Copiado!',
    'common.search': 'Buscar',
    'common.filter': 'Filtrar',
    'common.all': 'Todo',
    'common.back': 'Atrás',
    'common.next': 'Siguiente',
    'common.previous': 'Anterior',
    'common.close': 'Cerrar',
    'common.open': 'Abrir',
    'common.learn_more': 'Saber Más',
    'common.get_started': 'Comenzar',
    
    // Sandbox
    'sandbox.compile': 'Compilar',
    'sandbox.deploy': 'Desplegar',
    'sandbox.compiling': 'Compilando...',
    'sandbox.deploying': 'Desplegando...',
    'sandbox.console': 'Consola',
    'sandbox.files': 'Archivos',
    'sandbox.interaction': 'Interactuar',
    'sandbox.innovation': 'Modo Innovación',
    'sandbox.activate_innovation': 'Activar Innovación',
    
    // About
    'about.title': 'Sobre Nosotros',
    'about.mission': 'Nuestra Misión',
    'about.vision': 'Nuestra Visión',
    'about.team': 'Conoce al Equipo',
    'about.values': 'Nuestros Valores',
    'about.join': 'Únete a Nuestra Misión',
    
    // Docs
    'docs.title': 'Documentación',
    'docs.search_placeholder': 'Buscar documentación...',
    'docs.getting_started': 'Primeros Pasos',
    'docs.quick_links': 'Enlaces Rápidos',
    'docs.read_time': 'min de lectura',
    
    // Settings
    'settings.title': 'Configuración',
    'settings.language': 'Idioma',
    'settings.theme': 'Tema',
    'settings.theme.light': 'Claro',
    'settings.theme.dark': 'Oscuro',
    'settings.theme.system': 'Sistema',
    'settings.notifications': 'Notificaciones',
    'settings.privacy': 'Privacidad',
    
    // Footer
    'footer.rights': 'Todos los derechos reservados',
    'footer.privacy': 'Política de Privacidad',
    'footer.terms': 'Términos de Servicio',
  },
  
  zh: {
    // Navigation
    'nav.home': '首页',
    'nav.examples': '示例',
    'nav.playground': 'Playground',
    'nav.sandbox': '沙盒',
    'nav.docs': '文档',
    'nav.tutorials': '教程',
    'nav.about': '关于',
    'nav.faq': '常见问题',
    'nav.community': '社区',
    'nav.settings': '设置',
    
    // Hero
    'hero.title': '学习 Web3 开发',
    'hero.subtitle': '交互式学习',
    'hero.description': '使用AI驱动的工具和交互式教程构建、部署和理解智能合约。',
    'hero.cta.start': '开始构建',
    'hero.cta.explore': '探索示例',
    
    // Features
    'features.title': '革命性功能',
    'features.ai.title': 'AI 代码助手',
    'features.ai.description': '实时AI分析与语音控制',
    'features.timemachine.title': '时间机器',
    'features.timemachine.description': '穿越代码演变历史',
    'features.exploit.title': '漏洞实验室',
    'features.exploit.description': '通过安全的黑客学习安全知识',
    'features.arena.title': '协作竞技场',
    'features.arena.description': '与AI队友一起编程',
    'features.neural.title': '神经Gas预言机',
    'features.neural.description': 'ML驱动的Gas优化',
    'features.crosschain.title': '跨链部署',
    'features.crosschain.description': '一键部署到8+网络',
    
    // Common
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.success': '成功',
    'common.save': '保存',
    'common.cancel': '取消',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.copy': '复制',
    'common.copied': '已复制！',
    'common.search': '搜索',
    'common.filter': '筛选',
    'common.all': '全部',
    'common.back': '返回',
    'common.next': '下一步',
    'common.previous': '上一步',
    'common.close': '关闭',
    'common.open': '打开',
    'common.learn_more': '了解更多',
    'common.get_started': '开始使用',
    
    // Sandbox
    'sandbox.compile': '编译',
    'sandbox.deploy': '部署',
    'sandbox.compiling': '编译中...',
    'sandbox.deploying': '部署中...',
    'sandbox.console': '控制台',
    'sandbox.files': '文件',
    'sandbox.interaction': '交互',
    'sandbox.innovation': '创新模式',
    'sandbox.activate_innovation': '激活创新',
    
    // About
    'about.title': '关于我们',
    'about.mission': '我们的使命',
    'about.vision': '我们的愿景',
    'about.team': '团队介绍',
    'about.values': '我们的价值观',
    'about.join': '加入我们',
    
    // Docs
    'docs.title': '文档',
    'docs.search_placeholder': '搜索文档...',
    'docs.getting_started': '快速开始',
    'docs.quick_links': '快捷链接',
    'docs.read_time': '分钟阅读',
    
    // Settings
    'settings.title': '设置',
    'settings.language': '语言',
    'settings.theme': '主题',
    'settings.theme.light': '浅色',
    'settings.theme.dark': '深色',
    'settings.theme.system': '跟随系统',
    'settings.notifications': '通知',
    'settings.privacy': '隐私',
    
    // Footer
    'footer.rights': '版权所有',
    'footer.privacy': '隐私政策',
    'footer.terms': '服务条款',
  },
  
  // Placeholder for other languages
  fr: {} as Record<string, string>,
  de: {} as Record<string, string>,
  ja: {} as Record<string, string>,
  ko: {} as Record<string, string>,
  pt: {} as Record<string, string>,
  ru: {} as Record<string, string>,
  ar: {} as Record<string, string>,
};

// Fill in missing translations with English fallback
Object.keys(translations.en).forEach(key => {
  Object.keys(translations).forEach(lang => {
    if (!translations[lang as Language][key]) {
      translations[lang as Language][key] = translations.en[key];
    }
  });
});

interface I18nStore {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
  isRTL: () => boolean;
}

export const useI18n = create<I18nStore>()(
  persist(
    (set, get) => ({
      language: 'en',
      
      setLanguage: (lang: Language) => {
        set({ language: lang });
        // Update document direction for RTL languages
        const langInfo = languages.find(l => l.code === lang);
        document.documentElement.dir = langInfo?.rtl ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
      },
      
      t: (key: string, params?: Record<string, string>) => {
        const { language } = get();
        let text = translations[language][key] || translations.en[key] || key;
        
        // Replace parameters
        if (params) {
          Object.entries(params).forEach(([param, value]) => {
            text = text.replace(`{${param}}`, value);
          });
        }
        
        return text;
      },
      
      isRTL: () => {
        const { language } = get();
        const langInfo = languages.find(l => l.code === language);
        return langInfo?.rtl || false;
      }
    }),
    {
      name: 'i18n-storage'
    }
  )
);

export default useI18n;
