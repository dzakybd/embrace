// Firebase web SDK: Analytics on the client (page views and demo usage). The config comes from NEXT_PUBLIC_FIREBASE_*
// at build time (apphosting.yaml; the API key from Secret Manager); without it Analytics is simply off.
import { getApps, initializeApp } from 'firebase/app'

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: `${projectId}.firebasestorage.app`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

export async function startAnalytics() {
  if (!firebaseConfig.apiKey || !projectId || !firebaseConfig.appId) return null
  const { getAnalytics, isSupported, logEvent } = await import('firebase/analytics')
  if (!(await isSupported())) return null
  const analytics = getAnalytics(getApps()[0] ?? initializeApp(firebaseConfig))
  return (name: string, params?: Record<string, string | number>) => logEvent(analytics, name, params)
}
