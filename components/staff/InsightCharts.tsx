'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import type { Agency, Overview } from '../api'
import { Chart, COLORS, useMap } from '../Chart'
import { useLang } from '../Lang'
import { catLabel } from '../Procedures'
import { CHANNEL_LABEL, URGENCY_LABEL } from '../ui'

const reports = (t: (k: string, v?: Record<string, string | number>) => string, n: number) =>
  n === 1 ? t('1 report') : t('{n} reports', { n })

const URG = ['critical', 'high', 'normal', 'low'] as const
const URG_COLOR = { critical: COLORS.critical, high: COLORS.high, normal: COLORS.normal, low: COLORS.low }

/** Cases per province (KPAI) or kecamatan (Demak): darker is more cases; hover for escalated, open and the main case
 * type; scroll or pinch to zoom, drag to pan; click a region to see its cases in the inbox. */
export function CaseMap({ ov }: { ov: Overview }) {
  const { t } = useLang()
  const router = useRouter()
  const map = useMap(ov.map?.file)
  const option = useMemo(() => {
    const max = Math.max(1, ...ov.by_region.map((r) => r.count))
    const byName = Object.fromEntries(ov.by_region.map((r) => [r.name, r]))
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: { name: string }) => {
          const r = byName[p.name]
          if (!r) return `<b>${p.name}</b><br/>${t('No reports')}`
          return `<b>${p.name}</b><br/>${reports(t, r.count)} · ${t('{n} escalated', { n: r.escalated })} · ${t('{n} open', { n: r.open })}${r.top_category ? `<br/><span style="color:#5f6368">${r.top_category}</span>` : ''}`
        },
      },
      visualMap: {
        min: 0,
        max,
        left: 12,
        bottom: 12,
        calculable: true,
        itemHeight: 90,
        text: [t('More'), t('Fewer')],
        inRange: { color: ['#eef3fd', '#a8c7fa', '#4c8df6', '#0b57d0', '#041e49'] },
        textStyle: { color: COLORS.ink2, fontSize: 11 },
      },
      series: [
        {
          type: 'map',
          map,
          roam: true,
          scaleLimit: { min: 1, max: 12 },
          aspectScale: ov.map?.level === 'province' ? 1 : 0.95,
          left: 70,
          right: 8,
          top: 8,
          bottom: 8,
          label: {
            show: ov.map?.level === 'kecamatan',
            fontSize: 10,
            color: COLORS.ink,
            textBorderColor: '#fff',
            textBorderWidth: 2,
          },
          itemStyle: { borderColor: '#fff', borderWidth: 0.8, areaColor: '#f0f4f9' },
          emphasis: {
            label: { show: true, color: COLORS.ink, fontWeight: 600 },
            itemStyle: { areaColor: '#fbbc04', shadowBlur: 12, shadowColor: 'rgba(0,0,0,.25)' },
          },
          select: { disabled: true },
          animationDurationUpdate: 800,
          data: ov.by_region.map((r) => ({ name: r.name, value: r.count })),
        },
      ],
    }
  }, [ov, map, t])
  if (!ov.map) return null
  if (!map) return <div className="shimmer" style={{ height: 380 }} />
  return (
    <div className="map-wrap">
      <Chart
        option={option}
        height={ov.map.level === 'province' ? 400 : 440}
        label={t('Map of reports by region')}
        onClick={(p) => router.push(`/staff/inbox?q=${encodeURIComponent(p.name)}`)}
      />
      <ol className="map-rank">
        {ov.by_region.slice(0, 6).map((r, i) => (
          <li key={r.name} style={{ animationDelay: `${i * 70}ms` }}>
            <b>{r.name}</b>
            <span className="muted small">
              {reports(t, r.count)}
              {r.escalated ? ` · ${t('{n} escalated', { n: r.escalated })}` : ''}
            </span>
            <span className="map-bar" style={{ width: `${(r.count / ov.by_region[0].count) * 100}%` }} />
          </li>
        ))}
        {!ov.by_region.length && <li className="muted small">{t('No report names a place on this map yet.')}</li>}
      </ol>
    </div>
  )
}

