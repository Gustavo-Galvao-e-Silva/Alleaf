"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Heart, Brain } from "lucide-react";
import BottomNav from "../components/BottomNav";

const heartRateBpm = [72, 85, 78, 65, 70];

const chartData = heartRateBpm.map((bpm, i) => {
  const totalMinutes = i * 5;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    bpm,
  };
});

const currentBpm = heartRateBpm[heartRateBpm.length - 1];
const avg = Math.round(heartRateBpm.reduce((a, b) => a + b, 0) / heartRateBpm.length);
const min = Math.min(...heartRateBpm);
const max = Math.max(...heartRateBpm);

const stressLevel = [4, 6, 7, 5, 3];

const stressChartData = stressLevel.map((level, i) => {
  const totalMinutes = i * 5;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    level,
  };
});

const currentStress = stressLevel[stressLevel.length - 1];
const stressAvg = Math.round(stressLevel.reduce((a, b) => a + b, 0) / stressLevel.length);
const stressMin = Math.min(...stressLevel);
const stressMax = Math.max(...stressLevel);

const chartConfig = {
  bpm: {
    label: "Heart Rate",
    color: "oklch(0.637 0.237 15.1)",
  },
};

const stressChartConfig = {
  level: {
    label: "Stress Level",
    color: "oklch(0.6 0.2 270)",
  },
};

export default function DataPage() {
  return (
    <>
      <main className="min-h-dvh px-4 pt-14 pb-28">
        <h1 className="text-2xl font-bold mb-6">Your Data</h1>

        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Today
            </CardDescription>
            <CardTitle className="text-lg">Heart Rate</CardTitle>
            <div className="flex gap-5 mt-1 text-sm text-muted-foreground">
              <span>Avg <strong className="text-foreground">{avg}</strong></span>
              <span>Min <strong className="text-foreground">{min}</strong></span>
              <span>Max <strong className="text-foreground">{max}</strong></span>
              <span className="ml-auto text-xs">bpm</span>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <AreaChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="fillBpm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-bpm)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-bpm)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={11}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  domain={[50, 140]}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  tick={{ fontSize: 11 }}
                  tickCount={5}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Area
                  dataKey="bpm"
                  type="natural"
                  fill="url(#fillBpm)"
                  stroke="var(--color-bpm)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md mt-4">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Today
            </CardDescription>
            <CardTitle className="text-lg">Stress Level</CardTitle>
            <div className="flex gap-5 mt-1 text-sm text-muted-foreground">
              <span>Avg <strong className="text-foreground">{stressAvg}</strong></span>
              <span>Min <strong className="text-foreground">{stressMin}</strong></span>
              <span>Max <strong className="text-foreground">{stressMax}</strong></span>
              <span className="ml-auto text-xs">/ 10</span>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stressChartConfig} className="h-[220px] w-full">
              <AreaChart data={stressChartData} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="fillStress" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-level)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-level)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval={11}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 10]}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  tick={{ fontSize: 11 }}
                  tickCount={6}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Area
                  dataKey="level"
                  type="natural"
                  fill="url(#fillStress)"
                  stroke="var(--color-level)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Card className="border-none shadow-md relative">
            <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Current</p>
                <p className="text-2xl font-bold leading-none">{currentBpm} <span className="text-sm font-normal text-muted-foreground">bpm</span></p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md relative">
            <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-50">
                <Brain className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Current</p>
                <p className="text-2xl font-bold leading-none">{currentStress} <span className="text-sm font-normal text-muted-foreground">/ 10</span></p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <BottomNav activeItem="data" />
    </>
  );
}
