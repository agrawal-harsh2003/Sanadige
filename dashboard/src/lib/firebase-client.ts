'use client'
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:     process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId:      process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

function getClientApp(): FirebaseApp {
  if (getApps().length) return getApps()[0]!
  return initializeApp(firebaseConfig)
}

export function getClientAuth(): Auth {
  return getAuth(getClientApp())
}

export function getClientDb(): Firestore {
  return getFirestore(getClientApp())
}
