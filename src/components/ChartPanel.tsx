import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef, useState } from 'react';

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export interface KeyboardItem {
  id: string;
  label: string;
}

interface ChartPanelProps {
  title: string;
  description: string;
  option: echarts.EChartsCoreOption;
  keyboardItems?: KeyboardItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function ChartPanel({
  title,
  description,
  option,
  keyboardItems = [],
  selectedId = null,
  onSelect,
}: ChartPanelProps) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [keyboardIndex, setKeyboardIndex] = useState(0);

  useEffect(() => {
    if (!container.current) return;
    const instance = echarts.init(container.current, undefined, { renderer: 'canvas' });
    chart.current = instance;
    instance.setOption({
      animationDuration: 180,
      aria: { enabled: true, decal: { show: true } },
      textStyle: { fontFamily: 'Inter, Segoe UI, system-ui, sans-serif' },
      ...option,
    });
    instance.on('click', (event) => {
      const datum = event.data as { id?: unknown } | undefined;
      if (typeof datum?.id === 'string') onSelect?.(datum.id);
    });
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, [onSelect, option]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!keyboardItems.length || !onSelect) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (keyboardIndex + 1) % keyboardItems.length;
      setKeyboardIndex(next);
      onSelect(keyboardItems[next]!.id);
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = (keyboardIndex - 1 + keyboardItems.length) % keyboardItems.length;
      setKeyboardIndex(next);
      onSelect(keyboardItems[next]!.id);
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(keyboardItems[keyboardIndex]!.id);
    }
  }

  return (
    <section className="panel chart-panel" aria-labelledby={`${title.replaceAll(' ', '-')}-title`}>
      <div className="panel-heading">
        <div>
          <h2 id={`${title.replaceAll(' ', '-')}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        {selectedId && <span className="selection-chip">Selected: {selectedId}</span>}
      </div>
      <div
        ref={container}
        className="chart"
        role="img"
        tabIndex={keyboardItems.length ? 0 : -1}
        aria-label={`${title}. ${description}${keyboardItems.length ? ' Use arrow keys to move through selectable values and Enter to select.' : ''}`}
        onKeyDown={handleKeyDown}
      />
    </section>
  );
}