/** Reports per case type, this week against the previous week; click a bar to see those cases. */
export function CategoryChart({ ov, agency }: { ov: Overview; agency: Agency }) {
  const { t, lang } = useLang()
  const router = useRouter()
  const option = useMemo(() => {
    const rows = [...ov.by_category].reverse()
    const name = (id: string, fallback: string) => {
      const c = agency.categories.find((x) => x.id === id)
      return c ? catLabel(c, lang) : fallback
    }
    return {
      grid: { left: 8, right: 36, top: 30, bottom: 8, containLabel: true },
      legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 12 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: COLORS.line } }, minInterval: 1 },
      yAxis: {
        type: 'category',
        data: rows.map((c) => name(c.id, c.label)),
        axisLabel: { width: 170, overflow: 'truncate', fontSize: 12 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: COLORS.line } },
      },
      series: [
        {
          name: t('Last 30 days'),
          type: 'bar',
          data: rows.map((c) => ({ value: c.count, id: c.id })),
          itemStyle: { borderRadius: [0, 6, 6, 0], color: COLORS.brand },
          barMaxWidth: 16,
          label: { show: true, position: 'right', fontSize: 11 },
          emphasis: { focus: 'series' },
          animationDelay: (i: number) => i * 40,
        },
        {
          name: t('This week'),
          type: 'bar',
          data: rows.map((c) => c.this_week),
          itemStyle: { borderRadius: [0, 6, 6, 0], color: '#fbbc04' },
          barMaxWidth: 8,
          emphasis: { focus: 'series' },
          animationDelay: (i: number) => 200 + i * 40,
        },
        {
          name: t('Previous week'),
          type: 'bar',
          data: rows.map((c) => c.prev_week),
          itemStyle: { borderRadius: [0, 6, 6, 0], color: COLORS.low },
          barMaxWidth: 8,
          emphasis: { focus: 'series' },
          animationDelay: (i: number) => 300 + i * 40,
        },
      ],
    }
  }, [ov, agency, lang, t])
  return (
    <Chart
      option={option}
      height={Math.max(220, ov.by_category.length * 34 + 50)}
      label={t('Reports by category')}
      onClick={(p) => {
        const id = (p.data as { id?: string } | undefined)?.id
        if (id) router.push(`/staff/inbox?category=${id}`)
      }}
    />
  )
}

/** Reports per day, stacked by urgency, with a slider to zoom into a period. */
export function DailyChart({ ov }: { ov: Overview }) {
  const { t, lang } = useLang()
  const option = useMemo(() => {
    const days = ov.daily_urgency
    const fmt = (d: string) =>
      new Date(`${d}T00:00:00`).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', {
        day: 'numeric',
        month: 'short',
      })
    return {
      grid: { left: 8, right: 8, top: 34, bottom: 44, containLabel: true },
      legend: { top: 0, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 12 } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      dataZoom: [
        { type: 'inside' },
        { type: 'slider', height: 18, bottom: 6, borderColor: COLORS.line, fillerColor: 'rgba(11,87,208,.12)' },
      ],
      xAxis: {
        type: 'category',
        data: days.map((d) => fmt(d.date)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: COLORS.line } },
      },
      yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: COLORS.line } } },
      series: URG.map((u, k) => ({
        name: t(URGENCY_LABEL[u]),
        type: 'bar',
        stack: 'u',
        data: days.map((d) => d[u]),
        itemStyle: { color: URG_COLOR[u], borderRadius: k === 0 ? 0 : 0 },
        emphasis: { focus: 'series' },
        animationDelay: (i: number) => i * 25 + k * 80,
      })),
    }
  }, [ov, lang, t])
  return <Chart option={option} height={280} label={t('Daily volume')} />
}

/** A donut with the total in the middle. */
export function Donut({
  data,
  label,
  onClick,
}: {
  data: { name: string; value: number; color?: string; key?: string }[]
  label: string
  onClick?: (key: string) => void
}) {
  const { t } = useLang()
  const total = data.reduce((a, b) => a + b.value, 0)
  const option = useMemo(
    () => ({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: {
        orient: 'vertical',
        right: 0,
        top: 'middle',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { fontSize: 12 },
      },
      series: [
        {
          type: 'pie',
          radius: ['52%', '78%'],
          center: ['34%', '50%'],
          avoidLabelOverlap: true,
          padAngle: 2,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: {
            show: true,
            position: 'center',
            formatter: () => `{n|${total}}\n{l|${t('reports')}}`,
            rich: { n: { fontSize: 26, fontWeight: 500, color: COLORS.ink }, l: { fontSize: 12, color: COLORS.ink2 } },
          },
          emphasis: { scale: true, scaleSize: 8 },
          labelLine: { show: false },
          animationType: 'scale',
          animationEasing: 'elasticOut',
          data: data.map((d) => ({ ...d, itemStyle: d.color ? { color: d.color } : undefined })),
        },
      ],
    }),
    [data, total, t],
  )
  return (
    <Chart
      option={option}
      height={220}
      label={label}
      onClick={(p) => {
        const key = (p.data as { key?: string } | undefined)?.key
        if (key) onClick?.(key)
      }}
    />
  )
}

export function UrgencyDonut({ ov }: { ov: Overview }) {
  const { t } = useLang()
  const router = useRouter()
  const data = URG.map((u) => ({
    name: t(URGENCY_LABEL[u]),
    value: ov.by_urgency[u] ?? 0,
    color: URG_COLOR[u],
    key: u,
  }))
  return <Donut data={data} label={t('By urgency')} onClick={(u) => router.push(`/staff/inbox?urgency=${u}`)} />
}

export function ChannelDonut({ ov }: { ov: Overview }) {
  const { t } = useLang()
  const data = Object.entries(ov.by_channel)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => ({ name: t(CHANNEL_LABEL[c] ?? c), value: n }))
  return <Donut data={data} label={t('By channel')} />
}
