'use client'

// Interactive charts and maps with Apache ECharts (tree-shaken): animated on load and on data change, tooltips,
// hover emphasis, legend toggles and zoomable maps. Colors follow the Material 3 tokens in globals.css.
import { BarChart, LineChart, MapChart, PieChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef, useState } from 'react'

echarts.use([
  BarChart,
  LineChart,
  MapChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  DataZoomComponent,
  CanvasRenderer,
])

export const COLORS = {
  brand: '#0b57d0',
  brandSoft: '#d3e3fd',
  critical: '#b3261e',
  high: '#e8710a',
  normal: '#7cacf8',
  low: '#c4c7c5',
  good: '#146c2e',
  ink: '#1f1f1f',
  ink2: '#444746',
  line: '#e3e7ee',
  series: ['#0b57d0', '#7cacf8', '#146c2e', '#fbbc04', '#e8710a', '#b3261e', '#8e4ec6', '#00897b'],
}

export const BASE: echarts.EChartsCoreOption = {
  color: COLORS.series,
  textStyle: { fontFamily: "'Google Sans', 'Google Sans Text', system-ui, sans-serif", color: COLORS.ink2 },
  animationDuration: 900,
  animationEasing: 'cubicOut',
  animationDurationUpdate: 600,
  tooltip: {
    backgroundColor: '#fff',
    borderColor: COLORS.line,
    textStyle: { color: COLORS.ink, fontSize: 13 },
    extraCssText: 'border-radius:12px;box-shadow:0 2px 6px 2px rgb(0 0 0 / .15);',
  },
}

const maps = new Map<string, Promise<boolean>>()
/** Loads a GeoJSON map once (from /api/geo/<file>) and registers it under its file name. */
export function useMap(file: string | null | undefined): string | null {
  const name = file ? file.split('/').pop()! : null
  const [ready, setReady] = useState<string | null>(null)
  useEffect(() => {
    if (!name) return
    let p = maps.get(name)
    if (!p) {
      p = fetch(`/api/geo/${name}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((geo) => {
          if (geo) echarts.registerMap(name, geo)
          return !!geo
        })
        .catch(() => false)
      maps.set(name, p)
    }
    let live = true
    p.then((ok) => live && ok && setReady(name))
    return () => {
      live = false
    }
  }, [name])
  return ready
}

/** One chart: re-renders with animation when `option` changes; `onClick` gets the clicked item. */
export function Chart({
  option,
  height = 260,
  onClick,
  label,
}: {
  option: echarts.EChartsCoreOption
  height?: number
  onClick?: (p: { name: string; seriesName?: string; data?: unknown }) => void
  label: string
}) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const click = useRef(onClick)
  useEffect(() => {
    click.current = onClick
  }, [onClick])
  useEffect(() => {
    if (!el.current) return
    const c = echarts.init(el.current, undefined, { renderer: 'canvas' })
    chart.current = c
    c.on('click', (p) => click.current?.(p as never))
    const ro = new ResizeObserver(() => c.resize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      c.dispose()
      chart.current = null
    }
  }, [])
  useEffect(() => {
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    chart.current?.setOption({ ...BASE, ...(reduce ? { animation: false } : {}), ...option }, { notMerge: true })
  }, [option])
  return <div ref={el} className="chart" style={{ height }} role="img" aria-label={label} />
}
