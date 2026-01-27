'use client'

import { useEffect, useMemo, useState } from 'react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim'

export default function ParticleBackground() {
  const [init, setInit] = useState(false)

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine)
    }).then(() => {
      setInit(true)
    })
  }, [])

  const options = useMemo(
    () => ({
      background: {
        color: {
          value: 'transparent',
        },
      },
      fpsLimit: 60,
      interactivity: {
        events: {
          onClick: {
            enable: true,
            mode: 'push',
          },
          onHover: {
            enable: true,
            mode: 'repulse',
          },
        },
        modes: {
          push: {
            quantity: 2,
          },
          repulse: {
            distance: 120,
            duration: 0.4,
          },
        },
      },
      particles: {
        color: {
          value: ['#ffffff', '#a3a3a3', '#737373'],
        },
        links: {
          color: '#ffffff',
          distance: 150,
          enable: true,
          opacity: 0.05,
          width: 1,
        },
        move: {
          direction: 'none' as const,
          enable: true,
          outModes: {
            default: 'bounce' as const,
          },
          random: true,
          speed: 0.5,
          straight: false,
        },
        number: {
          density: {
            enable: true,
            area: 1200,
          },
          value: 40,
        },
        opacity: {
          value: { min: 0.05, max: 0.2 },
          animation: {
            enable: true,
            speed: 0.5,
            minimumValue: 0.05,
          },
        },
        shape: {
          type: 'circle',
        },
        size: {
          value: { min: 1, max: 2 },
        },
      },
      detectRetina: true,
    }),
    []
  )

  if (!init) return null

  return (
    <Particles
      id="tsparticles"
      className="fixed inset-0 pointer-events-none"
      options={options}
    />
  )
}
