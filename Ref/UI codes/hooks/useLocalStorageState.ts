'use client'
import { useState, useEffect } from 'react'

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [isClient, setIsClient] = useState(false)
  
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Prevent hydration mismatch by holding off until client renders
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(state) : value
      setState(valueToStore)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error)
    }
  }

  // If we haven't rendered on client yet, return initial value to match server rendering
  return [isClient ? state : initialValue, setValue] as const
}
