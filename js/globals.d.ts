interface Window {
  App: any;
  GelFigure: any;
  GelFigureI18N?: { zh?: Record<string, string>; en?: Record<string, string> };
  GelFigureReleases?: ReadonlyArray<{ version: string; date: string; zh: string[]; en: string[] }>;
  I18N: any;
  L: (zh: string, en: string, vars?: Record<string, string | number>) => string;
  PrefStorage: any;
  ProjectStore?: any;
  GelAI?: any;
}
