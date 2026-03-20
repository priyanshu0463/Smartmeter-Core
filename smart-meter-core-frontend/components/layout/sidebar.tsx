"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuthStore } from "@/lib/store/use-auth-store"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Activity,
  History,
  TrendingUp,
  Lightbulb,
  AlertTriangle,
  Zap,
  MessageSquare,
  Users,
  ShieldAlert,
  BarChart3,
  Cpu,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const consumerLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/monitoring", label: "Real-Time", icon: Activity },
  { href: "/historical", label: "Historical", icon: History },
  { href: "/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/insights", label: "AI Insights", icon: Lightbulb },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/automation", label: "Automation", icon: Zap },
  { href: "/ai-chat", label: "AI Chat", icon: MessageSquare },
]

const utilityLinks = [
  { href: "/utility/dashboard", label: "Utility Dashboard", icon: BarChart3 },
  { href: "/utility/segmentation", label: "Segmentation", icon: Users },
  { href: "/utility/anomalies", label: "Fraud Detection", icon: ShieldAlert },
  { href: "/utility/planning", label: "Grid Planning", icon: Cpu },
  { href: "/utility/reports", label: "Reports", icon: History },
]

const adminLinks = [
  { href: "/admin/meters", label: "Meters", icon: Zap },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/health", label: "System Health", icon: Activity },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  const links = user?.role === "ADMIN" ? adminLinks : user?.role === "UTILITY" ? utilityLinks : consumerLinks

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <Zap className="h-6 w-6 text-primary mr-2 fill-primary/20" />
        <span className="font-bold text-xl tracking-tight">SmartMeter</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70 hover:text-sidebar-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-primary",
                )}
              />
              {link.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => logout()}
        >
          <LogOut className="mr-2 h-5 w-5" />
          Logout
        </Button>
      </div>
    </div>
  )
}
