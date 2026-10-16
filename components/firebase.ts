// Firebase web SDK: Analytics on the client (page views and demo usage). The web config is public by design.
import { getApps, initializeApp } from 'firebase/app'

const firebaseConfig = {
  apiKey: 'AIzaSyD4L9qc_jiCdRG62V1tMe--PF8gsUvcCpw',
  authDomain: 'embrace-23a9c.firebaseapp.com',
  projectId: 'embrace-23a9c',
  storageBucket: 'embrace-23a9c.firebasestorage.app',
  messagingSenderId: '714975767018',
  appId: '1:714975767018:web:69fb4464cffd7e30fe2a93',
  measurementId: 'G-5PX7TF5KPH',
}

export async function startAnalytics() {
  const { getAnalytics, isSupported, logEvent } = await import('firebase/analytics')
  if (!(await isSupported())) return null
  const analytics = getAnalytics(getApps()[0] ?? initializeApp(firebaseConfig))
  return (name: string, params?: Record<string, string | number>) => logEvent(analytics, name, params)
}
