"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { TrendingDown, TrendingUp, Info, Zap, DollarSign, AlertCircle, Download, Sun, Cloud } from "lucide-react"
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts"

// <CHANGE> Enhanced forecast data with more metrics
const forecastData = Array.from({ length: 24 }, (_, i) => {
  const hour = i
  const baseLoad = 2 + Math.sin((hour - 6) / 12 * Math.PI) * 1.5
  const solarGen = hour >= 6 && hour <= 18 ? Math.sin((hour - 6) / 12 * Math.PI) * 2 : 0
  
  return {
    time: `${i}:00`,
    hour: i,
    predicted: baseLoad + Math.random() * 0.5,
    confidenceUpper: baseLoad + 0.8 + Math.random() * 0.3,
    confidenceLower: Math.max(0, baseLoad - 0.6 + Math.random() * 0.2),
    renewable: solarGen + Math.random() * 0.3,
    gridPrice: 0.12 + (hour >= 17 && hour <= 21 ? 0.08 : 0) + Math.random() * 0.02,
    netLoad: Math.max(0, baseLoad - solarGen),
  }
})

// <CHANGE> Weekly forecast pattern data
const weeklyPattern = [
  { day: "Mon", usage: 45, cost: 5.4, renewable: 12 },
  { day: "Tue", usage: 42, cost: 5.0, renewable: 15 },
  { day: "Wed", usage: 48, cost: 5.8, renewable: 14 },
  { day: "Thu", usage: 44, cost: 5.3, renewable: 16 },
  { day: "Fri", usage: 50, cost: 6.2, renewable: 13 },
  { day: "Sat", usage: 38, cost: 4.6, renewable: 18 },
  { day: "Sun", usage: 36, cost: 4.3, renewable: 20 },
]

// <CHANGE> Load profile comparison data for radar chart
const loadProfile = [
  { category: "Morning", current: 3.2, predicted: 3.5, optimal: 2.8 },
  { category: "Midday", current: 2.1, predicted: 2.3, optimal: 3.5 },
  { category: "Afternoon", current: 2.8, predicted: 3.0, optimal: 3.8 },
  { category: "Evening", current: 4.5, predicted: 4.8, optimal: 2.5 },
  { category: "Night", current: 1.8, predicted: 1.9, optimal: 1.5 },
]

