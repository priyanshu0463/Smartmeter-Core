"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2, AlertCircle, Server, Database, Globe, Wifi } from "lucide-react"

const systemServices = [
  { name: "API Gateway", status: "Healthy", uptime: "99.99%", latency: "24ms", icon: Server },
  { name: "Meter MQTT Broker", status: "Healthy", uptime: "100%", latency: "12ms", icon: Wifi },
  { name: "Analytics Engine", status: "Healthy", uptime: "99.95%", latency: "140ms", icon: Database },
  { name: "Consumer Web Portal", status: "Degraded", uptime: "98.2%", latency: "450ms", icon: Globe },
]

const recentLogs = [
  { time: "2025-12-25 10:24:12", service: "MQTT", event: "Meter MTR-9912 connection timeout", level: "Error" },
  { time: "2025-12-25 10:23:45", service: "AUTH", event: "Failed login attempt: admin@smartmeter.io", level: "Warn" },
  {
    time: "2025-12-25 10:20:01",
    service: "API",
    event: "Rate limit triggered for regional-load-aggregator",
    level: "Warn",
  },
  { time: "2025-12-25 10:15:30", service: "SYNC", event: "Successfully synced 4,200 meter records", level: "Info" },
  { time: "2025-12-25 10:10:12", service: "CORE", event: "Database backup completed successfully", level: "Info" },
]

export default function SystemHealthPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Health & Infrastructure</h1>
          <p className="text-muted-foreground">Real-time status of backend services and telemetry pipelines.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {systemServices.map((service) => (
            <Card key={service.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{service.name}</CardTitle>
                <service.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-2xl font-bold">{service.uptime}</div>
                  <Badge variant={service.status === "Healthy" ? "default" : "destructive"} className="text-[10px]">
                    {service.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Latency: {service.latency}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Infrastructure Status
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center items-center py-10">
              <div className="relative h-40 w-40 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-8 border-green-500/20 border-t-green-500 animate-spin-slow" />
                <div className="text-center">
                  <p className="text-4xl font-bold">99.8%</p>
                  <p className="text-xs text-muted-foreground">SLA Compliance</p>
                </div>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-8 w-full">
                <div className="text-center">
                  <p className="text-2xl font-bold">2.4k</p>
                  <p className="text-xs text-muted-foreground">Req / Sec</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">142 TB</p>
                  <p className="text-xs text-muted-foreground">Data Processed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                System Audit Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full">
                <div className="space-y-4">
                  {recentLogs.map((log, i) => (
                    <div key={i} className="flex flex-col gap-1 border-b pb-3 last:border-0">
                      <div className="flex items-center justify-between">
                        <Badge
                          variant={
                            log.level === "Error" ? "destructive" : log.level === "Warn" ? "outline" : "secondary"
                          }
                          className="text-[10px] py-0"
                        >
                          {log.level}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">{log.time}</span>
                      </div>
                      <p className="text-sm font-medium mt-1">
                        <span className="text-primary mr-2">[{log.service}]</span>
                        {log.event}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
