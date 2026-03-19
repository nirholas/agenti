import { useState, useCallback } from 'react';
import type { Config, SupportedChain, SignerType } from '../types';
import { DEFAULT_CONFIG } from '../constants/config';

const generateConfigHash = (config: Config): string => {
    return `${config.testEmail}-${config.chain}-${config.serverUrl}-${config.signerType}`;
};

export const useConfiguration = () => {
    const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
    const [configHash, setConfigHash] = useState<string>(generateConfigHash(DEFAULT_CONFIG));

    const updateConfig = useCallback((updates: Partial<Config>) => {
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        setConfigHash(generateConfigHash(newConfig));
    }, [config]);

    const updateEmail = useCallback((testEmail: string) => {
        updateConfig({ testEmail });
    }, [updateConfig]);

    const updateChain = useCallback((chain: SupportedChain) => {
        updateConfig({ chain });
    }, [updateConfig]);

    const updateServerUrl = useCallback((serverUrl: string) => {
        updateConfig({ serverUrl });
    }, [updateConfig]);

    const updateSignerType = useCallback((signerType: SignerType) => {
        updateConfig({ signerType });
    }, [updateConfig]);

    return {
        config,
        configHash,
        updateConfig,
        updateEmail,
        updateChain,
        updateServerUrl,
        updateSignerType,
    };
};