export default function ForecastPage() {
  // <CHANGE> Calculate detailed metrics
  const peakLoad = Math.max(...forecastData.map(d => d.predicted))
  const peakTime = forecastData.find(d => d.predicted === peakLoad)?.time || "18:00"
  const totalRenewable = forecastData.reduce((sum, d) => sum + d.renewable, 0)
  const totalPredicted = forecastData.reduce((sum, d) => sum + d.predicted, 0)
  const renewablePercent = (totalRenewable / totalPredicted) * 100
  const estimatedDailyCost = forecastData.reduce((sum, d) => sum + (d.predicted * d.gridPrice), 0)
  const savingsOpportunity = forecastData.filter(d => d.gridPrice > 0.15).reduce((sum, d) => sum + (d.predicted * 0.05), 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Load Forecast & Predictions</h1>
            <p className="text-muted-foreground">AI-powered predictions and optimization opportunities.</p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* <CHANGE> Enhanced metric cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Estimated Peak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{peakLoad.toFixed(2)} kW</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-destructive" />
                Expected at {peakTime}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sun className="h-4 w-4 text-green-500" />
                Renewable Energy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{renewablePercent.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                {totalRenewable.toFixed(1)} kWh from solar
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-chart-3" />
                Projected Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${estimatedDailyCost.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                For next 24 hours
              </p>
            </CardContent>
          </Card>
          <Card className="bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium opacity-90 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Savings Opportunity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${savingsOpportunity.toFixed(2)}</div>
              <p className="text-xs opacity-80 mt-1">Shift load from peak hours</p>
            </CardContent>
          </Card>
        </div>

        {/* <CHANGE> Tabbed forecast views */}
        <Tabs defaultValue="daily" className="space-y-4">
          <TabsList>
            <TabsTrigger value="daily">24-Hour Forecast</TabsTrigger>
            <TabsTrigger value="weekly">Weekly Pattern</TabsTrigger>
            <TabsTrigger value="profile">Load Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Hourly Load Prediction</CardTitle>
                    <CardDescription>AI confidence interval: 95% | Model: LSTM Neural Network</CardDescription>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Updated 5m ago
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={forecastData}>
                      <defs>
                        <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="time"
                        stroke="var(--muted-foreground)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          borderColor: "var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="confidenceUpper"
                        stroke="none"
                        fill="url(#confidenceBand)"
                        name="Confidence Range"
                      />
                      <Area
                        type="monotone"
                        dataKey="confidenceLower"
                        stroke="none"
                        fill="var(--background)"
                        name="Lower Bound"
                      />
                      <Line
                        type="monotone"
                        dataKey="predicted"
                        stroke="var(--primary)"
                        strokeWidth={3}
                        dot={false}
                        name="Predicted Load (kW)"
                      />
                      <Line
                        type="monotone"
                        dataKey="renewable"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        name="Solar Generation (kW)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* <CHANGE> Grid price and net load analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Grid Price & Net Load Analysis</CardTitle>
                <CardDescription>Optimize consumption based on time-of-use pricing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="time"
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
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="netLoad"
                        fill="var(--chart-4)"
                        name="Net Load (kW)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="stepAfter"
                        dataKey="gridPrice"
                        stroke="var(--destructive)"
                        strokeWidth={2}
                        dot={false}
                        name="Grid Price ($/kWh)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="weekly" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>7-Day Usage Forecast</CardTitle>
                <CardDescription>Predicted daily consumption and cost trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={weeklyPattern}>
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
                      <Legend />
                      <Bar yAxisId="left" dataKey="usage" fill="var(--primary)" name="Usage (kWh)" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="left" dataKey="renewable" fill="var(--chart-2)" name="Renewable (kWh)" radius={[4, 4, 0, 0]} />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="cost"
                        stroke="var(--chart-3)"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        name="Cost ($)"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* <CHANGE> Weekly insights cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Weekday Average</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">45.8 kWh</div>
                  <Progress value={68} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">68% of weekly total</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Weekend Average</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">37.0 kWh</div>
                  <Progress value={32} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">32% of weekly total</p>
                </CardContent>
              </Card>
              <Card className="border-green-500/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sun className="h-4 w-4 text-green-500" />
                    Best Solar Day
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Sunday</div>
                  <p className="text-xs text-muted-foreground mt-1">20 kWh renewable generation</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Load Profile Comparison</CardTitle>
                <CardDescription>Current vs Predicted vs Optimal consumption patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={loadProfile}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="category" stroke="var(--muted-foreground)" fontSize={12} />
                      <PolarRadiusAxis stroke="var(--muted-foreground)" fontSize={10} />
                      <Radar
                        name="Current Pattern"
                        dataKey="current"
                        stroke="var(--chart-4)"
                        fill="var(--chart-4)"
                        fillOpacity={0.3}
                      />
                      <Radar
                        name="Predicted Pattern"
                        dataKey="predicted"
                        stroke="var(--primary)"
                        fill="var(--primary)"
                        fillOpacity={0.3}
                      />
                      <Radar
                        name="Optimal Pattern"
                        dataKey="optimal"
                        stroke="var(--chart-2)"
                        fill="var(--chart-2)"
                        fillOpacity={0.2}
                        strokeDasharray="5 5"
                      />
                      <Legend />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          borderColor: "var(--border)",
                          borderRadius: "var(--radius)",
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* <CHANGE> Optimization recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  AI Optimization Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                  <TrendingDown className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Shift Evening Load to Midday</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Move 30% of evening consumption to 11 AM - 2 PM to maximize solar usage and save $12.40/week
                    </p>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-600">High Impact</Badge>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                  <Zap className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Reduce Morning Peak</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Morning peak is 18% higher than optimal. Schedule water heater to run after 10 AM
                    </p>
                  </div>
                  <Badge variant="outline" className="text-primary border-primary">Medium Impact</Badge>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
                  <Cloud className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Weather-Aware Scheduling</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Heavy cloud cover predicted Wed-Thu. Pre-cool home on Tuesday to reduce AC load
                    </p>
                  </div>
                  <Badge variant="outline">Low Impact</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
