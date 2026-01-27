'use client'

import Header from '@/components/Header'
import Hero from '@/components/Hero'
import ProductCards from '@/components/ProductCards'
import HowItWorks from '@/components/HowItWorks'
import Features from '@/components/Features'
import Stats from '@/components/Stats'
import Footer from '@/components/Footer'
import ParticleBackground from '@/components/ParticleBackground'

export default function Home() {
  return (
    <main id="main-content" className="relative min-h-screen">
      <ParticleBackground />
      <Header />
      
      <div className="container mx-auto px-4 pt-24 pb-16">
        <Hero />
        <ProductCards />
        <HowItWorks />
        <Stats />
        <Features />
      </div>
      
      <Footer />
    </main>
  )
}
