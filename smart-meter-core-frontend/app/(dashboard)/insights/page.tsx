"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Lightbulb,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Clock,
  ThermometerSun,
  AlertCircle,
  CheckCircle2,
  Target,
} from "lucide-react"
import {
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
  BarChart,
  Bar,
} from "recharts"
import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/store/use-auth-store"

type EfficiencyPoint = { month: string; efficiency: number; benchmark: number }
type ApplianceInsight = { appliance: string; usage: number; efficiency: number; cost: number; potential: number }
type WeatherPoint = { day: string; temp: number; usage: number }

export default function InsightsPage() {
  const { user, token } = useAuthStore()
  const meterId = user?.meterId

  const [efficiencyTrend, setEfficiencyTrend] = useState<EfficiencyPoint[]>([])
  const [applianceInsights, setApplianceInsights] = useState<ApplianceInsight[]>([])
  const [weatherCorrelation, setWeatherCorrelation] = useState<WeatherPoint[]>([])

  useEffect(() => {
    if (!meterId) return

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"

    Promise.all([
      fetch(`${apiBaseUrl}/api/consumer/insights/efficiency?meterId=${encodeURIComponent(meterId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }).then((r) => r.json()),
      fetch(`${apiBaseUrl}/api/consumer/insights/appliances?meterId=${encodeURIComponent(meterId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }).then((r) => r.json()),
      fetch(`${apiBaseUrl}/api/consumer/insights/weather?meterId=${encodeURIComponent(meterId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }).then((r) => r.json()),
    ])
      .then(([effJson, applJson, weatherJson]) => {
        setEfficiencyTrend((effJson.efficiencyTrend as EfficiencyPoint[]) ?? [])
        setApplianceInsights((applJson.appliances as ApplianceInsight[]) ?? [])
        setWeatherCorrelation((weatherJson.weatherCorrelation as WeatherPoint[]) ?? [])
      })
      .catch(() => {
        setEfficiencyTrend([])
        setApplianceInsights([])
        setWeatherCorrelation([])
      })
  }, [meterId, token])

  const totalSavingsPotential = applianceInsights.reduce((sum, a) => sum + a.potential, 0)
  const avgEfficiency =
    applianceInsights.length > 0 ? applianceInsights.reduce((sum, a) => sum + a.efficiency, 0) / applianceInsights.length : 0

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI-Powered Insights</h1>
          <p className="text-muted-foreground">Intelligent analysis and personalized recommendations for your home.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Efficiency Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgEfficiency.toFixed(0)}%</div>
              <Progress value={avgEfficiency} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">15% below optimal</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                Savings Potential
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${totalSavingsPotential.toFixed(0)}/mo</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingDown className="h-3 w-3" />
                With recommended changes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Active Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">8</div>
              <p className="text-xs text-muted-foreground mt-1">3 high priority</p>
            </CardContent>
          </Card>
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Goals Achieved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3/5</div>
              <Progress value={60} className="mt-2 bg-primary-foreground/20" />
              <p className="text-xs opacity-80 mt-1">On track this month</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Priority Recommendations
            </CardTitle>
            <CardDescription>AI-generated insights based on your consumption patterns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">HVAC System Running Inefficiently</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your HVAC is consuming 45% of total energy with only 68% efficiency. Filter replacement or
                      maintenance recommended. Potential savings: <strong>$12/month</strong>
                    </p>
                  </div>
                  <Badge variant="destructive" className="flex-shrink-0">
                    Critical
                  </Badge>
                </div>
                <Button size="sm" variant="outline" className="mt-3 h-8 text-xs bg-transparent">
                  Schedule Maintenance
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
              <Clock className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">Optimize Water Heater Schedule</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Water heater runs during peak hours (6-9 PM). Shift to off-peak (10 PM - 6 AM) to save $4/month on
                      time-of-use rates.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600 flex-shrink-0">
                    High
                  </Badge>
                </div>
                <Button size="sm" variant="outline" className="mt-3 h-8 text-xs bg-transparent">
                  Apply Schedule
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/5 border border-green-500/20">
              <TrendingUp className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">Excellent Solar Utilization</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      You're using 87% of your solar generation! Your self-consumption rate is above average. Keep up
                      the good work!
                    </p>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-600 flex-shrink-0">
                    Success
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Energy Efficiency Trend</CardTitle>
            <CardDescription>Your efficiency score vs benchmark over the past year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={efficiencyTrend}>
                  <defs>
                    <linearGradient id="efficiencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={[60, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "var(--radius)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="efficiency"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#efficiencyGradient)"
                    name="Your Efficiency"
                  />
                  <Line
                    type="monotone"
                    dataKey="benchmark"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Benchmark"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Appliance Efficiency Analysis</CardTitle>
              <CardDescription>Usage, efficiency, and savings potential by appliance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {applianceInsights.map((appliance) => (
                  <div key={appliance.appliance} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{appliance.appliance}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{appliance.usage}%</span>
                        <Badge
                          variant="outline"
                          className={
                            appliance.efficiency >= 85
                              ? "bg-green-500/10 text-green-600 border-green-500/50"
                              : appliance.efficiency >= 75
                                ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/50"
                                : "bg-destructive/10 text-destructive border-destructive/50"
                          }
                        >
                          {appliance.efficiency}%
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={appliance.efficiency} className="flex-1" />
                      {appliance.potential > 2 && (
                        <span className="text-xs text-green-600 font-medium whitespace-nowrap">
                          Save ${appliance.potential}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ThermometerSun className="h-5 w-5 text-orange-500" />
                Weather Impact Analysis
              </CardTitle>
              <CardDescription>How temperature affects your energy consumption</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weatherCorrelation}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="day"
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="usage"
                      fill="var(--primary)"
                      name="Usage (kWh)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="temp"
                      stroke="var(--destructive)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Temp (°C)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm">
                  <strong>Insight:</strong> Your usage increases by an average of <strong>2.1 kWh per °C</strong> above
                  28°C. Consider pre-cooling during off-peak hours when high temperatures are forecasted.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
