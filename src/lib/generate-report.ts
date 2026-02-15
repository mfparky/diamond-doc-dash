import { Outing, getDaysRestNeeded } from '@/types/pitcher';
import { BadgeResult } from '@/types/badges';

interface ReportData {
  pitcherName: string;
  outings: Outing[];
  badges: BadgeResult[];
  sevenDayPulse: number;
  maxVelo: number;
  strikePercentage: number;
  lastOuting: string;
}

function getGrade(pct: number): { grade: string; color: string } {
  if (pct >= 90) return { grade: 'A+', color: '#22c55e' };
  if (pct >= 80) return { grade: 'A', color: '#22c55e' };
  if (pct >= 70) return { grade: 'B+', color: '#4ade80' };
  if (pct >= 60) return { grade: 'B', color: '#f59e0b' };
  if (pct >= 50) return { grade: 'C+', color: '#f59e0b' };
  if (pct >= 40) return { grade: 'C', color: '#f97316' };
  return { grade: 'D', color: '#ef4444' };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-').map(Number);
  const date = parts.length === 3 && parts.every((n) => Number.isFinite(n))
    ? new Date(parts[0], parts[1] - 1, parts[2])
    : new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function generateReport(data: ReportData): void {
  const { pitcherName, outings, badges, sevenDayPulse, maxVelo, strikePercentage, lastOuting } = data;

  const seasonOutings = outings
    .filter((o) => new Date(o.date).getFullYear() === 2026)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalPitches = outings.reduce((sum, o) => sum + o.pitchCount, 0);
  const earnedBadges = badges.filter((b) => b.earned);

  // Calculate grades
  const withStrikes = seasonOutings.filter((o) => o.strikes !== null);
  const totalPitchesWithStrikes = withStrikes.reduce((s, o) => s + o.pitchCount, 0);
  const totalStrikes = withStrikes.reduce((s, o) => s + (o.strikes ?? 0), 0);
  const strikePct = totalPitchesWithStrikes > 0 ? (totalStrikes / totalPitchesWithStrikes) * 100 : 0;
  const accuracyScore = Math.min(100, (strikePct / 65) * 90);
  const accuracyGrade = getGrade(accuracyScore);

  const strikePcts = withStrikes
    .filter((o) => o.pitchCount > 0)
    .map((o) => ((o.strikes ?? 0) / o.pitchCount) * 100);
  let consistencyScore = 0;
  if (strikePcts.length >= 2) {
    const diffs: number[] = [];
    for (let i = 1; i < strikePcts.length; i++) {
      diffs.push(Math.abs(strikePcts[i] - strikePcts[i - 1]));
    }
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    consistencyScore = Math.max(0, Math.min(100, (1 - avgDiff / 20) * 100));
  }
  const consistencyGrade = getGrade(consistencyScore);

  let workEthicScore = 0;
  if (seasonOutings.length > 0) {
    const firstDate = new Date(seasonOutings[0].date);
    const lastDate = new Date(seasonOutings[seasonOutings.length - 1].date);
    const weeks = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const outingsPerWeek = seasonOutings.length / weeks;
    workEthicScore = Math.min(100, (outingsPerWeek / 3) * 100);
  }
  const workEthicGrade = getGrade(workEthicScore);

  const badgeScore = badges.length > 0 ? (earnedBadges.length / badges.length) * 100 : 0;
  const badgeGrade = getGrade(badgeScore);

  const gradeValues: Record<string, number> = {
    'A+': 97, A: 93, 'B+': 87, B: 83, 'C+': 77, C: 73, D: 65,
  };
  const allGrades = [accuracyGrade, consistencyGrade, workEthicGrade, badgeGrade];
  const avgGradeVal = allGrades.reduce((sum, g) => sum + (gradeValues[g.grade] || 70), 0) / allGrades.length;
  const overallGrade = getGrade(avgGradeVal);

  const sortedOutings = [...outings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recentOutings = sortedOutings.slice(0, 10);

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${pitcherName} - Season Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; background: #fff; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 32px; border-bottom: 3px solid #1a1a2e; padding-bottom: 16px; }
    .header h1 { font-size: 28px; font-weight: 800; }
    .header p { color: #666; font-size: 14px; margin-top: 4px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 18px; font-weight: 700; margin-bottom: 12px; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat-box { border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; text-align: center; }
    .stat-box .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-box .value { font-size: 24px; font-weight: 700; margin-top: 4px; }
    .grade-section { display: flex; align-items: flex-start; gap: 24px; }
    .overall-circle { width: 80px; height: 80px; border-radius: 50%; border: 3px solid; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; flex-shrink: 0; }
    .grades-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; }
    .grade-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 6px; background: #f8f8f8; }
    .grade-letter { font-size: 20px; font-weight: 800; width: 36px; text-align: center; }
    .grade-label { font-size: 13px; font-weight: 600; }
    .grade-detail { font-size: 11px; color: #888; }
    .badge-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .badge-item { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 4px 10px; font-size: 12px; }
    .badge-item.unearned { background: #f5f5f5; border-color: #e5e5e5; color: #aaa; }
    .outing-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .outing-table th { background: #f5f5f5; text-align: left; padding: 8px 10px; font-weight: 600; border-bottom: 2px solid #ddd; }
    .outing-table td { padding: 8px 10px; border-bottom: 1px solid #eee; }
    .outing-table tr:nth-child(even) { background: #fafafa; }
    .footer { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; color: #999; font-size: 11px; }
    @media print { body { padding: 20px; } @page { margin: 0.5in; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${pitcherName}</h1>
    <p>Season Report &middot; Generated ${today}</p>
  </div>

  <div class="stats-grid">
    <div class="stat-box">
      <div class="label">7-Day Pulse</div>
      <div class="value">${sevenDayPulse}</div>
    </div>
    <div class="stat-box">
      <div class="label">Total Pitches</div>
      <div class="value">${totalPitches}</div>
    </div>
    <div class="stat-box">
      <div class="label">Strike %</div>
      <div class="value">${strikePercentage.toFixed(1)}%</div>
    </div>
    <div class="stat-box">
      <div class="label">Max Velo</div>
      <div class="value">${maxVelo || '-'}</div>
    </div>
  </div>

  ${seasonOutings.length >= 2 ? `
  <div class="section">
    <div class="section-title">Season Report Card</div>
    <div class="grade-section">
      <div>
        <div class="overall-circle" style="border-color: ${overallGrade.color}; color: ${overallGrade.color};">
          ${overallGrade.grade}
        </div>
        <div style="text-align: center; font-size: 10px; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Overall</div>
      </div>
      <div class="grades-grid">
        <div class="grade-item">
          <span class="grade-letter" style="color: ${accuracyGrade.color}">${accuracyGrade.grade}</span>
          <div>
            <div class="grade-label">Accuracy</div>
            <div class="grade-detail">${strikePct.toFixed(0)}% strikes</div>
          </div>
        </div>
        <div class="grade-item">
          <span class="grade-letter" style="color: ${consistencyGrade.color}">${consistencyGrade.grade}</span>
          <div>
            <div class="grade-label">Consistency</div>
            <div class="grade-detail">${consistencyScore.toFixed(0)}% stable</div>
          </div>
        </div>
        <div class="grade-item">
          <span class="grade-letter" style="color: ${workEthicGrade.color}">${workEthicGrade.grade}</span>
          <div>
            <div class="grade-label">Work Ethic</div>
            <div class="grade-detail">${(seasonOutings.length / Math.max(1, (new Date(seasonOutings[seasonOutings.length - 1].date).getTime() - new Date(seasonOutings[0].date).getTime()) / (7 * 24 * 60 * 60 * 1000))).toFixed(1)}/week</div>
          </div>
        </div>
        <div class="grade-item">
          <span class="grade-letter" style="color: ${badgeGrade.color}">${badgeGrade.grade}</span>
          <div>
            <div class="grade-label">Achievements</div>
            <div class="grade-detail">${earnedBadges.length}/${badges.length} earned</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Achievements (${earnedBadges.length}/${badges.length})</div>
    <div class="badge-list">
      ${badges.map((b) => `<span class="badge-item${b.earned ? '' : ' unearned'}">${b.earned ? '&#9733; ' : ''}${b.name}</span>`).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Recent Outings</div>
    <table class="outing-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Pitches</th>
          <th>Strikes</th>
          <th>Strike %</th>
          <th>Max Velo</th>
          <th>Rest</th>
        </tr>
      </thead>
      <tbody>
        ${recentOutings.map((o) => `
        <tr>
          <td>${formatDate(o.date)}</td>
          <td>${o.eventType}</td>
          <td>${o.pitchCount}</td>
          <td>${o.strikes !== null ? o.strikes : '-'}</td>
          <td>${o.strikes !== null && o.pitchCount > 0 ? ((o.strikes / o.pitchCount) * 100).toFixed(0) + '%' : '-'}</td>
          <td>${o.maxVelo || '-'}</td>
          <td>${getDaysRestNeeded(o.pitchCount)}d</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>Diamond Doc Dash &middot; ${pitcherName} &middot; Last outing: ${formatDate(lastOuting)}</p>
  </div>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
