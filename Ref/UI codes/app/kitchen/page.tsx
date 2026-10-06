'use client'
import { redirect } from 'next/navigation'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function KitchenIndex() {
  const router = useRouter()
  useEffect(() => { router.replace('/kitchen/display') }, [router])
  return null
}
