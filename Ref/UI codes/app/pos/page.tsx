'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function POSIndex() {
  const router = useRouter()
  useEffect(() => { router.replace('/pos/floor') }, [router])
  return null
}
