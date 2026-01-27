import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Changes } from '@/pages/Changes'
import { Subscriptions } from '@/pages/Subscriptions'
import { Servers } from '@/pages/Servers'
import { Settings } from '@/pages/Settings'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/ThemeProvider'

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="mcp-watch-theme">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="changes" element={<Changes />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="servers" element={<Servers />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
