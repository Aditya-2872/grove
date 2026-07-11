import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AuthProvider } from './auth.tsx'
import AuthGate from './components/AuthGate.tsx'
import ProfileGate from './components/ProfileGate.tsx'
import { applyGlassAlpha, loadGlassAlpha } from './prefs.ts'

// Restore the saved glass transparency before first paint.
applyGlassAlpha(loadGlassAlpha())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <ProfileGate />
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
)
