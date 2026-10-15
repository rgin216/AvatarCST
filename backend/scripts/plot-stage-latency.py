"""Export a report chart from measured deployed pipeline timings."""
import csv
import json
import argparse
import math
from datetime import datetime
from pathlib import Path
from statistics import mean

from reportlab.graphics.shapes import Drawing, String, Rect, Line
from reportlab.graphics.charts.barcharts import HorizontalBarChart
from reportlab.graphics import renderPDF, renderSVG
from reportlab.lib.colors import HexColor
import pypdfium2 as pdfium

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--report', required=True, type=Path, help='Deployed-summary.json to plot')
parser.add_argument('--out', required=True, type=Path, help='Directory for chart and CSV exports')
args = parser.parse_args()
out = args.out.resolve()
data = json.loads(args.report.read_text(encoding='utf-8'))
rows = [r for r in data['rows'] if r['phase'] == 'measurement' and r['status'] == 'ok']
if not rows:
    parser.error('Report has no successful measured trials')
out.mkdir(parents=True, exist_ok=True)
avatars = ' + '.join(sorted({r['avatarMode'] for r in rows}))
date = datetime.fromisoformat(data['startedAt'].replace('Z', '+00:00')).strftime('%d %B %Y UTC')
specs = [
    ('Speech recognition (STT)', 'sttMs'),
    ('Orchestration (includes LLM)', 'orchestratorMs'),
    ('Audio preparation — wall time', 'audioMs'),
    ('Speech synthesis (TTS)*', 'ttsMs'),
    ('Lip-sync generation (Rhubarb)*', 'rhubarbMs'),
    ('Total API completion — client', 'requestMs'),
]
samples = []
for label, key in specs:
    values = [r.get('serverTimings', {}).get(key) if key != 'requestMs' else r[key] for r in rows]
    values = [v for v in values if type(v) in (int, float) and math.isfinite(v)]
    if values:
        samples.append(dict(stage=label, timing=key, n=len(values), mean_seconds=mean(values) / 1000))

with (out / 'average-stage-latency.csv').open('w', newline='', encoding='utf-8') as stream:
    writer = csv.DictWriter(stream, fieldnames=['stage', 'timing', 'n', 'mean_seconds'])
    writer.writeheader()
    writer.writerows(samples)

d = Drawing(900, 540)
ink = HexColor('#172B4D')
muted = HexColor('#53647C')
d.add(Rect(0, 0, 900, 540, fillColor=HexColor('#FFFFFF'), strokeColor=None))
d.add(String(35, 502, 'Average latency by pipeline stage', fontName='Helvetica-Bold', fontSize=23, fillColor=ink))
d.add(String(35, 475, f'Deployed voice/avatar pilot · {len(rows)} successful trials · {avatars} · {date}', fontSize=11, fillColor=muted))

chart = HorizontalBarChart()
chart.x, chart.y, chart.width, chart.height = 290, 145, 505, 290
ordered = list(reversed(samples))
chart.data = [[s['mean_seconds'] for s in ordered]]
chart.categoryAxis.categoryNames = [s['stage'] for s in ordered]
chart.categoryAxis.labels.fontName = 'Helvetica'
chart.categoryAxis.labels.fontSize = 11
chart.categoryAxis.labels.fillColor = ink
chart.categoryAxis.labels.dx = -8
chart.categoryAxis.visibleTicks = False
chart.categoryAxis.visibleAxis = False
chart.valueAxis.valueMin = 0
chart.valueAxis.valueMax = max(1, math.ceil(max(s['mean_seconds'] for s in samples) * 1.2))
chart.valueAxis.valueStep = max(0.2, math.ceil(chart.valueAxis.valueMax / 6))
chart.valueAxis.labels.fontSize = 10
chart.valueAxis.labels.fillColor = muted
chart.valueAxis.visibleGrid = True
chart.valueAxis.gridStrokeColor = HexColor('#E5EAF0')
chart.valueAxis.strokeColor = HexColor('#C9D2DE')
chart.bars[0].fillColor = HexColor('#3478B8')
chart.bars[0].strokeColor = None
chart.barWidth = 22
chart.groupSpacing = 12
chart.barLabelFormat = lambda value: f'{value:.2f} s'
chart.barLabels.fontName = 'Helvetica-Bold'
chart.barLabels.fontSize = 11
chart.barLabels.fillColor = ink
chart.barLabels.nudge = 7
chart.barLabels.boxAnchor = 'w'
d.add(chart)

step = chart.height / len(ordered)
for i, sample in enumerate(ordered):
    d.add(String(847, chart.y + (i + .5) * step - 4, f"n={sample['n']}", fontSize=10, fillColor=muted))
d.add(String(542, 112, 'Average latency (seconds)', fontSize=11, fillColor=muted, textAnchor='middle'))
d.add(Line(35, 91, 865, 91, strokeColor=HexColor('#E5EAF0')))
notes = [
    '* Recorded service timings overlap with audio preparation; bars are not additive.',
    'Warmups excluded. Cached/prefetched trials retained; missing service timings excluded, not set to zero.',
    'Total is upload-to-API-response completion. Browser playback and visible avatar onset were not measured.',
]
for i, note in enumerate(notes):
    d.add(String(35, 70 - i * 18, note, fontSize=10, fillColor=muted))

pdf_path = out / 'average-stage-latency.pdf'
renderPDF.drawToFile(d, str(pdf_path))
renderSVG.drawToFile(d, str(out / 'average-stage-latency.svg'))
pdf = pdfium.PdfDocument(str(pdf_path))
page = pdf[0]
bitmap = page.render(scale=2)
bitmap.to_pil().save(out / 'average-stage-latency.png')
bitmap.close()
page.close()
pdf.close()
print(json.dumps(samples, indent=2))
