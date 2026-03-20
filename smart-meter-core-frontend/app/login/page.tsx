"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore, type UserRole } from "@/lib/store/use-auth-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Zap } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<UserRole>("CONSUMER")
  const [meterId, setMeterId] = useState("")
  const login = useAuthStore((state) => state.login)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    await login(email || "demo@smartmeter.io", role, meterId)
    router.push(role === "UTILITY" ? "/utility/dashboard" : role === "ADMIN" ? "/admin/health" : "/dashboard")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="h-8 w-8 text-primary-foreground fill-primary-foreground/20" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">SmartMeter Core</CardTitle>
          <CardDescription>Enter your credentials to access the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email / Meter ID</Label>
              <Input
                id="email"
                placeholder="demo@smartmeter.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Login As</Label>
              <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONSUMER">Consumer</SelectItem>
                  <SelectItem value="UTILITY">Utility / DISCOM</SelectItem>
                  <SelectItem value="ADMIN">System Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role === "CONSUMER" && (
              <div className="space-y-2">
                <Label htmlFor="meter">Meter ID (Optional)</Label>
                <Input
                  id="meter"
                  placeholder="MTR-8829-X1"
                  value={meterId}
                  onChange={(e) => setMeterId(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" defaultValue="password" />
            </div>
            <Button type="submit" className="w-full">
              Login
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-xs text-muted-foreground">
          © 2025 SmartMeter Core. Enterprise Grid Analytics.
        </CardFooter>
      </Card>
    </div>
  )
}
