"use client"

import { useState, useRef, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Send, Bot, User, Sparkles, TrendingUp, DollarSign, BarChart3, Lightbulb } from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  chart?: {
    type: "line" | "bar" | "pie"
    data: any[]
    title: string
  }
}

const peakHoursData = [
  { hour: "6 AM", usage: 2.1 },
  { hour: "9 AM", usage: 3.2 },
  { hour: "12 PM", usage: 2.8 },
  { hour: "3 PM", usage: 2.5 },
  { hour: "6 PM", usage: 4.5 },
  { hour: "9 PM", usage: 3.8 },
  { hour: "12 AM", usage: 1.5 },
]

const billBreakdownData = [
  { name: "Base Usage", value: 45, color: "var(--chart-1)" },
  { name: "Peak Hours", value: 30, color: "var(--chart-2)" },
  { name: "HVAC", value: 15, color: "var(--chart-3)" },
  { name: "Other", value: 10, color: "var(--chart-4)" },
]

const savingsOpportunityData = [
  { category: "Off-peak Shift", savings: 12.4 },
  { category: "Solar Usage", savings: 8.7 },
  { category: "Standby Power", savings: 5.2 },
  { category: "HVAC Optimization", savings: 15.8 },
]

const anomalyData = [
  { date: "Mon", normal: 45, actual: 45 },
  { date: "Tue", normal: 43, actual: 42 },
  { date: "Wed", normal: 46, actual: 68 },
  { date: "Thu", normal: 44, actual: 46 },
  { date: "Fri", normal: 48, actual: 47 },
]

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I'm your SmartMeter AI assistant. I can help you analyze your energy usage, predict your bills, identify anomalies, or suggest ways to save. Try asking about your peak hours, bill forecast, or optimization opportunities!",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const generateResponse = (userQuery: string): Message => {
    const query = userQuery.toLowerCase()

    if (query.includes("peak") || query.includes("hours")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        content:
          "Based on your usage history, your peak consumption occurs between 6 PM and 9 PM, averaging 4.2 kW. Your morning peak at 9 AM is also significant at 3.2 kW. Here's your daily peak hour pattern:",
        timestamp: new Date(),
        chart: {
          type: "line",
          data: peakHoursData,
          title: "Daily Peak Usage Pattern",
        },
      }
    }

    if (query.includes("bill") || query.includes("forecast") || query.includes("cost")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        content:
          "Your estimated bill for this month is $168.40, which is 5% lower than last month. Here's the breakdown of your energy costs by category:",
        timestamp: new Date(),
        chart: {
          type: "pie",
          data: billBreakdownData,
          title: "Bill Breakdown by Category",
        },
      }
    }

    if (query.includes("save") || query.includes("saving") || query.includes("optimize")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        content:
          "I've identified several savings opportunities for you! You could save up to $42.10 per month by implementing these changes. The biggest opportunity is HVAC optimization, which could save $15.80 monthly:",
        timestamp: new Date(),
        chart: {
          type: "bar",
          data: savingsOpportunityData,
          title: "Monthly Savings Opportunities ($)",
        },
      }
    }

    if (query.includes("anomal") || query.includes("unusual") || query.includes("spike")) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        content:
          "I detected an anomaly on Wednesday with 68 kWh consumption, which is 48% higher than your typical pattern of 46 kWh. This could indicate an appliance malfunction or unusual usage. Here's the comparison:",
        timestamp: new Date(),
        chart: {
          type: "bar",
          data: anomalyData,
          title: "Normal vs Actual Usage This Week",
        },
      }
    }

    return {
      id: Date.now().toString(),
      role: "assistant",
      content:
        "I can help you with energy analysis! Try asking me about:\n\n• Your peak usage hours\n• Bill forecasts and breakdowns\n• Savings opportunities\n• Unusual consumption patterns\n• Optimization recommendations\n\nWhat would you like to know?",
      timestamp: new Date(),
    }
  }

  const handleSend = () => {
    if (!input.trim()) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    const query = input
    setInput("")
    setIsTyping(true)

    setTimeout(() => {
      const assistantMsg = generateResponse(query)
      setMessages((prev) => [...prev, assistantMsg])
      setIsTyping(false)
    }, 1200)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const renderChart = (chart: Message["chart"]) => {
    if (!chart) return null

    return (
      <div className="mt-3 p-3 rounded-lg bg-muted/30 border">
        <p className="text-xs font-medium text-muted-foreground mb-2">{chart.title}</p>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chart.type === "line" ? (
              <LineChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={10} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "var(--radius)",
                    fontSize: "12px",
                  }}
                />
                <Line type="monotone" dataKey="usage" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            ) : chart.type === "bar" ? (
              <BarChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey={chart.data[0].category ? "category" : "date"}
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "var(--radius)",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey={chart.data[0].savings ? "savings" : chart.data[0].normal ? "normal" : "value"}
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                />
                {chart.data[0].actual && <Bar dataKey="actual" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />}
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={chart.data}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  label={(entry) => entry.name}
                  labelLine={false}
                >
                  {chart.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "var(--radius)",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-140px)] flex flex-col max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Energy AI Assistant</h1>
              <p className="text-xs text-muted-foreground">Powered by advanced analytics & machine learning</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/50">
            <div className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse" />
            Online
          </Badge>
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden mb-4">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 min-h-0">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <Avatar className="h-9 w-9 border-2 border-border flex-shrink-0">
                    <AvatarFallback className={msg.role === "assistant" ? "bg-primary/10 text-primary" : "bg-muted"}>
                      {msg.role === "assistant" ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`max-w-[75%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}
                  >
                    <div
                      className={`rounded-2xl p-3 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted rounded-tl-sm"
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>
                      {msg.role === "assistant" && msg.chart && renderChart(msg.chart)}
                    </div>
                    <span className="text-[10px] text-muted-foreground px-1">
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3">
                  <Avatar className="h-9 w-9 border-2 border-border flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Bot className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-2xl rounded-tl-sm p-3 flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="p-4 border-t bg-card">
            <div className="flex gap-2">
              <Input
                placeholder="Ask about your bill, peak hours, savings opportunities..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isTyping && handleSend()}
                disabled={isTyping}
                className="flex-1"
              />
              <Button onClick={handleSend} disabled={isTyping || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { query: "Show peak hours", icon: TrendingUp, color: "text-primary" },
            { query: "What is my bill forecast?", icon: DollarSign, color: "text-chart-3" },
            { query: "How to save $10?", icon: Lightbulb, color: "text-green-500" },
            { query: "Analyze anomalies", icon: BarChart3, color: "text-destructive" },
          ].map(({ query, icon: Icon, color }) => (
            <Button
              key={query}
              variant="outline"
              size="sm"
              className="text-xs justify-start h-auto py-2.5 bg-card hover:bg-muted"
              onClick={() => setInput(query)}
              disabled={isTyping}
            >
              <Icon className={`h-3.5 w-3.5 mr-2 ${color}`} />
              {query}
            </Button>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
