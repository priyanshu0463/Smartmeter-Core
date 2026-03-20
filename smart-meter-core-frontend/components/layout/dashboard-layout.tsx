"use client"

import type React from "react"
import { Sidebar } from "./sidebar"
import { Navbar } from "./navbar"
import { useAuthStore } from "@/lib/store/use-auth-store"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block w-64 flex-shrink-0">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">{children}</main>
      </div>
    </div>
  )
}
