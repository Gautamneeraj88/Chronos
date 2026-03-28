import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ToolConfig {
  url: string;
  username?: string;
  password?: string;
}

export interface ObservabilityConfig {
  grafana:    ToolConfig;
  prometheus: ToolConfig;
  jaeger:     ToolConfig;
  rabbitmq:   ToolConfig;
  neo4j:      ToolConfig;
}

export const OBS_DEFAULTS: ObservabilityConfig = {
  grafana:    { url: import.meta.env.VITE_GRAFANA_URL ?? 'http://localhost:3004' },
  prometheus: { url: 'http://localhost:9090' },
  jaeger:     { url: import.meta.env.VITE_JAEGER_URL  ?? 'http://localhost:16686' },
  rabbitmq:   { url: 'http://localhost:15672', username: 'chronos',  password: 'chronos_dev' },
  neo4j:      { url: 'http://localhost:7474',  username: 'neo4j',    password: 'chronos_dev' },
};

const STORAGE_KEY = 'chronos:observability';

function loadConfig(): ObservabilityConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ObservabilityConfig>;
      return {
        grafana:    { ...OBS_DEFAULTS.grafana,    ...parsed.grafana    },
        prometheus: { ...OBS_DEFAULTS.prometheus, ...parsed.prometheus },
        jaeger:     { ...OBS_DEFAULTS.jaeger,     ...parsed.jaeger     },
        rabbitmq:   { ...OBS_DEFAULTS.rabbitmq,   ...parsed.rabbitmq   },
        neo4j:      { ...OBS_DEFAULTS.neo4j,      ...parsed.neo4j      },
      };
    }
  } catch { /* ignore corrupt storage */ }
  return OBS_DEFAULTS;
}

interface ObservabilityContextValue {
  config: ObservabilityConfig;
  save: (config: ObservabilityConfig) => void;
  reset: () => void;
}

const ObservabilityContext = createContext<ObservabilityContextValue | null>(null);

export function ObservabilityProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ObservabilityConfig>(loadConfig);

  const save = useCallback((next: ObservabilityConfig) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setConfig(next);
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConfig(OBS_DEFAULTS);
  }, []);

  return (
    <ObservabilityContext.Provider value={{ config, save, reset }}>
      {children}
    </ObservabilityContext.Provider>
  );
}

export function useObservability() {
  const ctx = useContext(ObservabilityContext);
  if (!ctx) throw new Error('useObservability must be inside ObservabilityProvider');
  return ctx;
}
