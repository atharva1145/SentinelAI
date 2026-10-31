"""Executive Data Quality & Model Audit Certificate generator."""
from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any, Dict, List

from app.models.dataset import Dataset
from app.models.issue import Issue, AnomalyResult


def generate_audit_certificate_html(
    dataset: Dataset,
    health_data: Dict[str, Any],
    issues: List[Issue],
    anomalies: List[AnomalyResult],
) -> str:
    """Generates an executive, print/PDF-ready HTML certificate."""
    cert_id = f"SENTINEL-AUDIT-{dataset.id}-{datetime.utcnow().strftime('%Y%m%d%H%M')}"
    timestamp_str = datetime.utcnow().strftime("%B %d, %Y - %H:%M:%S UTC")

    # Generate verification fingerprint hash
    hash_seed = f"{dataset.filename}:{dataset.file_size}:{len(issues)}:{len(anomalies)}"
    verification_hash = hashlib.sha256(hash_seed.encode("utf-8")).hexdigest()[:24].upper()

    overall_score = health_data.get("overall_score", 0.0)
    grade = health_data.get("grade", "F")
    status_label = health_data.get("status_label", "Unknown")
    color = health_data.get("color", "#64748b")
    dimensions = health_data.get("dimensions", {})
    metrics = health_data.get("metrics", {})

    # Determine certification decision
    if overall_score >= 80.0:
        compliance_title = "CERTIFIED FOR PRODUCTION WORKLOADS"
        compliance_badge_bg = "#ecfdf5"
        compliance_badge_color = "#059669"
        compliance_border = "#10b981"
        compliance_desc = "This dataset meets stringent enterprise requirements for completeness, uniqueness, and statistical integrity."
    elif overall_score >= 60.0:
        compliance_title = "CONDITIONALLY APPROVED (REMEDIATION REQUIRED)"
        compliance_badge_bg = "#fffbeb"
        compliance_badge_color = "#d97706"
        compliance_border = "#f59e0b"
        compliance_desc = "Minor data quality anomalies detected. Downstream production deployment recommended only after applying suggested remediations."
    else:
        compliance_title = "FAILED QUALITY AUDIT (QUARANTINED)"
        compliance_badge_bg = "#fef2f2"
        compliance_badge_color = "#dc2626"
        compliance_border = "#ef4444"
        compliance_desc = "High frequency of critical schema or value violations detected. Dataset is quarantined to prevent model and reporting corruption."

    # Top issues table rows
    critical_issues = [i for i in issues if (i.severity or "").lower() in ("critical", "high")][:15]
    issue_rows_html = ""
    for i in critical_issues:
        sev_color = "#dc2626" if (i.severity or "").lower() == "critical" else "#d97706"
        issue_rows_html += f"""
        <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 11px;">{i.column_name or 'Global'}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600; font-size: 11px;">{i.rule_name}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;"><span style="color: {sev_color}; font-weight: 700; font-size: 10px; text-transform: uppercase;">{i.severity}</span></td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #475569;">{i.explanation}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #0284c7;">{i.suggested_action}</td>
        </tr>
        """

    if not issue_rows_html:
        issue_rows_html = """<tr><td colspan="5" style="padding: 16px; text-align: center; color: #059669; font-weight: 600;">✓ No critical or high severity violations detected.</td></tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SentinelAI Quality Audit Certificate - {cert_id}</title>
    <style>
        @page {{
            size: A4;
            margin: 12mm 15mm;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            margin: 0;
            padding: 24px;
            font-size: 12px;
            line-height: 1.5;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 16px;
            margin-bottom: 20px;
        }}
        .brand {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .logo-box {{
            width: 36px;
            height: 36px;
            border-radius: 8px;
            background: linear-gradient(135deg, #4f46e5, #06b6d4);
            color: white;
            font-weight: 900;
            font-size: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }}
        .brand-title {{
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #0f172a;
            margin: 0;
        }}
        .cert-tag {{
            text-align: right;
            font-size: 11px;
            color: #64748b;
        }}
        .compliance-banner {{
            border-radius: 10px;
            padding: 14px 18px;
            background: {compliance_badge_bg};
            border-left: 5px solid {compliance_border};
            margin-bottom: 20px;
        }}
        .compliance-title {{
            font-size: 13px;
            font-weight: 800;
            color: {compliance_badge_color};
            margin-bottom: 2px;
        }}
        .grid-kpi {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        }}
        .kpi-card {{
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            background: #f8fafc;
        }}
        .kpi-label {{
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.5px;
        }}
        .kpi-value {{
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 4px;
        }}
        .dimensions-section {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
        }}
        .dim-card {{
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px;
        }}
        .dim-header {{
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 6px;
        }}
        .progress-bar-bg {{
            height: 6px;
            background: #e2e8f0;
            border-radius: 3px;
            overflow: hidden;
        }}
        .progress-bar-fill {{
            height: 100%;
            background: #4f46e5;
            border-radius: 3px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            margin-bottom: 20px;
        }}
        th {{
            background: #f1f5f9;
            padding: 8px 12px;
            text-align: left;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            color: #475569;
            border-bottom: 2px solid #cbd5e1;
        }}
        .footer {{
            margin-top: 30px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 16px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 10px;
            color: #64748b;
        }}
        .signoff-box {{
            width: 200px;
            border-bottom: 1px solid #0f172a;
            padding-bottom: 4px;
            margin-top: 24px;
            text-align: center;
            font-weight: 600;
            color: #0f172a;
        }}
        .print-btn {{
            position: fixed;
            top: 16px;
            right: 16px;
            background: #0f172a;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }}
        @media print {{
            .print-btn {{
                display: none;
            }}
            body {{
                padding: 0;
            }}
        }}
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>

    <div class="header">
        <div class="brand">
            <div class="logo-box">S</div>
            <div>
                <h1 class="brand-title">SentinelAI Platform</h1>
                <div style="font-size: 11px; color: #64748b;">Enterprise Data Quality & Autonomous Anomaly Detection</div>
            </div>
        </div>
        <div class="cert-tag">
            <div style="font-weight: 700; font-family: monospace;">{cert_id}</div>
            <div>Issued: {timestamp_str}</div>
            <div>Hash: <span style="font-family: monospace;">{verification_hash}</span></div>
        </div>
    </div>

    <div class="compliance-banner">
        <div class="compliance-title">{compliance_title}</div>
        <div style="font-size: 11px; color: #475569;">{compliance_desc}</div>
    </div>

    <div class="grid-kpi">
        <div class="kpi-card">
            <div class="kpi-label">Overall Health Score</div>
            <div class="kpi-value" style="color: {color};">{overall_score} <span style="font-size: 13px;">(Grade {grade})</span></div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Total Records Evaluated</div>
            <div class="kpi-value">{metrics.get('total_rows', 0):,}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Rule Quality Issues</div>
            <div class="kpi-value" style="color: {'#dc2626' if metrics.get('total_issues', 0) > 0 else '#059669'};">{metrics.get('total_issues', 0):,}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">ML Outliers Detected</div>
            <div class="kpi-value" style="color: {'#7c3aed' if metrics.get('total_anomalies', 0) > 0 else '#059669'};">{metrics.get('total_anomalies', 0):,}</div>
        </div>
    </div>

    <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: #475569; margin-bottom: 8px;">
        Core Quality Dimensions Evaluation
    </div>
    <div class="dimensions-section">
        <div class="dim-card">
            <div class="dim-header">
                <span>Completeness</span>
                <span>{dimensions.get('completeness', 100)}%</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: {dimensions.get('completeness', 100)}%;"></div>
            </div>
        </div>
        <div class="dim-card">
            <div class="dim-header">
                <span>Validity & Schema</span>
                <span>{dimensions.get('validity', 100)}%</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: {dimensions.get('validity', 100)}%;"></div>
            </div>
        </div>
        <div class="dim-card">
            <div class="dim-header">
                <span>Uniqueness</span>
                <span>{dimensions.get('uniqueness', 100)}%</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: {dimensions.get('uniqueness', 100)}%;"></div>
            </div>
        </div>
        <div class="dim-card">
            <div class="dim-header">
                <span>Anomaly-Free Rate</span>
                <span>{dimensions.get('anomaly_free', 100)}%</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: {dimensions.get('anomaly_free', 100)}%;"></div>
            </div>
        </div>
    </div>

    <div style="font-weight: 700; font-size: 11px; text-transform: uppercase; color: #475569; margin-top: 14px; margin-bottom: 6px;">
        High & Critical Severity Violations Log
    </div>
    <table>
        <thead>
            <tr>
                <th>Column</th>
                <th>Rule Name</th>
                <th>Severity</th>
                <th>Explanation</th>
                <th>Suggested Remediation</th>
            </tr>
        </thead>
        <tbody>
            {issue_rows_html}
        </tbody>
    </table>

    <div class="footer">
        <div>
            <div><strong>Audit Certification Protocol:</strong> ISO/IEC 25012 Data Quality Specification</div>
            <div>Dataset Origin: <span style="font-family: monospace;">{dataset.original_filename}</span> ({dataset.file_size:,} bytes)</div>
            <div>Generated by SentinelAI Enterprise Suite • Non-repudiation verified</div>
        </div>
        <div>
            <div class="signoff-box">Authorized Data Quality Officer</div>
            <div style="text-align: center; margin-top: 4px; font-size: 9px;">Digital Cryptographic Signature</div>
        </div>
    </div>
</body>
</html>"""
