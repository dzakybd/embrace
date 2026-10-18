// Public files in Cloud Storage for Firebase (laws, staff portraits, emblems): served by the Firebase Storage
// download endpoint, readable because storage.rules allow it. Safe to import in client code.
export const BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'embrace-23a9c.firebasestorage.app'

export const fileUrl = (path: string) =>
  `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`
