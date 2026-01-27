/**
 * usePlatformDetection Hook - Detect user's platform and environment
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

import { useState, useEffect, useCallback } from 'react';
import type { PlatformDetection, InstallPlatform } from '@/types';

interface UsePlatformDetectionReturn {
  detection: PlatformDetection | null;
  isDetecting: boolean;
  platform: InstallPlatform;
  refresh: () => void;
}

export function usePlatformDetection(): UsePlatformDetectionReturn {
  const [detection, setDetection] = useState<PlatformDetection | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [platform, setPlatform] = useState<InstallPlatform>('linux');

  const detect = useCallback(() => {
    setIsDetecting(true);

    try {
      const ua = navigator.userAgent.toLowerCase();
      let os: InstallPlatform = 'linux';

      if (ua.includes('mac') || ua.includes('darwin')) {
        os = 'macos';
      } else if (ua.includes('win')) {
        os = 'windows';
      } else if (ua.includes('linux') || ua.includes('x11')) {
        os = 'linux';
      }

      // Detect architecture
      const arch = ua.includes('arm') || ua.includes('aarch64') ? 'arm64' : 'x64';

      // Check for platform-specific hints
      const platform = (navigator as any).userAgentData?.platform?.toLowerCase();
      if (platform) {
        if (platform.includes('mac')) os = 'macos';
        else if (platform.includes('win')) os = 'windows';
        else if (platform.includes('linux')) os = 'linux';
      }

      const detectionResult: PlatformDetection = {
        os,
        arch,
        // These would ideally come from a backend check or browser extension
        nodeVersion: undefined,
        npmVersion: undefined,
        hasDocker: undefined,
        hasPython: undefined,
        pythonVersion: undefined,
      };

      setDetection(detectionResult);
      setPlatform(os);
    } catch (error) {
      console.error('Platform detection failed:', error);
      setDetection({ os: 'linux', arch: 'x64' });
      setPlatform('linux');
    } finally {
      setIsDetecting(false);
    }
  }, []);

  useEffect(() => {
    detect();
  }, [detect]);

  return {
    detection,
    isDetecting,
    platform,
    refresh: detect,
  };
}
